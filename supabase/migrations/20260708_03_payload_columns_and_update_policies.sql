-- payload holds the full app-shaped item so list round-trips are lossless.
alter table public.watchlists add column if not exists payload jsonb;
alter table public.history    add column if not exists payload jsonb;

-- upsert() performs an UPDATE on conflict; without these policies re-adding
-- an existing item would fail RLS.
create policy "Users can update their own watchlist."
  on public.watchlists for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can update their own history."
  on public.history for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
