// Brahmic-script text (Telugu, Kannada, ...) is made of Unicode grapheme
// clusters (consonant + vowel sign, or conjuncts). Never split with
// .split('') or string indices - always go through these helpers so a
// "letter" on screen matches a "letter" in code.

import { getLang } from './i18n.js';

// Grapheme-cluster boundaries follow the Unicode extended grapheme cluster
// algorithm (UAX #29), which is locale-invariant for the scripts this app
// uses - the locale tag mainly matters for word/sentence segmentation, not
// graphemes. Still, keying the segmenter off the active language rather than
// a hardcoded 'te' keeps this correct if that ever changes.
const segmenters = new Map();

function segmenterFor(lang) {
  if (!segmenters.has(lang)) {
    segmenters.set(lang, new Intl.Segmenter(lang, { granularity: 'grapheme' }));
  }
  return segmenters.get(lang);
}

export function graphemes(str) {
  return Array.from(segmenterFor(getLang()).segment(str), (s) => s.segment);
}

export function graphemeLength(str) {
  return graphemes(str).length;
}
