// Builds a "trace the dotted outline" surface for Likhita Japam - like a
// handwriting-practice worksheet, not a word-search. A word is rendered to
// an offscreen canvas, its ink is reduced to connected blobs (glyph
// strokes), each blob's outer boundary is walked and resampled into evenly
// spaced dots. The visible canvas draws a ruled-paper baseline plus those
// dots; dragging a finger/mouse near a dot fills it in.

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
// regular weight keeps strokes thin enough to (mostly) collapse those two
// rows together while remaining clearly visible. Verified this doesn't
// thin any stroke enough to drop below MIN_BLOB_PIXELS or fragment a
// letter into extra pieces, across the full content pool of all three
// languages.
const FONT_WEIGHT = 400;
const DOT_SPACING = 12; // px between dots along a stroke's outline
const MIN_BLOB_PIXELS = 28; // ignore anti-aliasing specks
export const HIT_RADIUS = 25; // px, how close a drag has to pass to fill a dot

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

function findComponents(ink, width, height) {
  const labels = new Int32Array(width * height).fill(-1);
  const components = [];
  const stack = [];

  for (let start = 0; start < ink.length; start++) {
    if (!ink[start] || labels[start] !== -1) continue;
    const pixels = [];
    labels[start] = components.length;
    stack.push(start);
    while (stack.length) {
      const idx = stack.pop();
      pixels.push(idx);
      const x = idx % width;
      const y = Math.floor(idx / width);
      const neighbors = [
        x > 0 ? idx - 1 : -1,
        x < width - 1 ? idx + 1 : -1,
        y > 0 ? idx - width : -1,
        y < height - 1 ? idx + width : -1,
      ];
      for (const n of neighbors) {
        if (n >= 0 && ink[n] && labels[n] === -1) {
          labels[n] = components.length;
          stack.push(n);
        }
      }
    }
    if (pixels.length >= MIN_BLOB_PIXELS) components.push(pixels);
  }
  return components;
}

function boundaryPixels(pixels, ink, width, height) {
  const boundary = [];
  for (const idx of pixels) {
    const x = idx % width;
    const y = Math.floor(idx / width);
    const isEdge =
      x === 0 || x === width - 1 || y === 0 || y === height - 1 ||
      !ink[idx - 1] || !ink[idx + 1] || !ink[idx - width] || !ink[idx + width];
    if (isEdge) boundary.push({ x, y });
  }
  return boundary;
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
  const components = findComponents(ink, width, height);

  const blobs = components.map((pixels) => {
    const boundary = boundaryPixels(pixels, ink, width, height);
    const ordered = orderByNearestNeighbor(boundary);
    const centroidX = pixels.reduce((sum, idx) => sum + (idx % width), 0) / pixels.length;
    return { dots: resampleByArcLength(ordered, DOT_SPACING), centroidX };
  });
  blobs.sort((a, b) => a.centroidX - b.centroidX);

  const result = { dots: blobs.flatMap((b) => b.dots), width, height, baselineY, ink };
  cache.set(cacheKey, result);
  return result;
}

// A trace counts as done once this fraction of dots has been touched -
// left just short of 100% (rather than exactly 100%) so a single
// stubborn dot - one that's awkward to land precisely, near an edge or
// a tight cluster of strokes - can't leave a genuinely-finished trace
// stuck forever, matching the app's no-penalty tone.
const COMPLETE_THRESHOLD = 0.99;

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
