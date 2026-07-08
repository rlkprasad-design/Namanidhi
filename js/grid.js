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

// Picks `count` entries from the pool entries matching this level's
// difficulty tier, restricted to words that can fit in gridSize - drawn
// from a shuffled rotation so nothing repeats until the tier cycles.
export function sampleEntries(pool, level) {
  const eligible = pool.filter(
    (e) => e.difficulty === level.difficulty && graphemes(e.word).length <= level.gridSize
  );
  if (!eligible.length) return [];

  const queue = refillQueue(drawQueues.get(level.difficulty) || [], eligible, level.entryCount);
  const drawn = queue.slice(0, level.entryCount);
  drawQueues.set(level.difficulty, queue.slice(level.entryCount));
  return drawn;
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
