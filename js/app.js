import {
  generateGridReliable, sampleMixedEntries, entryCountForGridSize, randomInt,
  splitAcrossDifficulties, difficultyWeightsForExperience, DIFFICULTIES, LATIN_POOL,
} from './grid.js';
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
  getLanguage, setLanguage,
} from './storage.js';
import {
  isBackendConfigured, ensurePlayer, syncPuzzleProgress, syncJapamLog,
  fetchPuzzleLeaderboard, fetchJapamLeaderboard,
} from './supabase-client.js';
import { t, getLang, setLang, LANGUAGES } from './i18n.js';

const root = document.getElementById('app');

// Likhita Japam's suggested names and the post-puzzle interlude word are
// content, not chrome, so they live per-language here rather than in
// i18n.js's STRINGS table.
function japamNames() {
  return getLang() === 'en'
    ? [{ word: 'Sri Rama', label: 'Sri Rama' }, { word: 'Govinda', label: 'Govinda' }]
    : [{ word: 'శ్రీరామ', label: 'శ్రీరామ' }, { word: 'గోవింద', label: 'గోవింద' }];
}
function interludeWord() {
  return getLang() === 'en' ? 'Sri Rama' : 'శ్రీరామ';
}

// English words are plain Latin (A-Z), so the grid's filler cells should
// draw from the same alphabet instead of Telugu's consonant+vowel-sign
// pool - grid.js defaults to the Telugu pool when this is omitted.
function fillerPool() {
  return getLang() === 'en' ? LATIN_POOL : undefined;
}

// Both languages sync to the shared family Supabase scoreboard, kept as
// separate per-language tallies (see language column on puzzle_progress/
// japam_log and the fetch calls in showScoreboard) rather than merged
// into one combined number per player.
function syncsToBackend() {
  return isBackendConfigured();
}

// What a found word of each difficulty is "worth" - shown as a small
// symbol on its hint row (GEM_ICONS) - and tallied separately on the
// scoreboard. Revealing a word via the "show answer" button still
// completes the puzzle but does not earn its gem (see markFound's
// viaHint handling below).
const GEM_ICONS = {
  easy: `<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="currentColor"/><circle cx="6" cy="6" r="1.3" fill="#fff" opacity="0.55"/></svg>`,
  medium: `<svg viewBox="0 0 16 16"><polygon points="8,1 15,8 8,15 1,8" fill="currentColor" stroke="#4e1219" stroke-width="0.6"/></svg>`,
  difficult: `<svg viewBox="0 0 16 16"><polygon points="4,3 12,3 15,7 8,15 1,7" fill="currentColor" stroke="#4e1219" stroke-width="0.6"/><path d="M4,3 L8,15 M12,3 L8,15 M1,7 L15,7" stroke="#4e1219" stroke-width="0.4" opacity="0.5" fill="none"/></svg>`,
};

function gemLabel(difficulty) {
  return { easy: t('gemEasy'), medium: t('gemMedium'), difficult: t('gemDifficult') }[difficulty] || '';
}

function gemBadge(difficulty) {
  const label = gemLabel(difficulty);
  return `<span class="gem-icon gem-${difficulty}" role="img" aria-label="${label}" title="${label}">${GEM_ICONS[difficulty] || ''}</span>`;
}

const state = {
  playerName: null,
  playerId: null,
};

// Escapes text pulled from anywhere a player (not this codebase) could
// have typed it - a display name, a custom Likhita Japam word, a
// Supabase leaderboard row - before it's ever interpolated into an HTML
// template string and handed to el()'s innerHTML. Every one of those is
// attacker-reachable: a player's display_name in particular is stored in
// the shared Supabase table and re-rendered on the Scoreboard for every
// other player who opens it, so an unescaped '<' or '"' there is a
// stored-XSS hole affecting the whole group, not just whoever typed it.
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function el(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  return tpl.content.firstElementChild;
}

function setScreen(node) {
  root.innerHTML = '';
  root.appendChild(node);
  document.documentElement.lang = getLang();
}

function topBar({ backAction } = {}) {
  const bar = el(`
    <div class="top-bar">
      <div>${backAction ? `<button type="button" class="btn btn-link" data-back>${t('back')}</button>` : ''}</div>
      <div class="player">${state.playerName ? `${escapeHtml(state.playerName)} · <button type="button" class="btn-link" data-change-name style="min-height:auto;padding:0;">${t('changeName')}</button>` : ''}</div>
    </div>
  `);
  if (backAction) bar.querySelector('[data-back]').addEventListener('click', backAction);
  const changeBtn = bar.querySelector('[data-change-name]');
  if (changeBtn) changeBtn.addEventListener('click', showNameGate);
  return bar;
}

