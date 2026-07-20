#!/usr/bin/env node
// Validates data/questions.json (the single content pool) and
// data/levels.json (the level ladder) against the schema the app actually
// reads (js/data.js + js/grid.js). Run before any content PR merges - see
// README.md "Adding new content". No dependencies.
//
// Usage: node scripts/validate-content.js [dir]   (defaults to "data")

const fs = require('fs');
const path = require('path');

const MEANING_WARN_LENGTH = 120;
const DIFFICULTIES = ['easy', 'medium', 'difficult'];

const targetDir = process.argv[2] || 'data';
const QUESTIONS_FILE = 'questions.json';
const LEVELS_FILE = 'levels.json';
const STOTRAMS_FILE = 'stotrams.json';

// Kannada's virama-joined consonant conjuncts (e.g. "ವ್ಯಾಸ") don't cluster
// correctly through Intl.Segmenter on the browsers this app actually runs
// on - it splits them apart, leaving a bare half-formed consonant as its
// own "letter" (see js/segmenter.js for the full story and the matching
// runtime fix). This validator has to count graphemes the same way the app
// does, or its length/grid-fit checks would pass content that then renders
// broken in the real grid - so it gets the same hand-rolled Kannada
// clusterer instead of trusting Intl.Segmenter for data/kn.
const KANNADA_VIRAMA = '್';
const KANNADA_DEPENDENT_MARKS = new Set([
  'ಂ', 'ಃ',
  'ಾ', 'ಿ', 'ೀ', 'ು', 'ೂ', 'ೃ', 'ೄ',
  'ೆ', 'ೇ', 'ೈ', 'ೊ', 'ೋ', 'ೌ',
  '಼',
]);
function isKannadaConsonant(ch) {
  if (!ch) return false;
  const cp = ch.codePointAt(0);
  return cp >= 0x0C95 && cp <= 0x0CB9;
}
function kannadaGraphemeLength(str) {
  const chars = Array.from(str);
  let count = 0;
  let i = 0;
  while (i < chars.length) {
    count++;
    i++;
    while (chars[i] === KANNADA_VIRAMA && isKannadaConsonant(chars[i + 1])) i += 2;
    if (chars[i] === KANNADA_VIRAMA) i++;
    while (i < chars.length && KANNADA_DEPENDENT_MARKS.has(chars[i])) i++;
  }
  return count;
}

const isKannadaDir = path.basename(path.resolve(process.cwd(), targetDir)) === 'kn';
const segmenter = new Intl.Segmenter('te', { granularity: 'grapheme' });
const graphemeLength = (str) => (isKannadaDir ? kannadaGraphemeLength(str) : Array.from(segmenter.segment(str)).length);

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}
function isPositiveInt(v) {
  return typeof v === 'number' && Number.isInteger(v) && v > 0;
}

