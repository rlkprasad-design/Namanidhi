import { graphemes } from './segmenter.js';

const CONSONANTS = ['క','ఖ','గ','ఘ','ఙ','చ','ఛ','జ','ఝ','ఞ','ట','ఠ','డ','ఢ','ణ','త','థ','ద','ధ','న','ప','ఫ','బ','భ','మ','య','ర','ల','వ','శ','ష','స','హ','ళ','ఱ'];
const VOWEL_SIGNS = ['', 'ా', 'ి', 'ీ', 'ు', 'ూ', 'ె', 'ే', 'ై', 'ొ', 'ో', 'ౌ', 'ం'];
const BASE_POOL = CONSONANTS.flatMap((c) => VOWEL_SIGNS.map((v) => c + v));

// Kannada's filler pool, same idea as Telugu's BASE_POOL above (both are
// Brahmic abugida scripts - a base consonant plus a vowel-sign diacritic
// forms one grapheme cluster) - just Kannada's own consonant and
// vowel-sign glyphs, so Kannada-mode filler cells look like real Kannada
// syllables rather than random Telugu ones.
const KANNADA_CONSONANTS = ['ಕ','ಖ','ಗ','ಘ','ಙ','ಚ','ಛ','ಜ','ಝ','ಞ','ಟ','ಠ','ಡ','ಢ','ಣ','ತ','ಥ','ದ','ಧ','ನ','ಪ','ಫ','ಬ','ಭ','ಮ','ಯ','ರ','ಲ','ವ','ಶ','ಷ','ಸ','ಹ','ಳ'];
const KANNADA_VOWEL_SIGNS = ['', 'ಾ', 'ಿ', 'ೀ', 'ು', 'ೂ', 'ೆ', 'ೇ', 'ೈ', 'ೊ', 'ೋ', 'ೌ', 'ಂ'];
export const KANNADA_POOL = KANNADA_CONSONANTS.flatMap((c) => KANNADA_VOWEL_SIGNS.map((v) => c + v));

