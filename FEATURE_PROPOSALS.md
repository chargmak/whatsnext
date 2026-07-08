# Feature Proposals — Making "What's Next?" the Best in its Genre

*Proposal date: 2026-07-08*

## Where the app stands today

What's Next? already nails the foundation of a release-tracking companion: TMDB-powered
search and trending, watchlist/watched with per-episode progress, a personalized release
calendar, "Notify Me" reminders, real Supabase accounts with guest mode and one-click
import, streaming-provider display by country, and a polished installable PWA shell.

The genre leaders each own one core loop:

| App | Their killer loop | What's Next? today |
|---|---|---|
| **TV Time / Trakt** | "Up Next" episode queue — open app, see exactly what to watch, tap to check off | Episode checklists exist, but buried inside each show's detail page |
| **JustWatch** | "Where can I stream this?" + alerts when a title lands on *your* services | Shows flatrate providers on detail pages only; no service preferences, no alerts |
| **Letterboxd** | Ratings, reviews, diary, lists — your taste as a social identity | Watched history only; no ratings, reviews, or custom lists |
| **Sequel / Callsheet** | Follow people (actors/directors), get notified about their new projects | Cast is displayed but not clickable |

The proposals below are ordered so that each tier is buildable with the existing stack
(React + Vite PWA, TMDB, Supabase Postgres/Auth/Edge Functions, Vercel) and each one
compounds the ones before it.

---

## Tier 1 — Own the core loop (highest impact, buildable now)

### 1. "Up Next" queue on Home ⭐ the namesake feature
The app is called **What's Next?** — the home screen should literally answer that question.

- A top-of-Home rail: for every show in the library with episode progress, compute the
  next unwatched episode (all data already exists in `watchedEpisodes` +
  `getTVSeasonDetails`), plus movies from the watchlist that are now released.
- One-tap "✓ watched" directly on the card, which advances the queue — the TV Time/Trakt
  dopamine loop.
- Sort by "aired most recently" with a "continue watching" bias toward shows checked off
  in the last 2 weeks.
- **Effort: M** · no schema changes; a `useUpNext()` hook + Home rail + episode-cache
  layer (cache season data in `localStorage`/IndexedDB to avoid re-fetching).

### 2. Real push notifications (Web Push)
"Notify Me" currently only adds an item to an in-app list — the promise of the feature
is unfulfilled. The service worker already exists; add the missing half:

- `push` + `notificationclick` handlers in `sw.js`; VAPID keys; a `push_subscriptions`
  table (user_id, endpoint, keys) with RLS.
- A daily Supabase Edge Function on `pg_cron` that joins `reminders` (and watchlist shows
  with `next_episode_to_air` = today) against subscriptions and sends "🎬 Dune Part 3 is
  out today" / "📺 S02E05 of Severance airs tonight".
- Notification preferences on the Notifications page become real (they're currently
  local-only toggles).
- **Effort: M–L** · this is the single biggest retention lever in the genre: it brings
  users *back* without them opening the app.

### 3. Ratings & mini-reviews
The foundation for identity, stats, and recommendations:

- 1–10 (or 5-star half-step) rating + optional short review when marking watched, and
  editable from the detail page and Library.
- New `ratings` table (user_id, media_id, media_type, rating, review, watched_at) with RLS;
  guest mode persists to `localStorage` like everything else, and migrates on signup.
- Show "Your rating" beside the TMDB rating; sort/filter Library by your rating.
- Also record **watch date** and support **rewatches** (a diary, Letterboxd-style).
- **Effort: M**

### 4. "My streaming services" + availability alerts
Turn the existing provider display into a JustWatch-class feature:

- Settings: pick your services (Netflix, Disney+, …) — one `profiles.services jsonb`
  column, TMDB `/watch/providers/movie|tv` supplies the catalog per region (the profile
  already stores country).
- Badge every card/list item that's available on *your* services; add an "On my
  services" filter in Search and Library.
