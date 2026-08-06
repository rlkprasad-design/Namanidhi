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

-- A player-flagged content entry (an off-beat word or meaning noticed
-- during a puzzle), so whoever curates data/questions.json can review
-- and fix them without needing anyone to email a screenshot. No foreign
-- key to players - flagged_by is just the display name at flag time, same
-- trust-based identity model as everywhere else in this schema.
create table if not exists flagged_entries (
  id bigint generated always as identity primary key,
  word text not null,
  meaning text not null,
  language text not null default 'te',
  difficulty text,
  source_mode text not null, -- 'general' (Puranas pool) or a stotram id
  flagged_by text,
  created_at timestamptz not null default now()
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
alter table flagged_entries enable row level security;

create policy "players readable by anyone"
  on players for select using (true);
create policy "puzzle_progress readable by anyone"
  on puzzle_progress for select using (true);
create policy "japam_log readable by anyone"
  on japam_log for select using (true);
create policy "flagged_entries readable by anyone"
  on flagged_entries for select using (true);

create policy "anyone can create a player"
  on players for insert with check (true);
create policy "anyone can log puzzle progress"
  on puzzle_progress for insert with check (true);
create policy "anyone can log japam traces"
  on japam_log for insert with check (true);
create policy "anyone can flag an entry"
  on flagged_entries for insert with check (true);
create policy "anyone can dismiss a flagged entry"
  on flagged_entries for delete using (true);

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

-- total_score is exposed as its own column (not just an ORDER BY
-- expression) specifically so js/supabase-client.js's fetchPuzzleLeaderboard
-- can .order() by it explicitly - PostgREST doesn't guarantee it will honor
-- a view's own internal ORDER BY, so the ranking a player actually sees
-- must come from a column the client requests by name, not this view's
-- default order alone.

create or replace view puzzle_leaderboard as
select
  p.display_name,
  pp.language,
  coalesce(sum(pp.entries_found), 0) as total_entries_found,
  coalesce(sum(pp.pearls_found), 0) as total_pearls,
  coalesce(sum(pp.gems_found), 0) as total_gems,
  coalesce(sum(pp.diamonds_found), 0) as total_diamonds,
  count(pp.id) as puzzles_completed,
  coalesce(sum(pp.pearls_found), 0) + coalesce(sum(pp.gems_found), 0) + coalesce(sum(pp.diamonds_found), 0) as total_score
from players p
join puzzle_progress pp on pp.player_id = p.id
group by p.display_name, pp.language
order by total_score desc;

-- first_logged_at feeds the Scoreboard's daily-average column (total_count
-- divided by days elapsed since a player's first japam in this language) -
-- computed client-side in js/app.js rather than here, since "days elapsed"
-- depends on the current date at read time, not write time.

create or replace view japam_leaderboard as
select
  p.display_name,
  jl.language,
  coalesce(sum(jl.count), 0) as total_count,
  min(jl.occurred_at) as first_logged_at
from players p
join japam_log jl on jl.player_id = p.id
group by p.display_name, jl.language
order by total_count desc;
