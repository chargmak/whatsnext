-- "Notify me when it's streaming" reminders.
--
-- Until now a reminder meant one thing: tell me when this title is released
-- (a movie's cinema opening, a show's next episode). A movie that is out in
-- cinemas but not on any streaming service yet needs a second kind, with no
-- date to count down to — send-release-reminders polls TMDB's watch providers
-- for the owner's country and fires once a subscription service lists it.
--
-- kind = 'release'   → the existing date-based reminder (the default, so every
--                      existing row and any older client keeps working).
-- kind = 'streaming' → fire when the title becomes available to stream.
--
-- A title can carry both at once, so the kind joins the unique key.
alter table public.reminders
  add column if not exists kind text not null default 'release';

alter table public.reminders
  drop constraint if exists reminders_kind_check;
alter table public.reminders
  add constraint reminders_kind_check check (kind in ('release', 'streaming'));

alter table public.reminders
  drop constraint if exists reminders_user_id_movie_id_media_type_key;
alter table public.reminders
  drop constraint if exists reminders_user_id_movie_id_media_type_kind_key;
alter table public.reminders
  add constraint reminders_user_id_movie_id_media_type_kind_key
  unique (user_id, movie_id, media_type, kind);
