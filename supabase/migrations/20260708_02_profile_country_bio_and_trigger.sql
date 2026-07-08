-- Profiles carry the extra fields the app collects at signup.
alter table public.profiles add column if not exists country text;
alter table public.profiles add column if not exists bio text;

-- Persist country/bio from signup metadata; upsert so a pre-existing
-- profile row never makes the trigger fail.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url, country, bio)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'country',
    new.raw_user_meta_data->>'bio'
  )
  on conflict (id) do update
    set full_name  = excluded.full_name,
        avatar_url = excluded.avatar_url,
        country    = excluded.country,
        bio        = excluded.bio;
  return new;
end;
$$;
