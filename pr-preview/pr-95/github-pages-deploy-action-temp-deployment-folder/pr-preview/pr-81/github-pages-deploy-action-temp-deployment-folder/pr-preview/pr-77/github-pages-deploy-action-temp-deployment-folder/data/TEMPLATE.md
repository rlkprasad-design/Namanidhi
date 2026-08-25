# Content entry shape

All content lives in one file, `data/questions.json` - deity names,
devotees, kshetrams, sacred items, all mixed together with no category of
their own. Every puzzle draws from this pool, and the hint/meaning line is
the only clue to what each hidden word is. The one thing that does sort
entries is **difficulty**: `"easy"`, `"medium"`, or `"difficult"` - each
level in `data/levels.json` names the tier it draws from.

```json
{
  "entries": [ /* entry objects go here - see below */ ]
}
```

## Adding a new entry

Filled example:

```json
{ "word": "గోవింద", "meaning": "గోవులను, భూమిని రక్షించువాడు", "difficulty": "easy" }
```

Empty template:

```json
{ "word": "", "meaning": "", "difficulty": "easy" }
```

- `word` - the Telugu text to hide in the grid / trace in Likhita Japam.
- `meaning` - one short line a player sees as a hint before they've found
  the word. Keep it under ~120 characters (the validator will warn if it's
  longer).
- `difficulty` - `"easy"`, `"medium"`, or `"difficult"`. This is entirely
  up to your judgement when you write the entry - there's no formula,
  just pick whichever tier feels right (a very well-known name can be
  "easy" even if it's a bit longer; an obscure term can be "difficult"
  even if it's short).
- `era` (optional) - only meaningful for devotee-type entries
  (`"itihasa"`, `"purana"`, or `"bhakti"`). Not shown to players, just
  kept for your own reference. Leave it out for anything else.

Add the entry to `entries` in `data/questions.json`, then run
`node scripts/validate-content.js` before opening a PR - it checks for
things like a missing field, a duplicate word, or a word too long to
ever fit its difficulty's grid.

## The level ladder - `data/levels.json`

Separate from content - this is the shape of each puzzle:

```json
{ "levelNumber": 1, "difficulty": "easy", "gridSize": 8, "fillerMode": "random", "breather": true, "japamCount": 3, "entryCount": 6 }
```

- `difficulty` - which tier of `questions.json` entries this level draws
  from.
- `gridSize` - the grid is `gridSize x gridSize`; must be big enough to
  fit the longest word at that difficulty (the validator checks this).
- `fillerMode` - `"random"` (easy) or `"curated"` (fillers echo the
  puzzle's own letters, harder to scan).
- `breather` - marks an easier level, for pacing.
- `japamCount` - how many Sri Rama traces the post-level interlude asks
  for.
- `entryCount` - how many entries this level's puzzle draws from its
  difficulty tier each time (a fresh random selection every time you play
  or hit "కొత్త పజిల్").

You can add more than one level per difficulty (e.g. a second "medium"
level with a bigger grid) - just give it a unique `levelNumber`.
