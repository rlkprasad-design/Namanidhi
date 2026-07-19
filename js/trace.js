// Shared straight-line tracing engine. Used both for the word-search grid
// (Nama Nidhi) and the single-row tracing surface (Likhita Japam) - same
// pointer mechanics, the caller just supplies a different DOM layout.
//
// Cells must be DOM elements carrying data-r and data-c attributes.
// This module only knows about (r, c) coordinates; matching selected
// letters against target words is the caller's job.

export function attachTracer(container, { onDragStart, onDragUpdate, onDragEnd }) {
  let active = false;
  let start = null;
  let dir = null; // [dr, dc] once the direction locks in, or null
  let path = [];

  function pointFromEvent(e) {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const cellEl = el && el.closest('[data-r][data-c]');
    if (!cellEl || !container.contains(cellEl)) return null;
    return { r: Number(cellEl.dataset.r), c: Number(cellEl.dataset.c) };
  }

  function computePath(to) {
    if (to.r === start.r && to.c === start.c) return [start];

    if (!dir) {
      const dr = Math.sign(to.r - start.r);
      const dc = Math.sign(to.c - start.c);
      const straight = dr === 0 || dc === 0 || Math.abs(to.r - start.r) === Math.abs(to.c - start.c);
      if (!straight) return path; // not a valid line from start yet; ignore
      dir = [dr, dc];
    }

    const [dr, dc] = dir;
    let steps;
    if (dr !== 0 && dc !== 0) {
      const s1 = (to.r - start.r) / dr;
      const s2 = (to.c - start.c) / dc;
      if (s1 !== s2 || s1 < 0) return path;
      steps = s1;
    } else if (dr !== 0) {
      if (to.c !== start.c) return path;
      steps = (to.r - start.r) / dr;
    } else {
      if (to.r !== start.r) return path;
      steps = (to.c - start.c) / dc;
    }
    if (!Number.isFinite(steps) || steps < 0) return path;

    const newPath = [];
    for (let i = 0; i <= steps; i++) {
      newPath.push({ r: start.r + dr * i, c: start.c + dc * i });
    }
    return newPath;
  }

  function begin(p) {
    active = true;
    start = p;
    dir = null;
    path = [p];
    onDragStart(path);
  }

  container.addEventListener('pointerdown', (e) => {
    const p = pointFromEvent(e);
    if (!p) return;
    begin(p);
    container.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  // Holding a mouse button down while dragging is awkward on a trackpad -
  // a real touch (pointerType 'touch') physically cannot emit pointermove
  // without an active contact point, so this branch is naturally a no-op
  // on touchscreens and only changes behavior for mouse/pen input: moving
  // over the grid starts and continues a trace with no button held at
  // all, ending when the pointer leaves the grid (see pointerleave below)
  // instead of on pointerup.
  container.addEventListener('pointermove', (e) => {
    const p = pointFromEvent(e);
    if (!active) {
      if (!p || e.pointerType === 'touch') return;
      begin(p);
      return;
    }
    if (!p) return;
    const newPath = computePath(p);
    if (newPath !== path) {
      path = newPath;
      onDragUpdate(path);
    }
  });

  function release() {
    if (!active) return;
    active = false;
    const finalPath = path;
    path = [];
    start = null;
    dir = null;
    onDragEnd(finalPath);
  }

  container.addEventListener('pointerup', release);
  container.addEventListener('pointercancel', release);
  container.addEventListener('pointerleave', (e) => {
    if (e.pointerType !== 'touch') release();
  });
}

// Reads the letters along a traced path out of a grid (rows of grapheme
// strings) and returns both the forward and reversed reading.
export function pathToStrings(path, grid) {
  const letters = path.map(({ r, c }) => grid[r][c]);
  return { forward: letters.join(''), reversed: letters.slice().reverse().join('') };
}
