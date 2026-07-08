// send-release-reminders
//
// Daily job (invoked by a scheduled cron) that finds "Notify Me" reminders whose
// release date has arrived (today or tomorrow) and haven't been notified yet,
// then delivers a Web Push notification to every device the reminder's owner has
// subscribed. Each reminder is stamped `notified_at` so it fires only once.
//
// Auth: if CRON_SECRET is set, the caller must send `Authorization: Bearer <CRON_SECRET>`.
// Env (set with `supabase secrets set`): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
// VAPID_SUBJECT, CRON_SECRET. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are
// injected automatically.

import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:notifications@whatsnext.app';
const CRON_SECRET = Deno.env.get('CRON_SECRET');

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });

// Whole days from `todayMs` (UTC midnight) to a YYYY-MM-DD release date.
const daysUntil = (releaseDate: string, todayMs: number): number => {
    const [y, m, d] = releaseDate.split('-').map(Number);
    const releaseMs = Date.UTC(y, m - 1, d);
    return Math.round((releaseMs - todayMs) / 86_400_000);
};

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

    // "Today" at UTC midnight; horizon includes tomorrow so users get a day's warning.
    const now = new Date();
    const todayMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const horizon = new Date(todayMs + 86_400_000).toISOString().slice(0, 10);

    const { data: reminders, error } = await supabase
        .from('reminders')
        .select('id, user_id, movie_id, media_type, title, release_date')
        .is('notified_at', null)
        .not('release_date', 'is', null)
        .lte('release_date', horizon);

    if (error) return json({ error: error.message }, 500);
    if (!reminders || reminders.length === 0) {
        return json({ ok: true, candidates: 0, sent: 0, failed: 0, notified: 0 });
    }

    let sent = 0;
    let failed = 0;
    const notifiedIds: number[] = [];

    for (const reminder of reminders) {
        const { data: subs, error: subErr } = await supabase
            .from('push_subscriptions')
            .select('endpoint, p256dh, auth')
            .eq('user_id', reminder.user_id);

        if (subErr || !subs || subs.length === 0) continue;

        const days = daysUntil(reminder.release_date, todayMs);
        const copy = releaseCopy(reminder.title, days);
        const payload = JSON.stringify({
            title: copy.title,
            body: copy.body,
            url: `/${reminder.media_type}/${reminder.movie_id}`,
            tag: `reminder-${reminder.id}`,
            icon: '/icon-192.png',
        });

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
                    console.error(`push failed for reminder ${reminder.id}:`, statusCode, String(err));
                }
            }
        }

        // Mark notified as long as at least one device received it.
        if (delivered) notifiedIds.push(reminder.id);
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
        sent,
        failed,
        notified: notifiedIds.length,
    });
});
