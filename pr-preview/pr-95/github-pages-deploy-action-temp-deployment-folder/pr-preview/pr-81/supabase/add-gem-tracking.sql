-- Nama Nidhi: add pearl/gem/diamond tracking to an EXISTING project
-- (one that has already run schema.sql, possibly also harden-rls.sql).
-- Run this once in the Supabase SQL editor. Safe to re-run.
--
-- Nama Gupta Nidhi puzzles now mix easy/medium/difficult words in the
-- same grid, and each difficulty is worth a different find:
--   easy      -> ముత్యం (pearl)
--   medium    -> రత్నం (gem)
--   difficult -> వజ్రం (diamond)
-- A word revealed via "సమాధానం చూపు" still completes the puzzle but
-- does not earn its gem - only self-found words are counted (see
-- markFound's earnedGem handling in js/app.js).
--
-- This adds the three counter columns to puzzle_progress and rebuilds
-- puzzle_leaderboard to expose the per-gem totals the Scoreboard screen
-- now reads, alongside a puzzles_completed column (renamed from
-- levels_completed, matching the move away from named difficulty tiers).

alter table puzzle_progress
  add column if not exists pearls_found int not null default 0,
  add column if not exists gems_found int not null default 0,
  add column if not exists diamonds_found int not null default 0;

-- The existing view's 2nd column is named levels_completed; the new one
-- is total_pearls in the same position. CREATE OR REPLACE VIEW can only
-- append new trailing columns, not rename/reorder existing ones, so the
-- old view has to be dropped first.
drop view if exists puzzle_leaderboard;

create view puzzle_leaderboard as
select
  p.display_name,
  coalesce(sum(pp.entries_found), 0) as total_entries_found,
  coalesce(sum(pp.pearls_found), 0) as total_pearls,
  coalesce(sum(pp.gems_found), 0) as total_gems,
  coalesce(sum(pp.diamonds_found), 0) as total_diamonds,
  count(pp.id) as puzzles_completed
from players p
left join puzzle_progress pp on pp.player_id = p.id
group by p.display_name
order by coalesce(sum(pp.pearls_found), 0) + coalesce(sum(pp.gems_found), 0) + coalesce(sum(pp.diamonds_found), 0) desc;
