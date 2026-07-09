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
- `js/data.js` - loads the content pool (`data/questions.json`) and the
  level ladder (`data/levels.json`).
- `js/storage.js` - player identity + local score fallback (`localStorage`).
- `js/supabase-client.js` / `js/config.js` - optional shared backend.
- `js/app.js` - screens and app state (Home, Game, Likhita Japam, Level
  complete, Scoreboard). There's no category picker and, as of this
  writing, no difficulty picker either: tapping "నామ గుప్త నిధి" on Home
  goes straight into a puzzle. Every puzzle mixes entries from all three
  difficulty tiers in the same grid - each hint row shows a gem badge
  (ముత్యం/రత్నం/వజ్రం for easy/medium/difficult) alongside its meaning, so
  the difficulty of each specific word is visible without the player ever
  choosing a tier up front.
- `data/questions.json` - every entry (deity names, devotees, kshetrams,
  sacred items, all mixed together with no category of their own), each
  tagged only with a `difficulty` (`"easy"`/`"medium"`/`"difficult"`) -
  this is what decides its gem type, not a level. `data/levels.json` names
  a `gridSizeMin`/`gridSizeMax` range (see below); `sampleMixedEntries` in
  `js/grid.js` rolls a size, then draws a roughly even split of easy/
  medium/difficult entries sized to fit it. Add a new entry by dropping it
  into `questions.json`'s `entries` array - it's in rotation immediately,
  no level to wire it into. `data/TEMPLATE.md` shows the exact shape.
- `data/stotrams.json` - the "స్తోత్ర పరీక్ష" (Stotra Pariksha) sub-section:
  one curated word-search per stotram, testing recall of names from that
  specific stotram's own text. Same flexible-grid model as the main pool
  (see `data/levels.json` below): each active stotram has a
  `gridSizeMin`/`gridSizeMax` range instead of one fixed size, rolled
  fresh every puzzle, with the round's entry count derived from whichever
  size comes up. Entries are drawn from the stotram's own `entries` list
  via a shuffled rotation queue scoped per stotram (`stotramDrawQueues` in
  `js/app.js`), trimmed to whatever's eligible at the rolled size before
  refilling - same idea as `js/grid.js`'s per-difficulty queues. Each
  entry also carries a `difficulty` (`"easy"`/`"medium"`/`"difficult"`)
  for now-metadata, later-filtering purposes - a round currently mixes all
  difficulties rather than gating by tier. A `"soon"` status entry only
  needs `id`, `title`, and `status` - it renders as a locked/coming-soon
  card. See the `active` `rama-raksha` entry for the full shape an active
  stotram needs (`gridSizeMin`, `gridSizeMax`, `fillerMode`, `about`,
  `entries`).
- `scripts/validate-content.js` - structural validator for
  `data/questions.json`, `data/levels.json`, and `data/stotrams.json`, run
  automatically on PRs via `.github/workflows/validate-content.yml`. See
  "Adding new content" below.

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

If you're planning to share the app beyond a small trusted circle (e.g.
family who might forward the link onward), also run
`supabase/harden-rls.sql` once in the SQL editor - it stops the raw
`puzzle_progress`/`japam_log` tables from being directly readable by
anyone with the public anon key (only the aggregated leaderboard views
stay readable, which is all the app itself ever reads) and adds sanity
bounds on submitted values. It changes nothing about how the app
behaves - just what a stranger with the URL could read or spam directly
against the database.

If your project predates the ముత్యం/రత్నం/వజ్రం (pearl/gem/diamond) gem
tracking, also run `supabase/add-gem-tracking.sql` once - it adds the
three counter columns to `puzzle_progress` and rebuilds
`puzzle_leaderboard` to expose the per-gem totals the Scoreboard screen
now reads. A brand-new project created from the current `schema.sql`
already has these, so this step is only for existing projects.

## Content pool

Everything lives in one file, `data/questions.json` - deity names,
devotees, kshetrams, sacred items, all mixed together with no category of
their own. There is no category picker in the app, and every puzzle can
mix a deity name, a devotee, a place, and a sacred item in the same grid;
the hint/meaning line is the only clue to what each hidden word is.