// Validates the questions file. Returns entries (for cross-checks with
// levels.json) plus { errors, warnings }.
function validateQuestions(data) {
  const errors = [];
  const warnings = [];
  const entries = [];

  if (!Array.isArray(data.entries) || data.entries.length === 0) {
    errors.push('entries must be a non-empty array');
    return { entries, errors, warnings };
  }

  // word+difficulty -> count seen. Scoped to difficulty, not global: a
  // puzzle only ever draws entries from a single difficulty tier
  // (js/grid.js's sampleEntries filters by level.difficulty), so the same
  // word can never be drawn into the same grid twice unless the duplicate
  // is within one tier - that's the only case that could actually show two
  // hints for one grid word in the same puzzle.
  const wordLocations = new Map();

  data.entries.forEach((entry, ei) => {
    const where = `entries[${ei}]`;

    if (!isNonEmptyString(entry.word)) {
      errors.push(`${where}: word must be a non-empty string`);
    } else {
      const len = graphemeLength(entry.word);
      if (len < 2) {
        errors.push(`${where}: word "${entry.word}" is only ${len} grapheme cluster(s) - looks like junk/empty content`);
      }
      const key = `${entry.word}::${entry.difficulty}`;
      wordLocations.set(key, (wordLocations.get(key) || 0) + 1);
      entries.push({ word: entry.word, len, difficulty: entry.difficulty });
    }

    if (!isNonEmptyString(entry.meaning)) {
      errors.push(`${where}: meaning must be a non-empty string`);
    } else if (entry.meaning.length > MEANING_WARN_LENGTH) {
      warnings.push(`${where}: meaning for "${entry.word}" is ${entry.meaning.length} chars - probably too long for the hints panel (soft limit ${MEANING_WARN_LENGTH})`);
    }

    if (!DIFFICULTIES.includes(entry.difficulty)) {
      errors.push(`${where}: difficulty must be one of ${DIFFICULTIES.join('/')}, got ${JSON.stringify(entry.difficulty)}`);
    }

    if ('era' in entry && entry.era !== null && typeof entry.era !== 'string') {
      errors.push(`${where}: era must be a string when present`);
    }
  });

  for (const [key, count] of wordLocations) {
    if (count > 1) {
      const [word, difficulty] = key.split('::');
      errors.push(`Duplicate word "${word}" appears ${count} times at difficulty "${difficulty}"`);
    }
  }

  return { entries, errors, warnings };
}

function validateLevels(levels) {
  const errors = [];
  if (!Array.isArray(levels) || levels.length === 0) {
    return ['levels.json must be a non-empty array'];
  }

  const seen = new Set();
  levels.forEach((level, li) => {
    const where = `levels[${li}]`;
    if (!isPositiveInt(level.levelNumber)) {
      errors.push(`${where}: levelNumber must be a positive integer`);
    } else if (seen.has(level.levelNumber)) {
      errors.push(`${where}: duplicate levelNumber ${level.levelNumber}`);
    } else {
      seen.add(level.levelNumber);
    }
    if (!isPositiveInt(level.gridSizeMin)) errors.push(`${where}: gridSizeMin must be a positive integer`);
    if (!isPositiveInt(level.gridSizeMax)) errors.push(`${where}: gridSizeMax must be a positive integer`);
    if (isPositiveInt(level.gridSizeMin) && isPositiveInt(level.gridSizeMax) && level.gridSizeMin > level.gridSizeMax) {
      errors.push(`${where}: gridSizeMin (${level.gridSizeMin}) must be <= gridSizeMax (${level.gridSizeMax})`);
    }
    if (level.fillerMode !== 'random' && level.fillerMode !== 'curated') {
      errors.push(`${where}: fillerMode must be "random" or "curated", got ${JSON.stringify(level.fillerMode)}`);
    }
    if (!isPositiveInt(level.japamCount)) errors.push(`${where}: japamCount must be a positive integer`);
  });
  return errors;
}

const STOTRAM_STATUSES = ['active', 'soon'];

