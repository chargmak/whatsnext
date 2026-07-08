# Release Notifications Setup

This app can send a **Web Push notification** when a movie or show you tapped
**Notify Me** on is released — even when the app is closed.

## How it works

1. On the Notifications page, **Push Notifications** asks for permission and
   subscribes the browser's service worker (`public/sw.js`) using a VAPID key.
2. The subscription is saved to the `push_subscriptions` table (per signed-in user).
3. A daily cron invokes the **`send-release-reminders`** edge function, which finds
   reminders releasing today/tomorrow that haven't been notified, sends a push to
   each of the user's devices, and stamps `reminders.notified_at` so it fires once.

> Scheduled alerts require a **signed-in account** — guest reminders live only in
> `localStorage`, which the server never sees.

---

## One-time setup

### 1. VAPID keys

A key pair was generated for this project. The **public** key is below (safe to
commit / expose to the browser). The matching **private** key is a secret and is
intentionally NOT stored in this repo — keep it only in your edge-function
secrets. Regenerate a fresh pair anytime with `node scripts/generate-vapid-keys.mjs`.

```
VAPID_PUBLIC_KEY=BLFJ5RgLUqUnHBkyHvRmTl-2CJPiiwFOaQVlJHvJSiGMKWCvtdiY5AGdgWDrrc1T3PgHBFOiPrQxsIzO2S2hjIQ
VAPID_PRIVATE_KEY=<keep secret — do not commit>
```

### 2. Client env

Add the public key to your client env (`.env` locally, and your Vercel project's
Environment Variables), then rebuild/redeploy:

```
VITE_VAPID_PUBLIC_KEY=BLFJ5RgLUqUnHBkyHvRmTl-2CJPiiwFOaQVlJHvJSiGMKWCvtdiY5AGdgWDrrc1T3PgHBFOiPrQxsIzO2S2hjIQ
```

### 3. Database

Apply the migration that adds `push_subscriptions` and `reminders.notified_at`:

```bash
supabase db push
```

(Already applied to the hosted project if you used the assistant's deploy.)

### 4. Deploy the edge function

```bash
supabase functions deploy send-release-reminders
```

`supabase/config.toml` already sets `verify_jwt = false` for it — the function
does its own auth via `CRON_SECRET`.

### 5. Edge-function secrets

Pick any strong random string for `CRON_SECRET` (e.g. `openssl rand -hex 32`):

```bash
supabase secrets set \
  VAPID_PUBLIC_KEY=BLFJ5RgLUqUnHBkyHvRmTl-2CJPiiwFOaQVlJHvJSiGMKWCvtdiY5AGdgWDrrc1T3PgHBFOiPrQxsIzO2S2hjIQ \
  VAPID_PRIVATE_KEY=<your-vapid-private-key> \
  VAPID_SUBJECT=mailto:you@example.com \
  CRON_SECRET=<your-random-secret>
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

### 6. Schedule the daily job

**Easiest:** Dashboard → Integrations → **Cron** → create a job targeting the
`send-release-reminders` function, add header `Authorization: Bearer <CRON_SECRET>`,
schedule `0 14 * * *`.

**Or via SQL:** enable `pg_cron` + `pg_net` (Dashboard → Database → Extensions),
then run `supabase/schedule_reminders_cron.sql` with `<CRON_SECRET>` filled in.

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