// English-mode filler pool - plain A-Z, since a Latin grid has no
// grapheme-cluster concept to imitate the way Telugu's consonant+vowel-sign
// pool does.
export const LATIN_POOL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const DIRECTIONS = [
  [0, 1], [0, -1], [1, 0], [-1, 0],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randomPool(fillerPool) {
  return fillerPool[Math.floor(Math.random() * fillerPool.length)];
}

export function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

// How many entries a puzzle asks for, given the grid size that round
// happened to roll - bigger board, more names, without being tied to a
// single fixed count per level. Tuned against the real content pool so
// placement (with generateGridReliable's retry) succeeds essentially
// always across every size a level's range can roll.
export function entryCountForGridSize(gridSize) {
  return Math.max(2, Math.round(gridSize * 0.7));
}

// Per-language-per-difficulty draw queues, so puzzles cycle through every
// eligible word once before any word repeats - independent random draws
// each time would still be "random" but would frequently repeat words by
// chance, especially for small pools (e.g. drawing 6 of 9 "difficult"
// words twice in a row shares ~4 words on average). Keyed per language too
// (mirroring app.js's stotramDrawQueues), so switching languages doesn't
// corrupt either queue with the other's words. exportDrawQueues/
// importDrawQueues let app.js persist this to localStorage so the "no
// repeat until the tier cycles" guarantee survives a page reload too, not
// just one continuous session - see storage.js's getPersistedDrawQueues.
const drawQueues = new Map();

export function exportDrawQueues() {
  return Object.fromEntries(drawQueues);
}

export function importDrawQueues(queues) {
  for (const [key, entries] of Object.entries(queues || {})) drawQueues.set(key, entries);
}

// `queue` holds every tier word not yet drawn THIS cycle, in shuffled
// order. A fresh cycle only starts (reshuffling the whole tier back in)
// once the queue is completely empty - i.e. every word has been drawn
// once - never just because the words currently at the front happen not
// to fit this particular roll's grid size. Topping up early on a
// too-small subset was the bug: it treated already-drawn words as
// "unseen" again as soon as the few still-queued words didn't fit, so a
// word could resurface long before the rest of its tier had its turn.
function startNewCycleIfEmpty(queue, tierPool) {
  if (queue.length === 0) queue.push(...shuffle(tierPool));
  return queue;
}

// Draws the first `count` queued words that fit this roll's grid size,
// leaving every other queued word - fitting or not - in place for a
// later draw instead of discarding or reshuffling it. Returns
// { drawn, remaining } - remaining becomes the new persisted queue. May
// return fewer than `count` if what's left this cycle doesn't have
// enough words at this size; that's fine, the caller already tolerates a
// tier contributing fewer entries than asked for.
function drawFromQueue(queue, count, fitsThisRoll) {
  const drawn = [];
  const remaining = [];
  for (const entry of queue) {
    if (drawn.length < count && fitsThisRoll(entry)) drawn.push(entry);
    else remaining.push(entry);
  }
  return { drawn, remaining };
}

export const DIFFICULTIES = ['easy', 'medium', 'difficult'];

// Once a word has been asked this many times, it's retired from the draw
// rotation for that player/pool - a name search stays a light daily
// break, not a slog through the same handful of "difficult" words forever.
// `exposure` (word -> times-shown count) is looked up by the caller from
// storage.js's getWordExposureCounts, already scoped to the right
// player+language+pool.
export const MAX_WORD_EXPOSURES = 10;

// True once every entry in `pool` has hit MAX_WORD_EXPOSURES - i.e. there's
// nothing left this player hasn't already seen its full allotment of times.
// Checked against the whole pool (not just whatever's eligible for one
// rolled grid size) so it reflects real exhaustion, not just an unlucky
// roll.
export function isPoolExhausted(pool, exposure = {}, maxExposures = MAX_WORD_EXPOSURES) {
  return pool.length > 0 && pool.every((e) => (exposure[e.word] || 0) >= maxExposures);
}

const EVEN_WEIGHTS = { easy: 1 / 3, medium: 1 / 3, difficult: 1 / 3 };

// Ramps a beginner's mix from all-easy up to a settled, still-approachable
// blend by their 30th completed puzzle (Nama Gupta Nidhi and Stotra
// Pariksha combined, since that's what puzzlesCompleted already counts) -
// it never gets harder than that plateau, so the game stays welcoming for
// an elderly audience long after the "new player" stage too.
export function difficultyWeightsForExperience(puzzlesCompleted) {
  const t = Math.min(1, Math.max(0, puzzlesCompleted) / 30);
  return {
    easy: 0.70 - 0.50 * t,
    medium: 0.30 + 0.10 * t,
    difficult: 0.40 * t,
  };
}

// Caps how large a grid a beginner can roll, ramping linearly up to the
// level's full gridSizeMax by their 50th completed puzzle - a big board is
// intimidating on its own regardless of how easy the words on it are, so
// this runs independently of (and longer than) the difficulty-mix ramp
// above, which finishes by puzzle 30. A brand-new player always gets
// gridSizeMin; from then on the ceiling grows until the full range opens
// up.
export function gridSizeCapForExperience(puzzlesCompleted, min, max) {
  const t = Math.min(1, Math.max(0, puzzlesCompleted) / 50);
  return Math.round(min + (max - min) * t);
}

// Splits `total` across the three difficulty tiers proportional to
// `weights` (an even split by default), using largest-remainder
// apportionment so the counts always sum to exactly `total` while still
// respecting the requested proportions as closely as whole numbers allow.
export function splitAcrossDifficulties(total, weights = EVEN_WEIGHTS) {
  const raw = DIFFICULTIES.map((d) => [d, (weights[d] ?? 0) * total]);
  const floors = raw.map(([d, v]) => [d, Math.floor(v)]);
  const counts = Object.fromEntries(floors);
  let remainder = total - floors.reduce((sum, [, v]) => sum + v, 0);
  const byFraction = raw
    .map(([d, v], i) => [d, v - floors[i][1]])
    .sort((a, b) => b[1] - a[1]);
  for (let i = 0; remainder > 0 && i < byFraction.length; i++, remainder--) {
    counts[byFraction[i][0]] += 1;
  }
  return counts;
}

// Each call rolls its own grid size within the level's range (capped for
// newer players - see gridSizeCapForExperience), then draws a mix of
// easy/medium/difficult entries sized to fit that roll - every puzzle
// blends all three tiers (so a hint's word can turn out to be a ముత్యం,
// రత్నం, or వజ్రం) rather than being one difficulty end to end. `weights`
// (see difficultyWeightsForExperience) skews that mix toward easier tiers
// for a newer/lower-scoring player instead of always an even split. Each
// tier is still drawn from its own shuffled rotation queue over the
// tier's full word list - see drawFromQueue - so nothing repeats until
// every word in that tier has been drawn once, regardless of how this
// or any other puzzle's grid size happened to roll in between.
export function sampleMixedEntries(pool, level, weights = EVEN_WEIGHTS, puzzlesCompleted = Infinity, lang = 'te', exposure = {}) {
  const cappedMax = gridSizeCapForExperience(puzzlesCompleted, level.gridSizeMin, level.gridSizeMax);
  const gridSize = randomInt(level.gridSizeMin, cappedMax);
  const targetCounts = splitAcrossDifficulties(entryCountForGridSize(gridSize), weights);

  const entries = [];
  for (const difficulty of DIFFICULTIES) {
    // The tier's full rotation pool - not filtered by this roll's grid
    // size, only by whether the word is still within its exposure cap.
    // Filtering by gridSize here (as this used to) meant a word too long
    // for one puzzle's small grid would drop out of the persisted queue
    // entirely, then look "unseen" again as soon as a bigger grid rolled
    // - letting it resurface well before the tier had actually cycled.
    const tierPool = pool.filter((e) => e.difficulty === difficulty && (exposure[e.word] || 0) < MAX_WORD_EXPOSURES);
    if (!tierPool.length) continue;

    const fitsThisRoll = (e) => graphemes(e.word).length <= gridSize;
    const eligibleNow = tierPool.filter(fitsThisRoll);
    const count = Math.min(targetCounts[difficulty], eligibleNow.length);
    if (!count) continue;

    const tierWords = new Set(tierPool.map((e) => e.word));
    const key = `${lang}::${difficulty}`;
    const queue = (drawQueues.get(key) || []).filter((e) => tierWords.has(e.word));
    startNewCycleIfEmpty(queue, tierPool);

    const { drawn, remaining } = drawFromQueue(queue, count, fitsThisRoll);
    entries.push(...drawn);
    drawQueues.set(key, remaining);
  }
  return { gridSize, entries };
}

// A random layout occasionally can't fit every requested word on the
// first try, especially when the rolled size sits near the tight end for
// its longest word - retrying with a fresh shuffle almost always finds a
// layout that fits everything (empirically ~0% failure within a handful
// of attempts against this app's content), so a puzzle never silently
// shows fewer words than it asked for.
const GENERATE_RETRY_ATTEMPTS = 15;

export function generateGridReliable({ size, entries, fillerMode, fillerPool = BASE_POOL }) {
  let result = { grid: [], placements: [] };
  for (let attempt = 0; attempt < GENERATE_RETRY_ATTEMPTS; attempt++) {
    result = generateGrid({ size, entries, fillerMode, fillerPool });
    if (result.placements.length === entries.length) break;
  }
  return result;
}

// Try every (direction, start) combo for a word, shuffled, and return the
// first one whose path is empty or matches existing graphemes (crossing OK).
function findPlacement(grid, size, letters) {
  const len = letters.length;
  const candidates = [];
  for (const [dr, dc] of DIRECTIONS) {
    const minRow = dr === 1 ? 0 : dr === -1 ? len - 1 : 0;
    const maxRow = dr === 1 ? size - len : dr === -1 ? size - 1 : size - 1;
    const minCol = dc === 1 ? 0 : dc === -1 ? len - 1 : 0;
    const maxCol = dc === 1 ? size - len : dc === -1 ? size - 1 : size - 1;
    if (minRow > maxRow || minCol > maxCol) continue;
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        candidates.push([r, c, dr, dc]);
      }
    }
  }

  for (const [r, c, dr, dc] of shuffle(candidates)) {
    let ok = true;
    const cells = [];
    for (let i = 0; i < len; i++) {
      const rr = r + dr * i;
      const cc = c + dc * i;
      const existing = grid[rr][cc];
      if (existing !== null && existing !== letters[i]) {
        ok = false;
        break;
      }
      cells.push([rr, cc]);
    }
    if (ok) return cells;
  }
  return null;
}

