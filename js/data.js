// Data-driven content: one JSON file per source (deity names, devotees,
// kshetrams, sacred items), each just a flat list of { word, meaning }
// entries - no levels, no category picker. Every puzzle draws from the
// combined pool of all of them, so adding a new entry to any file makes
// it available in rotation immediately, no other wiring required.

export const POOL_FILES = [
  'data/deity-names-vishnu-sahasranamam.json',
  'data/devotees.json',
  'data/kshetrams.json',
  'data/sacred-items.json',
];

const LEVELS_FILE = 'data/levels.json';

let poolPromise = null;
let levelsPromise = null;

async function fetchJson(file) {
  const res = await fetch(file);
  if (!res.ok) throw new Error(`Failed to load ${file}: ${res.status}`);
  return res.json();
}

// Flat array of { word, meaning, era?, category } pooled from every content file.
export function loadEntryPool() {
  if (!poolPromise) {
    poolPromise = Promise.all(POOL_FILES.map(fetchJson)).then((datasets) =>
      datasets.flatMap((ds) => ds.entries.map((e) => ({ ...e, category: ds.categoryGroup })))
    );
  }
  return poolPromise;
}

// The shared level ladder (grid size, filler mode, breather pacing, entry count).
export function loadLevels() {
  if (!levelsPromise) levelsPromise = fetchJson(LEVELS_FILE);
  return levelsPromise;
}
