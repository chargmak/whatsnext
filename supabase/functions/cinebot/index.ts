// CineBot — a Gemini-powered, library-aware movie/TV recommender.
//
// Uses Google Gemini through its OpenAI-compatible endpoint, so the whole thing
// runs on Gemini's free tier (no credit card). To switch providers later, only
// BASE_URL, the API-key secret, and MODEL need to change — the format is stock
// OpenAI function calling.
//
// Deploy:  supabase functions deploy cinebot
// Secrets: supabase secrets set GEMINI_API_KEY=... TMDB_API_KEY=...
// The app uses this automatically once deployed (AI is on by default); set
// VITE_CINEBOT_AI=false only to force the offline local recommender.
//
// The caller's JWT is forwarded so library reads run under Row-Level Security —
// the function can only ever see the caller's own watchlist/history.

import OpenAI from 'npm:openai@6.45.0';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { searchTmdb, discoverByGenre } from '../_shared/tmdb.ts';

const DAILY_LIMIT = 40;

// Gemini's OpenAI-compatible surface. The model choice is what broke CineBot:
//  1) A single user turn costs 2+ model calls here (the tool-call round-trip),
//     so plain `gemini-2.5-flash` (free tier: 10 RPM / 250 RPD) hit its ceiling
//     almost immediately and every reply came back HTTP 429 — the AI looked
//     "dead" because the client silently fell back to its offline recommender.
//  2) Pinned newer names are worse: `gemini-2.5-flash-lite` isn't even served on
//     THIS OpenAI-compat endpoint (it 404s), so pinning it kills the function.
// So default to the rolling `gemini-flash-lite-latest` alias: it's a flash-LITE
// model (the roomiest free-tier limits in the flash family), it's confirmed to
// work on this endpoint WITH function calling, and being an alias it won't 404
// when a specific dated model is retired. Override with the GEMINI_MODEL secret.
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/';
const MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-flash-lite-latest';

// True for a provider-side rate-limit (HTTP 429). Gemini's free tier returns a
// bare "429 status code (no body)", so we also sniff the message defensively.
const isRateLimit = (err: unknown) => {
  const status = (err as { status?: number })?.status;
  const msg = String((err as { message?: string })?.message ?? err ?? '');
  return status === 429 || /\b429\b|rate.?limit|quota|RESOURCE_EXHAUSTED/i.test(msg);
};

const tools = [
  {
    type: 'function',
    function: {
      name: 'search_tmdb',
      description: 'Search movies and TV shows by title or keywords. Use when the user names a specific title.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Title or keywords to search for.' } },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'discover_by_genre',
      description:
        'Find popular, well-rated titles in a genre with optional filters. Use for mood/vibe requests ' +
        '("something funny under 90 min"). max_runtime only applies to movies.',
      parameters: {
        type: 'object',
        properties: {
          genre: {
            type: 'string',
            enum: ['Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary', 'Drama',
              'Family', 'Fantasy', 'History', 'Horror', 'Music', 'Mystery', 'Romance', 'Sci-Fi',
              'Thriller', 'War', 'Western'],
          },
          media_type: { type: 'string', enum: ['movie', 'tv'] },
          max_runtime: { type: 'integer', description: 'Max runtime in minutes (movies only).' },
          min_rating: { type: 'number', description: 'Minimum TMDB rating 0-10.' },
          min_year: { type: 'integer' },
          max_year: { type: 'integer' },
        },
        required: ['genre'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_my_library',
      description: "Read the signed-in user's watchlist and watched history. Use for 'what should I watch next?' or personalized picks.",
      parameters: { type: 'object', properties: {} },
    },
  },
];