// A small pill for switching between Telugu and English. Switching
// re-renders whichever screen is passed as `onSwitch` (always a
// re-entrant screen function, e.g. showHome) rather than trying to
// patch the current DOM in place.
function languageToggle(onSwitch) {
  const wrap = el(`
    <div class="lang-toggle" data-lang-toggle>
      ${LANGUAGES.map((lang) => `
        <button type="button" class="lang-pill${getLang() === lang ? ' active' : ''}" data-lang="${lang}">
          ${lang === 'te' ? t('languageTelugu') : t('languageEnglish')}
        </button>
      `).join('')}
    </div>
  `);
  wrap.querySelectorAll('[data-lang]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const lang = btn.getAttribute('data-lang');
      if (lang === getLang()) return;
      setLang(lang);
      setLanguage(lang);
      onSwitch();
    });
  });
  return wrap;
}

// ---------------------------------------------------------------------
// Boot + identity
// ---------------------------------------------------------------------

async function boot() {
  setLang(getLanguage());
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
  if (!state.playerId && syncsToBackend()) {
    // Boot-time resume: if the saved name now conflicts with someone else's
    // (e.g. two devices settled on the same name before this device ever
    // synced), just stay local-only for this session rather than blocking
    // the app - the player can pick a distinct name via "మార్చు"/"Change" later.
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
      <h1 class="display" style="text-align:center;">${t('introTitle')}</h1>
      <p>${t('introBody1')}</p>
      <p>${t('introBody2')}</p>
      <p>${t('introBody3')}</p>
      <p>${t('introBody4')}</p>
      <p class="intro-privacy-note">${t('introPrivacyNote')}</p>
      <p class="install-guide-link"><a href="install.html">${t('installGuideLink')}</a></p>
      <p class="intro-signature">${t('introSignature')}</p>
      <div class="btn-row" style="margin-top:24px;">
        <button type="button" class="btn btn-primary" data-intro-continue>${t('continueBtn')}</button>
      </div>
    </div>
  `);
  screen.prepend(languageToggle(() => showIntro(onContinue)));
  screen.querySelector('[data-intro-continue]').addEventListener('click', onContinue);
  setScreen(screen);
}

function showNameGate() {
  const screen = el(`
    <div class="name-gate">
      <h1 class="display">${t('appTitle')}</h1>
      <p class="tagline">${t('appTagline')}</p>
      <p>${t('nameGatePrompt')}</p>
      <input type="text" class="text-input" maxlength="40" placeholder="${t('namePlaceholder')}" data-name-input />
      <p class="field-error" data-name-error style="display:none;"></p>
      <div class="btn-row">
        <button type="button" class="btn btn-primary" data-begin>${t('beginBtn')}</button>
      </div>
    </div>
  `);
  screen.prepend(languageToggle(showNameGate));
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
    if (syncsToBackend()) {
      // Only carry over this device's own player id if the name is unchanged -
      // otherwise a brand-new name must not silently inherit someone else's id.
      const knownPlayerId = name === state.playerName ? state.playerId : null;
      const result = await ensurePlayer(name, knownPlayerId);
      if (result.status === 'taken') {
        errorEl.textContent = t('nameTakenError');
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
        <h1 class="display">${t('appTitle')}</h1>
        <p class="tagline">${t('appTagline')}</p>
      </div>
      <p class="tagline" style="text-align:center;">${t('chooseModePrompt')}</p>
      <div class="mode-choice">
        <button type="button" class="mode-btn" data-mode="nama-nidhi">
          <div class="display">${t('namaGuptaNidhiTitle')}</div>
          <div class="sub">${t('namaGuptaNidhiSub')}</div>
        </button>
        <button type="button" class="mode-btn" data-mode="likhita-japam">
          <div class="display">${t('likhitaJapamTitle')}</div>
          <div class="sub">${t('likhitaJapamSub')}</div>
        </button>
      </div>
      <div class="btn-row" style="margin-top:28px;">
        <button type="button" class="btn btn-secondary" data-scoreboard>${t('scoreboardBtn')}</button>
        <button type="button" class="btn btn-secondary" data-about>${t('aboutBtn')}</button>
      </div>
    </div>
  `);
  screen.prepend(languageToggle(showHome));
  screen.prepend(topBar());
  screen.querySelector('[data-mode="nama-nidhi"]').addEventListener('click', showNamaGuptaNidhiHub);
  screen.querySelector('[data-mode="likhita-japam"]').addEventListener('click', showJapamNamePicker);
  screen.querySelector('[data-scoreboard]').addEventListener('click', showScoreboard);
  screen.querySelector('[data-about]').addEventListener('click', () => showIntro(showHome));
  setScreen(screen);
}

