-- Recreate user FKs with ON DELETE CASCADE so deleting an auth.users row
-- (account deletion) removes all of the user's app data.
alter table public.profiles drop constraint profiles_id_fkey;
alter table public.profiles add constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade;

alter table public.watchlists drop constraint watchlists_user_id_fkey;
alter table public.watchlists add constraint watchlists_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.history drop constraint history_user_id_fkey;
alter table public.history add constraint history_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