async function runTool(name: string, input: any, ctx: { caller: any; userId: string | null }) {
  if (name === 'search_tmdb') {
    const results = await searchTmdb(String(input.query || ''));
    return { results, items: results };
  }
  if (name === 'discover_by_genre') {
    const results = await discoverByGenre(input.genre, {
      mediaType: input.media_type,
      maxRuntime: input.max_runtime,
      minRating: input.min_rating,
      minYear: input.min_year,
      maxYear: input.max_year,
    });
    return { results, items: results };
  }
  if (name === 'get_my_library') {
    if (!ctx.userId) return { results: { watchlist: [], watched: [] }, items: [] };
    const [wl, hist] = await Promise.all([
      ctx.caller.from('watchlists').select('movie_id,media_type,title,payload').limit(100),
      ctx.caller.from('history').select('movie_id,media_type,title,payload').limit(100),
    ]);
    const compact = (rows: any[]) => (rows || []).map((r) => ({
      id: r.movie_id, type: r.media_type, title: r.title,
      genres: r.payload?.genres || [], year: r.payload?.year,
    }));
    return { results: { watchlist: compact(wl.data), watched: compact(hist.data) }, items: [] };
  }
  return { results: { error: 'unknown tool' }, items: [] };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const { message, history = [] } = await req.json();
    if (!message) return json({ error: 'message is required' }, 400);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization') || '';

    // Caller-scoped client: all reads run under the caller's RLS.
    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await caller.auth.getUser();
    const userId = user?.id ?? null;

    // Best-effort per-user daily rate limit (skips gracefully if the table is absent).
    if (userId) {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const { data: usage } = await caller
          .from('cinebot_usage').select('count').eq('used_on', today).maybeSingle();
        if ((usage?.count ?? 0) >= DAILY_LIMIT) {
          return json({ reply: "You've reached today's CineBot limit — check back tomorrow!", items: [] }, 200);
        }
        await caller.from('cinebot_usage').upsert(
          { user_id: userId, used_on: today, count: (usage?.count ?? 0) + 1 },
          { onConflict: 'user_id,used_on' },
        );
      } catch (_) { /* table not migrated yet — allow */ }
    }

    // Fetch the caller's display name for a personal greeting/system prompt.
    let name = 'the user';
    if (userId) {
      const { data: profile } = await caller.from('profiles').select('full_name').eq('id', userId).maybeSingle();
      if (profile?.full_name) name = profile.full_name;
    }

    // Cap per-request time and retries so a rate-limited Gemini fails fast and
    // the client can fall back to its local recommender promptly, rather than
    // hanging on the SDK's default 10-minute timeout inside an Edge Function.
    const client = new OpenAI({
      apiKey: Deno.env.get('GEMINI_API_KEY'),
      baseURL: BASE_URL,
      maxRetries: 2,
      timeout: 20_000,
    });
    const system =
      `You are CineBot, a warm, concise movie and TV recommender inside the "What's Next?" app. ` +
      `You are talking to ${name}. Today is ${new Date().toISOString().slice(0, 10)}. ` +
      `Ground every recommendation in the TMDB tools — never invent titles. For mood or time-boxed ` +
      `requests ("something funny under 90 min") use discover_by_genre with the right filters. ` +
      `For "what should I watch next?" call get_my_library and pick from their watchlist. ` +
      `Recommend one or two titles with a one-line reason each. Keep replies under 80 words.`;

    const messages: any[] = [
      { role: 'system', content: system },
      ...history.slice(-8).map((m: any) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content),
      })),
      { role: 'user', content: String(message) },
    ];

    let items: any[] = [];
    let response = await client.chat.completions.create({ model: MODEL, messages, tools, tool_choice: 'auto' });
    let msg = response.choices?.[0]?.message;

    // Each pass is another billable Gemini call against the free-tier quota, and
    // a recommendation almost never needs more than one tool round-trip, so cap
    // at 3 (worst case 4 model calls/turn) instead of the old 4.
    for (let i = 0; i < 3 && msg?.tool_calls?.length; i++) {
      // Echo the assistant turn (with its tool calls) back into the transcript.
      messages.push({ role: 'assistant', content: msg.content ?? '', tool_calls: msg.tool_calls });
      for (const call of msg.tool_calls) {
        let args: any = {};
        try { args = JSON.parse(call.function?.arguments || '{}'); } catch (_) { args = {}; }
        const { results, items: mapped } = await runTool(call.function?.name, args, { caller, userId });
        if (mapped?.length) items = mapped;
        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(results) });
      }
      response = await client.chat.completions.create({ model: MODEL, messages, tools, tool_choice: 'auto' });
      msg = response.choices?.[0]?.message;
    }

    const reply = (msg?.content || '').trim();
    return json({ reply: reply || "I couldn't find a good match — try a genre or a title.", items: items.slice(0, 3) });
  } catch (error) {
    // Gemini's free tier is momentarily saturated. Answer 200 with an explicit
    // rate-limit signal and a null reply: the client treats a missing reply as
    // "backend unavailable" and seamlessly falls back to its local recommender,
    // so the user still gets a real suggestion instead of an error. Returning a
    // 500 here would spam the console and read as a hard outage.
    if (isRateLimit(error)) {
      console.warn('cinebot: Gemini rate limit (429) — signaling client fallback.');
      return json({ reply: null, items: [], rateLimited: true });
    }
    console.error('cinebot error', error);
    return json({ error: 'internal error' }, 500);
  }
});
