-- Nama Nidhi: allow dismissing a flagged entry on an EXISTING project (one
-- that already ran add-flagged-entries.sql). Run this once in the Supabase
-- SQL editor. Safe to re-run.
--
-- add-flagged-entries.sql only ever granted select/insert on
-- flagged_entries, so once a flagged word's meaning was fixed in
-- data/questions.json, the flag itself had no way to leave the queue -
-- the Scoreboard's "Flagged questions" panel would show it forever. This
-- adds a delete policy (matching the existing "anyone can insert" trust
-- model - see schema.sql's RLS note) and js/app.js wires a dismiss button
-- to it, so clearing a resolved flag is one tap from inside the app.

drop policy if exists "anyone can dismiss a flagged entry" on flagged_entries;
create policy "anyone can dismiss a flagged entry"
  on flagged_entries for delete using (true);
