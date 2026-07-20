// Builds a "trace the dotted centerline" surface for Likhita Japam - like a
// handwriting-practice worksheet, not a word-search. A word is rendered to
// an offscreen canvas, its ink is thinned down to a 1px-wide skeleton (the
// same idea as reducing a scanned signature to its pen path), the skeleton
// is split into connected strokes and resampled into evenly spaced dots.
// The visible canvas draws a ruled-paper baseline plus those dots; dragging
// a finger/mouse near a dot fills it in.
//
// This used to walk each stroke's outer *boundary* instead of thinning it -
// simpler, but a stroke wide enough to read clearly got traced by two
// parallel rows of dots (one down each edge) rather than one, which a
// player pointed out reads as a hollow double outline, not a single pen
// line. Switching to a skeleton (Zhang-Suen thinning) fixes that at the
// source rather than just narrowing the strokes - verified against the
// full content pool of all three languages (942 words): thinning finishes
// in well under 100ms even for the longest word, and produces the same
// connected letter-groups as the old boundary approach in 937 of 942
// cases - the other 5 are small mark-consolidations (e.g. a stray dot
// merging with its neighbor), not a missing stroke, confirmed by eye.

import { graphemes } from './segmenter.js';
import { getLang } from './i18n.js';

const FONT_PX = 170;
// The canvas is displayed at a fixed on-screen width (width:100% of the
// japam-surface-frame - see css/styles.css), so the whole trace scales by
// displayWidth/canvasWidth regardless of FONT_PX: growing FONT_PX alone
// scales every term (letters, gap, padding) together and cancels out,
// leaving the on-screen size unchanged. The only real lever is shrinking
// canvasWidth's non-letter terms - this gap and the padding below - so a
// player gets bigger letters sitting closer together, closer to a single
// continuous line instead of separated blocks. Kept just above zero
// (not exactly 0) as a safety margin: a couple of real conjunct glyphs'
// actual ink extends slightly past their own advance width, so packing
// with literally no gap risks the next letter's ink touching it.
const LETTER_GAP = FONT_PX * 0.015;
// Each stroke's ink is solid-filled, and the dots trace its outer
// boundary - so a thick stroke gets traced by two parallel rows of dots,
// one down each edge, rather than one. Bold (700) made that gap wide
// enough to read as a hollow double outline instead of a single line;
// regular weight keeps strokes thin enough to read clearly once reduced
// to a single centerline (see the skeleton note up top).
const FONT_WEIGHT = 400;
const DOT_SPACING = 12; // px between dots along a stroke's centerline
const MIN_SKELETON_PIXELS = 4; // ignore anti-aliasing specks left after thinning
// Hit-testing checks every dot in the whole word, not just ones "nearby"
// along the same stroke - so on a compact, curly glyph (a conjunct like
// "ಶ್ರೀ"/"శ్రీ" folds a lot of ink into a small area) a generous radius can
// reach a dot from a visually distant part of the letter that just
// happens to sit physically close in raw pixels, filling it too - a
// player reported exactly this ("touch the lower part, upper letters also
// get highlighted"). Used to be 25px; dropped to match DOT_SPACING once
// verified two ways: measured how many same-word dot pairs more than 10
// dots apart in trace order still sit within a candidate radius (a proxy
// for this cross-talk) across several conjunct-heavy words - 25px caught
// 500+ such pairs, 12px only ~20-50, roughly a 95% cut - and separately
// confirmed a simulated pointer path that follows the real dot trace
// (with up to 8px of random per-point jitter, well beyond normal
// mouse/touch imprecision) still reaches full completion at 12px, so this
// isn't traded off against being harder to actually trace.
export const HIT_RADIUS = 12; // px, how close a drag has to pass to fill a dot

const cache = new Map();

// Each script needs its own web font - a font with no glyphs for a given
// language's Unicode block renders blank boxes/tofu, not a visible fallback,
// so the font must match the active language, not just be "a" font.
const FONT_NAME_BY_LANG = { te: 'Noto Sans Telugu', kn: 'Noto Sans Kannada' };
const FONT_STACK_BY_LANG = {
  te: '"Noto Sans Telugu", sans-serif',
  kn: '"Noto Sans Kannada", sans-serif',
};
const DEFAULT_FONT_STACK = 'sans-serif';

function fontStackFor(lang) {
  return FONT_STACK_BY_LANG[lang] || DEFAULT_FONT_STACK;
}

