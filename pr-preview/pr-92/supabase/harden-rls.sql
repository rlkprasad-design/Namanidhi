-- Nama Nidhi: tighten public read access on an EXISTING project
-- (one that has already run schema.sql). Run this once in the Supabase
-- SQL editor. Safe to re-run.
--
-- What this changes:
--   1. Raw event tables (puzzle_progress, japam_log) stop being directly
--      readable by anyone holding the public anon key - only the two
--      aggregated leaderboard views stay readable. The app never reads
--      these tables directly (only inserts into them and reads the
--      views), so this is invisible to how the app behaves; it just
--      stops a stranger from pulling every individual timestamped
--      puzzle/japam event instead of the totals the Scoreboard already
--      shows.
--   2. Adds sanity bounds on submitted values, so a stray or malicious
--      direct API call can't post an absurd count/length into the
--      shared board.
--
-- `players` stays selectable - the app needs to look up an existing
-- display_name so a returning player can resume under their own name
-- (see js/supabase-client.js's ensurePlayer), and that row only ever
-- holds a name + id + timestamp, already visible via the leaderboard
-- anyway.

drop policy if exists "puzzle_progress readable by anyone" on puzzle_progress;
drop policy if exists "japam_log readable by anyone" on japam_log;

grant select on puzzle_leaderboard, japam_leaderboard to anon, authenticated;

alter table players
  drop constraint if exists players_display_name_length,
  add constraint players_display_name_length check (char_length(display_name) between 1 and 40);

alter table puzzle_progress
  drop constraint if exists puzzle_progress_entries_found_range,
  add constraint puzzle_progress_entries_found_range check (entries_found between 0 and 50);

alter table japam_log
  drop constraint if exists japam_log_count_range,
  add constraint japam_log_count_range check (count between 1 and 500),
  drop constraint if exists japam_log_name_traced_length,
  add constraint japam_log_name_traced_length check (char_length(name_traced) between 1 and 200);