// Validates data/stotrams.json - the "స్తోత్ర పరీక్ష" sub-section's content.
// Unlike questions.json's pooled/sampled entries, each stotram's entries are
// a fixed curated set (every entry appears every time), so there's no
// difficulty tier or cross-file level ladder to check against - just that
// each stotram is internally consistent and its words fit its own grid.
function validateStotrams(stotrams) {
  const errors = [];
  if (!Array.isArray(stotrams) || stotrams.length === 0) {
    return ['stotrams.json must be a non-empty array'];
  }

  const seenIds = new Set();
  stotrams.forEach((stotram, si) => {
    const where = `stotrams[${si}]`;
    if (!isNonEmptyString(stotram.id)) {
      errors.push(`${where}: id must be a non-empty string`);
    } else if (seenIds.has(stotram.id)) {
      errors.push(`${where}: duplicate id "${stotram.id}"`);
    } else {
      seenIds.add(stotram.id);
    }
    if (!isNonEmptyString(stotram.title)) errors.push(`${where}: title must be a non-empty string`);
    if (!STOTRAM_STATUSES.includes(stotram.status)) {
      errors.push(`${where}: status must be one of ${STOTRAM_STATUSES.join('/')}, got ${JSON.stringify(stotram.status)}`);
    }
    if (stotram.status !== 'active') return; // "soon" entries are placeholders - nothing else to check

    if (!isPositiveInt(stotram.gridSizeMin)) errors.push(`${where}: gridSizeMin must be a positive integer`);
    if (!isPositiveInt(stotram.gridSizeMax)) errors.push(`${where}: gridSizeMax must be a positive integer`);
    if (isPositiveInt(stotram.gridSizeMin) && isPositiveInt(stotram.gridSizeMax) && stotram.gridSizeMin > stotram.gridSizeMax) {
      errors.push(`${where}: gridSizeMin (${stotram.gridSizeMin}) must be <= gridSizeMax (${stotram.gridSizeMax})`);
    }
    if (stotram.fillerMode !== 'random' && stotram.fillerMode !== 'curated') {
      errors.push(`${where}: fillerMode must be "random" or "curated", got ${JSON.stringify(stotram.fillerMode)}`);
    }
    if (!isNonEmptyString(stotram.about)) errors.push(`${where}: about must be a non-empty string`);

    if (!Array.isArray(stotram.entries) || stotram.entries.length === 0) {
      errors.push(`${where}: entries must be a non-empty array`);
      return;
    }
    const wordCounts = new Map();
    stotram.entries.forEach((entry, ei) => {
      const entryWhere = `${where}.entries[${ei}]`;
      if (!isNonEmptyString(entry.word)) {
        errors.push(`${entryWhere}: word must be a non-empty string`);
        return;
      }
      const len = graphemeLength(entry.word);
      if (len < 2) errors.push(`${entryWhere}: word "${entry.word}" is only ${len} grapheme cluster(s) - looks like junk/empty content`);
      if (isPositiveInt(stotram.gridSizeMax) && len > stotram.gridSizeMax) {
        errors.push(`${entryWhere}: word "${entry.word}" (${len} letters) can't fit even the largest grid (${stotram.gridSizeMax}x${stotram.gridSizeMax}) - raise gridSizeMax or shorten the word`);
      }
      wordCounts.set(entry.word, (wordCounts.get(entry.word) || 0) + 1);
      if (!isNonEmptyString(entry.meaning)) errors.push(`${entryWhere}: meaning must be a non-empty string`);
      if (!DIFFICULTIES.includes(entry.difficulty)) {
        errors.push(`${entryWhere}: difficulty must be one of ${DIFFICULTIES.join('/')}, got ${JSON.stringify(entry.difficulty)}`);
      }
    });
    for (const [word, count] of wordCounts) {
      if (count > 1) errors.push(`${where}: duplicate word "${word}" appears ${count} times`);
    }

    if (isPositiveInt(stotram.gridSizeMin)) {
      const eligibleAtMin = stotram.entries.filter((e) => isNonEmptyString(e.word) && graphemeLength(e.word) <= stotram.gridSizeMin).length;
      if (eligibleAtMin < 2) {
        errors.push(`${where}: only ${eligibleAtMin} entries fit the smallest grid (${stotram.gridSizeMin}x${stotram.gridSizeMin}) - a round there would be nearly empty; raise gridSizeMin, add shorter entries, or shorten existing ones`);
      }
    }
  });

  return errors;
}

function parseJsonFile(full) {
  return JSON.parse(fs.readFileSync(full, 'utf8'));
}