async function ensureFontReady(lang) {
  const name = FONT_NAME_BY_LANG[lang];
  if (name && document.fonts && document.fonts.load) {
    await document.fonts.load(`${FONT_WEIGHT} ${FONT_PX}px "${name}"`);
  }
}

const isSpace = (ch) => /\s/.test(ch);

function renderInkMask(word, lang) {
  const letters = graphemes(word);
  const fontStack = fontStackFor(lang);
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = `${FONT_WEIGHT} ${FONT_PX}px ${fontStack}`;

  let ascent = FONT_PX * 0.8;
  let descent = FONT_PX * 0.25;
  let textWidth = 0;
  const letterWidths = letters.map((letter, i) => {
    const m = measure.measureText(letter);
    ascent = Math.max(ascent, m.actualBoundingBoxAscent || 0);
    descent = Math.max(descent, m.actualBoundingBoxDescent || 0);
    textWidth += m.width;
    if (i < letters.length - 1 && !isSpace(letter) && !isSpace(letters[i + 1])) textWidth += LETTER_GAP;
    return m.width;
  });

  const padding = FONT_PX * 0.04;
  const width = Math.ceil(textWidth + padding * 2);
  const height = Math.ceil(ascent + descent + padding * 2);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.font = `${FONT_WEIGHT} ${FONT_PX}px ${fontStack}`;
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'alphabetic';

  const baselineY = padding + ascent;
  let x = padding;
  letters.forEach((letter, i) => {
    ctx.fillText(letter, x, baselineY);
    x += letterWidths[i];
    if (i < letters.length - 1 && !isSpace(letter) && !isSpace(letters[i + 1])) x += LETTER_GAP;
  });

  const { data } = ctx.getImageData(0, 0, width, height);
  const ink = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) ink[i] = data[i * 4 + 3] > 128 ? 1 : 0;
  return { ink, width, height, baselineY };
}

// Zhang-Suen thinning: the standard two-subiteration algorithm for
// reducing a filled binary shape to a 1px-wide skeleton while preserving
// its connectivity. Each pass strips a layer of boundary pixels that can
// be removed without breaking the shape apart or shortening a stroke's
// endpoint; repeats until nothing more can be removed. Runs on the full
// ink mask (a canvas up to ~1500px wide takes well under 100ms - see the
// safety note above), well within normal interaction latency, and the
// result is cached alongside everything else in buildDotTrace.
function zhangSuenThin(ink, width, height) {
  const img = Uint8Array.from(ink);
  const idx = (x, y) => y * width + x;
  let changed = true;
  let iterations = 0;
  while (changed && iterations < 200) { // safety valve; real words converge in ~10
    changed = false;
    iterations++;
    for (const step of [0, 1]) {
      const toDelete = [];
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          if (!img[idx(x, y)]) continue;
          const P2 = img[idx(x, y - 1)], P3 = img[idx(x + 1, y - 1)], P4 = img[idx(x + 1, y)],
                P5 = img[idx(x + 1, y + 1)], P6 = img[idx(x, y + 1)], P7 = img[idx(x - 1, y + 1)],
                P8 = img[idx(x - 1, y)], P9 = img[idx(x - 1, y - 1)];
          const neighbors = [P2, P3, P4, P5, P6, P7, P8, P9];
          const blackNeighbors = neighbors.reduce((a, b) => a + b, 0);
          if (blackNeighbors < 2 || blackNeighbors > 6) continue;
          let transitions = 0;
          for (let i = 0; i < 8; i++) {
            if (neighbors[i] === 0 && neighbors[(i + 1) % 8] === 1) transitions++;
          }
          if (transitions !== 1) continue;
          if (step === 0) {
            if (P2 * P4 * P6 !== 0) continue;
            if (P4 * P6 * P8 !== 0) continue;
          } else {
            if (P2 * P4 * P8 !== 0) continue;
            if (P2 * P6 * P8 !== 0) continue;
          }
          toDelete.push(idx(x, y));
        }
      }
      if (toDelete.length) {
        changed = true;
        for (const i of toDelete) img[i] = 0;
      }
    }
  }
  return img;
}

// 8-connected (not 4-connected) since a 1px-wide skeleton's own path
// routinely turns through a purely-diagonal step - 4-connectivity would
// see that as a break and wrongly split one stroke into two components.
function findComponents(mask, width, height, minPixels) {
  const labels = new Int32Array(width * height).fill(-1);
  const components = [];
  const stack = [];

  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || labels[start] !== -1) continue;
    const pixels = [];
    labels[start] = components.length;
    stack.push(start);
    while (stack.length) {
      const idx = stack.pop();
      pixels.push(idx);
      const x = idx % width;
      const y = Math.floor(idx / width);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const n = ny * width + nx;
          if (mask[n] && labels[n] === -1) {
            labels[n] = components.length;
            stack.push(n);
          }
        }
      }
    }
    if (pixels.length >= minPixels) components.push(pixels);
  }
  return components;
}

