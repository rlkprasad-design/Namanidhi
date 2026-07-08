// Converts Roman-letter (English keyboard) input into Telugu script, so a
// player can type "rama" or "krishna" and trace రామ / కృష్ణ. Two layers:
// 1. A small dictionary of common devotional names/words, checked first,
//    for guaranteed-correct results on the spellings people actually type.
// 2. A general phonetic (ITRANS-like) letter-by-letter fallback for
//    anything not in the dictionary - approximate by nature, like every
//    such system, but reasonable for straightforward phonetic spelling.
//
// Vowel length uses a doubled-letter convention (aa/ee/oo) rather than
// ITRANS capitalization, since casual typists won't know that scheme.

const DICTIONARY = {
  rama: 'రామ', sriram: 'శ్రీరామ', srirama: 'శ్రీరామ', shrirama: 'శ్రీరామ',
  krishna: 'కృష్ణ', shrikrishna: 'శ్రీకృష్ణ', srikrishna: 'శ్రీకృష్ణ',
  shiva: 'శివ', shivaya: 'శివాయ', mahadeva: 'మహాదేవ',
  vishnu: 'విష్ణు', narayana: 'నారాయణ', govinda: 'గోవింద', madhava: 'మాధవ',
  hanuman: 'హనుమ', hanumantha: 'హనుమంత', anjaneya: 'ఆంజనేయ',
  ganesha: 'గణేశ', ganapati: 'గణపతి', vinayaka: 'వినాయక',
  lakshmi: 'లక్ష్మి', saraswati: 'సరస్వతి', parvati: 'పార్వతి', durga: 'దుర్గ',
  sita: 'సీత', radha: 'రాధ', hanumantham: 'హనుమంతం',
  venkateswara: 'వేంకటేశ్వర', venkatesa: 'వేంకటేశ', balaji: 'బాలాజీ',
  ayyappa: 'అయ్యప్ప', subrahmanya: 'సుబ్రహ్మణ్య', muruga: 'మురుగ',
  brahma: 'బ్రహ్మ', indra: 'ఇంద్ర', surya: 'సూర్య', chandra: 'చంద్ర',
  om: 'ఓం', namah: 'నమః', namaha: 'నమః', swaha: 'స్వాహా',
};

// Longest-match-first tables. Nasals (m/n) are handled separately below
// since whether they're a full consonant or an anusvara (ం) depends on
// what follows.
const CONSONANTS = [
  ['ksh', 'క్ష'], ['chh', 'ఛ'], ['shh', 'ష'], ['gny', 'జ్ఞ'], ['jny', 'జ్ఞ'],
  ['kh', 'ఖ'], ['gh', 'ఘ'], ['ch', 'చ'], ['jh', 'ఝ'], ['th', 'థ'], ['dh', 'ధ'],
  ['ph', 'ఫ'], ['bh', 'భ'], ['sh', 'శ'],
  ['k', 'క'], ['g', 'గ'], ['c', 'చ'], ['j', 'జ'], ['t', 'త'], ['d', 'ద'],
  ['p', 'ప'], ['f', 'ఫ'], ['b', 'బ'], ['y', 'య'], ['r', 'ర'], ['l', 'ల'],
  ['v', 'వ'], ['w', 'వ'], ['s', 'స'], ['h', 'హ'], ['x', 'క్ష'], ['z', 'జ'],
  ['m', 'మ'], ['n', 'న'],
];

const VOWELS_INDEPENDENT = [
  ['aa', 'ఆ'], ['ee', 'ఈ'], ['ii', 'ఈ'], ['oo', 'ఊ'], ['uu', 'ఊ'],
  ['ai', 'ఐ'], ['au', 'ఔ'], ['ow', 'ఔ'],
  ['a', 'అ'], ['i', 'ఇ'], ['u', 'ఉ'], ['e', 'ఎ'], ['o', 'ఒ'],
];

const VOWELS_MATRA = [
  ['aa', 'ా'], ['ee', 'ీ'], ['ii', 'ీ'], ['oo', 'ూ'], ['uu', 'ూ'],
  ['ai', 'ై'], ['au', 'ౌ'], ['ow', 'ౌ'],
  ['a', ''], ['i', 'ి'], ['u', 'ు'], ['e', 'ె'], ['o', 'ొ'],
];

function matchLongest(word, i, table) {
  for (const [key, value] of table) {
    if (word.startsWith(key, i)) return [key, value];
  }
  return null;
}

function transliterateWord(word) {
  const lower = word.toLowerCase();
  if (DICTIONARY[lower]) return DICTIONARY[lower];

  let out = '';
  let pending = null; // Telugu consonant letter waiting to see if a vowel follows
  let i = 0;

  while (i < word.length) {
    const ch = word[i];

    if (ch === 'm' || ch === 'n') {
      const vowelAhead = matchLongest(word, i + 1, VOWELS_INDEPENDENT);
      if (!vowelAhead) {
        // No vowel follows -> nasalization (anusvara), not a full consonant.
        if (pending) { out += pending; pending = null; }
        out += 'ం';
        i += 1;
        continue;
      }
    }

    const cons = matchLongest(word, i, CONSONANTS);
    if (cons) {
      if (pending) out += pending + '్'; // previous consonant had no vowel - conjunct
      pending = cons[1];
      i += cons[0].length;
      continue;
    }

    const vow = matchLongest(word, i, VOWELS_INDEPENDENT);
    if (vow) {
      if (pending) {
        const matra = matchLongest(word, i, VOWELS_MATRA);
        out += pending + (matra ? matra[1] : '');
        pending = null;
      } else {
        out += vow[1];
      }
      i += vow[0].length;
      continue;
    }

    i += 1; // unrecognized character - skip it
  }

  if (pending) out += pending;
  return out;
}

const LATIN_ONLY = /^[a-zA-Z\s]+$/;

export function looksLikeLatin(text) {
  return LATIN_ONLY.test(text.trim());
}

export function transliterate(text) {
  return text
    .split(/(\s+)/)
    .map((part) => (/^\s+$/.test(part) ? part : transliterateWord(part)))
    .join('');
}
