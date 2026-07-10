import { generateGridReliable, sampleMixedEntries, entryCountForGridSize, randomInt } from './grid.js';
import { graphemes } from './segmenter.js';
import { attachTracer, pathToStrings } from './trace.js';
import { buildDotTrace, attachDotTracer } from './handwriting.js';
import { looksLikeLatin, transliterate } from './transliterate.js';
import { loadEntryPool, loadLevels, loadStotrams } from './data.js';
import {
  getPlayerName, setPlayerName, getPlayerId, setPlayerId,
  recordPuzzleProgressLocal, recordJapamLocal,
  getLocalPuzzleTotals, getLocalJapamTotals,
  hasSeenIntro, markIntroSeen,
} from './storage.js';
import {
  isBackendConfigured, ensurePlayer, syncPuzzleProgress, syncJapamLog,
  fetchPuzzleLeaderboard, fetchJapamLeaderboard,
} from './supabase-client.js';

const root = document.getElementById('app');

const JAPAM_NAMES = [
  { word: 'శ్రీరామ', label: 'శ్రీరామ' },
  { word: 'ఓం నమః శివాయ', label: 'ఓం నమః శివాయ' },
  { word: 'గోవింద', label: 'గోవింద' },
];
const INTERLUDE_WORD = 'శ్రీరామ';

// What a found word of each difficulty is "worth" - shown as a small
// symbol on its hint row (GEM_ICONS), with GEM_LABELS kept only for
// accessibility (title/aria-label) - and tallied separately on the
// scoreboard. Revealing a word via "సమాధానం చూపు" still completes the
// puzzle but does not earn its gem (see markFound's viaHint handling
// below).
const GEM_LABELS = { easy: 'ముత్యం', medium: 'రత్నం', difficult: 'వజ్రం' };

const GEM_ICONS = {
  easy: `<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="currentColor"/><circle cx="6" cy="6" r="1.3" fill="#fff" opacity="0.55"/></svg>`,
  medium: `<svg viewBox="0 0 16 16"><polygon points="8,1 15,8 8,15 1,8" fill="currentColor" stroke="#4e1219" stroke-width="0.6"/></svg>`,
  difficult: `<svg viewBox="0 0 16 16"><polygon points="4,3 12,3 15,7 8,15 1,7" fill="currentColor" stroke="#4e1219" stroke-width="0.6"/><path d="M4,3 L8,15 M12,3 L8,15 M1,7 L15,7" stroke="#4e1219" stroke-width="0.4" opacity="0.5" fill="none"/></svg>`,
};

function gemBadge(difficulty) {
  return `<span class="gem-icon gem-${difficulty}" role="img" aria-label="${GEM_LABELS[difficulty] || ''}" title="${GEM_LABELS[difficulty] || ''}">${GEM_ICONS[difficulty] || ''}</span>`;
}

const state = {
  playerName: null,
  playerId: null,
};

