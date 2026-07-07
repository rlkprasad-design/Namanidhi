#!/usr/bin/env node
// Validates every data/*.json content pack plus data/levels.json against
// the schema the app actually reads (js/data.js + js/grid.js). Run before
// any content PR merges - see README.md "Adding new content". No
// dependencies.
//
// Usage: node scripts/validate-content.js [dir]   (defaults to "data")

const fs = require('fs');
const path = require('path');

const MEANING_WARN_LENGTH = 120;
const segmenter = new Intl.Segmenter('te', { granularity: 'grapheme' });
const graphemeLength = (str) => Array.from(segmenter.segment(str)).length;

const targetDir = process.argv[2] || 'data';
const LEVELS_FILE = 'levels.json';

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}
function isPositiveInt(v) {
  return typeof v === 'number' && Number.isInteger(v) && v > 0;
}

// Validates one already-parsed content-pack file. Returns entries (for the
// cross-file duplicate check) plus { errors, warnings }.
function validateContentFile(data) {
  const errors = [];
  const warnings = [];
  const entries = [];

  if (!isNonEmptyString(data.categoryGroup)) errors.push('categoryGroup must be a non-empty string');
  if (!isNonEmptyString(data.categoryGroupLabel)) errors.push('categoryGroupLabel must be a non-empty string');
  if (!Array.isArray(data.entries) || data.entries.length === 0) {
    errors.push('entries must be a non-empty array');
    return { entries, errors, warnings };
  }

  data.entries.forEach((entry, ei) => {
    const where = `entries[${ei}]`;

    if (!isNonEmptyString(entry.word)) {
      errors.push(`${where}: word must be a non-empty string`);
    } else {
      const len = graphemeLength(entry.word);
      if (len < 2) {
        errors.push(`${where}: word "${entry.word}" is only ${len} grapheme cluster(s) - looks like junk/empty content`);
      }
      entries.push({ word: entry.word, len });
    }

    if (!isNonEmptyString(entry.meaning)) {
      errors.push(`${where}: meaning must be a non-empty string`);
    } else if (entry.meaning.length > MEANING_WARN_LENGTH) {
      warnings.push(`${where}: meaning for "${entry.word}" is ${entry.meaning.length} chars - probably too long for the hints panel (soft limit ${MEANING_WARN_LENGTH})`);
    }

    if ('era' in entry && entry.era !== null && typeof entry.era !== 'string') {
      errors.push(`${where}: era must be a string when present`);
    }
  });

  return { entries, errors, warnings };
}

function validateLevelsFile(levels) {
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

function parseJsonFile(full) {
  const raw = fs.readFileSync(full, 'utf8');
  return JSON.parse(raw);
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
  const wordLocations = new Map(); // word -> [file, file, ...] across the whole pool
  const allPoolEntries = []; // { word, len } across every content file
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
      const errors = validateLevelsFile(data);
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

    const { entries, errors, warnings } = validateContentFile(data);
    totalWarnings += warnings.length;
    for (const e of entries) {
      allPoolEntries.push(e);
      if (!wordLocations.has(e.word)) wordLocations.set(e.word, []);
      wordLocations.get(e.word).push(file);
    }

    if (errors.length === 0) {
      console.log(`\n✓ ${file}${warnings.length ? ` (${warnings.length} warning${warnings.length > 1 ? 's' : ''})` : ''}`);
    } else {
      console.log(`\n✗ ${file}`);
      anyFailed = true;
    }
    for (const e of errors) console.log(`  ✗ ${e}`);
    for (const w of warnings) console.log(`  ⚠ ${w}`);
  }

  const dupeErrors = [];
  for (const [word, locations] of wordLocations) {
    if (locations.length > 1) {
      dupeErrors.push(`Duplicate word "${word}" appears in: ${locations.join(', ')} (every puzzle pools all content files together, so this word would collide with itself)`);
    }
  }
  if (dupeErrors.length) {
    console.log(`\n✗ cross-file duplicates`);
    dupeErrors.forEach((e) => console.log(`  ✗ ${e}`));
    anyFailed = true;
  }

  if (levels && allPoolEntries.length) {
    const maxGridSize = Math.max(...levels.map((l) => l.gridSize));
    const tooLong = allPoolEntries.filter((e) => e.len > maxGridSize);
    if (tooLong.length) {
      console.log(`\n✗ words too long for any configured level (max gridSize is ${maxGridSize})`);
      tooLong.forEach((e) => console.log(`  ✗ "${e.word}" is ${e.len} letters - can never appear in any puzzle, raise a level's gridSize or shorten it`));
      anyFailed = true;
    }

    const poolWarnings = [];
    for (const level of levels) {
      const eligible = allPoolEntries.filter((e) => e.len <= level.gridSize).length;
      if (eligible < level.entryCount) {
        poolWarnings.push(`స్థాయి ${level.levelNumber}: needs ${level.entryCount} entries but only ${eligible} in the pool fit an ${level.gridSize}x${level.gridSize} grid - puzzles will show fewer words than intended`);
      }
    }
    if (poolWarnings.length) {
      console.log(`\n⚠ pool size vs level entryCount`);
      poolWarnings.forEach((w) => { console.log(`  ⚠ ${w}`); totalWarnings += 1; });
    }
  }

  console.log(`\n${'-'.repeat(40)}`);
  console.log(anyFailed ? 'FAILED: fix the ✗ items above before merging.' : `PASSED: ${files.length} file(s) OK${totalWarnings ? `, ${totalWarnings} warning(s) to look at` : ''}.`);

  process.exitCode = anyFailed ? 1 : 0;
}

main();
