-- Nama Nidhi: backfill pearls/gems/diamonds for puzzles completed BEFORE
-- the gem-tracking columns existed. Run this once in the Supabase SQL
-- editor, any time after add-gem-tracking.sql. Safe to re-run (each
-- update only touches rows it hasn't already touched).
--
-- Before the gem system, a puzzle was always a single difficulty tier
-- end to end (category was literally 'easy'/'medium'/'difficult'), so
-- entries_found on those old rows IS the count for that one gem type -
-- not a guess, just never copied into the new columns when they were
-- added. Rows from 'mixed' (Nama Gupta Nidhi's current mixed-difficulty
-- puzzles) or 'stotram' (Stotra Pariksha) can't be backfilled this way,
-- since those puzzles were never single-tier - if they show 0 gems with
-- real entries_found, it's either from before that mode's own gem
-- tracking shipped, or every word in that puzzle was revealed via
-- "సమాధానం చూపు" (which legitimately earns nothing).
--
-- Note: the old system didn't distinguish a hint-revealed word from a
-- self-found one - every find counted the same. This backfill treats
-- that old history as fully earned under the rules that applied at the
-- time, rather than retroactively docking it under today's stricter rule.

update puzzle_progress
set pearls_found = entries_found
where category = 'easy'
  and pearls_found = 0
  and gems_found = 0
  and diamonds_found = 0
  and entries_found > 0;

update puzzle_progress
set gems_found = entries_found
where category = 'medium'
  and pearls_found = 0
  and gems_found = 0
  and diamonds_found = 0
  and entries_found > 0;

update puzzle_progress
set diamonds_found = entries_found
where category = 'difficult'
  and pearls_found = 0
  and gems_found = 0
  and diamonds_found = 0
  and entries_found > 0;
