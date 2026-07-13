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
  Puzzle/Japam logs are namespaced per language (see "Languages" below).
- `js/i18n.js` - the UI chrome string table (`te`/`en`) and `t(key)`
  lookup helper - covers screen labels, buttons, and messages, not
  content data (which lives per-language in `data/` - see below).
- `js/supabase-client.js` / `js/config.js` - optional shared backend.
- `js/app.js` - screens and app state (Home, Game, Likhita Japam, Level
  complete, Scoreboard). Home has two independent top-level modes:
  "నామ గుప్త నిధి" and "లిఖిత జపం". నామ గుప్త నిధి isn't itself one puzzle -
  tapping it opens a small hub (`showNamaGuptaNidhiHub`) with two
  structurally-identical puzzle types under it: "సాధారణ" (General, the
  original mixed-pool puzzle) and "స్తోత్ర పరీక్ష" (Stotra Pariksha). There's
  no category or difficulty picker within the general puzzle - every
  puzzle mixes entries from all three difficulty tiers in the same grid -
  each hint row shows a gem badge (ముత్యం/రత్నం/వజ్రం for easy/medium/
  difficult) alongside its meaning, so
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

Puzzles completed *before* that migration will show `0` pearls/gems/
diamonds even though `entries_found`/`puzzles_completed` are correct -
the columns just didn't exist yet to record them. Run
`supabase/backfill-legacy-gems.sql` once, any time after
`add-gem-tracking.sql`, to recover most of that history: before the gem
system, a puzzle was always one difficulty tier end to end
(`category` was literally `'easy'`/`'medium'`/`'difficult'`), so an old
row's `entries_found` really is that whole gem type's count - this
copies it into the matching column rather than leaving it stranded.
Rows from `'mixed'` (today's mixed-difficulty puzzles) or `'stotram'`
can't be backfilled this way, since those puzzles were never single-
tier - if one of those shows `0` gems with a real `entries_found`, it's
either from before that mode's own gem tracking shipped, or every word
was revealed via "సమాధానం చూపు" (which legitimately earns nothing).

If your project predates per-language scoreboard sync, also run
`supabase/add-language-tracking.sql` once - it adds the `language`
column to `puzzle_progress`/`japam_log` (defaulting existing rows to
`'te'`, since Telugu was the only language that used to sync) and
rebuilds both leaderboard views to group by `(display_name, language)`.
A brand-new project created from the current `schema.sql` already has
this. Until this migration is run on an existing project, English-mode
play keeps falling back to local-only, same as before.
Safe to re-run; each `UPDATE` only touches rows it hasn't already
touched.

If your project predates the Likhita Japam board's daily-average column,
also run `supabase/add-japam-daily-average.sql` once - it adds
`first_logged_at` (each player's earliest japam timestamp per language)
to `japam_leaderboard`, which the Scoreboard screen divides `total_count`
by the days elapsed since to get the average. A brand-new project already
has this.

If your project predates the puzzle Scoreboard's sort fix, also run
`supabase/fix-puzzle-leaderboard-sort.sql` once - `fetchPuzzleLeaderboard`
used to order rows by `total_entries_found` (a raw find-count that
includes answers revealed via "Show answer," which earn no gem, and isn't
even a column the table displays), which could rank a player above
someone with strictly higher pearls, gems, diamonds, *and* puzzles
completed - every number the table actually shows. This adds `total_score`
(pearls+gems+diamonds) as a real column so the client can sort by the
same metric that's displayed. A brand-new project already has this.

## Content pool

Everything lives in one file, `data/questions.json` - deity names,
devotees, kshetrams, sacred items, all mixed together with no category of
their own. There is no category picker in the app, and every puzzle can
mix a deity name, a devotee, a place, and a sacred item in the same grid;
the hint/meaning line is the only clue to what each hidden word is.

`questions.json` (300 entries) is scoped to itihasa/purana narrative
content - Ramayana, Mahabharata, Bhagavatam, and other puranas (deity
names, devotees, demons/antagonists, kshetrams, sacred items - anything
that's part of a *story*). Names drawn from a specific sahasranama/
ashtottara-style "1000 (or 108) names" text belong to Stotra Pariksha
instead, as their own stotram entry, not here - that's a stronger,
narrower claim ("this word is one of *these specific* thousand names")
than "this is a name connected to this itihasa/purana," so it gets its
own reviewed, curated set rather than blending into the general pool.
This is why `vishnu-sahasranamam`, `shiva-sahasranamam`, and
`lalita-sahasranamam` in `data/stotrams.json` currently carry a
`draft_entries` array (not `entries`) alongside `"status": "soon"` -
words that were previously (mistakenly) mixed into the general pool,
pulled back out and parked here until each gets built into a proper
active stotram (larger word list, `about` text, grid-size range,
sourced/reviewed against the actual text) - `draft_entries` is
deliberately not `entries` so nothing accidentally goes live unreviewed;
promoting one is a manual rename plus the same review pass every other
active stotram got.

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
`js/grid.js` rolls a random size within that range, then draws a mix of
easy/medium/difficult entries sized to fit it (`entryCountForGridSize`,
split across tiers by `splitAcrossDifficulties`). This was a deliberate
choice over a fixed size and a difficulty picker: a puzzle that's the
same shape and tier every time starts to feel rote, and mixing the grid,
the size, and the difficulty keeps it a little unpredictable in the way
real recall practice is. Placement itself goes through
`generateGridReliable`, which retries a fresh random layout (up to 15
times) if the first one can't fit every drawn word - empirically near-0%
failure against this app's content.

The tier split isn't a flat even mix, though - `difficultyWeightsForExperience`
in `js/grid.js` reads the player's device-local `puzzlesCompleted` (Nama
Gupta Nidhi and Stotra Pariksha combined) and skews the weights: a brand
new player (0 completed) gets roughly 70% easy / 30% medium / 0%
difficult, ramping smoothly to a settled 20% / 40% / 40% mix by their
30th completed puzzle - and it stays there rather than continuing to get
harder, so the game doesn't outgrow an elderly audience over time.
`splitAcrossDifficulties` turns those weights into whole-number counts
via largest-remainder apportionment, so they always sum to exactly the
puzzle's entry count. Stotra Pariksha's `drawStotramRound` in `js/app.js`
uses the same weights and per-tier rotation-queue approach (one queue per
`stotram.id + difficulty`, mirroring `js/grid.js`'s per-difficulty
queues) rather than drawing from one combined pool, so the same
easy-first ramp applies there too. `data/levels.json` is still
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

## Languages

Telugu (`te`) is the default and still the deepest/best-reviewed
language. An English (`en`) mode covers Nama Gupta Nidhi, Stotra
Pariksha (Rama Raksha only so far), and Likhita Japam - a pill switcher
(`languageToggle` in `js/app.js`) on the intro, name-gate, and Home
screens flips between them, persisted via `getLanguage`/`setLanguage` in
`js/storage.js`.

Content is per-language, not translated on the fly: Telugu content stays
at `data/*.json` (unchanged paths, for backward compatibility), English
content lives at `data/en/*.json` with the same schema. `js/data.js`'s
loaders (`loadEntryPool`/`loadLevels`/`loadStotrams`) all take a `lang`
argument and cache per language. Adding a third language means adding a
`data/<lang>/` directory with the same three files, an entry in
`js/i18n.js`'s `LANGUAGES` array and `STRINGS` table, and (if the script
isn't a simple a-stem/consonant alphabet like Telugu's) a filler pool in
`js/grid.js` alongside `LATIN_POOL`.

Both languages sync to the shared family Supabase scoreboard, kept as
separate per-language tallies rather than merged into one combined
number - `puzzle_progress`/`japam_log` rows carry a `language` column,
and the `puzzle_leaderboard`/`japam_leaderboard` views group by
`(display_name, language)`, so the Scoreboard screen's fetch calls
(`fetchPuzzleLeaderboard(getLang())`/`fetchJapamLeaderboard(getLang())`)
only ever pull the current language's rows. Before Supabase is configured
(or while offline), both languages still fall back to this device's own
`localStorage`, namespaced separately per language in `js/storage.js` so
switching languages can't mix or clobber either language's local tally.
Player identity (name) is shared across languages - only the score data
is split.

`js/segmenter.js`'s `Intl.Segmenter('te', ...)` is reused for English
text too rather than adding a second segmenter - grapheme-cluster
boundaries are effectively locale-independent for plain Latin text (no
combining marks in the English content), so this is safe. `js/grid.js`'s
filler-cell alphabet is *not* locale-independent - English mode passes
`LATIN_POOL` (plain A-Z) via `generateGridReliable`'s `fillerPool`
option instead of Telugu's default consonant+vowel-sign pool.

One structural difference worth knowing before writing English content:
Telugu graphemes cluster a consonant and its vowel sign into one
"letter," so Telugu words tend to run 4-8 graphemes; English has no such
clustering, so the same name can run noticeably longer in Latin
characters (e.g. "విశ్వామిత్రప్రియః" is 7 Telugu graphemes but
"Vishvamitrapriya" is 16 Latin characters). English-mode `levels.json`/
`stotrams.json` therefore use larger `gridSizeMin`/`gridSizeMax` ranges
than their Telugu counterparts - check actual word lengths (not "does it
look short in Telugu") before picking a grid size range for new English
content.

Every `word` in `data/en/questions.json` and `data/en/stotrams.json` is
stored in ALL CAPS (`"RAMA"`, not `"Rama"`) - deliberately, not a
style choice. Telugu has no letter case at all, so a Telugu grid gives
no visual clue about where a word starts; normal English capitalization
("Rama") would put a single capital letter at the start of every hidden
word and nowhere else, handing English-mode players a free tell that
Telugu-mode players don't get. Uppercasing removes that asymmetry, and
happens to match how printed word-search puzzles are conventionally set
anyway. Keep new English entries uppercase for the same reason - the
hint panel displays exactly what's in the grid, so this doesn't need any
code-side transformation, just consistent data.

That ALL-CAPS rule is specific to the word-search grid; Likhita Japam's
suggested/typed names keep normal casing (`js/app.js`'s `japamNames()`
still returns "Sri Rama", not "SRI RAMA"), since `js/handwriting.js`
renders English words in a cursive font (Dancing Script) and uses case to
decide how letters join. Consecutive lowercase letters are grouped into
one `fillText` call each, so the browser's own text shaping visually
connects them into a single ink blob (and so a single continuous dot
path) - the finger doesn't need to lift between them. An uppercase letter
always starts its own segment with a gap on each side, so a name's
capitalized first letter stays visually distinct rather than getting
dragged into a cursive join it isn't part of. Telugu (anything
`looksLikeLatin()` says no to) is unaffected - it keeps the original
block-font, gap-between-every-grapheme rendering.

The English content pool (`data/en/questions.json`, 80 entries) and Rama
Raksha translation (`data/en/stotrams.json`) are a first-pass starter
set, smaller than the Telugu pool (300 entries) - same "grows over time,
human-reviewed before merging" model as Telugu, see "Adding new content"
below (the validator also runs against `data/en` in CI, see
`.github/workflows/validate-content.yml`).

English meanings are written the way these things actually get talked
about in a bilingual Telugu household, not as formal literary
translations - a family member flagged early meanings like "sacred
confluence of three rivers" or "grand patriarch" as stiffer than how
anyone would really say it. Prefer common Sanskrit devotional
vocabulary that's already familiar in Indian English over a fully
translated equivalent: "avatar" not "incarnation," "vahana" not
"divine vehicle," "Trimurti" not "divine trinity," "devas" where that's
more natural than "gods." The puzzle *words* themselves were never the
issue - they're already Sanskrit names in Roman letters (RAMA,
VENKATESWARA, TRISHULA) - this is purely about the hint text read
alongside them.

Lakshmi Ashtottaram and Vishnu Sahasranamam aren't in English yet -
`data/en/stotrams.json` lists them as `"soon"` placeholders, same as
Vishnu Sahasranamam still is in Telugu.

## What's not built yet

- Content depth is still thin, especially at the "difficult" tier (9
  entries) - the pool grows as more entries are added to
  `data/questions.json`.
- The "sarvadharma" pack (other traditions' devotional figures) is
  explicitly backlog, per the design brief.
- A fully-offline, no-leaderboard variant was flagged as a separate,
  simpler build if ever wanted - this repo is the shared-leaderboard
  version.
- Stotra Pariksha has two active stotrams (Rama Raksha Stotram, Lakshmi
  Ashtottaram) - Vishnu Sahasranamam is still a `"soon"` placeholder in
  `data/stotrams.json`, waiting on its word list being written and
  reviewed. Lakshmi Ashtottaram's 88 entries are a first pass
  reconstructed from memory (same caveat as Rama Raksha originally had)
  and haven't been checked against the source text yet - see "Adding new
  content" above.
