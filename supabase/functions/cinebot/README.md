# CineBot Edge Function (optional AI backend)

Turns CineBot into a real Claude-powered, library-aware recommender. **Optional** —
without it, CineBot falls back to the intent-aware local recommender in
`src/components/CineBot.jsx`, so the app works out of the box.

## What it does

A Supabase Edge Function that proxies the Anthropic Claude API (`claude-opus-4-8`)
with tool use:

- `search_tmdb` — title/keyword search
- `discover_by_genre` — mood + time-boxed discovery (e.g. "funny under 90 min")
- `get_my_library` — reads the caller's watchlist/history **under their own RLS**
  (the function forwards the caller's JWT, so it can only see their rows)

It returns `{ reply, items }`; the client renders `reply` and deep-links `items[0]`.

## Deploy

```bash
# 1. Apply the rate-limit migration (optional but recommended)
#    supabase/migrations/20260708_07_cinebot_usage_table.sql

# 2. Set secrets
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...   # server-side only
supabase secrets set TMDB_API_KEY=...               # server copy of the TMDB key

# 3. Deploy
supabase functions deploy cinebot

# 4. Enable in the app
echo "VITE_CINEBOT_AI=true" >> .env   # then rebuild
```

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are injected automatically by the platform.

## Notes

- Per-user daily cap is `DAILY_LIMIT` (default 40); best-effort via `cinebot_usage`.
- The `ANTHROPIC_API_KEY` and `TMDB_API_KEY` never reach the browser bundle.
