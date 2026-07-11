-- CineBot (the AI chat assistant) was removed from the app; its per-user
-- daily rate-limit counter goes with it. RLS policies drop with the table.
drop table if exists public.cinebot_usage;
