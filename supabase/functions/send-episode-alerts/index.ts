// send-episode-alerts
//
// Daily job (invoked by a scheduled cron) that alerts users when a new episode
// of a TV show *in their watchlist* airs today. For every distinct TV show a
// push-subscribed user has watchlisted, it asks TMDB for `next_episode_to_air`
// and, if that episode's air date is today (UTC), delivers a Web Push to each of
// the user's devices. Each (user, show, season, episode) is recorded in
// `episode_notifications` so it fires only once.
//
// Auth: shares CRON_SECRET with send-release-reminders — the caller must send
// `Authorization: Bearer <CRON_SECRET>` when that secret is set.
// Env (set with `supabase secrets set`): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
// VAPID_SUBJECT, CRON_SECRET, TMDB_API_KEY. SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:notifications@whatsnext.app';
const CRON_SECRET = Deno.env.get('CRON_SECRET');
const TMDB_API_KEY = Deno.env.get('TMDB_API_KEY');

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });

// Today at UTC as YYYY-MM-DD, to compare against TMDB's date-only air_date.
const todayUTC = () => new Date().toISOString().slice(0, 10);

const episodeCopy = (season: number, episode: number, name?: string) => {
    const label = `S${season}E${episode}`;
    return name
        ? `New episode — ${label}: “${name}” is out now.`
        : `New episode ${label} is out now.`;
};

interface NextEpisode {
    air_date?: string;
    season_number?: number;
    episode_number?: number;
    name?: string;
}

const tmdbTv = async (id: number): Promise<{ name?: string; next_episode_to_air?: NextEpisode } | null> => {
    const qs = new URLSearchParams({ api_key: TMDB_API_KEY ?? '', language: 'en-US' });
    const res = await fetch(`https://api.themoviedb.org/3/tv/${id}?${qs}`);
    if (!res.ok) return null;
    return res.json();
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
    if (!TMDB_API_KEY) {
        return json({ error: 'Server missing TMDB_API_KEY.' }, 500);
    }

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const today = todayUTC();

    // Devices to push to, grouped by user. No subscriptions → nothing to do.
    const { data: subs, error: subErr } = await supabase
        .from('push_subscriptions')
        .select('user_id, endpoint, p256dh, auth');
    if (subErr) return json({ error: subErr.message }, 500);
    if (!subs || subs.length === 0) {
        return json({ ok: true, shows: 0, airingToday: 0, sent: 0, failed: 0, notified: 0 });
    }

    const subsByUser = new Map<string, { endpoint: string; p256dh: string; auth: string }[]>();
    for (const s of subs) {
        const list = subsByUser.get(s.user_id) ?? [];
        list.push({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth });
        subsByUser.set(s.user_id, list);
    }
    const subscribedUserIds = [...subsByUser.keys()];

    // TV shows those users have in their watchlist.
    const { data: rows, error: wlErr } = await supabase
        .from('watchlists')
        .select('user_id, movie_id, title')
        .eq('media_type', 'tv')
        .in('user_id', subscribedUserIds);
    if (wlErr) return json({ error: wlErr.message }, 500);
    if (!rows || rows.length === 0) {
        return json({ ok: true, shows: 0, airingToday: 0, sent: 0, failed: 0, notified: 0 });
    }

    // tv_id -> watchers (deduped per user, since TMDB is fetched once per show).
    const watchersByShow = new Map<number, Map<string, string>>();
    for (const r of rows) {
        const watchers = watchersByShow.get(r.movie_id) ?? new Map<string, string>();
        watchers.set(r.user_id, r.title);
        watchersByShow.set(r.movie_id, watchers);
    }

    let sent = 0;
    let failed = 0;
    let notified = 0;
    let airingToday = 0;

    for (const [tvId, watchers] of watchersByShow) {
        const tv = await tmdbTv(tvId);
        const ep = tv?.next_episode_to_air;
        if (!ep || ep.air_date !== today || ep.season_number == null || ep.episode_number == null) {
            continue;
        }
        airingToday += 1;
        const season = ep.season_number;
        const episode = ep.episode_number;
        const payloadBody = episodeCopy(season, episode, ep.name);

        for (const [userId, watchlistTitle] of watchers) {
            // Dedup: skip users already notified for this episode.
            const { data: existing } = await supabase
                .from('episode_notifications')
                .select('id')
                .eq('user_id', userId)
                .eq('tv_id', tvId)
                .eq('season_number', season)
                .eq('episode_number', episode)
                .maybeSingle();
            if (existing) continue;

            const payload = JSON.stringify({
                title: tv?.name || watchlistTitle,
                body: payloadBody,
                url: `/tv/${tvId}`,
                tag: `episode-${tvId}-s${season}e${episode}`,
                icon: '/icon-192.png',
            });

            let delivered = false;
            for (const sub of subsByUser.get(userId) ?? []) {
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
                    if (statusCode === 404 || statusCode === 410) {
                        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
                    } else {
                        console.error(`episode push failed for user ${userId} show ${tvId}:`, statusCode, String(err));
                    }
                }
            }

            // Record once at least one device received it, so it never repeats.
            if (delivered) {
                notified += 1;
                await supabase.from('episode_notifications').upsert(
                    { user_id: userId, tv_id: tvId, season_number: season, episode_number: episode },
                    { onConflict: 'user_id,tv_id,season_number,episode_number', ignoreDuplicates: true }
                );
            }
        }
    }

    return json({
        ok: true,
        shows: watchersByShow.size,
        airingToday,
        sent,
        failed,
        notified,
    });
});
