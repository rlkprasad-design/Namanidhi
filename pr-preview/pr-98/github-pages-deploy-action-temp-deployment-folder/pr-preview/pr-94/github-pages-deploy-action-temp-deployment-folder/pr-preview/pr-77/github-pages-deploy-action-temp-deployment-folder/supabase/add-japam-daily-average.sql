-- Nama Nidhi: add a first-logged-at column to japam_leaderboard for an
-- EXISTING project (one that has already run schema.sql, possibly also
-- harden-rls.sql, add-gem-tracking.sql, and add-language-tracking.sql).
-- Run this once in the Supabase SQL editor. Safe to re-run.
--
-- The Scoreboard's Likhita Japam board now shows a "daily average" column
-- (total_count divided by days elapsed since a player's first japam in
-- that language), computed client-side in js/app.js since "days elapsed"
-- depends on today's date, not on when the row was written. This just
-- exposes the one extra fact that computation needs: each player's
-- earliest japam_log timestamp per language.
--
-- CREATE OR REPLACE VIEW can only append new trailing columns, and
-- first_logged_at is a new trailing column here, so no drop/recreate is
-- needed this time (unlike add-gem-tracking.sql's total_pearls, which
-- had to be inserted in the middle of the existing column order).

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