// నామ గుప్త నిధి itself isn't one puzzle mode - it's an umbrella over two
// puzzles that are structurally the same (a word-search grid + hints
// panel): a general mixed-pool puzzle, and Stotra Pariksha's per-stotram
// puzzles. This hub is the shared entry point; Likhita Japam is the only
// other independent top-level mode from Home.
function showNamaGuptaNidhiHub() {
  const screen = el(`
    <div>
      <h2 style="text-align:center;">${t('namaGuptaNidhiTitle')}</h2>
      <p class="tagline" style="text-align:center;">${t('chooseSubModePrompt')}</p>
      <div class="mode-choice">
        <button type="button" class="mode-btn" data-sub-mode="general">
          <div class="display">${t('generalModeTitle')}</div>
          <div class="sub">${t('generalModeSub')}</div>
        </button>
        <button type="button" class="mode-btn" data-sub-mode="stotra-pariksha">
          <div class="display">${t('stotraParikshaTitle')}</div>
          <div class="sub">${t('stotraParikshaSub')}</div>
        </button>
      </div>
    </div>
  `);
  screen.prepend(topBar({ backAction: showHome }));
  screen.querySelector('[data-sub-mode="general"]').addEventListener('click', startNamaGuptaNidhi);
  screen.querySelector('[data-sub-mode="stotra-pariksha"]').addEventListener('click', showStotramList);
  setScreen(screen);
}

// ---------------------------------------------------------------------
// Nama Gupta Nidhi (general): straight into a puzzle, no category or
// difficulty picker. Every puzzle mixes entries from all content packs
// AND all three difficulty tiers together - the hint line is the only
// clue to what each hidden word is, and to what it's worth (ముత్యం/
// రత్నం/వజ్రం, i.e. pearl/gem/diamond).
// ---------------------------------------------------------------------

const WRONG_TRIES_FOR_NUDGE = 4;

// Degrees to rotate a "points right" arrow glyph so it points along
// (dr, dc) - purely the geometry of the drag itself, no knowledge of
// where any word actually is.
function pointerAngleDeg(dr, dc) {
  return (Math.atan2(dr, dc) * 180) / Math.PI;
}

// Smaller grids have more room per cell - scale the letter up to use it,
// instead of a flat size that leaves a small grid's big cells half-empty.
function cellFontSize(gridSize) {
  const rem = Math.min(2.3, Math.max(0.6, 9.2 / gridSize));
  return `${rem.toFixed(2)}rem`;
}

async function startNamaGuptaNidhi() {
  const lang = getLang();
  const [levels, pool] = await Promise.all([loadLevels(lang), loadEntryPool(lang)]);
  renderGame(buildSession(levels[0], pool));
}

