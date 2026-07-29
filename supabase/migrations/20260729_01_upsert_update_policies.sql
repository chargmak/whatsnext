-- Migration 03 added UPDATE policies to watchlists/history so upsert() could
-- take its ON CONFLICT DO UPDATE path under RLS. reminders and watched_episodes
-- were created afterwards and never got the same treatment, so every upsert
-- that hit an existing row failed with 42501 "new row violates row-level
-- security policy (USING expression)":
--
--   * addReminder() re-saving a title that already had a reminder;
--   * migrateLocalData() importing guest data that overlaps the account;
--   * "Mark Season Seen" / "Seen it" on a partially watched series.
--
-- The episode writes now use ON CONFLICT DO NOTHING and no longer need this,
-- but the policies belong here regardless: every other user-owned table has
-- one, and their absence turns an ordinary re-save into a hard failure.

create policy "Users can update their own reminders."
  on public.reminders for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can update their own watched episodes."
  on public.watched_episodes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
