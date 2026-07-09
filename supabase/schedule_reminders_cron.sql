-- Schedule the daily push-notification jobs.
--
-- Two edge functions are scheduled here:
--   send-release-reminders  — "Notify Me" titles releasing today/tomorrow (14:00 UTC).
--   send-episode-alerts     — new episodes of watchlisted TV shows airing today.
--                             Run twice a day (03:00 and 15:00 UTC) so alerts land
--                             within ~12h of an episode dropping; the
--                             episode_notifications table dedupes, so no double sends.
--
-- Prerequisites (Dashboard → Database → Extensions): enable `pg_cron` and `pg_net`.
-- Replace <CRON_SECRET> below with the SAME value you set via
--   supabase secrets set CRON_SECRET=...
--
-- NOTE: this file is a template. Do not commit it with a real secret filled in.
-- The easiest alternative is the no-SQL path: Dashboard → Integrations → Cron →
-- "Create job", target the edge function, add an Authorization header of
-- `Bearer <CRON_SECRET>`, and set the schedule.

-- Release reminders: once daily at 14:00 UTC.
select cron.schedule(
  'send-release-reminders-daily',
  '0 14 * * *',
  $$
  select net.http_post(
    url     := 'https://vtftqdsltwernbjvewqm.functions.supabase.co/send-release-reminders',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <CRON_SECRET>'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- New-episode alerts: twice daily, ~12h apart (03:00 and 15:00 UTC).
select cron.schedule(
  'send-episode-alerts-daily',
  '0 15 * * *',
  $$
  select net.http_post(
    url     := 'https://vtftqdsltwernbjvewqm.functions.supabase.co/send-episode-alerts',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <CRON_SECRET>'
    ),
    body    := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'send-episode-alerts-daily-2',
  '0 3 * * *',
  $$
  select net.http_post(
    url     := 'https://vtftqdsltwernbjvewqm.functions.supabase.co/send-episode-alerts',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <CRON_SECRET>'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- To change a schedule, re-run cron.schedule with the same job name.
-- To remove one:  select cron.unschedule('send-episode-alerts-daily-2');
