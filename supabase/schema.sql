-- Nama Nidhi Supabase schema
-- Run this in the SQL editor of a NEW Supabase project created just for
-- this app - do not reuse the BBA Practice App project.

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  display_name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists puzzle_progress (
  id bigint generated always as identity primary key,
  player_id uuid not null references players(id) on delete cascade,
  category text not null,
  sub_category text,
  level int not null,
  entries_found int not null default 0,
  pearls_found int not null default 0,
  gems_found int not null default 0,
  diamonds_found int not null default 0,
  language text not null default 'te',
  completed_at timestamptz not null default now()
);

create table if not exists japam_log (
  id bigint generated always as identity primary key,
  player_id uuid not null references players(id) on delete cascade,
  name_traced text not null,
  count int not null default 1,
  session_type text not null check (session_type in ('standalone', 'interlude')),
  language text not null default 'te',
  occurred_at timestamptz not null default now()
);

-- Row Level Security --------------------------------------------------
-- Identity here is name-only (no Supabase Auth session), matching the
-- app's "no login for elderly users" design. That means RLS cannot truly
-- restrict "a player writing their own rows" without an auth session -
-- these policies are intentionally permissive (a shared family/community
-- tally, not sensitive data). If this ever opens up beyond a trusted
-- group and impersonation becomes a real concern, add Supabase Auth
-- (e.g. anonymous sign-in) and tighten these policies then - not before.

alter table players enable row level security;
alter table puzzle_progress enable row level security;
alter table japam_log enable row level security;

create policy "players readable by anyone"
  on players for select using (true);
create policy "puzzle_progress readable by anyone"
  on puzzle_progress for select using (true);
create policy "japam_log readable by anyone"
  on japam_log for select using (true);

create policy "anyone can create a player"
  on players for insert with check (true);
create policy "anyone can log puzzle progress"
  on puzzle_progress for insert with check (true);
create policy "anyone can log japam traces"
  on japam_log for insert with check (true);

-- Leaderboard views -----------------------------------------------------
-- Mirrors the leaderboard-view pattern from the BBA Practice App: one view
-- per scoreboard, aggregated per player, read by the Scoreboard screen.

-- Grouped by (display_name, language) rather than just display_name, so a
-- player who has played in both languages gets a separate row per
-- language - the two languages' tallies are never merged into one
-- combined number (see js/app.js's showScoreboard, which fetches with
-- the player's current language). An inner join is used deliberately: a
-- player only appears on a language's board once they've actually played
-- in it.

create or replace view puzzle_leaderboard as
select
  p.display_name,
  pp.language,
  coalesce(sum(pp.entries_found), 0) as total_entries_found,
  coalesce(sum(pp.pearls_found), 0) as total_pearls,
  coalesce(sum(pp.gems_found), 0) as total_gems,
  coalesce(sum(pp.diamonds_found), 0) as total_diamonds,
  count(pp.id) as puzzles_completed
from players p
join puzzle_progress pp on pp.player_id = p.id
group by p.display_name, pp.language
order by coalesce(sum(pp.pearls_found), 0) + coalesce(sum(pp.gems_found), 0) + coalesce(sum(pp.diamonds_found), 0) desc;

create or replace view japam_leaderboard as
select
  p.display_name,
  jl.language,
  coalesce(sum(jl.count), 0) as total_count
from players p
join japam_log jl on jl.player_id = p.id
group by p.display_name, jl.language
order by total_count desc;
