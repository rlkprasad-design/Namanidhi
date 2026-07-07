# Content entry shapes

There is no category picker in the app - every puzzle mixes entries from
all four content files together, and the hint/meaning line is the only
clue to what each hidden word is. Each `data/*.json` content file (except
`levels.json`) is just a flat list:

```json
{
  "categoryGroup": "devotees",
  "categoryGroupLabel": "భక్తులు",
  "entries": [ /* entry objects go here - see below */ ]
}
```

`categoryGroup`/`categoryGroupLabel` are kept for internal record-keeping
(e.g. what shows in `puzzle_progress` later, or if a filter is ever added
back) - they're not shown to players.

To add a brand new entry: copy the "empty template" for its category
below, fill it in, and add it to that file's `entries` array. That's the
whole process - there's no level to wire it into. As soon as it's in the
file, it's part of the pool every puzzle draws from. Then run
`node scripts/validate-content.js` before opening a PR.

## దైవనామాలు (deity names) - `data/deity-names-*.json`

Filled example:

```json
{ "word": "గోవింద", "meaning": "గోవులను, భూమిని రక్షించువాడు" }
```

Empty template:

```json
{ "word": "", "meaning": "" }
```

## భక్తులు (devotees) - `data/devotees.json`

Devotees additionally carry an internal `era` tag (`"itihasa"`,
`"purana"`, or `"bhakti"`) - it's not shown as a filter in the app, just
used for organizing content; the `meaning` line is what actually tells
players who the person is and roughly when they lived.

Filled example:

```json
{ "word": "శబరి", "era": "itihasa", "meaning": "రామభక్తురాలు, ఎంగిలి పండ్లు స్వీకరించిన భక్తి ప్రతీక" }
```

Empty template:

```json
{ "word": "", "era": "", "meaning": "" }
```

## క్షేత్రాలు (kshetrams) - `data/kshetrams.json`

Filled example:

```json
{ "word": "తిరుమల", "meaning": "వేంకటేశ్వరుని నివాసం, ఆంధ్రప్రదేశ్‌లోని ప్రసిద్ధ క్షేత్రం" }
```

Empty template:

```json
{ "word": "", "meaning": "" }
```

## పూజా సామగ్రి (sacred items) - `data/sacred-items.json`

Filled example:

```json
{ "word": "విభూతి", "meaning": "శివారాధనలో నుదుటిపై ధరించే పవిత్ర భస్మం" }
```

Empty template:

```json
{ "word": "", "meaning": "" }
```

## The level ladder - `data/levels.json`

This is separate from content - it's the shape of each puzzle, shared
across the whole pool:

```json
{ "levelNumber": 1, "gridSize": 8, "fillerMode": "random", "breather": true, "japamCount": 3, "entryCount": 5 }
```

- `gridSize` - the grid is `gridSize x gridSize`; must be big enough to
  fit the longest word you expect to draw (the validator checks the whole
  pool against every level's `gridSize`).
- `fillerMode` - `"random"` (easy) or `"curated"` (fillers echo the
  puzzle's own letters, harder to scan).
- `breather` - marks an easier level sprinkled between harder ones.
- `japamCount` - how many Sri Rama traces the post-level interlude asks
  for.
- `entryCount` - how many entries this level's puzzle draws from the pool
  each time (a new random selection every time you play or hit "కొత్త
  పజిల్").
