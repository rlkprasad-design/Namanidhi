// Data-driven content: every entry (deity names, devotees, kshetrams,
// sacred items - no more distinction between them) lives in one file per
// language, data/questions.json (Telugu, the original) or
// data/en/questions.json (English), tagged only by difficulty
// ("easy"/"medium"/"difficult"). Each level in data/levels.json (or
// data/en/levels.json) names the grid-size range and filler mode -
// language-agnostic shape, just kept per-language alongside its content
// so the two can evolve independently (a level tuning change for one
// language shouldn't silently affect the other before it's reviewed).

function filesFor(lang) {
  const dir = lang === 'te' ? 'data' : `data/${lang}`;
  return {
    questions: `${dir}/questions.json`,
    levels: `${dir}/levels.json`,
    stotrams: `${dir}/stotrams.json`,
  };
}

const poolPromises = new Map();
const levelsPromises = new Map();
const stotramsPromises = new Map();

async function fetchJson(file) {
  const res = await fetch(file);
  if (!res.ok) throw new Error(`Failed to load ${file}: ${res.status}`);
  return res.json();
}

// Flat array of { word, meaning, difficulty, era? } - the whole question bank.
export function loadEntryPool(lang = 'te') {
  if (!poolPromises.has(lang)) {
    poolPromises.set(lang, fetchJson(filesFor(lang).questions).then((data) => data.entries));
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
  if (!stotramsPromises.has(lang)) stotramsPromises.set(lang, fetchJson(filesFor(lang).stotrams));
  return stotramsPromises.get(lang);
}
