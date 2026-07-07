import { generateGrid, sampleEntries } from './grid.js';
import { attachTracer, pathToStrings } from './trace.js';
import { buildDotTrace, attachDotTracer } from './handwriting.js';
import { loadEntryPool, loadLevels } from './data.js';
import {
  getPlayerName, setPlayerName, getPlayerId, setPlayerId,
  recordPuzzleProgressLocal, recordJapamLocal,
  getLocalPuzzleTotals, getLocalJapamTotals,
} from './storage.js';
import {
  isBackendConfigured, ensurePlayer, syncPuzzleProgress, syncJapamLog,
  fetchPuzzleLeaderboard, fetchJapamLeaderboard,
} from './supabase-client.js';

const root = document.getElementById('app');
const canSpeak = 'speechSynthesis' in window;

const JAPAM_NAMES = [
  { word: 'శ్రీరామ', label: 'శ్రీరామ' },
  { word: 'ఓం నమః శివాయ', label: 'ఓం నమః శివాయ' },
  { word: 'గోవింద', label: 'గోవింద' },
];
const INTERLUDE_WORD = 'శ్రీరామ';

const state = {
  playerName: null,
  playerId: null,
};

function speak(text) {
  if (!canSpeak) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'te-IN';
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

function speakButton(text) {
  if (!canSpeak) return '';
  return `<button type="button" class="speak-btn" data-speak="${escapeAttr(text)}" aria-label="వినండి">🔊</button>`;
}

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
  root.querySelectorAll('[data-speak]').forEach((b) => {
    b.addEventListener('click', () => speak(b.dataset.speak));
  });
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
  state.playerName = getPlayerName();
  state.playerId = getPlayerId();
  if (!state.playerName) {
    showNameGate();
    return;
  }
  if (!state.playerId && isBackendConfigured()) {
    state.playerId = await ensurePlayer(state.playerName);
    if (state.playerId) setPlayerId(state.playerId);
  }
  showHome();
}

