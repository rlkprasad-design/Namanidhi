# నామ నిధి (Nama Nidhi)

నామాల్లో దాగిన రత్నాలు — a devotional Telugu word-search game, built for
elderly and devotionally-inclined players. Vanilla JS, HTML, CSS - no
build step, no framework.

## Running locally

Any static file server works, e.g.:

```
python3 -m http.server 8000
```

Then open `http://localhost:8000`. The app runs fully offline/local-only
until Supabase is configured (see below) - puzzle and Japam scores are
still tracked on-device via `localStorage`.

## Project layout

- `index.html`, `css/styles.css` - shell and visual design.
- `js/segmenter.js` - Telugu grapheme-cluster helpers (`Intl.Segmenter`).
  Every place that needs to split a word into "letters" goes through this -
  never `str.split('')`, which would break on conjuncts/matras.
- `js/grid.js` - word-search grid generator: places entries in any of 8
  directions, allows two entries to legitimately cross/share a cell, and
  fills remaining cells (random or letters drawn from the puzzle itself,
  depending on `fillerMode`).
- `js/trace.js` - the shared pointer-based straight-line tracing engine.
  Used both by the grid (Nama Nidhi) and the single-row tracing surface
  (Likhita Japam) - same mechanics, two DOM layouts.
- `js/data.js` - loads the content pool (`data/*.json`, flattened into one
  list) and the level ladder (`data/levels.json`).
- `js/storage.js` - player identity + local score fallback (`localStorage`).
- `js/supabase-client.js` / `js/config.js` - optional shared backend.
- `js/app.js` - screens and app state (Home, level select, Game, Likhita
  Japam, Level complete, Scoreboard). There's no category picker: every
  puzzle samples entries from the combined pool of all content files, and
  the hint/meaning line is the only clue to what each hidden word is.
- `data/*.json` - content packs, one file per source (deity names,
  devotees, kshetrams, sacred items) - each just a flat `entries` list.
  `data/levels.json` is the shared level ladder (grid size, filler mode,
  breather pacing, how many entries each puzzle draws). Add a new entry
  by dropping it into the right file's `entries` array - it's in the
  rotation immediately, no level to wire it into. `data/TEMPLATE.md` shows
  the exact shape.
- `scripts/validate-content.js` - structural validator for `data/*.json`
  and `data/levels.json`, run automatically on PRs via
  `.github/workflows/validate-content.yml`. See "Adding new content" below.

## Setting up Supabase (shared scoreboard)

The app works without this - it just stays local-only. To turn on the
shared family scoreboard:

1. Create a **new** Supabase project just for this app (don't reuse
   another project's database).
2. Open the SQL editor and run `supabase/schema.sql`. This creates
   `players`, `puzzle_progress`, `japam_log`, RLS policies, and the two
   leaderboard views (`puzzle_leaderboard`, `japam_leaderboard`).
3. Copy the project URL and anon/public API key into `js/config.js`:

   ```js
   export const SUPABASE_URL = 'https://xxxx.supabase.co';
   export const SUPABASE_ANON_KEY = 'eyJ...';
   ```

4. Reload the app. New players are created on first name entry; puzzle
   and Japam progress sync automatically after that.

Identity is name-only (no login), so RLS can't truly restrict "a player's
own rows" without an auth session - the policies in `schema.sql` are
intentionally permissive, matching the "informal family tally, add real
auth only if abuse becomes a concern" design. If the Supabase dashboard's
SQL editor ever refuses an insert unexpectedly, the Table Editor UI is a
fine manual fallback while a policy gets sorted out.

## Content pool

Four content files ship in `data/`, pooled together at runtime - there is
no category picker in the app, and every puzzle can mix a deity name, a
devotee, a place, and a sacred item in the same grid. The hint/meaning
line is the only clue to what each hidden word is:

- **దైవనామాలు** (deity names) - starts with Vishnu Sahasranamam.
- **భక్తులు** (devotees) - itihasa/purana and bhakti-era saints as one
  list; each entry's meaning line says who/when.
- **క్షేత్రాలు** (sacred places/kshetrams).
- **పూజా సామగ్రి** (sacred items & symbols of worship).

`data/levels.json` is the shared level ladder: each level declares
`gridSize`, `fillerMode` (`"random"` or `"curated"`), whether it's a
`breather` level, `japamCount` (how many Sri Rama traces the post-level
interlude asks for), and `entryCount` (how many entries that puzzle
samples from the pool - a fresh random selection every time you play or
hit "కొత్త పజిల్").

### Adding new content

New entries (names, devotees, kshetrams, sacred items) go into the
relevant `data/*.json` file's `entries` array, on a branch, opened as a
pull request - never committed straight to `main`. There's no level to
wire a new entry into; as soon as it's in the file, it's part of the pool
every puzzle draws from. See `data/TEMPLATE.md` for the exact shape of an
entry in each category before writing new ones by hand.

The automated check (`.github/workflows/validate-content.yml`, running
`scripts/validate-content.js` on any PR touching `data/**`) catches
structural problems - malformed JSON, missing fields, a word too short to
be real content, a word too long for any configured level, duplicate
words anywhere in the pool - but it **cannot verify religious/factual
accuracy**. Before merging, a human who knows the source material
(Sahasranamam, the relevant stotram, or the item's actual devotional use)
should read through the new entries' Telugu text and meanings. This app's
users are trusting the content to be correct, so this review step isn't
optional, even for small batches.

To run the check yourself before opening a PR:

```
node scripts/validate-content.js
```

## What's not built yet

- Only one deity-names stotram (Vishnu Sahasranamam) is seeded so far.
- The "sarvadharma" pack (other traditions' devotional figures) is
  explicitly backlog, per the design brief.
- A fully-offline, no-leaderboard variant was flagged as a separate,
  simpler build if ever wanted - this repo is the shared-leaderboard
  version.
