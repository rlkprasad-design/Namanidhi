// Builds a "trace the dotted outline" surface for Likhita Japam - like a
// handwriting-practice worksheet, not a word-search. A word is rendered to
// an offscreen canvas, its ink is reduced to connected blobs (glyph
// strokes), each blob's outer boundary is walked and resampled into evenly
// spaced dots. The visible canvas draws faint ruled-paper lines plus those
// dots; dragging a finger/mouse near a dot fills it in.

const FONT_PX = 110;
const DOT_SPACING = 9; // px between dots along a stroke's outline
const MIN_BLOB_PIXELS = 12; // ignore anti-aliasing specks
export const HIT_RADIUS = 17; // px, how close a drag has to pass to fill a dot

const cache = new Map();

async function ensureFontReady() {
  if (document.fonts && document.fonts.load) {
    await document.fonts.load(`700 ${FONT_PX}px "Noto Sans Telugu"`);
  }
}

function renderInkMask(word) {
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = `700 ${FONT_PX}px "Noto Sans Telugu", sans-serif`;
  const m = measure.measureText(word);
  const padding = FONT_PX * 0.35;
  const ascent = m.actualBoundingBoxAscent || FONT_PX * 0.8;
  const descent = m.actualBoundingBoxDescent || FONT_PX * 0.25;
  const width = Math.ceil(m.width + padding * 2);
  const height = Math.ceil(ascent + descent + padding * 2);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.font = `700 ${FONT_PX}px "Noto Sans Telugu", sans-serif`;
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(word, padding, padding + ascent);

  const { data } = ctx.getImageData(0, 0, width, height);
  const ink = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) ink[i] = data[i * 4 + 3] > 128 ? 1 : 0;
  return { ink, width, height };
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

// Builds (and caches) the dot outline for a word: { dots: [{x,y}], width, height }.
export async function buildDotTrace(word) {
  if (cache.has(word)) return cache.get(word);
  await ensureFontReady();

  const { ink, width, height } = renderInkMask(word);
  const components = findComponents(ink, width, height);

  const blobs = components.map((pixels) => {
    const boundary = boundaryPixels(pixels, ink, width, height);
    const ordered = orderByNearestNeighbor(boundary);
    const centroidX = pixels.reduce((sum, idx) => sum + (idx % width), 0) / pixels.length;
    return { dots: resampleByArcLength(ordered, DOT_SPACING), centroidX };
  });
  blobs.sort((a, b) => a.centroidX - b.centroidX);

  const result = { dots: blobs.flatMap((b) => b.dots), width, height };
  cache.set(word, result);
  return result;
}

// Attaches drag-to-fill interaction to a canvas already sized to match
// dotTrace.width/height. Calls onChange() whenever a new dot fills, and
// onComplete() once every dot has been touched.
export function attachDotTracer(canvas, dots, filled, { onChange, onComplete }) {
  let dragging = false;

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
      if (filled.size === dots.length) onComplete();
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
