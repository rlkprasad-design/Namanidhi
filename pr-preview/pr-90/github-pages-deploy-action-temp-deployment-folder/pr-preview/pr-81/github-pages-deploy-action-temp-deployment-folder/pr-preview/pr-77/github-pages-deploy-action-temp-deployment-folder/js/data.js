// Data-driven content: every entry (deity names, devotees, kshetrams,
// sacred items - no more distinction between them) lives in one file per
// language, data/questions.json (Telugu, the original) or
// data/en/questions.json (English), tagged only by difficulty
// ("easy"/"medium"/"difficult"). Each level in data/levels.json (or
// data/en/levels.json) names the grid-size range and filler mode -
// language-agnostic shape, just kept per-language alongside its content
// so the two can evolve independently (a level tuning change for one
// language shouldn't silently affect the other before it's reviewed).

import { fetchContentOverrides } from './supabase-client.js';

// Overlays any admin-entered corrections (see admin.html and
// supabase/add-content-overrides.sql) on top of the static pool before
// the rest of the app ever sees it - a flagged word/meaning gets fixed
// live for every player without a code deploy. No-ops (returns entries
// unchanged) when Supabase isn't configured/reachable, matching this
// app's local-only fallback everywhere else.
function applyOverrides(entries, overrides, sourceMode) {
  if (!overrides || !overrides.length) return entries;
  const bySourceAndWord = new Map(
    overrides.filter((o) => o.source_mode === sourceMode).map((o) => [o.word, o])
  );
  return entries.map((e) => {
    const o = bySourceAndWord.get(e.word);
    if (!o) return e;
    return {
      ...e,
      word: o.corrected_word || e.word,
      meaning: o.corrected_meaning || e.meaning,
    };
  });
}

function filesFor(lang) {
  const dir = lang === 'te' ? 'data' : `data/${lang}`;
  return {
    questions: `${dir}/questions.json`,
    levels: `${dir}/levels.json`,
    stotrams: `${dir}/stotrams.json`,
    saiSatcharitra: `${dir}/sai-satcharitra.json`,
  };
}

const poolPromises = new Map();
const levelsPromises = new Map();
const stotramsPromises = new Map();
const saiSatcharitraPromises = new Map();

async function fetchJson(file) {
  const res = await fetch(file);
  if (!res.ok) throw new Error(`Failed to load ${file}: ${res.status}`);
  return res.json();
}

// Flat array of { word, meaning, difficulty, era? } - the whole question bank.
export function loadEntryPool(lang = 'te') {
  if (!poolPromises.has(lang)) {
    poolPromises.set(
      lang,
      Promise.all([fetchJson(filesFor(lang).questions).then((data) => data.entries), fetchContentOverrides(lang)])
        .then(([entries, overrides]) => applyOverrides(entries, overrides, 'general'))
    );
  }
  return poolPromises.get(lang);
}

// The shared level ladder (each level names a grid size range, filler
// mode, breather pacing, entry count).
export function loadLevels(lang = 'te') {
  if (!levelsPromises.has(lang)) levelsPromises.set(lang, fetchJson(filesFor(lang).levels));
  return levelsPromises.get(lang);
}

// The "స్తోత్ర పరీక్ష" / Stotra Pariksha sub-section's stotram list. Unlike
// questions.json's pooled entries, each stotram here is a fixed curated
// set - every entry appears every time, nothing is sampled.
export function loadStotrams(lang = 'te') {
  if (!stotramsPromises.has(lang)) {
    stotramsPromises.set(
      lang,
      Promise.all([fetchJson(filesFor(lang).stotrams), fetchContentOverrides(lang)])
        .then(([stotrams, overrides]) => stotrams.map((s) => ({ ...s, entries: applyOverrides(s.entries, overrides, s.id) })))
    );
  }
  return stotramsPromises.get(lang);
}

// "శ్రీ సాయి సచ్చరిత్ర" sub-section's list - same shape and same
// fixed-curated-set model as loadStotrams above (grouped by theme rather
// than by stotram), just its own file so the two content packs can evolve
// independently.
export function loadSaiSatcharitra(lang = 'te') {
  if (!saiSatcharitraPromises.has(lang)) saiSatcharitraPromises.set(lang, fetchJson(filesFor(lang).saiSatcharitra));
  return saiSatcharitraPromises.get(lang);
}
