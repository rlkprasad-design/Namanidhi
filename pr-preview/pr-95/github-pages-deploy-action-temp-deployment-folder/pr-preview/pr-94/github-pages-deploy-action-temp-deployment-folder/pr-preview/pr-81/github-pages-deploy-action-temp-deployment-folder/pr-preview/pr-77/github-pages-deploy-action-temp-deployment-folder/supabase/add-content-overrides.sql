-- Nama Nidhi: add a table for admin-entered content corrections on an
-- EXISTING project (one that has already run schema.sql and
-- add-flagged-entries.sql). Run this once in the Supabase SQL editor.
-- Safe to re-run.
--
-- data/questions.json, data/stotrams.json etc. are static files shipped
-- with the site, so fixing a flagged word/meaning there means editing
-- code and waiting for a deploy - this table lets the admin page
-- (admin.html) fix an entry immediately, live, for every player, without
-- a deploy: js/data.js loads the static pool as before, then overlays any
-- matching row here on top before the app ever sees it.
--
-- Keyed the same way flagged_entries already is (language, source_mode,
-- word) so a correction submitted from the admin page can be matched back
-- to the exact flagged row and the exact pool entry it came from - the
-- same word text can legitimately appear in more than one pool (e.g. both
-- the general pool and a specific stotram) with a different meaning in
-- each, so source_mode has to be part of the match, not just the word.

create table if not exists content_overrides (
  id bigint generated always as identity primary key,
  language text not null,
  source_mode text not null, -- 'general' (Puranas pool) or a stotram id
  word text not null, -- the ORIGINAL word text this correction matches against
  corrected_word text, -- null if only the meaning needed fixing
  corrected_meaning text, -- null if only the word needed fixing
  created_at timestamptz not null default now()
);

alter table content_overrides enable row level security;

-- Matches this app's existing trust model (see schema.sql's RLS note and
-- flagged_entries' own policies): no real per-user auth, so the "admin
-- only" boundary is enforced by admin.html's password gate, not by RLS.
-- The public app itself needs read access to apply corrections for every
-- player, which is why select can't be locked down further here.
create policy "content_overrides readable by anyone"
  on content_overrides for select using (true);

create policy "anyone can insert a content override"
  on content_overrides for insert with check (true);

create policy "anyone can delete a content override"
  on content_overrides for delete using (true);
