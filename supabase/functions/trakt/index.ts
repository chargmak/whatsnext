// trakt
//
// Server half of the Trakt integration — the bridge that keeps What's Next? in
// step with Nuvio (and anything else signed in to the same Trakt account).
// Trakt's token endpoint needs the app's client secret, so the OAuth exchange
// has to happen here; and once we hold the tokens anyway, every Trakt call goes
// through this function too, so they never reach the browser.
//
// POST body `{ action, ... }`, called with the user's Supabase session:
//   exchange   { code, redirectUri } → finish OAuth, store tokens, { username }
//   disconnect {}                    → revoke at Trakt, delete the row
//   request    { method, path, body? } → proxy one /sync/* call, { status, data }
//
// Env (set with `supabase secrets set`): TRAKT_CLIENT_ID, TRAKT_CLIENT_SECRET.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const TRAKT_CLIENT_ID = Deno.env.get('TRAKT_CLIENT_ID');
const TRAKT_CLIENT_SECRET = Deno.env.get('TRAKT_CLIENT_SECRET');

const TRAKT_API = 'https://api.trakt.tv';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
    });

// The proxy only forwards the library endpoints the sync uses — it is not a
// general-purpose Trakt relay for whoever holds a session.
const ALLOWED = [
    { method: 'GET', path: /^\/sync\/(watchlist\/(movies|shows)|watched\/(movies|shows))$/ },
    { method: 'POST', path: /^\/sync\/(watchlist|history)(\/remove)?$/ },
];

const traktHeaders = (accessToken?: string) => ({
    'Content-Type': 'application/json',
    'trakt-api-version': '2',
    'trakt-api-key': TRAKT_CLIENT_ID!,
    // Trakt sits behind Cloudflare, which turns away requests with no UA.
    'User-Agent': 'WhatsNext/1.0',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
});

// Trakt rate-limits writes to about one per second and answers 429 with a
// Retry-After; wait it out once rather than failing the whole sync.
const traktFetch = async (path: string, init: RequestInit): Promise<Response> => {
    for (let attempt = 0; ; attempt++) {
        const res = await fetch(`${TRAKT_API}${path}`, init);
        if (res.status !== 429 || attempt >= 2) return res;
        const wait = Math.min(Number(res.headers.get('Retry-After')) || 1, 10);
        await new Promise((r) => setTimeout(r, wait * 1000));
    }
};

type Tokens = { access_token: string; refresh_token: string; expires_in: number; created_at: number };

const tokenRow = (t: Tokens) => ({
    access_token: t.access_token,
    refresh_token: t.refresh_token,
    expires_at: new Date((t.created_at + t.expires_in) * 1000).toISOString(),
});

const requestTokens = async (grant: Record<string, string>): Promise<Tokens> => {
    const res = await traktFetch('/oauth/token', {
        method: 'POST',
        headers: traktHeaders(),
        body: JSON.stringify({
            client_id: TRAKT_CLIENT_ID,
            client_secret: TRAKT_CLIENT_SECRET,
            ...grant,
        }),
    });
    if (!res.ok) throw new Error(`Trakt token request failed (${res.status})`);
    return await res.json();
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
        return json({ error: 'Server missing Supabase configuration.' }, 500);
    }
    if (!TRAKT_CLIENT_ID || !TRAKT_CLIENT_SECRET) {
        return json({ error: 'Trakt is not configured on the server.' }, 500);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: { user } } = await supabase.auth.getUser(jwt);
    if (!user) return json({ error: 'Unauthorized' }, 401);

    let body: Record<string, unknown>;
    try {
        body = await req.json();
    } catch {
        return json({ error: 'Invalid JSON body' }, 400);
    }

    try {
        if (body.action === 'exchange') {
            const code = String(body.code || '');
            const redirectUri = String(body.redirectUri || '');
            if (!code || !redirectUri) return json({ error: 'Missing code or redirectUri' }, 400);

            const tokens = await requestTokens({
                code,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code',
            });

            const settings = await traktFetch('/users/settings', { headers: traktHeaders(tokens.access_token) });
            const username = settings.ok ? (await settings.json())?.user?.username ?? null : null;

            // A reconnect starts from a clean slate: the old snapshot described a
            // possibly different Trakt account, and trusting it would read every
            // difference as a deletion.
            const { error } = await supabase.from('trakt_connections').upsert({
                user_id: user.id,
                username,
                ...tokenRow(tokens),
                snapshot: null,
                last_synced_at: null,
                connected_at: new Date().toISOString(),
            });
            if (error) throw error;
            return json({ username });
        }

        const { data: conn, error: connError } = await supabase
            .from('trakt_connections')
            .select('access_token, refresh_token, expires_at')
            .eq('user_id', user.id)
            .maybeSingle();
        if (connError) throw connError;

        if (body.action === 'disconnect') {
            if (conn) {
                // Best effort: a token Trakt already forgot is no reason to
                // keep the link on our side.
                await traktFetch('/oauth/revoke', {
                    method: 'POST',
                    headers: traktHeaders(),
                    body: JSON.stringify({
                        token: conn.access_token,
                        client_id: TRAKT_CLIENT_ID,
                        client_secret: TRAKT_CLIENT_SECRET,
                    }),
                }).catch(() => null);
                await supabase.from('trakt_connections').delete().eq('user_id', user.id);
            }
            return json({ ok: true });
        }

        if (body.action === 'request') {
            if (!conn) return json({ error: 'Trakt is not connected.' }, 409);

            const method = String(body.method || 'GET').toUpperCase();
            const path = String(body.path || '');
            if (!ALLOWED.some((rule) => rule.method === method && rule.path.test(path))) {
                return json({ error: 'Endpoint not allowed' }, 400);
            }

            let accessToken = conn.access_token;
            // Refresh a little early so a token can't expire mid-sync.
            if (Date.parse(conn.expires_at) - Date.now() < 24 * 3600 * 1000) {
                try {
                    const tokens = await requestTokens({
                        refresh_token: conn.refresh_token,
                        grant_type: 'refresh_token',
                    });
                    await supabase.from('trakt_connections').update(tokenRow(tokens)).eq('user_id', user.id);
                    accessToken = tokens.access_token;
                } catch {
                    // Refresh tokens are single-use and expire; once Trakt
                    // rejects ours the only way back is to sign in again.
                    return json({ error: 'Trakt sign-in expired. Reconnect Trakt in Settings.', reconnect: true }, 401);
                }
            }

            const res = await traktFetch(path, {
                method,
                headers: traktHeaders(accessToken),
                ...(method === 'POST' ? { body: JSON.stringify(body.body ?? {}) } : {}),
            });
            if (res.status === 401) {
                return json({ error: 'Trakt sign-in expired. Reconnect Trakt in Settings.', reconnect: true }, 401);
            }
            const text = await res.text();
            const data = text ? JSON.parse(text) : null;
            if (!res.ok) return json({ error: `Trakt request failed (${res.status})`, status: res.status }, 502);
            return json({ status: res.status, data });
        }

        return json({ error: 'Unknown action' }, 400);
    } catch (error) {
        return json({ error: error instanceof Error ? error.message : String(error) }, 500);
    }
});