function escapeAttr(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function setScreen(node) {
  root.innerHTML = '';
  root.appendChild(node);
}

function topBar({ backAction, title } = {}) {
  const bar = el(`
    <div class="top-bar">
      <div>${backAction ? '<button type="button" class="btn btn-link" data-back>← వెనుకకు</button>' : ''}</div>
      <div class="player">${state.playerName ? `${escapeAttr(state.playerName)} · <button type="button" class="btn-link" data-change-name style="min-height:auto;padding:0;">మార్చు</button>` : ''}</div>
    </div>
  `);
  if (backAction) bar.querySelector('[data-back]').addEventListener('click', backAction);
  const changeBtn = bar.querySelector('[data-change-name]');
  if (changeBtn) changeBtn.addEventListener('click', showNameGate);
  return bar;
}

// ---------------------------------------------------------------------
// Boot + identity
// ---------------------------------------------------------------------

async function boot() {
  if (!hasSeenIntro()) {
    showIntro(() => { markIntroSeen(); continueBoot(); });
    return;
  }
  continueBoot();
}

async function continueBoot() {
  state.playerName = getPlayerName();
  state.playerId = getPlayerId();
  if (!state.playerName) {
    showNameGate();
    return;
  }
  if (!state.playerId && isBackendConfigured()) {
    // Boot-time resume: if the saved name now conflicts with someone else's
    // (e.g. two devices settled on the same name before this device ever
    // synced), just stay local-only for this session rather than blocking
    // the app - the player can pick a distinct name via "మార్చు" later.
    const result = await ensurePlayer(state.playerName, state.playerId);
    if (result.id) {
      state.playerId = result.id;
      setPlayerId(result.id);
    }
  }
  showHome();
}

function showIntro(onContinue) {
  const screen = el(`
    <div class="intro-screen">
      <h1 class="display" style="text-align:center;">నామ నిధి కి స్వాగతం</h1>
      <p>ఇది ఒక ఆటవిడుపు లాంటి సాధన. మీరు రెండు మార్గాలు ఎంచుకోవచ్చు. మొదటిది ఇచ్చిన అక్షరాల సమూహంలో భగవంతుని లేదా ఆ సంబంధించిన వ్యక్తుల లేదా వస్తువుల పేర్లను గుర్తించడం ('ఈనాడు' పదవినోదం లాగా ).</p>
      <p>రెండవది, తెల్సిన నామాన్ని ప్రశాంతంగా పెన్ తో పేపర్ మీద రాస్తున్నట్లు గా స్క్రీన్ మీద వ్రాయడం. దీన్ని లిఖిత జపం అంటారు. మీకు నచ్చిన పేర్లను కూడా మీరు వ్రాయవచ్చు.</p>
      <p>స్కోర్ బోర్డు లో మీ ప్రగతి ని చూడగలరు. మన ఇతర కుటుంబ సభ్యుల ప్రగతి కూడా అక్కడ ఉంటుంది.</p>
      <p>ఇది చెయ్యటానికి ముఖ్య కారణం, మన phone ద్వారా మనం చాల సేపు మనం సమాచార సేకరణ యంత్రాలుగా ఉంటున్నాం. కొంచెం సేపు దానికి విరామం అవసరం అనిపించి వేరే ఎదో పని బదులు ఇది పురుషార్థం గా కూడా పనికి వస్తుంది అన్న భావం తో దీనికి పూనుకున్నా.</p>
      <p class="intro-signature">Just a random thought in action....but once started, it was absorbing for me. Hope you too enjoy it.</p>
      <div class="btn-row" style="margin-top:24px;">
        <button type="button" class="btn btn-primary" data-intro-continue>ప్రారంభించండి</button>
      </div>
    </div>
  `);
  screen.querySelector('[data-intro-continue]').addEventListener('click', onContinue);
  setScreen(screen);
}

function showNameGate() {
  const screen = el(`
    <div class="name-gate">
      <h1 class="display">నామ నిధి</h1>
      <p class="tagline">నామాల్లో దాగిన రత్నాలు</p>
      <p>ఆడటానికి మీ పేరు లేదా ముద్దుపేరు రాయండి</p>
      <input type="text" class="text-input" maxlength="40" placeholder="మీ పేరు" data-name-input />
      <p class="field-error" data-name-error style="display:none;"></p>
      <div class="btn-row">
        <button type="button" class="btn btn-primary" data-begin>ప్రారంభించండి</button>
      </div>
    </div>
  `);
  const input = screen.querySelector('[data-name-input]');
  const errorEl = screen.querySelector('[data-name-error]');
  const beginBtn = screen.querySelector('[data-begin]');
  if (state.playerName) input.value = state.playerName;
  const submit = async () => {
    const name = input.value.trim();
    if (!name) { input.focus(); return; }
    errorEl.style.display = 'none';
    beginBtn.disabled = true;
    let playerId = null;
    if (isBackendConfigured()) {
      // Only carry over this device's own player id if the name is unchanged -
      // otherwise a brand-new name must not silently inherit someone else's id.
      const knownPlayerId = name === state.playerName ? state.playerId : null;
      const result = await ensurePlayer(name, knownPlayerId);
      if (result.status === 'taken') {
        errorEl.textContent = 'ఈ పేరు ఇప్పటికే వాడుకలో ఉంది. దయచేసి వేరే పేరు లేదా ఇంటిపేరు జోడించి రాయండి.';
        errorEl.style.display = 'block';
        beginBtn.disabled = false;
        input.focus();
        return;
      }
      playerId = result.id;
    }
    setPlayerName(name);
    state.playerName = name;
    state.playerId = playerId;
    setPlayerId(playerId);
    beginBtn.disabled = false;
    showHome();
  };
  screen.querySelector('[data-begin]').addEventListener('click', submit);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  setScreen(screen);
  input.focus();
}

// ---------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------

function showHome() {
  const screen = el(`
    <div>
      <div class="title-block">
        <img src="icons/aum-180.png" alt="" class="home-logo" width="88" height="88" />
        <h1 class="display">నామ నిధి</h1>
        <p class="tagline">నామాల్లో దాగిన రత్నాలు</p>
      </div>
      <p class="tagline" style="text-align:center;">మీకు నచ్చిన విధానాన్ని ఎంచుకోండి</p>
      <div class="mode-choice">
        <button type="button" class="mode-btn" data-mode="nama-nidhi">
          <div class="display">నామ గుప్త నిధి</div>
          <div class="sub">నామాలు దాగిన పజిల్ ఆడండి</div>
        </button>
        <button type="button" class="mode-btn" data-mode="likhita-japam">
          <div class="display">లిఖిత జపం</div>
          <div class="sub">నామాన్ని ప్రశాంతంగా రాయండి</div>
        </button>
        <button type="button" class="mode-btn new" data-mode="stotra-pariksha">
          <div class="new-tag">కొత్తది</div>
          <div class="display">స్తోత్ర పరీక్ష</div>
          <div class="sub">మీ అవగాహనను పరీక్షించుకోండి</div>
        </button>
      </div>
      <div class="btn-row" style="margin-top:28px;">
        <button type="button" class="btn btn-secondary" data-scoreboard>స్కోరు బోర్డు</button>
        <button type="button" class="btn btn-secondary" data-about>ఈ యాప్ గురించి</button>
      </div>
    </div>
  `);
  screen.prepend(topBar());
  screen.querySelector('[data-mode="nama-nidhi"]').addEventListener('click', startNamaGuptaNidhi);
  screen.querySelector('[data-mode="likhita-japam"]').addEventListener('click', showJapamNamePicker);
  screen.querySelector('[data-mode="stotra-pariksha"]').addEventListener('click', showStotramList);
  screen.querySelector('[data-scoreboard]').addEventListener('click', showScoreboard);
  screen.querySelector('[data-about]').addEventListener('click', () => showIntro(showHome));
  setScreen(screen);
}

// ---------------------------------------------------------------------
// Nama Gupta Nidhi: straight into a puzzle, no category or difficulty
// picker. Every puzzle mixes entries from all content packs AND all
// three difficulty tiers together - the hint line is the only clue to
// what each hidden word is, and to what it's worth (ముత్యం/రత్నం/వజ్రం).
// ---------------------------------------------------------------------

const WRONG_TRIES_FOR_NUDGE = 4;

// Degrees to rotate a "points right" arrow glyph so it points along
// (dr, dc) - purely the geometry of the drag itself, no knowledge of
// where any word actually is.
function pointerAngleDeg(dr, dc) {
  return (Math.atan2(dr, dc) * 180) / Math.PI;
}

// Smaller grids have more room per cell - scale the letter up to use it,
// instead of a flat size that leaves the 4x4 grid's big cells half-empty.
function cellFontSize(gridSize) {
  const rem = Math.min(2.3, Math.max(0.85, 9.2 / gridSize));
  return `${rem.toFixed(2)}rem`;
}

async function startNamaGuptaNidhi() {
  const [levels, pool] = await Promise.all([loadLevels(), loadEntryPool()]);
  renderGame(buildSession(levels[0], pool));
}

function buildSession(level, pool) {
  const { gridSize, entries } = sampleMixedEntries(pool, level);
  const { grid, placements } = generateGridReliable({
    size: gridSize,
    entries,
    fillerMode: level.fillerMode,
  });
  return {
    level,
    pool,
    gridSize,
    grid,
    placements: placements.map((p) => ({ ...p, found: false, earnedGem: false })),
    wrongAttempts: 0,
  };
}

function renderGame(session) {
  const { level, gridSize } = session;
  const screen = el(`
    <div>
      <h2 style="text-align:center;">నామ గుప్త నిధి · ${gridSize}×${gridSize}</h2>
      <p class="tagline" style="text-align:center;">కింద సూచనల్లో ఉన్న నామాలను అక్షరాల్లో వేలితో గీసి కనుగొనండి</p>
      <div class="grid-frame">
        <div class="grid" data-grid style="grid-template-columns:repeat(${gridSize}, 1fr); --cell-font-size:${cellFontSize(gridSize)};"></div>
      </div>
      <div class="game-toolbar">
        <button type="button" class="btn btn-secondary" data-new-puzzle>కొత్త పజిల్</button>
        <button type="button" class="btn btn-secondary" data-show-answer>సమాధానం చూపు</button>
      </div>
      <div class="hints-panel">
        <h3>సూచనలు</h3>
        <div data-hints></div>
      </div>
    </div>
  `);
  screen.prepend(topBar({ backAction: showHome }));

  const gridEl = screen.querySelector('[data-grid]');
  const hintsEl = screen.querySelector('[data-hints]');
  const toolbarEl = screen.querySelector('.game-toolbar');
  const cellEls = [];

  for (let r = 0; r < gridSize; r++) {
    const row = [];
    for (let c = 0; c < gridSize; c++) {
      const cellEl = el(`<div class="cell" data-r="${r}" data-c="${c}">${session.grid[r][c]}</div>`);
      gridEl.appendChild(cellEl);
      row.push(cellEl);
    }
    cellEls.push(row);
  }

  function renderHints() {
    hintsEl.innerHTML = '';
    for (const p of session.placements) {
      const item = el(`
        <div class="hint-item ${p.found ? 'found' : 'pending'}">
          <span class="hint-word">${p.letters.join('')}</span>
          ${gemBadge(p.entry.difficulty)}
          <span class="hint-meaning">${p.entry.meaning} <span class="hint-count">(${p.letters.length})</span></span>
        </div>
      `);
      hintsEl.appendChild(item);
    }
  }
  renderHints();

  let lastSelected = [];
  function highlightSelection(path) {
    lastSelected.forEach(({ r, c }) => cellEls[r][c].classList.remove('selected'));
    path.forEach(({ r, c }) => cellEls[r][c].classList.add('selected'));
    lastSelected = path;
  }

  // A small arrow on the last-selected cell showing which way the drag
  // is currently heading - purely the geometry of path[0]->path[1], not
  // a peek at session.placements. Helps keep a diagonal drag straight
  // without revealing which word (if any) is actually along that line.
  let pointerCell = null;
  function updateDirectionPointer(path) {
    if (pointerCell) {
      pointerCell.classList.remove('direction-pointer');
      pointerCell.style.removeProperty('--pointer-angle');
      pointerCell = null;
    }
    if (path.length < 2) return;
    const [a, b] = path;
    const dr = Math.sign(b.r - a.r);
    const dc = Math.sign(b.c - a.c);
    const last = path[path.length - 1];
    pointerCell = cellEls[last.r][last.c];
    pointerCell.style.setProperty('--pointer-angle', `${pointerAngleDeg(dr, dc)}deg`);
    pointerCell.classList.add('direction-pointer');
  }

  function markFound(placement, viaHint) {
    placement.found = true;
    placement.earnedGem = !viaHint;
    placement.cells.forEach(([r, c]) => cellEls[r][c].classList.add('found'));
    renderHints();
    checkLevelComplete();
  }

  function flashWrong(path) {
    path.forEach(({ r, c }) => cellEls[r][c].classList.add('wrong'));
    setTimeout(() => {
      path.forEach(({ r, c }) => cellEls[r][c].classList.remove('wrong'));
    }, 400);
  }

  function maybeNudge() {
    if (session.wrongAttempts < WRONG_TRIES_FOR_NUDGE) return;
    const target = session.placements.find((p) => !p.found);
    if (!target) return;
    session.wrongAttempts = 0;
    target.cells.forEach(([r, c]) => cellEls[r][c].classList.add('nudge'));
    setTimeout(() => {
      target.cells.forEach(([r, c]) => cellEls[r][c].classList.remove('nudge'));
    }, 2500);
  }

  function checkLevelComplete() {
    if (!session.placements.every((p) => p.found)) return;
    recordLevelProgress(session);
    toolbarEl.innerHTML = '';
    const continueBtn = el('<button type="button" class="btn btn-primary" data-level-continue>కొనసాగించు</button>');
    continueBtn.addEventListener('click', () => showLevelComplete(level));
    toolbarEl.appendChild(continueBtn);
  }

  attachTracer(gridEl, {
    onDragStart: (path) => { highlightSelection(path); updateDirectionPointer(path); },
    onDragUpdate: (path) => { highlightSelection(path); updateDirectionPointer(path); },
    onDragEnd: (path) => {
      highlightSelection([]);
      updateDirectionPointer([]);
      if (path.length < 2) return;
      const { forward, reversed } = pathToStrings(path, session.grid);
      const match = session.placements.find((p) => {
        if (p.found) return false;
        const word = p.letters.join('');
        return word === forward || word === reversed;
      });
      if (match) {
        session.wrongAttempts = 0;
        markFound(match);
      } else {
        session.wrongAttempts += 1;
        flashWrong(path);
        maybeNudge();
      }
    },
  });

  screen.querySelector('[data-new-puzzle]').addEventListener('click', () => {
    renderGame(buildSession(level, session.pool));
  });
  screen.querySelector('[data-show-answer]').addEventListener('click', () => {
    const target = session.placements.find((p) => !p.found);
    if (target) markFound(target, true);
  });

  setScreen(screen);
}

function recordLevelProgress(session) {
  const { level } = session;
  const gemCounts = { easy: 0, medium: 0, difficult: 0 };
  for (const p of session.placements) {
    if (p.earnedGem) gemCounts[p.entry.difficulty] = (gemCounts[p.entry.difficulty] || 0) + 1;
  }
  const progress = {
    category: 'mixed',
    sub_category: null,
    level: level.levelNumber,
    entries_found: session.placements.length,
    pearls_found: gemCounts.easy,
    gems_found: gemCounts.medium,
    diamonds_found: gemCounts.difficult,
  };
  recordPuzzleProgressLocal(progress);
  if (state.playerId) syncPuzzleProgress(state.playerId, progress);
}

function showLevelComplete(level) {
  const screen = el(`
    <div class="complete-screen">
      <div class="glow">🙏</div>
      <h2>అభినందనలు!</h2>
      <p>అన్ని నామాలు దొరికాయి.</p>
      <div class="btn-row" style="margin-top:24px;">
        <button type="button" class="btn btn-primary" data-continue>కొనసాగించు</button>
      </div>
    </div>
  `);
  screen.querySelector('[data-continue]').addEventListener('click', () => {
    startJapamSession({
      mode: 'interlude',
      word: INTERLUDE_WORD,
      target: level.japamCount,
      onExit: showHome,
    });
  });
  setScreen(screen);
}

// ---------------------------------------------------------------------
// Stotra Pariksha: one curated puzzle per stotram, testing recall of
// names from that specific stotram's own text - every entry appears
// every time (no sampling/difficulty tiers, unlike Nama Gupta Nidhi
// above).
// ---------------------------------------------------------------------

async function showStotramList() {
  const screen = el(`
    <div>
      <h2 style="text-align:center;">స్తోత్ర పరీక్ష</h2>
      <p class="tagline" style="text-align:center;">మీ అవగాహనను పరీక్షించుకోండి</p>
      <div class="card-grid" data-stotrams style="margin-top:20px;"></div>
    </div>
  `);
  screen.prepend(topBar({ backAction: showHome }));
  setScreen(screen);

  const stotrams = await loadStotrams();
  const container = screen.querySelector('[data-stotrams]');
  for (const stotram of stotrams) {
    if (stotram.status !== 'active') {
      container.appendChild(el(`
        <div class="card locked">
          <div class="card-title">${stotram.title}</div>
          <div class="card-sub">త్వరలో వస్తుంది</div>
          <span class="badge soon">త్వరలో</span>
        </div>
      `));
      continue;
    }
    const card = el(`
      <button type="button" class="card">
        <div class="card-title">${stotram.title}</div>
        <div class="card-sub">మొత్తం ${stotram.entries.length} పేర్లు · గ్రిడ్ సైజు, ప్రశ్నల సంఖ్య ప్రతిసారి మారుతుంది</div>
        <span class="badge">ఆడవచ్చు</span>
      </button>
    `);
    card.addEventListener('click', () => startStotram(stotram));
    container.appendChild(card);
  }
}

// Per-stotram shuffled draw queue - same rotation idea as grid.js's
// per-difficulty queues, so rounds cycle through the whole word list
// before anything repeats, instead of drawing independently at random
// each time. Each call also rolls its own grid size within the stotram's
// range, which changes which words are eligible - so the existing queue
// is first trimmed to only currently-eligible words before topping it
// back up, same approach as sampleMixedEntries in grid.js.
const stotramDrawQueues = new Map();

function drawStotramRound(stotram, gridSize) {
  const eligible = stotram.entries.filter((e) => graphemes(e.word).length <= gridSize);
  const eligibleWords = new Set(eligible.map((e) => e.word));
  let queue = (stotramDrawQueues.get(stotram.id) || []).filter((e) => eligibleWords.has(e.word));
  const count = Math.min(entryCountForGridSize(gridSize), eligible.length);

  while (queue.length < count) {
    const queuedWords = new Set(queue.map((e) => e.word));
    const unseen = eligible.filter((e) => !queuedWords.has(e.word));
    const shuffled = (unseen.length ? unseen : eligible).slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    queue = queue.concat(shuffled);
  }
  const drawn = queue.slice(0, count);
  stotramDrawQueues.set(stotram.id, queue.slice(count));
  return drawn;
}

function buildStotramSession(stotram) {
  const gridSize = randomInt(stotram.gridSizeMin, stotram.gridSizeMax);
  const entries = drawStotramRound(stotram, gridSize);
  const { grid, placements } = generateGridReliable({ size: gridSize, entries, fillerMode: stotram.fillerMode });
  return { stotram, gridSize, grid, placements: placements.map((p) => ({ ...p, found: false, earnedGem: false })), wrongAttempts: 0 };
}

function startStotram(stotram) {
  renderStotramGame(buildStotramSession(stotram));
}

function renderStotramGame(session) {
  const { stotram, gridSize } = session;
  const screen = el(`
    <div>
      <h2 style="text-align:center;">${stotram.title}</h2>
      <p class="tagline" style="text-align:center;">మీ అవగాహనను పరీక్షించుకోండి</p>
      <div class="grid-frame">
        <div class="grid" data-grid style="grid-template-columns:repeat(${gridSize}, 1fr); --cell-font-size:${cellFontSize(gridSize)};"></div>
      </div>
      <div class="game-toolbar">
        <button type="button" class="btn btn-secondary" data-new-puzzle>కొత్త పజిల్</button>
        <button type="button" class="btn btn-secondary" data-show-answer>సమాధానం చూపు</button>
      </div>
      <div class="hints-panel">
        <h3>సూచనలు</h3>
        <div data-hints></div>
      </div>
    </div>
  `);
  screen.prepend(topBar({ backAction: showStotramList }));

  const gridEl = screen.querySelector('[data-grid]');
  const hintsEl = screen.querySelector('[data-hints]');
  const toolbarEl = screen.querySelector('.game-toolbar');
  const cellEls = [];

  for (let r = 0; r < gridSize; r++) {
    const row = [];
    for (let c = 0; c < gridSize; c++) {
      const cellEl = el(`<div class="cell" data-r="${r}" data-c="${c}">${session.grid[r][c]}</div>`);
      gridEl.appendChild(cellEl);
      row.push(cellEl);
    }
    cellEls.push(row);
  }

  function renderHints() {
    hintsEl.innerHTML = '';
    for (const p of session.placements) {
      hintsEl.appendChild(el(`
        <div class="hint-item ${p.found ? 'found' : 'pending'}">
          <span class="hint-word">${p.letters.join('')}</span>
          ${gemBadge(p.entry.difficulty)}
          <span class="hint-meaning">${p.entry.meaning} <span class="hint-count">(${p.letters.length})</span></span>
        </div>
      `));
    }
  }
  renderHints();

  let lastSelected = [];
  function highlightSelection(path) {
    lastSelected.forEach(({ r, c }) => cellEls[r][c].classList.remove('selected'));
    path.forEach(({ r, c }) => cellEls[r][c].classList.add('selected'));
    lastSelected = path;
  }

  let pointerCell = null;
  function updateDirectionPointer(path) {
    if (pointerCell) {
      pointerCell.classList.remove('direction-pointer');
      pointerCell.style.removeProperty('--pointer-angle');
      pointerCell = null;
    }
    if (path.length < 2) return;
    const [a, b] = path;
    const dr = Math.sign(b.r - a.r);
    const dc = Math.sign(b.c - a.c);
    const last = path[path.length - 1];
    pointerCell = cellEls[last.r][last.c];
    pointerCell.style.setProperty('--pointer-angle', `${pointerAngleDeg(dr, dc)}deg`);
    pointerCell.classList.add('direction-pointer');
  }

  function markFound(placement, viaHint) {
    placement.found = true;
    placement.earnedGem = !viaHint;
    placement.cells.forEach(([r, c]) => cellEls[r][c].classList.add('found'));
    renderHints();
    checkComplete();
  }

  function flashWrong(path) {
    path.forEach(({ r, c }) => cellEls[r][c].classList.add('wrong'));
    setTimeout(() => path.forEach(({ r, c }) => cellEls[r][c].classList.remove('wrong')), 400);
  }

  function maybeNudge() {
    if (session.wrongAttempts < WRONG_TRIES_FOR_NUDGE) return;
    const target = session.placements.find((p) => !p.found);
    if (!target) return;
    session.wrongAttempts = 0;
    target.cells.forEach(([r, c]) => cellEls[r][c].classList.add('nudge'));
    setTimeout(() => target.cells.forEach(([r, c]) => cellEls[r][c].classList.remove('nudge')), 2500);
  }

  function checkComplete() {
    if (!session.placements.every((p) => p.found)) return;
    recordStotramProgress(session);
    toolbarEl.innerHTML = '';
    const btn = el('<button type="button" class="btn btn-primary" data-continue>కొనసాగించు</button>');
    btn.addEventListener('click', () => showStotramComplete(stotram));
    toolbarEl.appendChild(btn);
  }

  attachTracer(gridEl, {
    onDragStart: (path) => { highlightSelection(path); updateDirectionPointer(path); },
    onDragUpdate: (path) => { highlightSelection(path); updateDirectionPointer(path); },
    onDragEnd: (path) => {
      highlightSelection([]); updateDirectionPointer([]);
      if (path.length < 2) return;
      const { forward, reversed } = pathToStrings(path, session.grid);
      const match = session.placements.find((p) => !p.found && (p.letters.join('') === forward || p.letters.join('') === reversed));
      if (match) { session.wrongAttempts = 0; markFound(match); }
      else { session.wrongAttempts += 1; flashWrong(path); maybeNudge(); }
    },
  });

  screen.querySelector('[data-new-puzzle]').addEventListener('click', () => renderStotramGame(buildStotramSession(stotram)));
  screen.querySelector('[data-show-answer]').addEventListener('click', () => {
    const target = session.placements.find((p) => !p.found);
    if (target) markFound(target, true);
  });

  setScreen(screen);
}

function recordStotramProgress(session) {
  const gemCounts = { easy: 0, medium: 0, difficult: 0 };
  for (const p of session.placements) {
    if (p.earnedGem) gemCounts[p.entry.difficulty] = (gemCounts[p.entry.difficulty] || 0) + 1;
  }
  const progress = {
    category: 'stotram',
    sub_category: session.stotram.id,
    level: 1,
    entries_found: session.placements.length,
    pearls_found: gemCounts.easy,
    gems_found: gemCounts.medium,
    diamonds_found: gemCounts.difficult,
  };
  recordPuzzleProgressLocal(progress);
  if (state.playerId) syncPuzzleProgress(state.playerId, progress);
}

function showStotramComplete(stotram) {
  const screen = el(`
    <div class="complete-screen">
      <div class="glow">🙏</div>
      <h2>అభినందనలు!</h2>
      <p>${stotram.title}లోని అన్ని నామాలను మీరు కనుగొన్నారు.</p>
      <div class="about-box">
        <strong>${stotram.title}</strong> గురించి: ${stotram.about}
      </div>
      <div class="btn-row" style="margin-top:12px;">
        <button type="button" class="btn btn-secondary" data-again>మళ్ళీ ఆడండి</button>
        <button type="button" class="btn btn-primary" data-list>ముగించు</button>
      </div>
    </div>
  `);
  screen.querySelector('[data-again]').addEventListener('click', () => startStotram(stotram));
  screen.querySelector('[data-list]').addEventListener('click', showStotramList);
  setScreen(screen);
}

// ---------------------------------------------------------------------
// Likhita Japam (standalone + interlude share this engine)
// ---------------------------------------------------------------------

function showJapamNamePicker() {
  const screen = el(`
    <div>
      <h2>ఏ నామాన్ని రాద్దాం?</h2>
      <div class="card-grid" data-names></div>
      <div class="custom-word-block">
        <p class="tagline" style="text-align:center;">లేదా మీకు నచ్చిన నామాన్ని రాయండి</p>
        <input type="text" class="text-input" maxlength="60" placeholder="తెలుగులో లేదా English లో రాయండి" data-custom-word />
        <div class="btn-row">
          <button type="button" class="btn btn-primary" data-custom-start>ప్రారంభించండి</button>
        </div>
      </div>
    </div>
  `);
  screen.prepend(topBar({ backAction: showHome }));
  const container = screen.querySelector('[data-names]');
  JAPAM_NAMES.forEach(({ word, label }, i) => {
    const card = el(`
      <button type="button" class="card" style="text-align:center;">
        <div class="card-title">${label}</div>
        ${i === 0 ? '<span class="badge">సూచించినది</span>' : ''}
      </button>
    `);
    card.addEventListener('click', () => {
      startJapamSession({ mode: 'standalone', word, target: null, onExit: showHome });
    });
    container.appendChild(card);
  });

  const customInput = screen.querySelector('[data-custom-word]');
  const startCustom = () => {
    const typed = customInput.value.trim();
    if (!typed) { customInput.focus(); return; }
    const word = looksLikeLatin(typed) ? transliterate(typed) : typed;
    startJapamSession({ mode: 'standalone', word, target: null, onExit: showHome });
  };
  screen.querySelector('[data-custom-start]').addEventListener('click', startCustom);
  customInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') startCustom(); });

  setScreen(screen);
}

function startJapamSession(config) {
  const session = { ...config, count: 0 };
  renderJapamTrace(session);
}

async function renderJapamTrace(session) {
  const isStandalone = !session.target;
  const screen = el(`
    <div>
      <h2 style="text-align:center;">లిఖిత జపం</h2>
      <p class="tagline" style="text-align:center;">కింద చుక్కలను అనుసరిస్తూ వేలితో గీయండి</p>
      <div class="japam-word">${session.word}</div>
      ${session.target ? '<div class="mala" data-mala></div>' : '<p class="tagline" style="text-align:center;" data-count></p>'}
      <div class="japam-surface-frame">
        <canvas data-canvas></canvas>
      </div>
      ${isStandalone ? '<div class="btn-row"><button type="button" class="btn btn-secondary" data-exit>ముగించు</button></div>' : ''}
    </div>
  `);
  const exitAction = isStandalone ? () => showJapamSessionSummary(session) : session.onExit;
  screen.prepend(topBar({ backAction: exitAction }));
  if (isStandalone) screen.querySelector('[data-exit]').addEventListener('click', exitAction);

  if (session.target) {
    const mala = screen.querySelector('[data-mala]');
    for (let i = 0; i < session.target; i++) {
      mala.appendChild(el(`<div class="bead${i < session.count ? ' filled' : ''}"></div>`));
    }
  } else {
    screen.querySelector('[data-count]').textContent = `ఈ సెషన్‌లో: ${session.count} సార్లు`;
  }

  setScreen(screen);

  const canvas = screen.querySelector('[data-canvas]');
  const { dots, width, height, baselineY } = await buildDotTrace(session.word);
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const filled = new Set();

  function draw() {
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(240, 210, 139, 0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, baselineY);
    ctx.lineTo(width, baselineY);
    ctx.stroke();
    dots.forEach((d, i) => {
      ctx.beginPath();
      ctx.arc(d.x, d.y, filled.has(i) ? 4.5 : 3.5, 0, Math.PI * 2);
      ctx.fillStyle = filled.has(i) ? '#c9962e' : '#4e1219';
      ctx.fill();
    });
  }
  draw();

  attachDotTracer(canvas, dots, filled, {
    onChange: draw,
    onComplete: () => onJapamSuccess(session),
  });
}

function onJapamSuccess(session) {
  session.count += 1;
  const entry = {
    name_traced: session.word,
    count: 1,
    session_type: session.mode === 'interlude' ? 'interlude' : 'standalone',
  };
  recordJapamLocal(entry);
  if (state.playerId) syncJapamLog(state.playerId, entry);

  if (session.mode === 'interlude' && session.count >= session.target) {
    showJapamCompletion(session);
  } else {
    renderJapamTrace(session);
  }
}

function showJapamSessionSummary(session) {
  const screen = el(`
    <div class="completion-beat">
      <h2>ఈ సెషన్‌లో</h2>
      <p style="font-size:1.6rem;">${session.count} సార్లు</p>
      <div class="btn-row" style="margin-top:20px;">
        <button type="button" class="btn btn-primary" data-home>హోమ్‌కు వెళ్ళండి</button>
      </div>
    </div>
  `);
  screen.querySelector('[data-home]').addEventListener('click', showHome);
  setScreen(screen);
}

function showJapamCompletion(session) {
  const screen = el(`
    <div class="completion-beat">
      <div class="glow">🙏</div>
      <p>లిఖిత జపం పూర్తయింది.</p>
      <div class="btn-row" style="margin-top:20px;">
        <button type="button" class="btn btn-primary" data-continue>కొనసాగించు</button>
      </div>
    </div>
  `);
  screen.querySelector('[data-continue]').addEventListener('click', session.onExit);
  setScreen(screen);
}

// ---------------------------------------------------------------------
// Scoreboard
// ---------------------------------------------------------------------

async function showScoreboard() {
  const screen = el(`
    <div>
      <h2 style="text-align:center;">స్కోరు బోర్డు</h2>
      <p class="tagline" style="text-align:center;">మీరు, మీ కుటుంబ సభ్యులు ఇప్పటివరకు సాధించిన ప్రగతి ఇక్కడ చూడవచ్చు</p>
      <div class="score-section">
        <h3>నామ గుప్త నిధి స్కోరు బోర్డు</h3>
        <div data-puzzle-board>లోడ్ అవుతోంది...</div>
      </div>
      <div class="score-section">
        <h3>లిఖిత జప స్కోరు బోర్డు</h3>
        <div data-japam-board>లోడ్ అవుతోంది...</div>
      </div>
    </div>
  `);
  screen.prepend(topBar({ backAction: showHome }));
  setScreen(screen);

  const puzzleBoardEl = screen.querySelector('[data-puzzle-board]');
  const japamBoardEl = screen.querySelector('[data-japam-board]');

  if (isBackendConfigured()) {
    const [puzzleRows, japamRows] = await Promise.all([fetchPuzzleLeaderboard(), fetchJapamLeaderboard()]);
    const activePuzzleRows = (puzzleRows || []).filter((row) =>
      (row.total_pearls ?? 0) > 0 || (row.total_gems ?? 0) > 0 || (row.total_diamonds ?? 0) > 0 || (row.puzzles_completed ?? 0) > 0
    );
    puzzleBoardEl.replaceWith(renderLeaderboardTable(
      activePuzzleRows,
      ['display_name', 'total_pearls', 'total_gems', 'total_diamonds', 'puzzles_completed'],
      ['పేరు', `${gemBadge('easy')} ముత్యాలు`, `${gemBadge('medium')} రత్నాలు`, `${gemBadge('difficult')} వజ్రాలు`, 'పూర్తయిన పజిల్స్'],
      'data-puzzle-board'
    ));
    japamBoardEl.replaceWith(renderLeaderboardTable(japamRows || [], ['display_name', 'total_count'], ['పేరు', 'మొత్తం జపసంఖ్య'], 'data-japam-board'));
  } else {
    const puzzleTotals = getLocalPuzzleTotals();
    const japamTotals = getLocalJapamTotals();
    puzzleBoardEl.outerHTML = `
      <div data-puzzle-board>
        <p>${gemBadge('easy')} ముత్యాలు: <strong>${puzzleTotals.pearls}</strong> &nbsp;·&nbsp; ${gemBadge('medium')} రత్నాలు: <strong>${puzzleTotals.gems}</strong> &nbsp;·&nbsp; ${gemBadge('difficult')} వజ్రాలు: <strong>${puzzleTotals.diamonds}</strong></p>
        <p>పూర్తయిన పజిల్స్: <strong>${puzzleTotals.puzzlesCompleted}</strong></p>
        <p class="score-note">ఇది ఈ పరికరంలో మాత్రమే భద్రపరచబడింది.</p>
      </div>`;
    japamBoardEl.outerHTML = `
      <div data-japam-board>
        <p>మొత్తం జపసంఖ్య: <strong>${japamTotals.total}</strong></p>
        <p>ఈ రోజు: <strong>${japamTotals.today}</strong></p>
        <p class="score-note">ఇది ఈ పరికరంలో మాత్రమే భద్రపరచబడింది.</p>
      </div>`;
  }
}

function renderLeaderboardTable(rows, keys, labels, dataAttr) {
  if (!rows || !rows.length) {
    return el(`<div ${dataAttr}><p class="score-note">ఇంకా స్కోర్లు లేవు.</p></div>`);
  }
  const header = labels.map((l) => `<th>${l}</th>`).join('');
  const body = rows.map((row) => `<tr>${keys.map((k) => `<td>${row[k] ?? 0}</td>`).join('')}</tr>`).join('');
  return el(`
    <div ${dataAttr}>
      <table class="score-table">
        <thead><tr>${header}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `);
}

// ---------------------------------------------------------------------

boot();