function main() {
  const dir = path.resolve(process.cwd(), targetDir);
  if (!fs.existsSync(dir)) {
    console.error(`No such directory: ${dir}`);
    process.exitCode = 1;
    return;
  }

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  if (!files.length) {
    console.error(`No .json files found in ${dir}`);
    process.exitCode = 1;
    return;
  }

  let anyFailed = false;
  let totalWarnings = 0;
  let poolEntries = null;
  let levels = null;

  for (const file of files) {
    const full = path.join(dir, file);
    let data;
    try {
      data = parseJsonFile(full);
    } catch (err) {
      console.log(`\n✗ ${file}`);
      console.log(`  ✗ invalid JSON: ${err.message}`);
      anyFailed = true;
      continue;
    }

    if (file === LEVELS_FILE) {
      const errors = validateLevels(data);
      if (errors.length === 0) {
        console.log(`\n✓ ${file}`);
        levels = data;
      } else {
        console.log(`\n✗ ${file}`);
        errors.forEach((e) => console.log(`  ✗ ${e}`));
        anyFailed = true;
      }
      continue;
    }

    if (file === QUESTIONS_FILE) {
      const { entries, errors, warnings } = validateQuestions(data);
      totalWarnings += warnings.length;
      if (errors.length === 0) {
        console.log(`\n✓ ${file}${warnings.length ? ` (${warnings.length} warning${warnings.length > 1 ? 's' : ''})` : ''}`);
        poolEntries = entries;
      } else {
        console.log(`\n✗ ${file}`);
        anyFailed = true;
      }
      for (const e of errors) console.log(`  ✗ ${e}`);
      for (const w of warnings) console.log(`  ⚠ ${w}`);
      continue;
    }

    if (file === STOTRAMS_FILE) {
      const errors = validateStotrams(data);
      if (errors.length === 0) {
        console.log(`\n✓ ${file}`);
      } else {
        console.log(`\n✗ ${file}`);
        errors.forEach((e) => console.log(`  ✗ ${e}`));
        anyFailed = true;
      }
      continue;
    }

    console.log(`\n· ${file} (unrecognized file, skipped - only questions.json, levels.json, and stotrams.json are validated)`);
  }

  if (levels && poolEntries) {
    // Every level now mixes all three difficulties in one grid (no more
    // per-level difficulty), so one shared ceiling applies to all of them:
    // a word just needs to fit under *some* level's largest possible roll.
    const maxGridSizeOverall = Math.max(...levels.map((l) => l.gridSizeMax));

    const tooLong = poolEntries.filter((e) => e.len > maxGridSizeOverall);
    if (tooLong.length) {
      console.log(`\n✗ words too long for any level's largest possible grid`);
      tooLong.forEach((e) => console.log(`  ✗ "${e.word}" (${e.difficulty}, ${e.len} letters) can't fit any level's largest grid (max ${maxGridSizeOverall}x${maxGridSizeOverall}) - raise a level's gridSizeMax or shorten the word`));
      anyFailed = true;
    }

    // A puzzle's actual entry count per difficulty is derived from
    // whatever size it rolls (entryCountForGridSize, split three ways)
    // and clamped to however many words are eligible at that size, so a
    // shortfall degrades gracefully - the only genuinely bad case is a
    // rolled size with fewer than 2 eligible words for some tier, which
    // would leave that tier essentially unrepresented in the mix.
    const poolWarnings = [];
    for (const level of levels) {
      for (let size = level.gridSizeMin; size <= level.gridSizeMax; size++) {
        for (const difficulty of DIFFICULTIES) {
          const eligible = poolEntries.filter((e) => e.difficulty === difficulty && e.len <= size).length;
          if (eligible < 2) {
            poolWarnings.push(`స్థాయి ${level.levelNumber} at ${size}x${size}: only ${eligible} "${difficulty}" entries fit - that tier would be nearly absent from puzzles at this size`);
          }
        }
      }
    }
    if (poolWarnings.length) {
      console.log(`\n⚠ pool size vs a level's possible rolled grid sizes`);
      poolWarnings.forEach((w) => { console.log(`  ⚠ ${w}`); totalWarnings += 1; });
    }
  }

  console.log(`\n${'-'.repeat(40)}`);
  console.log(anyFailed ? 'FAILED: fix the ✗ items above before merging.' : `PASSED${totalWarnings ? ` with ${totalWarnings} warning(s) to look at` : ''}.`);

  process.exitCode = anyFailed ? 1 : 0;
}

main();
