-- Nama Nidhi: fix the puzzle Scoreboard's sort order on an EXISTING
-- project (one that has already run schema.sql, possibly also
-- harden-rls.sql, add-gem-tracking.sql, add-language-tracking.sql, and
-- add-japam-daily-average.sql). Run this once in the Supabase SQL editor.
-- Safe to re-run.
--
-- js/supabase-client.js's fetchPuzzleLeaderboard has always explicitly
-- ordered by total_entries_found, a raw count of every name found
-- (including ones revealed via "సమాధానం చూపు"/"Show answer", which earn
-- no gem) - not the same number as pearls+gems+diamonds, and not even a
-- column the Scoreboard table displays. That let a player with more
-- revealed-not-earned finds outrank someone with strictly higher pearls,
-- gems, diamonds, AND puzzles completed - all four numbers the table
-- actually shows.
--
-- This adds total_score (pearls+gems+diamonds, the number the view's own
-- internal ORDER BY always intended to rank by) as a real column, so the
-- client can explicitly .order() by the same metric that's actually
-- displayed. Purely a view change - no underlying table/column to migrate.

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
