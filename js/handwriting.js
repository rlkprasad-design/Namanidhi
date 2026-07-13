// Builds a "trace the dotted outline" surface for Likhita Japam - like a
// handwriting-practice worksheet, not a word-search. A word is rendered to
// an offscreen canvas, its ink is reduced to connected blobs (glyph
// strokes), each blob's outer boundary is walked and resampled into evenly
// spaced dots. The visible canvas draws a ruled-paper baseline plus those
// dots; dragging a finger/mouse near a dot fills it in.
//
// English words render in a cursive font (Dancing Script) with every
// letter of one word (capitals included) grouped into a single fillText
// call, so the browser's own text shaping joins the whole word into one
// continuous ink blob (and so one continuous dot path) instead of a
// block-letter font's separate per-letter strokes - the finger can flow
// through the entire word without lifting. Only an actual space - a
// break between separate words, e.g. "Sri" and "Rama" - starts a new
// segment with a gap, the same way a pen naturally lifts between words
// even in cursive handwriting; a capital letter never forces a break on
// its own. Telugu (and anything else non-Latin) keeps the original
// block-font, gap-between-every-grapheme behavior unchanged.

import { graphemes } from './segmenter.js';
import { looksLikeLatin } from './transliterate.js';

const FONT_PX = 170;
const LETTER_GAP = FONT_PX * 0.1; // extra gap drawn between segments
const DOT_SPACING = 12; // px between dots along a stroke's outline
const MIN_BLOB_PIXELS = 28; // ignore anti-aliasing specks
export const HIT_RADIUS = 25; // px, how close a drag has to pass to fill a dot
const CURSIVE_FONT = 'Dancing Script';
const BLOCK_FONT = 'Noto Sans Telugu';

const cache = new Map();

async function ensureFontReady() {
  if (document.fonts && document.fonts.load) {
    await Promise.all([
      document.fonts.load(`700 ${FONT_PX}px "${BLOCK_FONT}"`),
      document.fonts.load(`700 ${FONT_PX}px "${CURSIVE_FONT}"`),
    ]);
  }
}

const isSpace = (ch) => /\s/.test(ch);

// Groups graphemes into fillText segments. Non-Latin words (Telugu etc.)
// get one segment per grapheme, matching the original behavior exactly.
// Latin words merge every non-space letter of one word - including any
// capital - into a single segment, rendered together so the cursive
// font's own connecting strokes join the whole word; only a space
// starts a new segment.
function segmentWord(letters, cursive) {
  if (!cursive) return letters.map((letter) => ({ text: letter, joinable: false }));

  const segments = [];
  for (const letter of letters) {
    const canJoin = !isSpace(letter);
    const last = segments[segments.length - 1];
    if (canJoin && last && last.joinable) {
      last.text += letter;
    } else {
      segments.push({ text: letter, joinable: canJoin });
    }
  }
  return segments;
}

function renderInkMask(word) {
  const cursive = looksLikeLatin(word);
  const fontFamily = cursive ? CURSIVE_FONT : BLOCK_FONT;
  const fontShorthand = `700 ${FONT_PX}px "${fontFamily}", sans-serif`;
  const segments = segmentWord(graphemes(word), cursive);

  const measure = document.createElement('canvas').getContext('2d');
  measure.font = fontShorthand;

  let ascent = FONT_PX * 0.8;
  let descent = FONT_PX * 0.25;
  let textWidth = 0;
  const segmentWidths = segments.map((seg, i) => {
    const m = measure.measureText(seg.text);
    ascent = Math.max(ascent, m.actualBoundingBoxAscent || 0);
    descent = Math.max(descent, m.actualBoundingBoxDescent || 0);
    textWidth += m.width;
    if (i < segments.length - 1 && !isSpace(seg.text) && !isSpace(segments[i + 1].text)) textWidth += LETTER_GAP;
    return m.width;
  });

  const padding = FONT_PX * 0.08;
  const width = Math.ceil(textWidth + padding * 2);
  const height = Math.ceil(ascent + descent + padding * 2);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.font = fontShorthand;
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'alphabetic';

  const baselineY = padding + ascent;
  let x = padding;
  segments.forEach((seg, i) => {
    ctx.fillText(seg.text, x, baselineY);
    x += segmentWidths[i];
    if (i < segments.length - 1 && !isSpace(seg.text) && !isSpace(segments[i + 1].text)) x += LETTER_GAP;
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
// { dots: [{x,y}], width, height, baselineY }.
export async function buildDotTrace(word) {
  if (cache.has(word)) return cache.get(word);
  await ensureFontReady();

  const { ink, width, height, baselineY } = renderInkMask(word);
  const components = findComponents(ink, width, height);

  const blobs = components.map((pixels) => {
    const boundary = boundaryPixels(pixels, ink, width, height);
    const ordered = orderByNearestNeighbor(boundary);
    const centroidX = pixels.reduce((sum, idx) => sum + (idx % width), 0) / pixels.length;
    return { dots: resampleByArcLength(ordered, DOT_SPACING), centroidX };
  });
  blobs.sort((a, b) => a.centroidX - b.centroidX);

  const result = { dots: blobs.flatMap((b) => b.dots), width, height, baselineY };
  cache.set(word, result);
  return result;
}

// A trace counts as done once this fraction of dots has been touched -
// left deliberately short of 100% so an almost-complete trace (a stray
// dot or two, imprecise touch input) still counts, matching the app's
// no-penalty tone.
const COMPLETE_THRESHOLD = 0.95;

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
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    markNear(pointFromEvent(e));
  });
  const release = () => { dragging = false; };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
}
