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
const segmenter = new Intl.Segmenter('te', { granularity: 'grapheme' });
const graphemeLength = (str) => Array.from(segmenter.segment(str)).length;

const targetDir = process.argv[2] || 'data';
const QUESTIONS_FILE = 'questions.json';
const LEVELS_FILE = 'levels.json';
const STOTRAMS_FILE = 'stotrams.json';

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
    if (!DIFFICULTIES.includes(level.difficulty)) {
      errors.push(`${where}: difficulty must be one of ${DIFFICULTIES.join('/')}, got ${JSON.stringify(level.difficulty)}`);
    }
    if (!isPositiveInt(level.gridSize)) errors.push(`${where}: gridSize must be a positive integer`);
    if (level.fillerMode !== 'random' && level.fillerMode !== 'curated') {
      errors.push(`${where}: fillerMode must be "random" or "curated", got ${JSON.stringify(level.fillerMode)}`);
    }
    if (typeof level.breather !== 'boolean') errors.push(`${where}: breather must be a boolean`);
    if (!isPositiveInt(level.japamCount)) errors.push(`${where}: japamCount must be a positive integer`);
    if (!isPositiveInt(level.entryCount)) errors.push(`${where}: entryCount must be a positive integer`);
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

    if (!isPositiveInt(stotram.gridSize)) errors.push(`${where}: gridSize must be a positive integer`);
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
      if (isPositiveInt(stotram.gridSize) && len > stotram.gridSize) {
        errors.push(`${entryWhere}: word "${entry.word}" (${len} letters) can't fit a ${stotram.gridSize}x${stotram.gridSize} grid - raise gridSize or shorten the word`);
      }
      wordCounts.set(entry.word, (wordCounts.get(entry.word) || 0) + 1);
      if (!isNonEmptyString(entry.meaning)) errors.push(`${entryWhere}: meaning must be a non-empty string`);
    });
    for (const [word, count] of wordCounts) {
      if (count > 1) errors.push(`${where}: duplicate word "${word}" appears ${count} times`);
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
    const maxGridSizeByDifficulty = {};
    for (const level of levels) {
      maxGridSizeByDifficulty[level.difficulty] = Math.max(maxGridSizeByDifficulty[level.difficulty] || 0, level.gridSize);
    }

    const tooLong = poolEntries.filter((e) => {
      const maxGrid = maxGridSizeByDifficulty[e.difficulty];
      return maxGrid !== undefined && e.len > maxGrid;
    });
    if (tooLong.length) {
      console.log(`\n✗ words too long for any level at their difficulty`);
      tooLong.forEach((e) => console.log(`  ✗ "${e.word}" (${e.difficulty}, ${e.len} letters) can't fit any "${e.difficulty}" level's grid - raise that level's gridSize or shorten the word`));
      anyFailed = true;
    }

    const orphaned = poolEntries.filter((e) => !(e.difficulty in maxGridSizeByDifficulty));
    if (orphaned.length) {
      console.log(`\n⚠ entries with no matching level`);
      orphaned.forEach((e) => { console.log(`  ⚠ "${e.word}" is tagged difficulty="${e.difficulty}" but no level in levels.json uses that difficulty - it will never appear in a puzzle`); totalWarnings += 1; });
    }

    const poolWarnings = [];
    for (const level of levels) {
      const eligible = poolEntries.filter((e) => e.difficulty === level.difficulty && e.len <= level.gridSize).length;
      if (eligible < level.entryCount) {
        poolWarnings.push(`స్థాయి ${level.levelNumber} (${level.difficulty}): needs ${level.entryCount} entries but only ${eligible} fit an ${level.gridSize}x${level.gridSize} grid - puzzles will show fewer words than intended`);
      }
    }
    if (poolWarnings.length) {
      console.log(`\n⚠ pool size vs level entryCount`);
      poolWarnings.forEach((w) => { console.log(`  ⚠ ${w}`); totalWarnings += 1; });
    }
  }

  console.log(`\n${'-'.repeat(40)}`);
  console.log(anyFailed ? 'FAILED: fix the ✗ items above before merging.' : `PASSED${totalWarnings ? ` with ${totalWarnings} warning(s) to look at` : ''}.`);

  process.exitCode = anyFailed ? 1 : 0;
}

main();
