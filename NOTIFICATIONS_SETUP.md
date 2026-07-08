# Release Notifications Setup

This app can send **Web Push notifications** — even when the app is closed — for:

- **Release reminders**: a movie or show you tapped **Notify Me** on is released.
- **New episodes**: a new episode of a TV show **in your watchlist** airs today.

## How it works

1. On the Notifications page, **Push Notifications** asks for permission and
   subscribes the browser's service worker (`public/sw.js`) using a VAPID key.
2. The subscription is saved to the `push_subscriptions` table (per signed-in user).
3. Two daily crons deliver alerts:
   - **`send-release-reminders`** finds reminders releasing today/tomorrow that
     haven't been notified, pushes to each of the user's devices, and stamps
     `reminders.notified_at` so it fires once.
   - **`send-episode-alerts`** looks at every TV show in each subscribed user's
     watchlist, asks TMDB whether the show's next episode airs today, and pushes a
     "new episode" alert. Each `(user, show, season, episode)` is recorded in
     `episode_notifications` so it fires only once.

> Scheduled alerts require a **signed-in account** — guest reminders and watchlists
> live only in `localStorage`, which the server never sees. Episode alerts also
> require a **TV show in your watchlist** and Push Notifications turned on.

---

## One-time setup

### 1. VAPID keys

A key pair was generated for this project. The **public** key is below (safe to
commit / expose to the browser). The matching **private** key is a secret and is
intentionally NOT stored in this repo — keep it only in your edge-function
secrets. Regenerate a fresh pair anytime with `node scripts/generate-vapid-keys.mjs`.

```
VAPID_PUBLIC_KEY=BEiuMR6fPv2p9L2n712L-PTP6Eot_iOiWAk8wrIcZ-54C9SX1aDFfVZZ9VB_-cTzRSuUjjZ3ww5lybJem75rogI
VAPID_PRIVATE_KEY=<keep secret — do not commit>
```

### 2. Client env

This public key is **already baked into the client** (`src/services/push.js`), so
push shows up as enabled in the app with no extra config. You only need to set an
env var if you want to **override / rotate** the key without changing code —
`.env` locally, and your Vercel project's Environment Variables — then redeploy:

```
VITE_VAPID_PUBLIC_KEY=BEiuMR6fPv2p9L2n712L-PTP6Eot_iOiWAk8wrIcZ-54C9SX1aDFfVZZ9VB_-cTzRSuUjjZ3ww5lybJem75rogI
```

### 3. Database

Apply the migrations that add `push_subscriptions`, `reminders.notified_at`, and
`episode_notifications`:

```bash
supabase db push
```

(Already applied to the hosted project if you used the assistant's deploy.)

### 4. Deploy the edge functions

```bash
supabase functions deploy send-release-reminders
supabase functions deploy send-episode-alerts
```

`supabase/config.toml` already sets `verify_jwt = false` for both — they do their
own auth via `CRON_SECRET`.

### 5. Edge-function secrets

Pick any strong random string for `CRON_SECRET` (e.g. `openssl rand -hex 32`).
`TMDB_API_KEY` is the same TMDB v3 key used by the client (`VITE_TMDB_API_KEY`) —
it's required by `send-episode-alerts` to look up episode air dates:

```bash
supabase secrets set \
  VAPID_PUBLIC_KEY=BEiuMR6fPv2p9L2n712L-PTP6Eot_iOiWAk8wrIcZ-54C9SX1aDFfVZZ9VB_-cTzRSuUjjZ3ww5lybJem75rogI \
  VAPID_PRIVATE_KEY=<your-vapid-private-key> \
  VAPID_SUBJECT=mailto:you@example.com \
  CRON_SECRET=<your-random-secret> \
  TMDB_API_KEY=<your-tmdb-v3-api-key>
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

### 6. Schedule the daily jobs

**Easiest:** Dashboard → Integrations → **Cron** → create a job for each function
(`send-release-reminders`, `send-episode-alerts`), add header
`Authorization: Bearer <CRON_SECRET>`, and schedule them (e.g. `0 14 * * *` and
`0 15 * * *`).

**Or via SQL:** enable `pg_cron` + `pg_net` (Dashboard → Database → Extensions),
then run `supabase/schedule_reminders_cron.sql` with `<CRON_SECRET>` filled in (and
add a matching `cron.schedule(...)` call targeting `send-episode-alerts`).

---

## Testing

1. Open the app, sign in, open a movie with a future release date, tap **Notify Me**.
2. Go to Notifications → toggle **Push Notifications** on → allow the prompt.
   Confirm a row appears in `push_subscriptions`.
3. Temporarily set that reminder's `release_date` to today in the `reminders` table.
4. Invoke the function manually:

   ```bash
   curl -i -X POST \
     https://vtftqdsltwernbjvewqm.functions.supabase.co/send-release-reminders \
     -H "Authorization: Bearer <CRON_SECRET>"
   ```

   You should get `{"ok":true,...,"sent":1,...}` and receive a notification.

## Notes

- iOS delivers Web Push only to apps **installed to the Home Screen** (Add to Home
  Screen), on iOS 16.4+.
- Dead subscriptions (browser cleared / permission revoked) return 404/410 and are
  pruned automatically on the next run.
