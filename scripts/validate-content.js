#!/usr/bin/env node
// Validates every data/*.json content pack against the schema the app
// actually reads (js/data.js + js/grid.js). Run before any content PR
// merges - see README.md "Adding new content". No dependencies.
//
// Usage: node scripts/validate-content.js [dir]   (defaults to "data")

const fs = require('fs');
const path = require('path');

const MEANING_WARN_LENGTH = 120;
const segmenter = new Intl.Segmenter('te', { granularity: 'grapheme' });
const graphemeLength = (str) => Array.from(segmenter.segment(str)).length;

const targetDir = process.argv[2] || 'data';

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}
function isPositiveInt(v) {
  return typeof v === 'number' && Number.isInteger(v) && v > 0;
}

// Validates one already-parsed dataset. Returns { errors: string[], warnings: string[] }.
function validateDataset(data) {
  const errors = [];
  const warnings = [];

  if (!isNonEmptyString(data.categoryGroup)) errors.push('categoryGroup must be a non-empty string');
  if (!isNonEmptyString(data.categoryGroupLabel)) errors.push('categoryGroupLabel must be a non-empty string');
  if (!('subGroupId' in data)) errors.push('subGroupId key is missing (use null if there is no sub-group)');
  if (!('subGroupLabel' in data)) errors.push('subGroupLabel key is missing (use null if there is no sub-group)');
  if (!Array.isArray(data.levels) || data.levels.length === 0) {
    errors.push('levels must be a non-empty array');
    return { errors, warnings };
  }

  const seenLevelNumbers = new Set();
  const wordLocations = new Map(); // word -> ["స్థాయి 1", "స్థాయి 2", ...]

  data.levels.forEach((level, li) => {
    const where = `levels[${li}]`;

    if (!isPositiveInt(level.levelNumber)) {
      errors.push(`${where}: levelNumber must be a positive integer`);
    } else if (seenLevelNumbers.has(level.levelNumber)) {
      errors.push(`${where}: duplicate levelNumber ${level.levelNumber}`);
    } else {
      seenLevelNumbers.add(level.levelNumber);
    }

    if (!isPositiveInt(level.gridSize)) errors.push(`${where}: gridSize must be a positive integer`);
    if (level.fillerMode !== 'random' && level.fillerMode !== 'curated') {
      errors.push(`${where}: fillerMode must be "random" or "curated", got ${JSON.stringify(level.fillerMode)}`);
    }
    if (typeof level.breather !== 'boolean') errors.push(`${where}: breather must be a boolean`);
    if (!isPositiveInt(level.japamCount)) errors.push(`${where}: japamCount must be a positive integer`);

    if (!Array.isArray(level.entries) || level.entries.length === 0) {
      errors.push(`${where}: entries must be a non-empty array`);
      return;
    }

    level.entries.forEach((entry, ei) => {
      const entryWhere = `${where}.entries[${ei}]`;

      if (!isNonEmptyString(entry.word)) {
        errors.push(`${entryWhere}: word must be a non-empty string`);
      } else {
        const len = graphemeLength(entry.word);
        if (len < 2) {
          errors.push(`${entryWhere}: word "${entry.word}" is only ${len} grapheme cluster(s) - looks like junk/empty content`);
        }
        if (isPositiveInt(level.gridSize) && len > level.gridSize) {
          errors.push(`${entryWhere}: word "${entry.word}" (${len} letters) cannot fit in a ${level.gridSize}x${level.gridSize} grid - raise gridSize or shorten the level`);
        }
        const levelLabel = isPositiveInt(level.levelNumber) ? `స్థాయి ${level.levelNumber}` : where;
        if (!wordLocations.has(entry.word)) wordLocations.set(entry.word, []);
        wordLocations.get(entry.word).push(levelLabel);
      }

      if (!isNonEmptyString(entry.meaning)) {
        errors.push(`${entryWhere}: meaning must be a non-empty string`);
      } else if (entry.meaning.length > MEANING_WARN_LENGTH) {
        warnings.push(`${entryWhere}: meaning for "${entry.word}" is ${entry.meaning.length} chars - probably too long for the hints panel (soft limit ${MEANING_WARN_LENGTH})`);
      }

      if ('era' in entry && entry.era !== null && typeof entry.era !== 'string') {
        errors.push(`${entryWhere}: era must be a string when present`);
      }
    });
  });

  for (const [word, locations] of wordLocations) {
    if (locations.length > 1) {
      errors.push(`Duplicate word "${word}" appears in: ${locations.join(', ')}`);
    }
  }

  return { errors, warnings };
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

  for (const file of files) {
    const full = path.join(dir, file);
    const raw = fs.readFileSync(full, 'utf8');
    let data;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      console.log(`\n✗ ${file}`);
      console.log(`  - invalid JSON: ${err.message}`);
      anyFailed = true;
      continue;
    }

    const { errors, warnings } = validateDataset(data);
    totalWarnings += warnings.length;

    if (errors.length === 0) {
      console.log(`\n✓ ${file}${warnings.length ? ` (${warnings.length} warning${warnings.length > 1 ? 's' : ''})` : ''}`);
    } else {
      console.log(`\n✗ ${file}`);
      anyFailed = true;
    }
    for (const e of errors) console.log(`  ✗ ${e}`);
    for (const w of warnings) console.log(`  ⚠ ${w}`);
  }

  console.log(`\n${'-'.repeat(40)}`);
  console.log(anyFailed ? 'FAILED: fix the ✗ items above before merging.' : `PASSED: ${files.length} file(s) OK${totalWarnings ? `, ${totalWarnings} warning(s) to look at` : ''}.`);

  process.exitCode = anyFailed ? 1 : 0;
}

main();
