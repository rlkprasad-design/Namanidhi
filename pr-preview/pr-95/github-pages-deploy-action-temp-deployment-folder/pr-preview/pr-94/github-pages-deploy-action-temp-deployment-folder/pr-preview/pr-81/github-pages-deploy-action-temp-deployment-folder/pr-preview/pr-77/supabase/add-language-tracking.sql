-- Nama Nidhi: add per-language tracking to an EXISTING project
-- (one that has already run schema.sql, possibly also harden-rls.sql
-- and add-gem-tracking.sql). Run this once in the Supabase SQL editor.
-- Safe to re-run.
--
-- Until now, syncsToBackend() in js/app.js only synced Telugu play to
-- this shared scoreboard - English-mode play stayed on each device's own
-- localStorage and was never visible to anyone else, which is why an
-- English player's scores could look "missing" no matter how long you
-- waited. Both languages now sync here, kept as separate per-language
-- tallies per player (not merged into one combined number) via the new
-- `language` column below.
--
-- Every row written before this migration was Telugu (the only language
-- that used to sync), so the default of 'te' on the new column is
-- historically accurate for existing data - nothing needs backfilling.

alter table puzzle_progress
  add column if not exists language text not null default 'te';

alter table japam_log
  add column if not exists language text not null default 'te';

-- Both leaderboard views now group by (display_name, language) instead of
-- just display_name, so a player who has played in both languages gets a
-- separate row per language. The Scoreboard screen filters its fetch to
-- the player's current language, so this shows as one board per language
-- rather than a blended total. Using an inner join (not left join) here
-- so a player only appears on a language's board once they've actually
-- played in it, matching the zero-totals filtering the Scoreboard screen
-- already does client-side.

drop view if exists puzzle_leaderboard;

create view puzzle_leaderboard as
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

drop view if exists japam_leaderboard;

create view japam_leaderboard as
select
  p.display_name,
  jl.language,
  coalesce(sum(jl.count), 0) as total_count
from players p
join japam_log jl on jl.player_id = p.id
group by p.display_name, jl.language
order by total_count desc;