- Extend the push Edge Function: when a watchlist title *becomes* available on one of
  your services, notify — "Oppenheimer just landed on Prime Video". (Daily diff of
  provider data for watchlist items, cached in one table.)
- Show rent/buy providers on detail pages too (TMDB already returns them; only
  `flatrate` is used today).
- **Effort: M** · high perceived value, near-zero new UI surface.

### 5. Custom lists
- `lists` + `list_items` tables (name, emoji, is_public, share slug) with RLS.
- "Add to list" from any card/detail page; lists tab in Library.
- Public lists get a shareable read-only URL (`/list/:slug`) — the app's first
  organic-growth surface, and the seed of every social feature in Tier 3.
- **Effort: M**

### 6. Quick wins bundle (ship alongside any of the above)
- **Mark season / mark all previous as watched** — one tap instead of 22 on the episode
  checklist.
- **Clickable cast → person page** (`/person/:id`, TMDB `person` + `combined_credits`):
  filmography with "in your library / watched" badges.
- **Hide watched titles from Trending** (toggle), and a "In your watchlist" badge on Home.
- **Search filters**: year range, min rating, sort order — TMDB `/discover` already
  supports all of it; the genre chips exist, this generalizes them.
- **Runtime left on shows**: "≈ 14h left to finish" on TV cards (episodes × runtime).
- **Effort: S each**

---

## Tier 2 — Differentiate (features few or none of the competitors have)

### 7. A real CineBot (Claude-powered) 🤖
CineBot is currently a keyword matcher pretending to be a bot. Make it real and it
becomes the headline feature no mainstream tracker has:

- Supabase Edge Function proxying the Claude API (key stays server-side), with tool use:
  `search_tmdb`, `discover`, and read-only access to the user's library and ratings.
- Enables: *"something like Dark but shorter"*, *"a feel-good movie under 100 minutes on
  my services"*, *"what should I finish first from my watchlist?"* — grounded answers
  with tappable cards.
- Rate-limit per user; guests get N free messages/day.
- **Effort: L** · but it's the "best of genre" moment — mood-based, library-aware,
  conversational discovery.

### 8. "Because you watched" personalized rows
Zero-backend personalization from data already on hand:

- TMDB `/movie/{id}/recommendations` and `/tv/{id}/recommendations` seeded from the
  user's highest-rated / most recently watched titles; filter out already-seen items.
- Home gains 2–3 rows: "Because you watched *Severance*", "More from your favorite
  genre" (favorite genre is already computed in stats).
- **Effort: S–M** · dramatic feel-of-intelligence gain for a weekend of work.

### 9. Stats 2.0 + "Reel Wrapped" year in review 📊
Stats already exist (hours, favorite genre, rank) — turn them into a shareable identity:

- Genre donut, monthly watch-time heatmap, top actors/directors (from cached credits),
  longest streak, busiest day, total episodes.
- Every December (or on demand): a swipeable **Wrapped** story with a canvas-rendered
  share card via the existing Web Share API integration. This is the genre's proven
  viral loop (Spotify Wrapped, Letterboxd Year in Review).
- Streaks & achievements: "7-day streak", "Marathon: 10 episodes in a day", "Genre
  explorer" — TV Time-style light gamification on the Profile page.
- **Effort: M**

### 10. Subscribe-able release calendar (iCal feed) 📅
Nobody in the genre does this well:

- A Supabase Edge Function serving a per-user tokenized `.ics` feed of their release
  calendar (movie releases + upcoming episodes of tracked shows).
- One tap: "Add to Google/Apple Calendar" — releases appear in the calendar users
  already live in, updating automatically.
- **Effort: S–M** · tiny surface, huge "how did I live without this" factor.

### 11. Import from Trakt / Letterboxd / TV Time
Every power user in this genre already has years of history elsewhere:

- CSV/JSON importers (all three export data) mapping to watchlist/watched/ratings via
  TMDB ID lookup; the Settings page already has an import/export section to house it.
- This is the #1 adoption unblocker for exactly the users who evangelize tracker apps.
- **Effort: M**

### 12. Follow people (actors, directors, creators)
- "Follow" button on person pages (Tier 1 #6); `followed_people` table.
- Notifications/calendar entries when a followed person's new project gets a release
  date (TMDB `person/{id}/combined_credits` diffed by the daily cron).
- Only niche apps (Sequel, Callsheet) do this — a genuine differentiator.
- **Effort: M** (requires #2 and #6)

---

## Tier 3 — Social & moonshots (the moat)

### 13. Friends & activity feed
- Follow users, public profile toggle, feed of friends' ratings/reviews/finishes.
- Reviews from friends surface first on detail pages.
- **Effort: L** · unlocks the Letterboxd-style network effect; build only after ratings
  (#3) and lists (#5) give the feed content.

### 14. "What should WE watch tonight?" — shared decision mode 🎲
The unsolved problem of the genre — deciding *together*:

- Collaborative watchlists (share a list with a partner; both can add).
- **Tonight Picker**: intersect two members' watchlists ∩ mutual streaming services ∩
  mood/length filters → swipe to veto, first mutual "yes" wins (Tinder-for-movies, but
  seeded from *your* real lists, which is why it will actually work).
- **Effort: L** · composes lists (#5), services (#4), and accounts — a headline feature
  no major tracker has shipped well.

### 15. Episode discussions with spoiler shields
- Per-episode comment threads, blurred until you've marked that episode watched
  (TV Time's stickiest feature).
- **Effort: L** · needs moderation strategy; ship last.

### 16. Weekly email digest
- "Your week ahead: 3 episodes, 1 premiere, 2 titles left Netflix" via Resend +
  `pg_cron` — the `weeklyDigest` toggle already exists in the UI, unwired.
- **Effort: S–M** (reuses #2's scheduling)

---

## Platform investments (enable everything above)

1. **TMDB proxy Edge Function** — the TMDB key currently ships in the client bundle
   (`VITE_TMDB_API_KEY`). Proxying through Supabase hides the key, adds a cache layer
   (cuts TMDB rate-limit pressure for Up Next/Calendar fan-out), and gives one place to
   add region/language.
2. **Query caching layer** (TanStack Query or a small SWR wrapper) — Calendar and Up
   Next re-fetch season data aggressively; cached queries make the app feel instant and
   enable offline reads.
3. **i18n + full region support** — TMDB serves 50+ languages; `language` comes from one
   parameter already centralized in `tmdb.js`. Trackers are global products.
4. **Basic test harness** (Vitest + Testing Library) before the Tier 1 wave lands —
   UserContext's optimistic-update logic is exactly the code that regresses silently.

---

## Suggested roadmap

| Phase | Ships | Outcome |
|---|---|---|
| **1. Core loop** (now) | Up Next (#1), quick wins (#6), push notifications (#2) | Opening the app answers "what's next?"; the app reaches out when something airs |
| **2. Taste & discovery** | Ratings/diary (#3), Because-you-watched (#8), services & alerts (#4), real CineBot (#7) | The app knows what you like and where you can watch it |
| **3. Identity & growth** | Lists (#5), Stats 2.0/Wrapped (#9), iCal feed (#10), importers (#11) | Shareable surfaces bring new users; importers convert them |
| **4. Together** | Follow people (#12), friends (#13), Tonight Picker (#14), digest (#16) | Network effects and the "decide together" moat |

### If only three things get built
1. **Up Next queue** — it's the app's name and the genre's proven daily-habit loop.
2. **Real push notifications** — completes the "never miss a release" promise and drives re-engagement.
3. **Claude-powered CineBot + Because-you-watched** — discovery intelligence that no mainstream tracker offers, on an already-built chat surface.
