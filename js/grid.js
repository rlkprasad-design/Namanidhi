import { graphemes } from './segmenter.js';

const CONSONANTS = ['క','ఖ','గ','ఘ','ఙ','చ','ఛ','జ','ఝ','ఞ','ట','ఠ','డ','ఢ','ణ','త','థ','ద','ధ','న','ప','ఫ','బ','భ','మ','య','ర','ల','వ','శ','ష','స','హ','ళ','ఱ'];
const VOWEL_SIGNS = ['', 'ా', 'ి', 'ీ', 'ు', 'ూ', 'ె', 'ే', 'ై', 'ొ', 'ో', 'ౌ', 'ం'];
const BASE_POOL = CONSONANTS.flatMap((c) => VOWEL_SIGNS.map((v) => c + v));

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

function randomPool() {
  return BASE_POOL[Math.floor(Math.random() * BASE_POOL.length)];
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

// Per-difficulty draw queues, so puzzles cycle through every eligible word
// once before any word repeats - independent random draws each time would
// still be "random" but would frequently repeat words by chance, especially
// for small pools (e.g. drawing 6 of 9 "difficult" words twice in a row
// shares ~4 words on average). Reset on page reload.
const drawQueues = new Map();

function refillQueue(queue, eligible, count) {
  while (queue.length < count) {
    const queuedWords = new Set(queue.map((e) => e.word));
    const unseen = eligible.filter((e) => !queuedWords.has(e.word));
    queue.push(...shuffle(unseen.length ? unseen : eligible));
  }
  return queue;
}

export const DIFFICULTIES = ['easy', 'medium', 'difficult'];

// Splits `total` roughly evenly across the three difficulty tiers, so a
// mixed puzzle almost always has at least one of each - which tier gets
// the "extra" slot from an uneven split is shuffled each time rather than
// always landing on the same one.
function splitAcrossDifficulties(total) {
  const base = Math.floor(total / DIFFICULTIES.length);
  let remainder = total - base * DIFFICULTIES.length;
  const counts = Object.fromEntries(DIFFICULTIES.map((d) => [d, base]));
  for (const d of shuffle(DIFFICULTIES)) {
    if (remainder <= 0) break;
    counts[d] += 1;
    remainder -= 1;
  }
  return counts;
}

// Each call rolls its own grid size within the level's range, then draws
// a mix of easy/medium/difficult entries sized to fit that roll - every
// puzzle blends all three tiers (so a hint's word can turn out to be a
// ముత్యం, రత్నం, or వజ్రం) rather than being one difficulty end to end.
// Each tier is still drawn from its own shuffled rotation queue, trimmed
// to whatever's eligible at the rolled size before topping back up, so
// nothing repeats until that tier cycles - same idea as before, just
// running once per tier per puzzle instead of once for a single tier.
export function sampleMixedEntries(pool, level) {
  const gridSize = randomInt(level.gridSizeMin, level.gridSizeMax);
  const targetCounts = splitAcrossDifficulties(entryCountForGridSize(gridSize));

  const entries = [];
  for (const difficulty of DIFFICULTIES) {
    const eligible = pool.filter((e) => e.difficulty === difficulty && graphemes(e.word).length <= gridSize);
    if (!eligible.length) continue;

    const eligibleWords = new Set(eligible.map((e) => e.word));
    const trimmedQueue = (drawQueues.get(difficulty) || []).filter((e) => eligibleWords.has(e.word));
    const count = Math.min(targetCounts[difficulty], eligible.length);

    const queue = refillQueue(trimmedQueue, eligible, count);
    entries.push(...queue.slice(0, count));
    drawQueues.set(difficulty, queue.slice(count));
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

export function generateGridReliable({ size, entries, fillerMode }) {
  let result = { grid: [], placements: [] };
  for (let attempt = 0; attempt < GENERATE_RETRY_ATTEMPTS; attempt++) {
    result = generateGrid({ size, entries, fillerMode });
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
export function generateGrid({ size, entries, fillerMode }) {
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

  fillEmptyCells(grid, size, fillerMode);

  return { grid, placements };
}

function fillEmptyCells(grid, size, fillerMode) {
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
        grid[r][c] = randomPool();
      }
    }
  }
}
