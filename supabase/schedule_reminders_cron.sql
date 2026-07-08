-- Schedule the daily release-reminder push job.
--
-- Prerequisites (Dashboard → Database → Extensions): enable `pg_cron` and `pg_net`.
-- Replace <CRON_SECRET> below with the SAME value you set via
--   supabase secrets set CRON_SECRET=...
--
-- NOTE: this file is a template. Do not commit it with a real secret filled in.
-- The easiest alternative is the no-SQL path: Dashboard → Integrations → Cron →
-- "Create job", target the `send-release-reminders` edge function, add an
-- Authorization header of `Bearer <CRON_SECRET>`, and set the schedule.

select cron.schedule(
  'send-release-reminders-daily',
  '0 14 * * *', -- every day at 14:00 UTC
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

-- To change the schedule, re-run cron.schedule with the same job name.
-- To remove it:  select cron.unschedule('send-release-reminders-daily');