// Builds a size x size grid with every entry hidden in a straight line
// (any of 8 directions), allowing entries to legitimately cross/share a cell.
export function generateGrid({ size, entries, fillerMode, fillerPool = BASE_POOL }) {
  const grid = Array.from({ length: size }, () => Array(size).fill(null));

  const withLetters = entries
    .map((entry) => ({ entry, letters: graphemes(entry.word) }))
    .sort((a, b) => b.letters.length - a.letters.length);

  const placements = [];
  const unplaced = [];

  for (const { entry, letters } of withLetters) {
    const cells = findPlacement(grid, size, letters);
    if (!cells) {
      unplaced.push(entry.word);
      continue;
    }
    cells.forEach(([r, c], i) => {
      grid[r][c] = letters[i];
    });
    placements.push({ entry, letters, cells });
  }

  if (unplaced.length) {
    // Should only happen if gridSize is too small for the given entries.
    console.warn('Could not place entries (grid too small):', unplaced);
  }

  fillEmptyCells(grid, size, fillerMode, fillerPool);

  return { grid, placements };
}

function fillEmptyCells(grid, size, fillerMode, fillerPool) {
  const usedGraphemes = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c] !== null) usedGraphemes.push(grid[r][c]);
    }
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c] !== null) continue;
      if (fillerMode === 'curated' && usedGraphemes.length && Math.random() < 0.7) {
        grid[r][c] = usedGraphemes[Math.floor(Math.random() * usedGraphemes.length)];
      } else {
        grid[r][c] = randomPool(fillerPool);
      }
    }
  }
}
