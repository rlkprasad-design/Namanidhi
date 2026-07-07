# Content entry shapes

Every file in `data/*.json` follows this same top-level shape:

```json
{
  "categoryGroup": "devotees",
  "categoryGroupLabel": "భక్తులు",
  "subGroupId": null,
  "subGroupLabel": null,
  "levels": [
    {
      "levelNumber": 1,
      "gridSize": 8,
      "fillerMode": "random",
      "breather": true,
      "japamCount": 3,
      "entries": [ /* entry objects go here - see below */ ]
    }
  ]
}
```

- `subGroupId`/`subGroupLabel` are only non-null when a category has a real
  sub-group to pick between (e.g. a specific stotram for deity names).
  Use `null` for both when there isn't one.
- `fillerMode` is `"random"` or `"curated"` - random for easier/breather
  levels, curated (fillers drawn from the puzzle's own letters) for harder
  ones.
- `japamCount` is how many Sri Rama traces the post-level interlude asks
  for after that level - small for breather levels, larger for hard ones.
- New `levelNumber`s must be unique within the file and roughly increase
  in difficulty; `gridSize` must be big enough to fit every entry's word
  (the validator checks this).

To add a brand new entry, copy the "empty template" for its category
below, fill it in, and add it to the `entries` array of the right level
(or a new level, following the shape above). Then run
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