function buildSession(level, pool) {
  const weights = difficultyWeightsForExperience(getLocalPuzzleTotals(getLang()).puzzlesCompleted);
  const { gridSize, entries } = sampleMixedEntries(pool, level, weights);
  const { grid, placements } = generateGridReliable({
    size: gridSize,
    entries,
    fillerMode: level.fillerMode,
    fillerPool: fillerPool(),
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
      <h2 style="text-align:center;">${t('namaGuptaNidhiTitle')} · ${gridSize}×${gridSize}</h2>
      <p class="tagline" style="text-align:center;">${t('puzzleInstructions')}</p>
      <div class="grid-frame">
        <div class="grid" data-grid style="grid-template-columns:repeat(${gridSize}, 1fr); --cell-font-size:${cellFontSize(gridSize)};"></div>
      </div>
      <div class="game-toolbar">
        <button type="button" class="btn btn-secondary" data-new-puzzle>${t('newPuzzleBtn')}</button>
        <button type="button" class="btn btn-secondary" data-show-answer>${t('showAnswerBtn')}</button>
      </div>
      <div class="hints-panel">
        <h3>${t('hintsTitle')}</h3>
        <div data-hints></div>
      </div>
    </div>
  `);
  screen.prepend(topBar({ backAction: showNamaGuptaNidhiHub }));

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
          <span class="hint-meaning">${p.entry.meaning} <span class="hint-count">${t('syllableCount', p.letters.length)}</span></span>
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
    const continueBtn = el(`<button type="button" class="btn btn-primary" data-level-continue>${t('continueLevelBtn')}</button>`);
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
    language: getLang(),
  };
  recordPuzzleProgressLocal(progress, getLang());
  if (state.playerId && syncsToBackend()) syncPuzzleProgress(state.playerId, progress);
}

function showLevelComplete(level) {
  const screen = el(`
    <div class="complete-screen">
      <div class="glow">🙏</div>
      <h2>${t('congratulations')}</h2>
      <p>${t('allFoundLevel')}</p>
      <div class="btn-row" style="margin-top:24px;">
        <button type="button" class="btn btn-primary" data-continue>${t('continueLevelBtn')}</button>
      </div>
    </div>
  `);
  screen.querySelector('[data-continue]').addEventListener('click', () => {
    startJapamSession({
      mode: 'interlude',
      word: interludeWord(),
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
      <h2 style="text-align:center;">${t('stotraParikshaTitle')}</h2>
      <p class="tagline" style="text-align:center;">${t('stotraParikshaSub')}</p>
      <div class="card-grid" data-stotrams style="margin-top:20px;"></div>
    </div>
  `);
  screen.prepend(topBar({ backAction: showNamaGuptaNidhiHub }));
  setScreen(screen);

  const stotrams = await loadStotrams(getLang());
  const container = screen.querySelector('[data-stotrams]');
  for (const stotram of stotrams) {
    if (stotram.status !== 'active') {
      container.appendChild(el(`
        <div class="card locked">
          <div class="card-title">${stotram.title}</div>
          <div class="card-sub">${t('soonSub')}</div>
          <span class="badge soon">${t('soonBadge')}</span>
        </div>
      `));
      continue;
    }
    const card = el(`
      <button type="button" class="card">
        <div class="card-title">${stotram.title}</div>
        <div class="card-sub">${t('stotramCardSub', stotram.entries.length)}</div>
        <span class="badge">${t('playableBadge')}</span>
      </button>
    `);
    card.addEventListener('click', () => startStotram(stotram));
    container.appendChild(card);
  }
}

function shuffleLocal(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Per-stotram, per-difficulty shuffled draw queues - same rotation idea as
// grid.js's per-difficulty queues, so rounds cycle through each tier's
// whole word list before anything repeats, instead of drawing
// independently at random each time. `weights` (see
// difficultyWeightsForExperience) skews how many of each tier a round
// asks for, same as the main pool. Each call also rolls its own grid
// size within the stotram's range, which changes which words are
// eligible - so the existing per-tier queue is first trimmed to only
// currently-eligible words before topping it back up. Keyed per language
// too (stotram.id is shared across data/stotrams.json and
// data/en/stotrams.json), so switching languages doesn't corrupt either
// queue with the other's words.
const stotramDrawQueues = new Map();

function drawStotramRound(stotram, gridSize, weights) {
  const targetCounts = splitAcrossDifficulties(entryCountForGridSize(gridSize), weights);
  const drawn = [];
  for (const difficulty of DIFFICULTIES) {
    const eligible = stotram.entries.filter((e) => e.difficulty === difficulty && graphemes(e.word).length <= gridSize);
    if (!eligible.length) continue;

    const eligibleWords = new Set(eligible.map((e) => e.word));
    const key = `${getLang()}::${stotram.id}::${difficulty}`;
    let queue = (stotramDrawQueues.get(key) || []).filter((e) => eligibleWords.has(e.word));
    const count = Math.min(targetCounts[difficulty], eligible.length);

    while (queue.length < count) {
      const queuedWords = new Set(queue.map((e) => e.word));
      const unseen = eligible.filter((e) => !queuedWords.has(e.word));
      queue = queue.concat(shuffleLocal(unseen.length ? unseen : eligible));
    }
    drawn.push(...queue.slice(0, count));
    stotramDrawQueues.set(key, queue.slice(count));
  }
  return drawn;
}

function buildStotramSession(stotram) {
  const gridSize = randomInt(stotram.gridSizeMin, stotram.gridSizeMax);
  const weights = difficultyWeightsForExperience(getLocalPuzzleTotals(getLang()).puzzlesCompleted);
  const entries = drawStotramRound(stotram, gridSize, weights);
  const { grid, placements } = generateGridReliable({ size: gridSize, entries, fillerMode: stotram.fillerMode, fillerPool: fillerPool() });
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
      <p class="tagline" style="text-align:center;">${t('stotraParikshaSub')}</p>
      <div class="grid-frame">
        <div class="grid" data-grid style="grid-template-columns:repeat(${gridSize}, 1fr); --cell-font-size:${cellFontSize(gridSize)};"></div>
      </div>
      <div class="game-toolbar">
        <button type="button" class="btn btn-secondary" data-new-puzzle>${t('newPuzzleBtn')}</button>
        <button type="button" class="btn btn-secondary" data-show-answer>${t('showAnswerBtn')}</button>
      </div>
      <div class="hints-panel">
        <h3>${t('hintsTitle')}</h3>
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
          <span class="hint-meaning">${p.entry.meaning} <span class="hint-count">${t('syllableCount', p.letters.length)}</span></span>
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
    const btn = el(`<button type="button" class="btn btn-primary" data-continue>${t('continueLevelBtn')}</button>`);
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
    language: getLang(),
  };
  recordPuzzleProgressLocal(progress, getLang());
  if (state.playerId && syncsToBackend()) syncPuzzleProgress(state.playerId, progress);
}

function showStotramComplete(stotram) {
  const screen = el(`
    <div class="complete-screen">
      <div class="glow">🙏</div>
      <h2>${t('congratulations')}</h2>
      <p>${t('stotramFoundAll', stotram.title)}</p>
      <div class="about-box">
        ${t('stotramAboutLabel', stotram.title)} ${stotram.about}
      </div>
      <div class="btn-row" style="margin-top:12px;">
        <button type="button" class="btn btn-secondary" data-again>${t('playAgainBtn')}</button>
        <button type="button" class="btn btn-primary" data-list>${t('finishBtn')}</button>
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
      <h2>${t('japamPickerTitle')}</h2>
      <div class="card-grid" data-names></div>
      <div class="custom-word-block">
        <p class="tagline" style="text-align:center;">${t('japamCustomPrompt')}</p>
        <input type="text" class="text-input" maxlength="60" placeholder="${t('japamCustomPlaceholder')}" data-custom-word />
        <div class="btn-row">
          <button type="button" class="btn btn-primary" data-custom-start>${t('beginBtn')}</button>
        </div>
      </div>
    </div>
  `);
  screen.prepend(topBar({ backAction: showHome }));
  const container = screen.querySelector('[data-names]');
  japamNames().forEach(({ word, label }, i) => {
    const card = el(`
      <button type="button" class="card" style="text-align:center;">
        <div class="card-title">${label}</div>
        ${i === 0 ? `<span class="badge">${t('suggestedBadge')}</span>` : ''}
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
    // Telugu mode transliterates a Latin-typed guess ("rama") into Telugu
    // script; English mode has nothing to transliterate to, so the typed
    // text is traced as-is.
    const word = getLang() === 'en' ? typed : (looksLikeLatin(typed) ? transliterate(typed) : typed);
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
      <div class="japam-surface-frame">
        <canvas data-canvas></canvas>
      </div>
      <h2 style="text-align:center;">${t('likhitaJapamHeading')}</h2>
      <p class="tagline" style="text-align:center;">${t('japamTraceInstructions')}</p>
      <p class="landscape-hint">${t('japamLandscapeHint')}</p>
      <div class="japam-word">${escapeHtml(session.word)}</div>
      ${session.target ? '<div class="mala" data-mala></div>' : '<p class="tagline" style="text-align:center;" data-count></p>'}
      ${isStandalone ? `<div class="btn-row"><button type="button" class="btn btn-secondary" data-exit>${t('finishBtn')}</button></div>` : ''}
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
    screen.querySelector('[data-count]').textContent = t('japamSessionCount', session.count);
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
    language: getLang(),
  };
  recordJapamLocal(entry, getLang());
  if (state.playerId && syncsToBackend()) syncJapamLog(state.playerId, entry);

  if (session.mode === 'interlude' && session.count >= session.target) {
    showJapamCompletion(session);
  } else {
    renderJapamTrace(session);
  }
}

function showJapamSessionSummary(session) {
  const screen = el(`
    <div class="completion-beat">
      <h2>${t('japamThisSession')}</h2>
      <p style="font-size:1.6rem;">${t('japamTimes', session.count)}</p>
      <div class="btn-row" style="margin-top:20px;">
        <button type="button" class="btn btn-primary" data-home>${t('goHomeBtn')}</button>
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
      <p>${t('japamComplete')}</p>
      <div class="btn-row" style="margin-top:20px;">
        <button type="button" class="btn btn-primary" data-continue>${t('continueLevelBtn')}</button>
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
      <h2 style="text-align:center;">${t('scoreboardTitle')}</h2>
      <p class="tagline" style="text-align:center;">${t('scoreboardTagline')}</p>
      <div class="score-section">
        <h3>${t('puzzleBoardTitle')}</h3>
        <p class="gem-legend">${t('gemLegend', gemBadge('easy'), gemBadge('medium'), gemBadge('difficult'))}</p>
        <div data-puzzle-board>${t('loading')}</div>
      </div>
      <div class="score-section">
        <h3>${t('japamBoardTitle')}</h3>
        <div data-japam-board>${t('loading')}</div>
      </div>
    </div>
  `);
  screen.prepend(topBar({ backAction: showHome }));
  setScreen(screen);

  const puzzleBoardEl = screen.querySelector('[data-puzzle-board]');
  const japamBoardEl = screen.querySelector('[data-japam-board]');

  if (syncsToBackend()) {
    const [puzzleRows, japamRows] = await Promise.all([fetchPuzzleLeaderboard(getLang()), fetchJapamLeaderboard(getLang())]);
    const activePuzzleRows = (puzzleRows || []).filter((row) =>
      (row.total_pearls ?? 0) > 0 || (row.total_gems ?? 0) > 0 || (row.total_diamonds ?? 0) > 0 || (row.puzzles_completed ?? 0) > 0
    );
    puzzleBoardEl.replaceWith(renderLeaderboardTable(
      activePuzzleRows,
      ['display_name', 'total_pearls', 'total_gems', 'total_diamonds', 'puzzles_completed'],
      [t('colName'), `${gemBadge('easy')} ${t('colPearls')}`, `${gemBadge('medium')} ${t('colGems')}`, `${gemBadge('difficult')} ${t('colDiamonds')}`, t('colPuzzlesCompleted')],
      'data-puzzle-board'
    ));
    japamBoardEl.replaceWith(renderLeaderboardTable(japamRows || [], ['display_name', 'total_count'], [t('colName'), t('colTotalJapamCount')], 'data-japam-board'));
  } else {
    const puzzleTotals = getLocalPuzzleTotals(getLang());
    const japamTotals = getLocalJapamTotals(getLang());
    puzzleBoardEl.outerHTML = `
      <div data-puzzle-board>
        <p>${gemBadge('easy')} ${t('colPearls')}: <strong>${puzzleTotals.pearls}</strong> &nbsp;·&nbsp; ${gemBadge('medium')} ${t('colGems')}: <strong>${puzzleTotals.gems}</strong> &nbsp;·&nbsp; ${gemBadge('difficult')} ${t('colDiamonds')}: <strong>${puzzleTotals.diamonds}</strong></p>
        <p>${t('localPuzzlesCompleted', puzzleTotals.puzzlesCompleted)}</p>
        <p class="score-note">${t('localOnlyNote')}</p>
      </div>`;
    japamBoardEl.outerHTML = `
      <div data-japam-board>
        <p>${t('localTotalJapam', japamTotals.total)}</p>
        <p>${t('localTodayJapam', japamTotals.today)}</p>
        <p class="score-note">${t('localOnlyNote')}</p>
      </div>`;
  }
}

function renderLeaderboardTable(rows, keys, labels, dataAttr) {
  if (!rows || !rows.length) {
    return el(`<div ${dataAttr}><p class="score-note">${t('noScoresYet')}</p></div>`);
  }
  const header = labels.map((l) => `<th>${l}</th>`).join('');
  // Rows come straight from the shared Supabase leaderboard views - any
  // player's own chosen display_name ends up here, so it must be escaped
  // like any other untrusted input before going into innerHTML (see
  // escapeHtml's comment above).
  const body = rows.map((row) => `<tr>${keys.map((k) => `<td>${escapeHtml(row[k] ?? 0)}</td>`).join('')}</tr>`).join('');
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
