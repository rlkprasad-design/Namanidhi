// Data-driven content: every entry (deity names, devotees, kshetrams,
// sacred items - no more distinction between them) lives in one file,
// data/questions.json, tagged only by difficulty ("easy"/"medium"/
// "difficult"). Each level in data/levels.json names the difficulty tier
// it draws from. Adding a new entry to questions.json makes it available
// in rotation immediately, no other wiring required.

const QUESTIONS_FILE = 'data/questions.json';
const LEVELS_FILE = 'data/levels.json';
const STOTRAMS_FILE = 'data/stotrams.json';

let poolPromise = null;
let levelsPromise = null;
let stotramsPromise = null;

async function fetchJson(file) {
  const res = await fetch(file);
  if (!res.ok) throw new Error(`Failed to load ${file}: ${res.status}`);
  return res.json();
}

// Flat array of { word, meaning, difficulty, era? } - the whole question bank.
export function loadEntryPool() {
  if (!poolPromise) {
    poolPromise = fetchJson(QUESTIONS_FILE).then((data) => data.entries);
  }
  return poolPromise;
}

// The shared level ladder (each level names a difficulty tier, grid size,
// filler mode, breather pacing, entry count).
export function loadLevels() {
  if (!levelsPromise) levelsPromise = fetchJson(LEVELS_FILE);
  return levelsPromise;
}

// The "స్తోత్ర పరీక్ష" sub-section's stotram list. Unlike questions.json's
// pooled entries, each stotram here is a fixed curated set - every entry
// appears every time, nothing is sampled.
export function loadStotrams() {
  if (!stotramsPromise) stotramsPromise = fetchJson(STOTRAMS_FILE);
  return stotramsPromise;
}
