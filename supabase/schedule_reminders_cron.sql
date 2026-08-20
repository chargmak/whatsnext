-- Schedule the push-notification jobs.
--
-- Two edge functions are scheduled here:
--   send-release-reminders  — "Notify Me" titles releasing today/tomorrow (14:00 UTC).
--   send-episode-alerts     — new episodes of watchlisted TV shows that have
--                             actually aired (air date + the platform's release
--                             hour, in the platform's zone). Run every 3 hours:
--                             platforms drop at their own hour (Netflix 00:00
--                             Pacific, Apple 21:00 Pacific, HBO 21:00 Eastern),
--                             so a twice-daily job could sit on an episode for
--                             half a day. The episode_notifications table
--                             dedupes, so the extra runs never double-send.
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

-- New-episode alerts: every 3 hours, so an alert lands within 3h of the drop.
select cron.schedule(
  'send-episode-alerts-3h',
  '0 */3 * * *',
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

-- Retire the twice-daily jobs this replaces. cron.unschedule raises on a job
-- that isn't there, so a fresh project doesn't trip over these.
do $$
declare
  stale text;
begin
  foreach stale in array array['send-episode-alerts-daily', 'send-episode-alerts-daily-2'] loop
    begin
      perform cron.unschedule(stale);
    exception when others then null;
    end;
  end loop;
end $$;

-- To change a schedule, re-run cron.schedule with the same job name.
-- To remove one:  select cron.unschedule('send-episode-alerts-3h');
