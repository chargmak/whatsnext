-- Self-serve account deletion. Deleting the auth.users row cascades to
-- profiles/watchlists/history/watched_episodes/reminders via their FKs.
create or replace function public.delete_user()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.delete_user() from anon, public;
grant execute on function public.delete_user() to authenticated;
