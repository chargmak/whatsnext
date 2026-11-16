// send-release-reminders
//
// Daily job (invoked by a scheduled cron) that finds "Notify Me" reminders whose
// release date has arrived (today or tomorrow) and haven't been notified yet,
// then delivers a Web Push notification to every device the reminder's owner has
// subscribed. Each reminder is stamped `notified_at` so it fires only once.
//
// It also serves "Notify me when it's streaming" reminders (kind = 'streaming'):
// those have no date, so each run asks TMDB which subscription services carry
// the title in the owner's country and fires the first time there is one.
//
// Auth: if CRON_SECRET is set, the caller must send `Authorization: Bearer <CRON_SECRET>`.
// Env (set with `supabase secrets set`): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
// VAPID_SUBJECT, CRON_SECRET. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are
// injected automatically.

import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { daysUntilInZone, zoneForUser } from '../_shared/air-time.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:notifications@whatsnext.app';
const CRON_SECRET = Deno.env.get('CRON_SECRET');
const TMDB_API_KEY = Deno.env.get('TMDB_API_KEY');

// The next episode's air date for a show, or null when TMDB has none / is
// unreachable.
const nextEpisodeDate = async (tvId: number): Promise<string | null> => {
    if (!TMDB_API_KEY) return null;
    const qs = new URLSearchParams({ api_key: TMDB_API_KEY, language: 'en-US' });
    try {
        const res = await fetch(`https://api.themoviedb.org/3/tv/${tvId}?${qs}`);
        if (!res.ok) return null;
        const show = await res.json();
        return show?.next_episode_to_air?.air_date ?? null;
    } catch {
        return null;
    }
};

// Subscription ("flatrate") services carrying a title, per country code. Null
// when TMDB can't be asked — which must read as "don't know", never as "none".
type ProvidersByCountry = Record<string, { flatrate?: { provider_name: string }[] }>;
const streamingProviders = async (
    mediaType: string,
    id: number,
): Promise<ProvidersByCountry | null> => {
    if (!TMDB_API_KEY) return null;
    const qs = new URLSearchParams({ api_key: TMDB_API_KEY });
    const kind = mediaType === 'tv' ? 'tv' : 'movie';
    try {
        const res = await fetch(`https://api.themoviedb.org/3/${kind}/${id}/watch/providers?${qs}`);
        if (!res.ok) return null;
        const data = await res.json();
        return (data?.results ?? {}) as ProvidersByCountry;
    } catch {
        return null;
    }
};

const streamingCopy = (title: string, names: string[]) => {
    const where = names.length === 1
        ? names[0]
        : names.length === 2
            ? `${names[0]} and ${names[1]}`
            : `${names[0]} and ${names.length - 1} more`;
    return { title, body: `${title} is now streaming on ${where}.` };
};

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });

