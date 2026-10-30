-- Trakt connection (the bridge to Nuvio and any other Trakt-synced app).
--
-- One row per user who has linked a Trakt account. The OAuth tokens are only
-- ever read and written by the `trakt` edge function (service role); the
-- browser can see whether it's connected and to whom, and maintain the sync
-- bookkeeping, but never the tokens themselves.
--
-- `snapshot` is the set of titles/episodes both sides agreed on at the end of
-- the last successful sync. It's what lets a sync tell "removed in Nuvio" apart
-- from "added here": an item missing on one side that the snapshot remembers
-- was deleted there; one the snapshot doesn't know about is new.
create table public.trakt_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  snapshot jsonb,
  last_synced_at timestamptz,
  connected_at timestamptz not null default now()
);

alter table public.trakt_connections enable row level security;

create policy "Users can view their own Trakt connection."
  on public.trakt_connections for select
  using (auth.uid() = user_id);

create policy "Users can update their own Trakt connection."
  on public.trakt_connections for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own Trakt connection."
  on public.trakt_connections for delete
  using (auth.uid() = user_id);

-- Column-level grants keep the tokens server-side even though the row is the
-- user's own: no select on access_token/refresh_token, and only the sync
-- bookkeeping is writable. Inserts happen solely through the edge function.
revoke all on public.trakt_connections from anon, authenticated;
grant select (user_id, username, snapshot, last_synced_at, connected_at, expires_at)
  on public.trakt_connections to authenticated;
grant update (snapshot, last_synced_at) on public.trakt_connections to authenticated;
grant delete on public.trakt_connections to authenticated;
