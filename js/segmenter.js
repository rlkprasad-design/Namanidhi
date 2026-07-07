// Telugu text is made of Unicode grapheme clusters (consonant + vowel sign,
// or conjuncts). Never split with .split('') or string indices - always go
// through these helpers so a "letter" on screen matches a "letter" in code.

const segmenter = new Intl.Segmenter('te', { granularity: 'grapheme' });

export function graphemes(str) {
  return Array.from(segmenter.segment(str), (s) => s.segment);
}

export function graphemeLength(str) {
  return graphemes(str).length;
}
