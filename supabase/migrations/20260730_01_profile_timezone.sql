-- Release times are shown in the viewer's own clock, so the profile carries an
-- IANA time zone (e.g. 'Europe/Athens'). The app detects the device zone and
-- sends it at signup; the profile value is the override a viewer can pin from
-- Edit Profile, and it's the only location signal the server-side push jobs have
-- (they fall back to the country when it's null).
alter table public.profiles add column if not exists timezone text;

-- Persist timezone from signup metadata alongside the other profile fields.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url, country, bio, timezone)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'country',
    new.raw_user_meta_data->>'bio',
    new.raw_user_meta_data->>'timezone'
  )
  on conflict (id) do update
    set full_name  = excluded.full_name,
        avatar_url = excluded.avatar_url,
        country    = excluded.country,
        bio        = excluded.bio,
        timezone   = coalesce(excluded.timezone, public.profiles.timezone);
  return new;
end;
$$;
