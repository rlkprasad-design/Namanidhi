// Data-driven content: one JSON file per category/stotram. Adding more
// content later (a new stotram, more devotees) never touches this code -
// just add a file here and drop the JSON in data/.

export const DATASET_FILES = [
  'data/deity-names-vishnu-sahasranamam.json',
  'data/devotees.json',
  'data/kshetrams.json',
  'data/sacred-items.json',
];

const cache = new Map();

export async function loadDataset(file) {
  if (cache.has(file)) return cache.get(file);
  const res = await fetch(file);
  if (!res.ok) throw new Error(`Failed to load ${file}: ${res.status}`);
  const json = await res.json();
  cache.set(file, json);
  return json;
}

export async function loadAllDatasets() {
  return Promise.all(DATASET_FILES.map(loadDataset));
}

// Groups datasets by categoryGroup (దైవనామాలు / భక్తులు / క్షేత్రాలు / పూజా సామగ్రి)
// for the Home screen's first-level choice.
export async function loadCategoryGroups() {
  const all = await loadAllDatasets();
  const groups = new Map();
  for (const ds of all) {
    if (!groups.has(ds.categoryGroup)) {
      groups.set(ds.categoryGroup, { id: ds.categoryGroup, label: ds.categoryGroupLabel, datasets: [] });
    }
    groups.get(ds.categoryGroup).datasets.push(ds);
  }
  return Array.from(groups.values());
}
