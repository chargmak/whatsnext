# Feature Proposals V2 — Completionist, AI-native & Social

**Date:** 2026-07-08 · Companion to `FEATURE_PROPOSALS.md` (the original 17-feature roadmap).

This round focuses on three themes that push "What's Next?" past the tracker genre:
**AI-native discovery**, **completionist tracking**, and **social / watch-together**.
Items marked **✅ Shipped** are implemented in this branch; the rest are designed and
ready to build (each maps to concrete files, tables, and RLS).

---

## ✅ Shipped in this round (client-side, no backend changes)

### 1. Person pages + filmography completion (Completionist)
- Cast on a detail page is now tappable → `/person/:id` (`src/pages/Person.jsx`).
- A **completion ring** shows what % of a person's notable filmography you've watched,
  computed from `UserContext.watched`. Per-title check toggles let you tick off what
  you've seen right from the list, plus a "show only to-watch" filter.
- New TMDB calls: `getPersonDetails`, `getPersonCredits`, `imageUrl` in `src/services/tmdb.js`.

### 2. Franchise / collection tracking (Completionist)
- On any movie in a collection (e.g. *The Dark Knight Trilogy*), a **Franchise panel**
  in `src/pages/MovieDetail.jsx` shows an in-order checklist, an "N/M watched" progress
  bar, and "Add remaining to watchlist". Uses `getCollection` + TMDB `belongs_to_collection`.

### 3. CineBot is real (AI-native)
- The orphaned CineBot is now wired into the app (`src/App.jsx`) and greets you by your
  actual profile name. It understands **mood + time-boxed** requests
  ("something funny under 90 min"), **library-aware** prompts ("what should I watch next?"
  → pulls from your watchlist), and title lookups — all client-side.
- **Optional Claude backend**: `supabase/functions/cinebot` proxies `claude-opus-4-8` with
  tool use (`search_tmdb`, `discover_by_genre`, `get_my_library` under the caller's RLS).
  Enable with `VITE_CINEBOT_AI=true` after deploying; otherwise the local recommender runs.
  Migration `20260708_07_cinebot_usage_table.sql` adds per-user daily rate limiting.

---

## Next phase — Social & watch-together (needs Supabase migrations)

### 4. Follow users + public profiles
**User story:** flip a "Public profile" toggle; get a shareable `/u/:userId` page showing
your avatar, stats, and watched grid; follow other users.

- **Migration `20260708_08_public_profiles_and_follows.sql`:**
  ```sql
  alter table public.profiles add column if not exists is_public boolean not null default false;
  create table public.follows (
    follower_id  uuid not null references auth.users(id) on delete cascade,
    following_id uuid not null references auth.users(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (follower_id, following_id),
    check (follower_id <> following_id)
  );
  alter table public.follows enable row level security;
  create policy "Follows are viewable by everyone." on public.follows for select using (true);
  create policy "Users insert their own follows." on public.follows for insert with check (auth.uid() = follower_id);
  create policy "Users delete their own follows." on public.follows for delete using (auth.uid() = follower_id);
  ```
- **Migration `20260708_09_public_watched_read.sql`** — the RLS decision (Option A, recommended):
  add an OR-combined SELECT policy so a `history` row is also readable when its owner is public.
  Keeps the existing owner-only policy intact and lets the client reuse `fromDbRow` unchanged.
  ```sql
  create policy "Public users' history is viewable." on public.history
    for select using (
      exists (select 1 from public.profiles p where p.id = history.user_id and p.is_public = true)
    );
  ```
  *(Alternative — a `security definer` RPC — is preferable only if visibility later grows
  beyond a public/private boolean, e.g. followers-only.)*
- **Code:** `userData.js` gains `fetchFollowing`, `followUser`, `unfollowUser`,
  `fetchPublicProfile`, `fetchPublicWatched`, `fetchFollowCounts`; `UserContext` gains
  `following` + optimistic `followUser`/`unfollowUser` and `isPublic` on the profile;
  new `src/pages/PublicProfile.jsx` at `/u/:userId`; a toggle in `EditProfile.jsx`.

### 5. Taste-compatibility score
On another user's public profile, "You're 62% compatible." Compute **client-side** (both
watched sets are already available via #4's RLS) in a new `src/utils/compatibility.js`:
Jaccard over `{type-id}` keys blended with genre-vector cosine similarity. Upgrade to a
`security definer` RPC only if watched lists later become private; weight by rating once the
ratings feature (original doc #3) ships.

### 6. "Previously on…" spoiler-safe AI recaps
On a TV detail page, a button generates a recap of the story **only up to your last-watched
episode**. Spoiler-safety is enforced by **bounding the input, not just prompting**: the client
computes the last-watched `(season, episode)` (a new `getLastWatchedEpisode(tvId)` selector),
and the Edge Function fetches season data server-side and passes Claude *only* episodes ≤ the
boundary. Reuses the `cinebot` function (add a `recap` action) — no new migration.

---

## New differentiators worth adding (beyond the original 17)

These target gaps even genre leaders (Letterboxd, TV Time, Trakt) leave open:

- **"Leaving soon" streaming-expiry alerts** — notify when a watchlist title is about to
  leave your service. Needs a provider-availability snapshot + the Web Push work from the
  original doc (#2). High retention value.
- **Subscription-cost optimizer** — "which service unlocks the most of your watchlist per
  dollar this month" / "what to cancel". Pure computation over watchlist × TMDB `watch/providers`.
- **Watch-party sync (moonshot, deferred)** — Supabase Realtime channels for shared play/pause
  and reactions. Large; build after the social graph (#4) lands.

---

## Suggested order
1. Social graph (#4) → compatibility (#5) — unlocks the social loop with two small migrations.
2. Deploy the `cinebot` Edge Function → add spoiler-safe recaps (#6).
3. Streaming intelligence (leaving-soon + cost optimizer) once Web Push (original #2) exists.
