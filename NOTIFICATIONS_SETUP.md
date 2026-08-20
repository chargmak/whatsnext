# Release Notifications Setup

This app can send **Web Push notifications** — even when the app is closed — for:

- **Release reminders**: a movie or show you tapped **Notify Me** on is released.
- **New episodes**: a new episode of a TV show **in your watchlist** has aired.

## How it works

1. On the Notifications page, **Push Notifications** asks for permission and
   subscribes the browser's service worker (`public/sw.js`) using a VAPID key.
2. The subscription is saved to the `push_subscriptions` table (per signed-in user).
3. Two scheduled crons deliver alerts:
   - **`send-release-reminders`** finds reminders releasing today/tomorrow that
     haven't been notified, pushes to each of the user's devices, and stamps
     `reminders.notified_at` so it fires once.
   - **`send-episode-alerts`** looks at every TV show in each subscribed user's
     watchlist and works out the *instant* its latest episode actually drops —
     TMDB's date-only `air_date` joined to the platform's release hour, in the
     platform's own timezone (Netflix 00:00 Pacific, Apple 21:00 Pacific — which
     is midnight Eastern the next day — HBO 21:00 Eastern, and so on). The alert
     goes out only once that instant has passed, so nobody is told an episode is
     out the day before they can watch it. Each `(user, show, season, episode)`
     is recorded in `episode_notifications` so it fires only once.

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

Apply the migrations that add `push_subscriptions`, `reminders.notified_at`,
`episode_notifications`, and `profiles.timezone` (the alerts phrase air times in
each recipient's own zone, falling back to their country):

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
`Authorization: Bearer <CRON_SECRET>`, and schedule them: `0 14 * * *` for
`send-release-reminders`, and `0 */3 * * *` for `send-episode-alerts` (platforms
drop at their own hour, so a less frequent job can sit on an episode for hours
after it lands).

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

## Troubleshooting: alerts stopped arriving

Start at the `push_subscriptions` table. **If it's empty, nothing can be
delivered** — the crons will keep running and returning `{"ok":true,...,"sent":0}`,
because there's no device to send to:

```sql
select user_id, user_agent, created_at from push_subscriptions;
```

A Web Push subscription is **not permanent**. The push service retires it on its
own after a browser update, a reinstalled PWA, storage pressure, or a long idle
stretch. The old endpoint then returns 410 and the delivery job prunes the row —
correctly, but that used to be the end of it: the row was only ever written at
the moment the toggle was flipped, so nothing recreated it. Meanwhile the
Notifications toggle kept reading "on", because it reflected the *browser's*
subscription, not the server's row.

That gap is now closed on three fronts:

- `syncPushSubscription()` (`src/services/push.js`) re-registers the device on
  every signed-in app load. Permission is already granted in this case, so it
  resubscribes silently — no prompt.
- `sw.js` handles `pushsubscriptionchange` and resubscribes the moment the push
  service retires an endpoint; the app persists the replacement on next open.
- The Notifications page checks the *server* row, not just the browser, and says
  so when a device needs re-registering instead of showing a toggle that lies.

A subscription created against a **different VAPID key** (a rotation, or one left
over from an older deployment) is also detected and replaced — the push service
refuses those sends with `403 VapidPkHashMismatch`, which is equally invisible
from the app.

Other things worth checking, in order:

1. `select * from cron.job` — both jobs present and `active`.
2. `select * from cron.job_run_details order by start_time desc limit 5` — the
   jobs are firing (this only proves the HTTP request was *made*).
3. Dashboard → Edge Functions → Logs — the invocation returned 200, not 401
   (`CRON_SECRET` mismatch) or 500 (missing VAPID / TMDB secrets).
4. `select id, title, release_date, notified_at from reminders` — an alert that
   already fired has `notified_at` set and will never fire again.

## Troubleshooting: an alert arrived on the wrong day

An episode alert that lands before the episode does means the job resolved the
wrong air *instant*. Two things to check, in this order:

1. **Is the deployed function the one in this repo?** Edge functions ship
   separately from the app — a merged fix changes nothing until
   `supabase functions deploy send-episode-alerts` runs. Dashboard → Edge
   Functions shows each function's version and last deploy; compare that against
   the commit that last touched `supabase/functions/`. An older build compared
   `air_date` with today's UTC date and announced evening drops up to a day
   early.
2. **Does the show's platform still match a release rule?** The rules live in
   `supabase/functions/_shared/air-time.ts` (mirroring `src/services/releaseTime.js`
   — keep the two in sync) and are matched against TMDB's `networks[].name`.
   Platforms get renamed: TMDB reports Apple's service as plain **"Apple TV"**
   since the 2025 rebrand, so a rule written for `apple tv+` alone stops
   matching and the show silently falls back to an origin-country prime-time
   guess. Check what TMDB actually says:

   ```bash
   curl -s "https://api.themoviedb.org/3/tv/<id>?api_key=<key>" \
     | jq '{networks: [.networks[].name], next: .next_episode_to_air.air_date}'
   ```

   Also remember TMDB dates each episode by the **platform's** calendar day, not
   the viewer's: Apple drops at 21:00 Pacific, so an episode dated Thursday is a
   Friday morning release across Europe.

## Notes

- iOS delivers Web Push only to apps **installed to the Home Screen** (Add to Home
  Screen), on iOS 16.4+.
- Dead subscriptions (browser cleared / permission revoked) return 404/410 and are
  pruned automatically on the next run.