The one thing that does sort entries is `difficulty`: `"easy"`,
`"medium"`, or `"difficult"`, assigned by whoever writes the entry - there's
no formula, just judgement about how well-known or obscure something is.
This is also what a found word is "worth": easy → ముత్యం (pearl), medium →
రత్నం (gem), difficult → వజ్రం (diamond). A word revealed via "సమాధానం
చూపు" still lets the puzzle complete but doesn't earn its gem - only a
word the player actually finds themselves counts (`markFound`'s `viaHint`
parameter in `js/app.js`, tallied per-difficulty in `recordLevelProgress`
and shown on the Scoreboard).

`data/levels.json` names a `gridSizeMin`/`gridSizeMax` range, a
`fillerMode` (`"random"` or `"curated"`), and `japamCount` (how many Sri
Rama traces the post-puzzle interlude asks for) - there's no `difficulty`
on a level anymore, since every puzzle mixes all three tiers in one grid
rather than being one difficulty end to end. Grid size is not fixed -
every time you play or hit "కొత్త పజిల్", `sampleMixedEntries` in
`js/grid.js` rolls a random size within that range, then draws a roughly
even split of easy/medium/difficult entries sized to fit it
(`entryCountForGridSize`, split three ways - see `splitAcrossDifficulties`).
This was a deliberate choice over a fixed size and a difficulty picker: a
puzzle that's the same shape and tier every time starts to feel rote, and
mixing the grid, the size, and the difficulty keeps it a little
unpredictable in the way real recall practice is. Placement itself goes
through `generateGridReliable`, which retries a fresh random layout (up
to 15 times) if the first one can't fit every drawn word - empirically
near-0% failure against this app's content. `data/levels.json` is still
an array (currently with one entry) so more than one puzzle "shape" (a
quicker round vs. a longer one, say) could be added later without a
schema change.

### Adding new content

New entries go straight into `data/questions.json`'s `entries` array, on
a branch, opened as a pull request - never committed straight to `main`.
There's no level to wire a new entry into; as soon as it's in the file
and tagged with a difficulty, it's part of the pool every puzzle at that
tier draws from. See `data/TEMPLATE.md` for the exact shape before
writing new ones by hand.

The automated check (`.github/workflows/validate-content.yml`, running
`scripts/validate-content.js` on any PR touching `data/**`) catches
structural problems - malformed JSON, missing fields, an invalid
difficulty value, a word too short to be real content, a word too long
for any level at its difficulty, duplicate words - but it **cannot
verify religious/factual accuracy**. Before merging, a human who knows
the source material (Sahasranamam, the relevant stotram, or the item's
actual devotional use) should read through the new entries' Telugu text
and meanings. This app's users are trusting the content to be correct, so
this review step isn't optional, even for small batches.

The same review requirement applies to `data/stotrams.json` - each active
stotram's word list is a stronger factual claim than the general pool
("this word appears in *this specific* stotram"), so it needs the same
human check against the actual source text. The current `rama-raksha`
entry's word list was reconstructed from memory rather than the source
text and should get that review pass - checked against the actual
stotram - before being treated as final content.

To run the check yourself before opening a PR:

```
node scripts/validate-content.js
```

## What's not built yet

- Content depth is still thin, especially at the "difficult" tier (9
  entries) - the pool grows as more entries are added to
  `data/questions.json`.
- The "sarvadharma" pack (other traditions' devotional figures) is
  explicitly backlog, per the design brief.
- A fully-offline, no-leaderboard variant was flagged as a separate,
  simpler build if ever wanted - this repo is the shared-leaderboard
  version.
- Stotra Pariksha only has one active stotram (Rama Raksha Stotram) so
  far - Lakshmi Ashtottaram and Vishnu Sahasranamam are listed as
  `"soon"` placeholders in `data/stotrams.json`, waiting on their word
  lists being written and reviewed.
