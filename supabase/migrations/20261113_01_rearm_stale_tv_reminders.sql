-- "Notify Me" on a TV show used to save the series' premiere date instead of
-- its next episode's air date. The release job then saw a date years in the
-- past and sent "out now" the next morning, stamping notified_at so the real
-- release would never be announced.
--
-- Re-arm those reminders: any TV reminder whose date was already past when it
-- was created was never a real upcoming date. Clearing notified_at lets
-- send-release-reminders re-read the next episode from TMDB and fire on time.
update public.reminders
set notified_at = null
where media_type = 'tv'
  and notified_at is not null
  and release_date is not null
  and release_date < created_at::date;