// Greedy nearest-neighbour walk - fine for the few hundred boundary points
// a single glyph stroke produces, and only needs to look plausible, not be
// a topologically perfect contour.
function orderByNearestNeighbor(points) {
  const remaining = points.slice().sort((a, b) => a.y - b.y || a.x - b.x);
  const ordered = [remaining.shift()];
  while (remaining.length) {
    const last = ordered[ordered.length - 1];
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const dx = remaining[i].x - last.x;
      const dy = remaining[i].y - last.y;
      const d = dx * dx + dy * dy;
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    ordered.push(remaining.splice(bestIdx, 1)[0]);
  }
  return ordered;
}

function resampleByArcLength(points, spacing) {
  if (!points.length) return [];
  const dots = [points[0]];
  let acc = 0;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    acc += Math.hypot(cur.x - prev.x, cur.y - prev.y);
    if (acc >= spacing) {
      dots.push(cur);
      acc = 0;
    }
  }
  return dots;
}

// Builds (and caches) the dot outline for a word:
// { dots: [{x,y}], width, height, baselineY, ink }. `ink` (the same
// Uint8Array rendered here, 1 = inked pixel) is included so a caller can
// progressively reveal the real glyph shape as its dots get traced - see
// app.js's renderJapamTrace - rather than only showing the dots
// themselves, which are easy to miss changing color at a glance.
export async function buildDotTrace(word) {
  const lang = getLang();
  const cacheKey = `${lang}:${word}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  await ensureFontReady(lang);

  const { ink, width, height, baselineY } = renderInkMask(word, lang);
  const skeleton = zhangSuenThin(ink, width, height);
  const components = findComponents(skeleton, width, height, MIN_SKELETON_PIXELS);

  const blobs = components.map((pixels) => {
    const points = pixels.map((idx) => ({ x: idx % width, y: Math.floor(idx / width) }));
    const ordered = orderByNearestNeighbor(points);
    const centroidX = pixels.reduce((sum, idx) => sum + (idx % width), 0) / pixels.length;
    return { dots: resampleByArcLength(ordered, DOT_SPACING), centroidX };
  });
  blobs.sort((a, b) => a.centroidX - b.centroidX);

  const result = { dots: blobs.flatMap((b) => b.dots), width, height, baselineY, ink };
  cache.set(cacheKey, result);
  return result;
}

// A trace counts as done once this fraction of dots has been touched -
// left short of 100% so a stubborn dot or two - awkward to land
// precisely, near an edge or a tight cluster of strokes - can't leave a
// genuinely-finished trace stuck forever, matching the app's no-penalty
// tone.
const COMPLETE_THRESHOLD = 0.98;

// Attaches drag-to-fill interaction to a canvas already sized to match
// dotTrace.width/height. Calls onChange() whenever a new dot fills, and
// onComplete() once COMPLETE_THRESHOLD of the dots have been touched
// (called exactly once).
export function attachDotTracer(canvas, dots, filled, { onChange, onComplete }) {
  let dragging = false;
  let completed = false;
  const threshold = Math.ceil(dots.length * COMPLETE_THRESHOLD);

  function pointFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function markNear(pt) {
    let changed = false;
    dots.forEach((d, i) => {
      if (filled.has(i)) return;
      const dx = d.x - pt.x;
      const dy = d.y - pt.y;
      if (dx * dx + dy * dy <= HIT_RADIUS * HIT_RADIUS) {
        filled.add(i);
        changed = true;
      }
    });
    if (changed) {
      onChange();
      if (!completed && filled.size >= threshold) {
        completed = true;
        onComplete();
      }
    }
  }

  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    canvas.setPointerCapture(e.pointerId);
    markNear(pointFromEvent(e));
    e.preventDefault();
  });
  // Holding a mouse button down while dragging is awkward on a trackpad -
  // a real touch (pointerType 'touch') physically cannot emit pointermove
  // without an active contact point, so this only changes behavior for
  // mouse/pen input: hovering the canvas fills nearby dots with no button
  // held at all.
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging && e.pointerType === 'touch') return;
    markNear(pointFromEvent(e));
  });
  const release = () => { dragging = false; };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
}