function showNameGate() {
  const screen = el(`
    <div class="name-gate">
      <h1 class="display">నామ నిధి</h1>
      <p class="tagline">నామాల్లో దాగిన రత్నాలు</p>
      <p>ఆడటానికి మీ పేరు లేదా ముద్దుపేరు రాయండి</p>
      <input type="text" maxlength="40" placeholder="మీ పేరు" data-name-input />
      <div class="btn-row">
        <button type="button" class="btn btn-primary" data-begin>ప్రారంభించండి</button>
      </div>
    </div>
  `);
  const input = screen.querySelector('[data-name-input]');
  if (state.playerName) input.value = state.playerName;
  const submit = async () => {
    const name = input.value.trim();
    if (!name) { input.focus(); return; }
    setPlayerName(name);
    state.playerName = name;
    state.playerId = null;
    if (isBackendConfigured()) {
      state.playerId = await ensurePlayer(name);
      if (state.playerId) setPlayerId(state.playerId);
    }
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
        <h1 class="display">నామ నిధి</h1>
        <p class="tagline">నామాల్లో దాగిన రత్నాలు</p>
      </div>
      <div class="mode-choice">
        <button type="button" class="mode-btn" data-mode="nama-nidhi">
          <div class="display">నామ నిధి</div>
          <div class="sub">నామాలు దాగిన పజిల్ ఆడండి</div>
        </button>
        <button type="button" class="mode-btn" data-mode="likhita-japam">
          <div class="display">లిఖిత జపం</div>
          <div class="sub">నామాన్ని ప్రశాంతంగా రాయండి</div>
        </button>
      </div>
      <div class="btn-row" style="margin-top:28px;">
        <button type="button" class="btn btn-secondary" data-scoreboard>స్కోరు బోర్డు</button>
      </div>
    </div>
  `);
  screen.prepend(topBar());
  screen.querySelector('[data-mode="nama-nidhi"]').addEventListener('click', showLevelSelect);
  screen.querySelector('[data-mode="likhita-japam"]').addEventListener('click', showJapamNamePicker);
  screen.querySelector('[data-scoreboard]').addEventListener('click', showScoreboard);
  setScreen(screen);
}

// ---------------------------------------------------------------------
// Nama Nidhi: level -> game
// Every puzzle mixes entries from all content packs (deity names,
// devotees, kshetrams, sacred items) - no category picker. The hint
// line is the only clue to what each hidden word is.
// ---------------------------------------------------------------------

async function showLevelSelect() {
  const screen = el(`
    <div>
      <h2 style="text-align:center;">నామ నిధి</h2>
      <p class="tagline" style="text-align:center;">స్థాయిని ఎంచుకోండి</p>
      <div class="card-grid" data-levels></div>
    </div>
  `);
  screen.prepend(topBar({ backAction: showHome }));
  setScreen(screen);

  const [levels] = await Promise.all([loadLevels(), loadEntryPool()]);
  const container = screen.querySelector('[data-levels]');
  for (const level of levels) {
    const card = el(`
      <button type="button" class="card">
        <div class="card-title">స్థాయి ${level.levelNumber}</div>
        <div class="card-sub">${level.entryCount} నామాలు · ${level.gridSize}×${level.gridSize} గ్రిడ్</div>
        ${level.breather ? '<span class="badge">సులభ విరామం</span>' : ''}
      </button>
    `);
    card.addEventListener('click', () => startLevel(level));
    container.appendChild(card);
  }
}

// ---------------------------------------------------------------------
// Game screen
// ---------------------------------------------------------------------

const WRONG_TRIES_FOR_NUDGE = 4;

async function startLevel(level) {
  const pool = await loadEntryPool();
  renderGame(buildSession(level, pool));
}

function buildSession(level, pool) {
  const entries = sampleEntries(pool, level.gridSize, level.entryCount);
  const { grid, placements } = generateGrid({
    size: level.gridSize,
    entries,
    fillerMode: level.fillerMode,
  });
  return {
    level,
    pool,
    grid,
    placements: placements.map((p) => ({ ...p, found: false })),
    wrongAttempts: 0,
  };
}

function renderGame(session) {
  const { level } = session;
  const screen = el(`
    <div>
      <h2 style="text-align:center;">స్థాయి ${level.levelNumber}</h2>
      <div class="grid-frame">
        <div class="grid" data-grid style="grid-template-columns:repeat(${level.gridSize}, 1fr);"></div>
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
  screen.prepend(topBar({ backAction: showLevelSelect }));

  const gridEl = screen.querySelector('[data-grid]');
  const hintsEl = screen.querySelector('[data-hints]');
  const toolbarEl = screen.querySelector('.game-toolbar');
  const cellEls = [];

  for (let r = 0; r < level.gridSize; r++) {
    const row = [];
    for (let c = 0; c < level.gridSize; c++) {
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
          <span class="hint-meaning">${p.entry.meaning}</span>
          ${p.found && canSpeak ? speakButton(p.entry.word) : ''}
        </div>
      `);
      hintsEl.appendChild(item);
    }
    hintsEl.querySelectorAll('[data-speak]').forEach((b) => {
      b.addEventListener('click', () => speak(b.dataset.speak));
    });
  }
  renderHints();

  let lastSelected = [];
  function highlightSelection(path) {
    lastSelected.forEach(({ r, c }) => cellEls[r][c].classList.remove('selected'));
    path.forEach(({ r, c }) => cellEls[r][c].classList.add('selected'));
    lastSelected = path;
  }

  function markFound(placement) {
    placement.found = true;
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
    onDragStart: highlightSelection,
    onDragUpdate: highlightSelection,
    onDragEnd: (path) => {
      highlightSelection([]);
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
    if (target) markFound(target);
  });

  setScreen(screen);
}

function recordLevelProgress(session) {
  const { level } = session;
  const progress = {
    category: 'mixed',
    sub_category: null,
    level: level.levelNumber,
    entries_found: session.placements.length,
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
      onExit: showLevelSelect,
    });
  });
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
      <div class="japam-word">${session.word} ${canSpeak ? speakButton(session.word) : ''}</div>
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
  const { dots, width, height } = await buildDotTrace(session.word);
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const filled = new Set();

  function draw() {
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(240, 210, 139, 0.35)';
    ctx.lineWidth = 1;
    const ruleGap = height / 4;
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(0, ruleGap * i);
      ctx.lineTo(width, ruleGap * i);
      ctx.stroke();
    }
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
      <p>నామజపం పూర్తయింది.</p>
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
      <h2 style="text-align:center;">మన కుటుంబం నామ సంఖ్య</h2>
      <div class="score-section">
        <h3>నామ నిధి స్కోరు బోర్డు</h3>
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
    puzzleBoardEl.replaceWith(renderLeaderboardTable(puzzleRows, ['display_name', 'total_entries_found', 'levels_completed'], ['పేరు', 'దొరికిన నామాలు', 'పూర్తయిన స్థాయిలు'], 'data-puzzle-board'));
    japamBoardEl.replaceWith(renderLeaderboardTable(japamRows, ['display_name', 'total_count'], ['పేరు', 'మొత్తం జపసంఖ్య'], 'data-japam-board'));
  } else {
    const puzzleTotals = getLocalPuzzleTotals();
    const japamTotals = getLocalJapamTotals();
    puzzleBoardEl.outerHTML = `
      <div data-puzzle-board>
        <p>మీరు ఇప్పటివరకు కనుగొన్న నామాలు: <strong>${puzzleTotals.entriesFound}</strong></p>
        <p>పూర్తయిన స్థాయిలు: <strong>${puzzleTotals.levelsCompleted}</strong></p>
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