const releaseCopy = (title: string, days: number) => {
    if (days <= 0) return { title, body: `${title} is out now — tap to see where to watch.` };
    if (days === 1) return { title, body: `${title} releases tomorrow.` };
    return { title, body: `${title} releases in ${days} days.` };
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'authorization, content-type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
            },
        });
    }

    if (CRON_SECRET && req.headers.get('Authorization') !== `Bearer ${CRON_SECRET}`) {
        return json({ error: 'Unauthorized' }, 401);
    }

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
        return json({ error: 'Server missing Supabase configuration.' }, 500);
    }
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
        return json({ error: 'Server missing VAPID keys.' }, 500);
    }

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Candidates are pulled two days out in UTC terms, then filtered per user
    // against *their* calendar: a viewer in Auckland or Honolulu is up to a day
    // off UTC, so "releases tomorrow" has to be decided in their own zone or the
    // alert lands on the wrong day. Anything still too far out is left alone and
    // picked up by a later run.
    const now = new Date();
    const todayMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const horizon = new Date(todayMs + 2 * 86_400_000).toISOString().slice(0, 10);

    const { data: releaseRows, error } = await supabase
        .from('reminders')
        .select('id, user_id, movie_id, media_type, title, release_date, created_at')
        .eq('kind', 'release')
        .is('notified_at', null)
        .not('release_date', 'is', null)
        .lte('release_date', horizon);

    if (error) return json({ error: error.message }, 500);

    // Streaming reminders carry no date — every pending one is checked each run.
    const { data: streamingRows, error: streamingErr } = await supabase
        .from('reminders')
        .select('id, user_id, movie_id, media_type, title')
        .eq('kind', 'streaming')
        .is('notified_at', null);

    if (streamingErr) return json({ error: streamingErr.message }, 500);

    const reminders = releaseRows ?? [];
    const streamingReminders = streamingRows ?? [];
    if (reminders.length === 0 && streamingReminders.length === 0) {
        return json({ ok: true, candidates: 0, sent: 0, failed: 0, notified: 0 });
    }

    let sent = 0;
    let failed = 0;
    let notYet = 0;
    let stale = 0;
    const notifiedIds: number[] = [];
    const nextDateByShow = new Map<number, Promise<string | null>>();

    // Each owner's zone — their pinned setting, else the country on their
    // profile — and that country, which decides what "streaming" means for them.
    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, country, timezone')
        .in('id', [...new Set([...reminders, ...streamingReminders].map((r) => r.user_id))]);
    const zoneByUser = new Map<string, string>(
        (profiles ?? []).map((p) => [p.id as string, zoneForUser(p.timezone, p.country)]),
    );
    const countryByUser = new Map<string, string>(
        (profiles ?? []).map((p) => [p.id as string, String(p.country || 'US').toUpperCase()]),
    );

    type Sub = { endpoint: string; p256dh: string; auth: string };
    const subsByUser = new Map<string, Promise<Sub[]>>();
    const subsFor = (userId: string): Promise<Sub[]> => {
        let pending = subsByUser.get(userId);
        if (!pending) {
            pending = (async () => {
                const { data, error: subErr } = await supabase
                    .from('push_subscriptions')
                    .select('endpoint, p256dh, auth')
                    .eq('user_id', userId);
                return subErr || !data ? [] : (data as Sub[]);
            })();
            subsByUser.set(userId, pending);
        }
        return pending;
    };

    // Push one payload to every device; true when at least one received it.
    const deliver = async (subs: Sub[], payload: string, reminderId: number) => {
        let delivered = false;
        for (const sub of subs) {
            try {
                await webpush.sendNotification(
                    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                    payload
                );
                sent += 1;
                delivered = true;
            } catch (err) {
                failed += 1;
                const statusCode = (err as { statusCode?: number }).statusCode;
                // Endpoint gone for good — drop the dead subscription.
                if (statusCode === 404 || statusCode === 410) {
                    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
                } else {
                    console.error(`push failed for reminder ${reminderId}:`, statusCode, String(err));
                }
            }
        }
        return delivered;
    };

    for (const reminder of reminders) {
        const subs = await subsFor(reminder.user_id);
        if (subs.length === 0) continue;

        // A reminder is only ever set on something still to come, so a date
        // that was already past when it was created is wrong — for a series it
        // used to be the premiere date (years ago) rather than the next episode.
        // Announcing that as "out now" is exactly the false alert to avoid.
        // Re-read a series' next episode from TMDB and move the reminder onto it.
        let releaseDate: string = reminder.release_date;
        const createdDay = String(reminder.created_at ?? '').slice(0, 10);
        if (createdDay && releaseDate < createdDay) {
            const next = reminder.media_type === 'tv'
                ? await (nextDateByShow.get(reminder.movie_id)
                    ?? nextDateByShow.set(reminder.movie_id, nextEpisodeDate(reminder.movie_id))
                        .get(reminder.movie_id))
                : null;
            if (!next || next < createdDay) {
                // Nothing upcoming to point it at; leave it pending, unsent.
                stale += 1;
                continue;
            }
            releaseDate = next;
            await supabase.from('reminders').update({ release_date: next }).eq('id', reminder.id);
        }

        const zone = zoneByUser.get(reminder.user_id) ?? 'UTC';
        const days = daysUntilInZone(releaseDate, zone, now);
        // Still more than a day away where they are — not this run's business.
        if (days === null || days > 1) {
            notYet += 1;
            continue;
        }
        const copy = releaseCopy(reminder.title, days);
        const payload = JSON.stringify({
            title: copy.title,
            body: copy.body,
            url: `/${reminder.media_type}/${reminder.movie_id}`,
            tag: `reminder-${reminder.id}`,
            icon: '/icon-192.png',
        });

        // Mark notified as long as at least one device received it.
        if (await deliver(subs, payload, reminder.id)) notifiedIds.push(reminder.id);
    }

    // --- "Notify me when it's streaming" ---
    //
    // Availability is per country, and only the owner's own country counts: a
    // film reaching a US service says nothing about when it reaches Greece, so
    // there is deliberately no fallback to another country's listing.
    let notStreaming = 0;
    const providersByTitle = new Map<string, Promise<ProvidersByCountry | null>>();
    for (const reminder of streamingReminders) {
        const subs = await subsFor(reminder.user_id);
        if (subs.length === 0) continue;

        const key = `${reminder.media_type}-${reminder.movie_id}`;
        let lookup = providersByTitle.get(key);
        if (!lookup) {
            lookup = streamingProviders(reminder.media_type, reminder.movie_id);
            providersByTitle.set(key, lookup);
        }
        const country = countryByUser.get(reminder.user_id) ?? 'US';
        const names = [...new Set(
            ((await lookup)?.[country]?.flatrate ?? []).map((p) => p.provider_name).filter(Boolean),
        )];
        if (names.length === 0) {
            notStreaming += 1;
            continue;
        }

        const copy = streamingCopy(reminder.title, names);
        const payload = JSON.stringify({
            title: copy.title,
            body: copy.body,
            url: `/${reminder.media_type}/${reminder.movie_id}`,
            tag: `reminder-${reminder.id}`,
            icon: '/icon-192.png',
        });

        if (await deliver(subs, payload, reminder.id)) notifiedIds.push(reminder.id);
    }

    if (notifiedIds.length > 0) {
        const { error: updateErr } = await supabase
            .from('reminders')
            .update({ notified_at: new Date().toISOString() })
            .in('id', notifiedIds);
        if (updateErr) console.error('failed to mark reminders notified:', updateErr.message);
    }

    return json({
        ok: true,
        candidates: reminders.length,
        streamingCandidates: streamingReminders.length,
        notYet,
        notStreaming,
        stale,
        sent,
        failed,
        notified: notifiedIds.length,
    });
});
