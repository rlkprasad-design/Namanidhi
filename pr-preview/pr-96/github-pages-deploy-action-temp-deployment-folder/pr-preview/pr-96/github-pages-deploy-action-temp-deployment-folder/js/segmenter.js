// Brahmic-script text (Telugu, Kannada, ...) is made of Unicode grapheme
// clusters (consonant + vowel sign, or conjuncts). Never split with
// .split('') or string indices - always go through these helpers so a
// "letter" on screen matches a "letter" in code.

import { getLang } from './i18n.js';

// Telugu's virama-joined consonant conjuncts (e.g. "శ్రీ") come back as a
// single cluster from the platform's Intl.Segmenter. Kannada's don't: on
// the actual browsers this app runs on, Intl.Segmenter('kn', ...) splits a
// conjunct like "ವ్ಯಾಸ" (Vyasa) into ["ವ್","ಯಾ","ಸ"] instead of
// ["ವ್ಯಾ","ಸ"], leaving a bare half-formed consonant ("ವ್") as its own
// "letter" - a real player spotted exactly this in the grid and Likhita
// Japam. So Kannada gets a hand-rolled clusterer built directly from the
// Unicode conjunct-consonant rule (base consonant, absorb any number of
// virama+consonant pairs, then absorb a trailing vowel sign/anusvara/
// visarga) instead of trusting Intl.Segmenter to do it.
const segmenters = new Map();

function segmenterFor(lang) {
  if (!segmenters.has(lang)) {
    segmenters.set(lang, new Intl.Segmenter(lang, { granularity: 'grapheme' }));
  }
  return segmenters.get(lang);
}

const KANNADA_VIRAMA = '್';
// Dependent vowel signs, anusvara, visarga, nukta - marks that attach to
// the consonant (or conjunct) immediately before them rather than starting
// a new letter of their own.
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

export function kannadaGraphemes(str) {
  const chars = Array.from(str);
  const clusters = [];
  let i = 0;
  while (i < chars.length) {
    let cluster = chars[i];
    i++;
    while (chars[i] === KANNADA_VIRAMA && isKannadaConsonant(chars[i + 1])) {
      cluster += chars[i] + chars[i + 1];
      i += 2;
    }
    if (chars[i] === KANNADA_VIRAMA) {
      cluster += chars[i];
      i++;
    }
    while (i < chars.length && KANNADA_DEPENDENT_MARKS.has(chars[i])) {
      cluster += chars[i];
      i++;
    }
    clusters.push(cluster);
  }
  return clusters;
}

export function graphemes(str) {
  if (getLang() === 'kn') return kannadaGraphemes(str);
  return Array.from(segmenterFor(getLang()).segment(str), (s) => s.segment);
}

export function graphemeLength(str) {
  return graphemes(str).length;
}
