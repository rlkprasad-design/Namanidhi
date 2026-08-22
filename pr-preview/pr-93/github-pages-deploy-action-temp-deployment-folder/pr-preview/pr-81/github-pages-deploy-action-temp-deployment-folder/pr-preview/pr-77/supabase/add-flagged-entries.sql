-- Nama Nidhi: add a table for player-flagged content on an EXISTING
-- project (one that has already run schema.sql). Run this once in the
-- Supabase SQL editor. Safe to re-run.
--
-- Lets a player tap a small flag icon next to any hint if the word or
-- meaning looks off, without needing to email a screenshot. The
-- Scoreboard screen's new "Flagged questions" panel reads straight from
-- this table, so whoever curates data/questions.json can review and fix
-- flagged entries from inside the app.

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

alter table flagged_entries enable row level security;

create policy "flagged_entries readable by anyone"
  on flagged_entries for select using (true);

create policy "anyone can flag an entry"
  on flagged_entries for insert with check (true);
