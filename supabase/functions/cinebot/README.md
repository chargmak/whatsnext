# CineBot Edge Function (optional AI backend)

Turns CineBot into a real, library-aware recommender powered by **Google Gemini's
free tier**. **Optional** — without it, CineBot falls back to the intent-aware
local recommender in `src/components/CineBot.jsx`, so the app works out of the box.

## What it does

A Supabase Edge Function that calls Google Gemini through its OpenAI-compatible
endpoint (`gemini-flash-lite-latest` by default) with tool use:

- `search_tmdb` — title/keyword search
- `discover_by_genre` — mood + time-boxed discovery (e.g. "funny under 90 min")
- `get_my_library` — reads the caller's watchlist/history **under their own RLS**
  (the function forwards the caller's JWT, so it can only see their rows)

It returns `{ reply, items }`; the client renders `reply` and deep-links `items[0]`.

## Why Gemini

Google's Gemini API has a genuinely free tier (no credit card). The model choice
here is load-bearing — it's what broke CineBot before:

- **Don't pin `gemini-2.5-flash`.** A single user turn costs 2+ model calls (the
  tool-call round-trip), and `-flash`'s free tier is only ~10 req/min / 250 req/day,
  so the ceiling was hit almost immediately and replies came back HTTP **429**. The
  client then silently fell back to its offline recommender, making the AI look dead.
- **Don't pin `gemini-2.5-flash-lite` either.** Despite appearing in the native model
  list, that exact id is **not served on the OpenAI-compat endpoint** — it returns
  HTTP **404**, which takes the whole function down.
- **Default to the rolling `gemini-flash-lite-latest` alias.** It's confirmed to work
  on this endpoint *with* function calling, it's a flash-**lite** model (the roomiest
  free-tier limits in the flash family), and being an alias it won't 404 when a dated
  model is retired.

On a 429 the function now returns a soft `{ reply: null, rateLimited: true }` (HTTP
200) so the client falls back to its local recommender cleanly instead of erroring.
Because Gemini speaks the OpenAI wire format, swapping to another provider later
(e.g. Groq) only means changing `BASE_URL`, `MODEL`, and the API-key secret in
`index.ts`. Override the model with the `GEMINI_MODEL` secret.

## Get the keys (both free)

- **`GEMINI_API_KEY`** — create one at https://aistudio.google.com/apikey (free,
  no billing required). Stays server-side; never reaches the browser bundle.
- **`TMDB_API_KEY`** — the server copy of the TMDB v3 key the app already uses
  (`VITE_TMDB_API_KEY`). Free from https://www.themoviedb.org/settings/api.

## Deploy

```bash
# 1. Apply the rate-limit migration (optional but recommended)
#    supabase/migrations/20260708_07_cinebot_usage_table.sql

# 2. Set secrets
supabase secrets set GEMINI_API_KEY=...   # server-side only
supabase secrets set TMDB_API_KEY=...     # server copy of the TMDB key
# optional: supabase secrets set GEMINI_MODEL=gemini-flash-latest  # a more capable (non-lite) alias

# 3. Deploy
supabase functions deploy cinebot
```

Once the function is deployed and its secrets are set, CineBot uses it
automatically — the AI backend is **on by default** in the app. No frontend
env var is needed. (Set `VITE_CINEBOT_AI=false` only if you want to force the
offline local recommender.)

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are injected automatically by the platform.

## Notes

- Per-user daily cap is `DAILY_LIMIT` (default 40); best-effort via `cinebot_usage`.
- Neither `GEMINI_API_KEY` nor `TMDB_API_KEY` ever reaches the browser bundle.
- Gemini's free tier may use prompts to improve Google's models — fine for public
  movie chat, but don't send anything sensitive.
