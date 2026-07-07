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
- `js/data.js` - loads the JSON content packs.
- `js/storage.js` - player identity + local score fallback (`localStorage`).
- `js/supabase-client.js` / `js/config.js` - optional shared backend.
- `js/app.js` - screens and app state (Home, level select, Game, Likhita
  Japam, Level complete, Scoreboard).
- `data/*.json` - content packs, one file per category/stotram. Add more
  entries or a whole new stotram by adding a JSON file in this shape and
  listing it in `DATASET_FILES` in `js/data.js` - no other code changes
  needed.

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

## Content packs

Four categories ship in `data/`:

- **దైవనామాలు** (deity names) - starts with Vishnu Sahasranamam.
- **భక్తులు** (devotees) - itihasa/purana and bhakti-era saints as one
  list; each entry's meaning line says who/when.
- **క్షేత్రాలు** (sacred places/kshetrams).
- **పూజా సామగ్రి** (sacred items & symbols of worship).

Each level inside a pack declares `gridSize`, `fillerMode`
(`"random"` or `"curated"`), whether it's a `breather` level, and
`japamCount` (how many Sri Rama traces the post-level interlude asks for).

## What's not built yet

- Only one deity-names stotram (Vishnu Sahasranamam) is seeded; the
  sub-group picker screen is already wired up for when more are added.
- The "sarvadharma" pack (other traditions' devotional figures) is
  explicitly backlog, per the design brief.
- A fully-offline, no-leaderboard variant was flagged as a separate,
  simpler build if ever wanted - this repo is the shared-leaderboard
  version.
