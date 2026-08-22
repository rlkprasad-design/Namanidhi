import {
  generateGridReliable, sampleMixedEntries, entryCountForGridSize, randomInt,
  splitAcrossDifficulties, difficultyWeightsForExperience, gridSizeCapForExperience, DIFFICULTIES, LATIN_POOL, KANNADA_POOL,
  exportDrawQueues, importDrawQueues, isPoolExhausted, MAX_WORD_EXPOSURES, buildTodaysPuzzle,
} from './grid.js';
import { graphemes } from './segmenter.js';
import { attachTracer, pathToStrings } from './trace.js';
import { buildDotTrace, attachDotTracer, isJoinedLang, hitRadiusFor } from './handwriting.js';
import { looksLikeLatin, transliterate } from './transliterate.js';
import { loadEntryPool, loadLevels, loadStotrams, loadSaiSatcharitra } from './data.js';
import {
  getPlayerName, setPlayerName, getPlayerId, setPlayerId,
  recordPuzzleProgressLocal, recordJapamLocal,
  getLocalPuzzleTotals, getLocalJapamTotals, daysElapsedInclusive,
  hasSeenIntro, markIntroSeen,
  getLanguage, setLanguage,
  getPersistedDrawQueues, setPersistedDrawQueues,
  getPersistedStotramDrawQueues, setPersistedStotramDrawQueues,
  getWordExposureCounts, recordWordExposures,
  migrateLegacyDataOnce,
  getGeneralDifficultyFilter, setGeneralDifficultyFilter,
  getTodaysPuzzleCompletion, setTodaysPuzzleCompletion,
} from './storage.js';
import {
  isBackendConfigured, ensurePlayer, syncPuzzleProgress, syncJapamLog,
  fetchPuzzleLeaderboard, fetchJapamLeaderboard, flagEntry, fetchFlaggedEntries, dismissFlaggedEntry,
  fetchPlayerCount, fetchJapamNetworkTotal,
} from './supabase-client.js';
import { t, getLang, setLang, LANGUAGES, DEFAULT_LANGUAGE } from './i18n.js';
import { saveRecording, getRecording, deleteRecording } from './recordings.js';

const root = document.getElementById('app');

// Likhita Japam's suggested names and the post-puzzle interlude word are
// content, not chrome, so they live per-language here rather than in
// i18n.js's STRINGS table. Keyed by language rather than an en/else
// ternary so adding a language is a new map entry, not a new branch.
const JAPAM_NAMES_BY_LANG = {
  te: [{ word: 'శ్రీ రామ', label: 'శ్రీ రామ' }, { word: 'సాయిరాం', label: 'సాయిరాం' }],
  en: [{ word: 'Shriram', label: 'Shriram' }, { word: 'Sairam', label: 'Sairam' }],
  kn: [{ word: 'ಶ್ರೀರಾಮ್', label: 'ಶ್ರೀರಾಮ್' }, { word: 'ಸಾಯಿರಾಮ್', label: 'ಸಾಯಿರಾಮ್' }],
};
function japamNames() {
  return JAPAM_NAMES_BY_LANG[getLang()] || JAPAM_NAMES_BY_LANG[DEFAULT_LANGUAGE];
}

const INTERLUDE_WORD_BY_LANG = { te: 'శ్రీరామ', en: 'Sri Rama', kn: 'ಶ್ರೀರಾಮ' };
function interludeWord() {
  return INTERLUDE_WORD_BY_LANG[getLang()] || INTERLUDE_WORD_BY_LANG[DEFAULT_LANGUAGE];
}

// Telugu and Kannada both fill empty grid cells from a consonant+vowel-sign
// pool (grid.js's BASE_POOL/KANNADA_POOL - real-looking syllables rather
// than random codepoints); English draws from plain Latin A-Z instead.
// grid.js defaults to the Telugu pool when this returns undefined.
const FILLER_POOL_BY_LANG = { en: LATIN_POOL, kn: KANNADA_POOL };
function fillerPool() {
  return FILLER_POOL_BY_LANG[getLang()];
}

// The app's live URL - shared alongside shareMessage from every screen's
// share link (see setScreen). GitHub Pages serves this repo from here;
// update if the project ever moves.
const APP_URL = 'https://rlkprasad-design.github.io/Namanidhi/';

function shareHref() {
  return `https://wa.me/?text=${encodeURIComponent(`${t('shareMessage')} ${APP_URL}`)}`;
}

// Prefers the native share sheet (lets a player pick WhatsApp, SMS, email,
// anything installed) when available; the link itself already points at
// a WhatsApp Web fallback for browsers without navigator.share (typically
// desktop), so the href alone still works if this handler never runs.
function shareApp(e) {
  if (!navigator.share) return;
  e.preventDefault();
  navigator.share({ title: t('appTitle'), text: t('shareMessage'), url: APP_URL }).catch(() => {});
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

// A little celebratory pop of the earned gem, rising and fading away from
// the middle of the word just found - only for a genuinely self-found
// word (see markFound's earnedGem), never for a "Show answer" reveal,
// so the animation always means the same thing: a gem was actually
// earned. Removes itself once its CSS animation finishes.
//
// Appended to the grid itself (not the found cell) and positioned with
// the anchor cell's own offset - a .cell has overflow:hidden (so a long
// grapheme can't spill into its neighbors), which would otherwise clip
// this animation to invisibility the moment it started rising past the
// cell's edge.
function popGemFeedback(gridEl, cellEls, cells, difficulty) {
  const [mr, mc] = cells[Math.floor(cells.length / 2)];
  const anchor = cellEls[mr]?.[mc];
  if (!anchor) return;
  const pop = document.createElement('div');
  pop.className = `gem-pop gem-pop-${difficulty}`;
  pop.innerHTML = GEM_ICONS[difficulty] || '';
  pop.style.left = `${anchor.offsetLeft + anchor.offsetWidth / 2}px`;
  pop.style.top = `${anchor.offsetTop + anchor.offsetHeight / 2}px`;
  gridEl.appendChild(pop);
  pop.addEventListener('animationend', () => pop.remove());
}

// One-tap "this word/meaning looks off" report from a hint row - see
// wireFlagButtons. Only shown when there's a backend to actually record
// it in (see syncsToBackend's callers below); flagging into nothing would
// just be a dead button.
const FLAG_ICON = `<svg viewBox="0 0 16 16"><path d="M3 1v14M3 1h9l-2 3 2 3H3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>`;

function flagButtonHtml(idx) {
  if (!syncsToBackend()) return '';
  return `<button type="button" class="flag-btn" data-flag="${idx}" title="${t('flagBtnTitle')}" aria-label="${t('flagBtnTitle')}">${FLAG_ICON}</button>`;
}

// Wires up every flag button just rendered inside `hintsEl` - called
// after each renderHints() (which rebuilds the hints panel from scratch,
// so listeners need reattaching every time, not just once). `placements`
// matches session.placements (index-aligned with the data-flag index in
// the markup); `sourceMode` is 'general' for the Puranas pool or a
// stotram's id, so a curator reviewing flags later knows where each one
// came from.
function wireFlagButtons(hintsEl, placements, sourceMode) {
  if (!syncsToBackend()) return;
  hintsEl.querySelectorAll('[data-flag]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (btn.disabled) return;
      btn.disabled = true;
      const p = placements[Number(btn.dataset.flag)];
      const { ok } = await flagEntry({
        word: p.letters.join(''),
        meaning: p.entry.meaning,
        language: getLang(),
        difficulty: p.entry.difficulty,
        source_mode: sourceMode,
        flagged_by: state.playerName,
      });
      if (ok) {
        btn.classList.add('flagged');
        btn.title = t('flaggedConfirm');
      } else {
        btn.disabled = false; // let them retry
      }
    });
  });
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

// Every screen gets a small feedback-email reminder footer (except the
// Intro/"About this app" screen, which already spells this out in full as
// part of introPrivacyNote - repeating it there would be redundant) and a
// share link, unconditionally on every screen including Intro/About.
function setScreen(node, { footer = true } = {}) {
  root.innerHTML = '';
  root.appendChild(node);
  // Without this, a screen change keeps whatever scroll position the
  // previous screen was left at (e.g. scrolled down to a focused input,
  // or a long puzzle's hint list) - on a short landscape viewport that
  // was enough to push the new screen's own content, canvas included,
  // partly or fully above the visible area with no visual cue that
  // there was anything to scroll back up for.
  window.scrollTo(0, 0);
  if (footer) {
    root.appendChild(el(`<p class="global-feedback-note">${t('feedbackNote')}</p>`));
  }
  const shareRow = el(`<p class="global-share-row"><a href="${shareHref()}" target="_blank" rel="noopener" data-share>${t('shareBtnLabel')}</a></p>`);
  shareRow.querySelector('[data-share]').addEventListener('click', shareApp);
  root.appendChild(shareRow);
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

// language code -> the i18n key naming that language, so the toggle scales
// to any number of languages instead of a te/en either-or.
const LANGUAGE_LABEL_KEYS = { te: 'languageTelugu', en: 'languageEnglish', kn: 'languageKannada' };

// A small pill row for switching between languages. Switching re-renders
// whichever screen is passed as `onSwitch` (always a re-entrant screen
// function, e.g. showHome) rather than trying to patch the current DOM
// in place.
function languageToggle(onSwitch) {
  const wrap = el(`
    <div class="lang-toggle" data-lang-toggle>
      ${LANGUAGES.map((lang) => `
        <button type="button" class="lang-pill${getLang() === lang ? ' active' : ''}" data-lang="${lang}">
          ${t(LANGUAGE_LABEL_KEYS[lang])}
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

// A shared Today's Puzzle link (e.g. from a WhatsApp status) needs to drop
// straight into the puzzle - the whole point of the "play first, name only
// if sharing" design (see showTodaysPuzzle et al.) is that someone who
// taps a status update shouldn't hit the intro screen and name gate before
// they even see what they were shown. Checked before any of that normal
// boot sequence runs; everyone else's boot flow is completely unaffected.
// `lang` (set by the share link itself, see shareTodaysPuzzleResult) picks
// which language's puzzle to show without touching this device's own
// stored language preference - setLang() alone is session-only.
function todaysPuzzleDeepLinkParams() {
  const params = new URLSearchParams(location.search);
  if (params.get('today') !== '1') return null;
  const lang = params.get('lang');
  return { lang: LANGUAGES.includes(lang) ? lang : null };
}

async function boot() {
  const deepLink = todaysPuzzleDeepLinkParams();
  if (deepLink) {
    setLang(deepLink.lang || getLanguage());
    migrateLegacyDataOnce();
    state.playerName = getPlayerName();
    state.playerId = getPlayerId();
    showTodaysPuzzle();
    return;
  }
  setLang(getLanguage());
  migrateLegacyDataOnce();
  if (!hasSeenIntro()) {
    showIntro(() => { markIntroSeen(); continueBoot(); });
    return;
  }
  continueBoot();
}

// Loads the currently-active player's own draw queues into the shared
// in-memory Maps - called whenever state.playerName is established or
// changes (here, and in showNameGate's finish()), never once at boot,
// since a shared device switching names mid-session needs each switch to
// swap in that player's own queues, not just the very first one.
function loadDrawQueuesForCurrentPlayer() {
  importDrawQueues(getPersistedDrawQueues(state.playerName));
  for (const [key, entries] of Object.entries(getPersistedStotramDrawQueues(state.playerName))) {
    stotramDrawQueues.set(key, entries);
  }
}

async function continueBoot() {
  state.playerName = getPlayerName();
  state.playerId = getPlayerId();
  if (!state.playerName) {
    showNameGate();
    return;
  }
  loadDrawQueuesForCurrentPlayer();
  if (!state.playerId && syncsToBackend()) {
    // Boot-time resume: pick up (or create) this device's saved name's
    // player id if it isn't already known locally.
    const result = await ensurePlayer(state.playerName);
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
      <p class="intro-content-credits">${t('introContentCredits')}</p>
      <p class="install-guide-link"><a href="install.html">${t('installGuideLink')}</a></p>
      <p class="intro-signature">${t('introSignature')}</p>
      <div class="btn-row" style="margin-top:24px;">
        <button type="button" class="btn btn-primary" data-intro-continue>${t('continueBtn')}</button>
      </div>
    </div>
  `);
  screen.prepend(languageToggle(() => showIntro(onContinue)));
  screen.querySelector('[data-intro-continue]').addEventListener('click', onContinue);
  setScreen(screen, { footer: false });
}

function showNameGate() {
  const screen = el(`
    <div class="name-gate">
      <h1 class="display">${t('appTitle')}</h1>
      <p class="tagline">${t('appTagline')}</p>
      <p>${t('nameGatePrompt')}</p>
      <input type="text" class="text-input" maxlength="40" placeholder="${t('namePlaceholder')}" data-name-input />
      <div class="btn-row" data-begin-row>
        <button type="button" class="btn btn-primary" data-begin>${t('beginBtn')}</button>
      </div>
      <div class="resume-notice" data-resume-notice style="display:none;"></div>
    </div>
  `);
  screen.prepend(languageToggle(showNameGate));
  const input = screen.querySelector('[data-name-input]');
  const beginBtn = screen.querySelector('[data-begin]');
  const beginRow = screen.querySelector('[data-begin-row]');
  const noticeEl = screen.querySelector('[data-resume-notice]');
  if (state.playerName) input.value = state.playerName;

  const finish = (name, playerId) => {
    setPlayerName(name);
    state.playerName = name;
    state.playerId = playerId;
    setPlayerId(playerId);
    loadDrawQueuesForCurrentPlayer();
    showHome();
  };

  // Picking up a name that already has history is fine if it's genuinely
  // the same person returning (the common case on a shared family device),
  // but it's also the one moment a real collision between two different
  // people would be silent otherwise - since ensurePlayer no longer blocks
  // it (see its comment), this pauses to make it visible instead, only
  // when the name actually changed (not on a no-op re-submit of the name
  // already active on this device).
  const showResumeNotice = (name, playerId) => {
    beginRow.style.display = 'none';
    noticeEl.style.display = 'block';
    noticeEl.innerHTML = `
      <p class="resume-notice-text">${t('resumeNoticeText', escapeHtml(name))}</p>
      <div class="btn-row">
        <button type="button" class="btn btn-primary" data-resume-confirm>${t('resumeConfirmBtn')}</button>
        <button type="button" class="btn btn-secondary" data-resume-cancel>${t('resumeCancelBtn')}</button>
      </div>
    `;
    noticeEl.querySelector('[data-resume-confirm]').addEventListener('click', () => finish(name, playerId));
    noticeEl.querySelector('[data-resume-cancel]').addEventListener('click', () => {
      noticeEl.style.display = 'none';
      noticeEl.innerHTML = '';
      beginRow.style.display = 'flex';
      beginBtn.disabled = false;
      input.value = '';
      input.focus();
    });
  };

  const submit = async () => {
    const name = input.value.trim();
    if (!name) { input.focus(); return; }
    beginBtn.disabled = true;
    let playerId = null;
    if (syncsToBackend()) {
      const result = await ensurePlayer(name);
      if (result.status === 'ok' && result.resumed && name !== state.playerName) {
        showResumeNotice(name, result.id);
        return;
      }
      playerId = result.id;
    }
    beginBtn.disabled = false;
    finish(name, playerId);
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
      ${syncsToBackend() ? `
      <div class="stats-strip" data-stats hidden>
        <div class="stat-cell" data-stat-members hidden>
          <div class="stat-number" data-stat-members-number></div>
          <div class="stat-label">${t('homeStatMembersLabel')}</div>
        </div>
        <div class="stat-cell" data-stat-japam hidden>
          <div class="stat-number" data-stat-japam-number></div>
          <div class="stat-label">${t('homeStatJapamLabel')}</div>
        </div>
        <p class="stats-note">${t('homeStatsAllLanguagesNote')}</p>
      </div>` : ''}
      <button type="button" class="mode-btn new" data-mode="todays-puzzle" style="margin-bottom:20px;">
        <span class="new-tag">${t('newBadge')}</span>
        <div class="display">${t('todaysPuzzleTitle')}</div>
        <div class="sub">${t('todaysPuzzleSub')}</div>
      </button>
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
  screen.querySelector('[data-mode="todays-puzzle"]').addEventListener('click', showTodaysPuzzle);
  screen.querySelector('[data-scoreboard]').addEventListener('click', showScoreboard);
  screen.querySelector('[data-about]').addEventListener('click', () => showIntro(showHome));
  setScreen(screen);

  // Fetched after Home is already on screen, same as the Japam picker's
  // network total - these two headline numbers are a nice-to-have, not
  // worth delaying the front page (or its own network hiccup) over.
  if (syncsToBackend()) {
    const statsEl = screen.querySelector('[data-stats]');
    Promise.all([fetchPlayerCount(), fetchJapamNetworkTotal()]).then(([memberCount, japamTotal]) => {
      if (!statsEl.isConnected) return;
      let shown = false;
      if (memberCount != null) {
        screen.querySelector('[data-stat-members-number]').textContent = memberCount;
        screen.querySelector('[data-stat-members]').hidden = false;
        shown = true;
      }
      if (japamTotal != null) {
        screen.querySelector('[data-stat-japam-number]').textContent = japamTotal;
        screen.querySelector('[data-stat-japam]').hidden = false;
        shown = true;
      }
      statsEl.hidden = !shown;
    });
  }
}

// నామ గుప్త నిధి itself isn't one puzzle mode - it's an umbrella over two
// puzzles that are structurally the same (a word-search grid + hints
// panel): a general mixed-pool puzzle, and Stotra Pariksha's per-stotram
// puzzles. This hub is the shared entry point; Likhita Japam is the only
// other independent top-level mode from Home.
function showNamaGuptaNidhiHub() {
  const selectedTiers = getGeneralDifficultyFilter(state.playerName);
  const screen = el(`
    <div>
      <h2 style="text-align:center;">${t('namaGuptaNidhiTitle')}</h2>
      <p class="tagline" style="text-align:center;">${t('chooseSubModePrompt')}</p>
      <div class="mode-choice">
        <div class="mode-btn" role="button" tabindex="0" data-sub-mode="general">
          <div class="display">${t('generalModeTitle')}</div>
          <div class="sub">${t('generalModeSub')}</div>
          <div class="difficulty-filter" data-difficulty-filter>
            <span class="difficulty-filter-label">${t('generalDifficultyLabel')}</span>
            <label><input type="checkbox" value="easy" ${selectedTiers.includes('easy') ? 'checked' : ''} /> ${t('gemEasy')}</label>
            <label><input type="checkbox" value="medium" ${selectedTiers.includes('medium') ? 'checked' : ''} /> ${t('gemMedium')}</label>
            <label><input type="checkbox" value="difficult" ${selectedTiers.includes('difficult') ? 'checked' : ''} /> ${t('gemDifficult')}</label>
          </div>
        </div>
        <button type="button" class="mode-btn" data-sub-mode="stotra-pariksha">
          <div class="display">${t('stotraParikshaTitle')}</div>
          <div class="sub">${t('stotraParikshaSub')}</div>
        </button>
        <button type="button" class="mode-btn" data-sub-mode="sai-satcharitra">
          <div class="display">${t('saiSatcharitraTitle')}</div>
          <div class="sub">${t('saiSatcharitraSub')}</div>
        </button>
      </div>
    </div>
  `);
  screen.prepend(topBar({ backAction: showHome }));

  const generalCard = screen.querySelector('[data-sub-mode="general"]');
  const startGeneral = () => startNamaGuptaNidhi();
  generalCard.addEventListener('click', startGeneral);
  generalCard.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startGeneral(); }
  });

  // The filter row sits inside the (non-<button>, role="button") general
  // card so it's reachable without a second tap, same reasoning as the
  // Japam picker's nested record buttons (see wireRecordButton) - clicks/
  // keystrokes on it must not also bubble up and start a puzzle.
  const filterRow = generalCard.querySelector('[data-difficulty-filter]');
  filterRow.addEventListener('click', (e) => e.stopPropagation());
  filterRow.addEventListener('keydown', (e) => e.stopPropagation());
  const filterCheckboxes = [...filterRow.querySelectorAll('input[type="checkbox"]')];
  filterCheckboxes.forEach((cb) => {
    cb.addEventListener('change', () => {
      const selected = filterCheckboxes.filter((c) => c.checked).map((c) => c.value);
      if (selected.length === 0) { cb.checked = true; return; } // at least one tier must stay selected
      setGeneralDifficultyFilter(selected, state.playerName);
    });
  });

  screen.querySelector('[data-sub-mode="stotra-pariksha"]').addEventListener('click', showStotramList);
  screen.querySelector('[data-sub-mode="sai-satcharitra"]').addEventListener('click', startSaiSatcharitra);
  setScreen(screen);
}

// ---------------------------------------------------------------------
// Nama Gupta Nidhi (general): straight into a puzzle, no category picker.
// Every puzzle mixes entries from all content packs together, and - by
// default - all three difficulty tiers too; the hint line is the only
// clue to what each hidden word is, and to what it's worth (ముత్యం/
// రత్నం/వజ్రం, i.e. pearl/gem/diamond). A player can narrow that mix to
// specific tiers via the checkboxes on this mode's card (see
// showNamaGuptaNidhiHub/maskDifficultyWeights) - deliberately only here,
// not in Stotra Pariksha or Sai Satcharitra, which stay mixed as before.
// ---------------------------------------------------------------------

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

function generalScopeKey() {
  return `${getLang()}::general`;
}

// "Today's Puzzle" - a small, fixed puzzle (see grid.js's buildTodaysPuzzle)
// meant to be shared: the same words and grid layout for every player of a
// given language on a given calendar day, so a WhatsApp-status result
// ("I found 5/6 today, beat that") and a shared link both point at the
// exact same thing the sender saw. Reachable two ways: the Home screen
// card (showHome, below) for normal players already past the name gate,
// and a `?today=1[&lang=xx]` URL param checked at boot() that skips the
// intro/name-gate entirely - state.playerName can be null here in a way
// it never is anywhere else in the app, so every function below has to
// tolerate that; only the optional "save to scoreboard" step in
// showTodaysPuzzleResult actually needs a name.
const GEM_EMOJI = { easy: '⚪', medium: '🔷', difficult: '💎' };

function getTodaysDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatElapsed(ms) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

async function showTodaysPuzzle() {
  const lang = getLang();
  // Today's Puzzle is meant to be the one shared daily challenge, not
  // something replayable for a better score - reopening it the same day
  // shows the result already earned instead of handing out a second,
  // fresh attempt.
  const completion = getTodaysPuzzleCompletion(lang, state.playerName);
  if (completion && completion.dateStr === getTodaysDateStr()) {
    showTodaysPuzzleReplay(completion);
    return;
  }
  const pool = await loadEntryPool(lang);
  const session = buildTodaysPuzzle(pool, { lang, dateStr: getTodaysDateStr(), fillerPool: fillerPool() });
  renderTodaysPuzzleGame(session);
}

// Deliberately its own renderer rather than reusing renderGame - the
// completion path is different enough (no draw-queue/exposure bookkeeping,
// a result+share screen instead of an auto-recorded "level complete", a
// possibly-guest player) that sharing renderGame's would mean threading a
// pile of Today's-Puzzle-only conditionals through code every other mode
// also depends on. The grid/hints/tracer wiring itself is intentionally
// the same shape as renderGame/renderCuratedGame.
function renderTodaysPuzzleGame(session) {
  const { gridSize } = session;
  const screen = el(`
    <div>
      <h2 style="text-align:center;">${t('todaysPuzzleTitle')}</h2>
      <p class="tagline" style="text-align:center;">${t('puzzleInstructions')}</p>
      <div class="grid-frame">
        <div class="grid" data-grid style="grid-template-columns:repeat(${gridSize}, 1fr); --cell-font-size:${cellFontSize(gridSize)};"></div>
      </div>
      <div class="game-toolbar">
        <button type="button" class="btn btn-secondary" data-show-answer>${t('showAnswerBtn')}</button>
      </div>
      <div class="hints-panel">
        <h3>${t('hintsTitle')}</h3>
        <div data-hints></div>
      </div>
    </div>
  `);
  screen.prepend(topBar({ backAction: showHome }));

  const gridEl = screen.querySelector('[data-grid]');
  const hintsEl = screen.querySelector('[data-hints]');
  const toolbarEl = screen.querySelector('.game-toolbar');
  const cellEls = [];
  const startTime = Date.now();

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
    session.placements.forEach((p) => {
      hintsEl.appendChild(el(`
        <div class="hint-item ${p.found ? 'found' : 'pending'}">
          <span class="hint-word">${p.letters.join('')}</span>
          ${gemBadge(p.entry.difficulty)}
          <span class="hint-meaning">${p.entry.meaning} <span class="hint-count">${t('syllableCount', p.letters.length)}</span></span>
        </div>
      `));
    });
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
    placement.cells.forEach(([r, c]) => {
      cellEls[r][c].classList.add('found');
      if (viaHint) cellEls[r][c].classList.add('via-hint');
    });
    if (placement.earnedGem) popGemFeedback(gridEl, cellEls, placement.cells, placement.entry.difficulty);
    renderHints();
    checkComplete();
  }

  function flashWrong(path) {
    path.forEach(({ r, c }) => cellEls[r][c].classList.add('wrong'));
    setTimeout(() => path.forEach(({ r, c }) => cellEls[r][c].classList.remove('wrong')), 400);
  }

  function checkComplete() {
    if (!session.placements.every((p) => p.found)) return;
    toolbarEl.innerHTML = '';
    const btn = el(`<button type="button" class="btn btn-primary" data-continue>${t('continueLevelBtn')}</button>`);
    btn.addEventListener('click', () => showTodaysPuzzleResult(session, Date.now() - startTime));
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
      if (match) markFound(match);
      else flashWrong(path);
    },
  });

  screen.querySelector('[data-show-answer]').addEventListener('click', () => {
    const target = session.placements.find((p) => !p.found);
    if (target) markFound(target, true);
  });

  setScreen(screen);
}

function todaysPuzzleGemCounts(session) {
  const gemCounts = { easy: 0, medium: 0, difficult: 0 };
  for (const p of session.placements) {
    if (p.earnedGem) gemCounts[p.entry.difficulty] = (gemCounts[p.entry.difficulty] || 0) + 1;
  }
  return gemCounts;
}

function recordTodaysPuzzleProgress(gemCounts, total) {
  const progress = {
    category: 'daily',
    sub_category: getTodaysDateStr(),
    level: 1,
    entries_found: total,
    pearls_found: gemCounts.easy,
    gems_found: gemCounts.medium,
    diamonds_found: gemCounts.difficult,
    language: getLang(),
  };
  recordPuzzleProgressLocal(progress, getLang(), state.playerName);
  if (state.playerId && syncsToBackend()) syncPuzzleProgress(state.playerId, progress);
}

function shareTodaysPuzzleResult(gemLine, foundCount, total) {
  const shareUrl = `${APP_URL}?today=1&lang=${getLang()}`;
  const text = `🪷 ${gemLine || '—'}\n${t('todaysPuzzleShareIntro', foundCount, total)}\n${t('todaysPuzzleShareCta')}`;
  if (navigator.share) {
    navigator.share({ text, url: shareUrl }).catch(() => {});
  } else {
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${shareUrl}`)}`, '_blank', 'noopener');
  }
}

// The actual completion of a fresh run: records progress (if named) and
// remembers it locally (see storage.js's getTodaysPuzzleCompletion) so
// showTodaysPuzzle() won't hand out a second attempt today, then renders
// the same result screen a replay later the same day would show.
function showTodaysPuzzleResult(session, elapsedMs) {
  const gemCounts = todaysPuzzleGemCounts(session);
  const total = session.placements.length;

  // Anyone who already has a name (i.e. reached this from Home, not a
  // guest deep link) gets recorded automatically, same as every other
  // mode - no reason to make them tap an extra "save" button just
  // because this mode also happens to support guests.
  if (state.playerName) recordTodaysPuzzleProgress(gemCounts, total);
  setTodaysPuzzleCompletion(getLang(), state.playerName, { dateStr: getTodaysDateStr(), gemCounts, total, elapsedMs });

  renderTodaysPuzzleResultScreen(gemCounts, total, elapsedMs, { isReplay: false });
}

// Reopening Today's Puzzle after already finishing it today - shows
// exactly what showTodaysPuzzleResult showed the first time, without
// recording progress again (that already happened on the real run).
function showTodaysPuzzleReplay(completion) {
  renderTodaysPuzzleResultScreen(completion.gemCounts, completion.total, completion.elapsedMs, { isReplay: true });
}

function renderTodaysPuzzleResultScreen(gemCounts, total, elapsedMs, { isReplay }) {
  const foundCount = gemCounts.easy + gemCounts.medium + gemCounts.difficult;
  const gemLine = GEM_EMOJI.easy.repeat(gemCounts.easy) + GEM_EMOJI.medium.repeat(gemCounts.medium) + GEM_EMOJI.difficult.repeat(gemCounts.difficult);
  const alreadyNamed = !!state.playerName;

  const screen = el(`
    <div class="complete-screen">
      <div class="glow">🪔</div>
      <h2>${t('todaysPuzzleResultTitle')}</h2>
      ${isReplay ? `<p class="tagline">${t('todaysPuzzleAlreadyPlayedNote')}</p>` : ''}
      <p style="font-size:1.6rem; letter-spacing:0.08em;">${gemLine || '—'}</p>
      <p>${t('todaysPuzzleFoundLine', foundCount, total)}</p>
      <p class="tagline">${t('todaysPuzzleElapsedLabel', formatElapsed(elapsedMs))}</p>
      <div class="btn-row" style="margin-top:16px;">
        <button type="button" class="btn btn-primary" data-share-result>${t('todaysPuzzleShareBtn')}</button>
      </div>
      ${alreadyNamed ? '' : `
      <div class="save-score-block" data-save-block style="margin-top:20px;">
        <p class="tagline">${t('todaysPuzzleSavePrompt')}</p>
        <input type="text" class="text-input" maxlength="40" placeholder="${t('namePlaceholder')}" data-save-name />
        <div class="btn-row">
          <button type="button" class="btn btn-secondary" data-save>${t('todaysPuzzleSaveBtn')}</button>
        </div>
      </div>`}
      <div class="btn-row" style="margin-top:20px;">
        <button type="button" class="btn btn-secondary" data-home>${t('todaysPuzzleBackHome')}</button>
      </div>
    </div>
  `);
  screen.prepend(topBar(alreadyNamed ? { backAction: showHome } : {}));

  screen.querySelector('[data-share-result]').addEventListener('click', () => shareTodaysPuzzleResult(gemLine, foundCount, total));

  if (!alreadyNamed) {
    const saveBlock = screen.querySelector('[data-save-block]');
    const saveBtn = screen.querySelector('[data-save]');
    saveBtn.addEventListener('click', async () => {
      const name = screen.querySelector('[data-save-name]').value.trim();
      if (!name) return;
      saveBtn.disabled = true;
      // Mirrors showNameGate's submit() - a guest saving a result needs the
      // same ensurePlayer() round-trip to get a real playerId before
      // recordTodaysPuzzleProgress can sync anywhere, or the save would
      // silently stay local-only even with a backend configured.
      let playerId = null;
      if (syncsToBackend()) {
        const result = await ensurePlayer(name);
        playerId = result.id;
      }
      state.playerName = name;
      state.playerId = playerId;
      setPlayerName(name);
      setPlayerId(playerId);
      loadDrawQueuesForCurrentPlayer();
      recordTodaysPuzzleProgress(gemCounts, total);
      saveBlock.innerHTML = `<p class="tagline">${t('todaysPuzzleSavedConfirm')}</p>`;
    });
  }

  screen.querySelector('[data-home]').addEventListener('click', showHome);
  setScreen(screen);
}

async function startNamaGuptaNidhi() {
  const lang = getLang();
  const [levels, pool] = await Promise.all([loadLevels(lang), loadEntryPool(lang)]);
  renderGeneralSession(levels[0], pool);
}

// Checks whether this player has already been asked every word in the
// general pool MAX_WORD_EXPOSURES times before building a puzzle - rather
// than silently degrading toward emptier and emptier grids as the last few
// not-yet-maxed words run out, this catches full exhaustion up front and
// points the player at Stotra Pariksha instead.
function renderGeneralSession(level, pool) {
  const exposure = getWordExposureCounts(generalScopeKey(), state.playerName);
  if (isPoolExhausted(pool, exposure)) {
    showPoolExhausted({
      messageKey: 'poolExhaustedGeneralMessage',
      backAction: showNamaGuptaNidhiHub,
      switchLabel: t('poolExhaustedSwitchToStotra'),
      onSwitch: showStotramList,
    });
    return;
  }
  const session = buildSession(level, pool);
  // isPoolExhausted() above only catches total exhaustion, not the case
  // where whatever's left unexhausted just doesn't fit any of the grid
  // sizes sampleMixedEntries tried rolling - vanishingly rare after its
  // own retries, but showing this instead of a grid with an empty hints
  // panel (nothing to find, no way to progress) is the honest fallback.
  if (session.placements.length === 0) {
    showPoolExhausted({
      messageKey: 'poolExhaustedGeneralMessage',
      backAction: showNamaGuptaNidhiHub,
      switchLabel: t('poolExhaustedSwitchToStotra'),
      onSwitch: showStotramList,
    });
    return;
  }
  renderGame(session);
}

// Zeroes out any tier the player has explicitly excluded via the Puranas
// card's difficulty checkboxes, then renormalizes what's left back to sum
// to 1 - an excluded tier never appears, no matter what the experience
// curve above would otherwise have picked, while tiers left selected keep
// skewing toward each other the same way they always have (so a newer
// player who leaves Pearl+Gem checked still leans toward Pearl).
function maskDifficultyWeights(weights, allowedTiers) {
  const allowed = new Set(allowedTiers);
  const masked = {};
  let total = 0;
  for (const d of DIFFICULTIES) {
    masked[d] = allowed.has(d) ? (weights[d] || 0) : 0;
    total += masked[d];
  }
  // A brand-new player's experience curve assigns Difficult a weight of
  // exactly 0 (see difficultyWeightsForExperience - it only ramps up over
  // their first 30 puzzles), so "Diamond only" from a new player would
  // otherwise mask everything down to a 0 total. Falling back to the
  // *unmasked* weights here would silently ignore their explicit choice
  // and hand them Pearl/Gem again; splitting evenly across just the
  // allowed tiers instead keeps the exclusion absolute regardless of how
  // experienced they are.
  if (total <= 0) {
    const even = {};
    for (const d of DIFFICULTIES) even[d] = allowed.has(d) ? 1 / allowed.size : 0;
    return even;
  }
  for (const d of DIFFICULTIES) masked[d] /= total;
  return masked;
}

function buildSession(level, pool) {
  const puzzlesCompleted = getLocalPuzzleTotals(getLang(), state.playerName).puzzlesCompleted;
  const weights = maskDifficultyWeights(difficultyWeightsForExperience(puzzlesCompleted), getGeneralDifficultyFilter(state.playerName));
  const scopeKey = generalScopeKey();
  const exposure = getWordExposureCounts(scopeKey, state.playerName);
  const { gridSize, entries } = sampleMixedEntries(pool, level, weights, puzzlesCompleted, getLang(), exposure);
  setPersistedDrawQueues(exportDrawQueues(), state.playerName);
  recordWordExposures(entries.map((e) => e.word), scopeKey, state.playerName);
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
        ${syncsToBackend() ? `<p class="flag-hint-note">${t('flagHintExplainer')}</p>` : ''}
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
    session.placements.forEach((p, idx) => {
      const item = el(`
        <div class="hint-item ${p.found ? 'found' : 'pending'}">
          <span class="hint-word">${p.letters.join('')}</span>
          ${gemBadge(p.entry.difficulty)}
          <span class="hint-meaning">${p.entry.meaning} <span class="hint-count">${t('syllableCount', p.letters.length)}</span></span>
          ${flagButtonHtml(idx)}
        </div>
      `);
      hintsEl.appendChild(item);
    });
    wireFlagButtons(hintsEl, session.placements, 'general');
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
    placement.cells.forEach(([r, c]) => {
      cellEls[r][c].classList.add('found');
      if (viaHint) cellEls[r][c].classList.add('via-hint');
    });
    if (placement.earnedGem) popGemFeedback(gridEl, cellEls, placement.cells, placement.entry.difficulty);
    renderHints();
    checkLevelComplete();
  }

  function flashWrong(path) {
    path.forEach(({ r, c }) => cellEls[r][c].classList.add('wrong'));
    setTimeout(() => {
      path.forEach(({ r, c }) => cellEls[r][c].classList.remove('wrong'));
    }, 400);
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
        markFound(match);
      } else {
        flashWrong(path);
      }
    },
  });

  screen.querySelector('[data-new-puzzle]').addEventListener('click', () => {
    renderGeneralSession(level, session.pool);
  });
  screen.querySelector('[data-show-answer]').addEventListener('click', () => {
    const target = session.placements.find((p) => !p.found);
    if (target) markFound(target, true);
  });

  setScreen(screen);
}

// Shared "you've run out of not-yet-maxed words" screen for both Nama
// Gupta Nidhi (general pool) and Stotra Pariksha (per-stotram pool) - see
// renderGeneralSession/renderCuratedSession, the only callers.
function showPoolExhausted({ messageKey, backAction, switchLabel, onSwitch }) {
  const screen = el(`
    <div class="complete-screen">
      <div class="glow">🙏</div>
      <h2>${t('poolExhaustedTitle')}</h2>
      <p>${t(messageKey)}</p>
      <div class="btn-row" style="margin-top:24px;">
        <button type="button" class="btn btn-primary" data-switch>${switchLabel}</button>
      </div>
    </div>
  `);
  screen.prepend(topBar({ backAction }));
  screen.querySelector('[data-switch]').addEventListener('click', onSwitch);
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
  recordPuzzleProgressLocal(progress, getLang(), state.playerName);
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
// Curated collections: Stotra Pariksha (one curated puzzle per stotram)
// and Sri Sai Satcharitra (one curated puzzle per theme) are the same
// shape underneath - a fixed set of entries that all appear every time
// (no sampling/difficulty tiers, unlike Nama Gupta Nidhi above), tested
// through the same grid/hint/flag machinery. MODE_CONFIG is the only
// thing that differs between them: which list screen "back" returns to,
// which pool-exhausted message to show, and what to tag saved progress
// with - renderCuratedSession/renderCuratedGame/recordCuratedProgress/
// showCuratedComplete/startCurated below all take a `kind` key into this
// table instead of being written twice.
// ---------------------------------------------------------------------

const MODE_CONFIG = {
  stotram: {
    listAction: showStotramList,
    poolExhaustedMessageKey: 'poolExhaustedStotramMessage',
    switchLabelKey: 'poolExhaustedSwitchToPuranas',
    onSwitch: startNamaGuptaNidhi,
    category: 'stotram',
    subtitleKey: 'stotraParikshaSub',
  },
  'sai-satcharitra': {
    // Unlike Stotra Pariksha, this pool is deliberately a single combined
    // collection with no picker screen - "back" from the puzzle (and the
    // pool-exhausted fallback, and "Finish") all return straight to the
    // hub. See startSaiSatcharitra below.
    listAction: showNamaGuptaNidhiHub,
    poolExhaustedMessageKey: 'poolExhaustedSaiSatcharitraMessage',
    switchLabelKey: 'poolExhaustedSwitchToPuranas',
    onSwitch: startNamaGuptaNidhi,
    category: 'sai-satcharitra',
    subtitleKey: 'saiSatcharitraSub',
  },
};

async function renderCollectionList({ titleKey, subKey, loader }) {
  const screen = el(`
    <div>
      <h2 style="text-align:center;">${t(titleKey)}</h2>
      <p class="tagline" style="text-align:center;">${t(subKey)}</p>
      <div class="card-grid" data-collections style="margin-top:20px;"></div>
    </div>
  `);
  screen.prepend(topBar({ backAction: showNamaGuptaNidhiHub }));
  setScreen(screen);
  return { screen, collections: await loader(getLang()) };
}

async function showStotramList() {
  const { screen, collections } = await renderCollectionList({
    titleKey: 'stotraParikshaTitle', subKey: 'stotraParikshaSub', loader: loadStotrams,
  });
  renderCollectionCards(screen.querySelector('[data-collections]'), collections, 'stotram');
}

// The "శ్రీ సాయి సచ్చరిత్ర" sub-mode has just the one combined collection
// (no per-theme picker, unlike Stotra Pariksha's per-stotram list) - so
// tapping the hub button goes straight into its puzzle.
async function startSaiSatcharitra() {
  const collections = await loadSaiSatcharitra(getLang());
  const collection = collections.find((c) => c.status === 'active') || collections[0];
  startCurated(collection, 'sai-satcharitra');
}

function renderCollectionCards(container, collections, kind) {
  for (const collection of collections) {
    if (collection.status !== 'active') {
      container.appendChild(el(`
        <div class="card locked">
          <div class="card-title">${collection.title}</div>
          <div class="card-sub">${t('soonSub')}</div>
          <span class="badge soon">${t('soonBadge')}</span>
        </div>
      `));
      continue;
    }
    const card = el(`
      <button type="button" class="card">
        <div class="card-title">${collection.title}</div>
        <div class="card-sub">${t('stotramCardSub')}</div>
        <span class="badge">${t('playableBadge')}</span>
      </button>
    `);
    card.addEventListener('click', () => startCurated(collection, kind));
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
// queue with the other's words. Hydrated from and persisted to
// localStorage (see boot() and drawStotramRound's last line) so a word
// can't resurface right after a page reload either.
const stotramDrawQueues = new Map();

function curatedScopeKey(stotram) {
  return `${getLang()}::${stotram.id}`;
}

function drawStotramRound(stotram, gridSize, weights, exposure) {
  const targetCounts = splitAcrossDifficulties(entryCountForGridSize(gridSize), weights);
  const drawn = [];
  for (const difficulty of DIFFICULTIES) {
    // See grid.js's sampleMixedEntries for why this pool isn't filtered by
    // gridSize up front: doing so used to drop a word from the persisted
    // queue whenever it was briefly too long for a small roll, letting it
    // resurface as "unseen" the next time a bigger grid came around,
    // well before the tier had actually cycled.
    const tierPool = stotram.entries.filter((e) => e.difficulty === difficulty && (exposure[e.word] || 0) < MAX_WORD_EXPOSURES);
    if (!tierPool.length) continue;

    const fitsThisRoll = (e) => graphemes(e.word).length <= gridSize;
    const eligibleNow = tierPool.filter(fitsThisRoll);
    const count = Math.min(targetCounts[difficulty], eligibleNow.length);
    if (!count) continue;

    const tierWords = new Set(tierPool.map((e) => e.word));
    const key = `${getLang()}::${stotram.id}::${difficulty}`;
    const queue = (stotramDrawQueues.get(key) || []).filter((e) => tierWords.has(e.word));
    // A fresh cycle only starts once every word has been drawn (queue
    // fully empty) - never just because the front of the queue doesn't
    // happen to fit this roll's grid size. See grid.js's
    // startNewCycleIfEmpty for why that distinction is the actual fix.
    if (queue.length === 0) queue.push(...shuffleLocal(tierPool));

    const remaining = [];
    let drawnHere = 0;
    for (const entry of queue) {
      if (drawnHere < count && fitsThisRoll(entry)) { drawn.push(entry); drawnHere += 1; }
      else remaining.push(entry);
    }
    stotramDrawQueues.set(key, remaining);
  }
  setPersistedStotramDrawQueues(Object.fromEntries(stotramDrawQueues), state.playerName);
  return drawn;
}

// How many times a roll is allowed to come up empty before giving up -
// see grid.js's sampleMixedEntries for why this can legitimately happen
// even when isPoolExhausted() says the pool isn't exhausted: whatever
// words this player hasn't exhausted yet might all be too long to fit
// this particular roll's grid size. Re-rolling resolves it in practice.
const STOTRAM_SAMPLE_RETRY_ATTEMPTS = 20;

function buildStotramSession(stotram) {
  const puzzlesCompleted = getLocalPuzzleTotals(getLang(), state.playerName).puzzlesCompleted;
  const cappedMax = gridSizeCapForExperience(puzzlesCompleted, stotram.gridSizeMin, stotram.gridSizeMax);
  const weights = difficultyWeightsForExperience(puzzlesCompleted);
  const scopeKey = curatedScopeKey(stotram);
  const exposure = getWordExposureCounts(scopeKey, state.playerName);

  let gridSize;
  let entries = [];
  for (let attempt = 0; attempt < STOTRAM_SAMPLE_RETRY_ATTEMPTS; attempt++) {
    gridSize = randomInt(stotram.gridSizeMin, cappedMax);
    entries = drawStotramRound(stotram, gridSize, weights, exposure);
    if (entries.length > 0) break;
  }

  recordWordExposures(entries.map((e) => e.word), scopeKey, state.playerName);
  const { grid, placements } = generateGridReliable({ size: gridSize, entries, fillerMode: stotram.fillerMode, fillerPool: fillerPool() });
  return { stotram, gridSize, grid, placements: placements.map((p) => ({ ...p, found: false, earnedGem: false })) };
}

// Mirrors renderGeneralSession above: checks this collection's own pool
// for full exhaustion before building a puzzle, and if so points the
// player at a different collection or back to Puranas instead of a
// near-empty grid. `kind` is a MODE_CONFIG key ('stotram' or
// 'sai-satcharitra') - see the comment above MODE_CONFIG.
function renderCuratedSession(collection, kind) {
  const cfg = MODE_CONFIG[kind];
  const exposure = getWordExposureCounts(curatedScopeKey(collection), state.playerName);
  if (isPoolExhausted(collection.entries, exposure)) {
    showPoolExhausted({
      messageKey: cfg.poolExhaustedMessageKey,
      backAction: cfg.listAction,
      switchLabel: t(cfg.switchLabelKey),
      onSwitch: cfg.onSwitch,
    });
    return;
  }
  const session = buildStotramSession(collection);
  // See renderGeneralSession's matching check - isPoolExhausted() above
  // only catches total exhaustion, not this collection's unexhausted
  // words all being too long for every grid size buildStotramSession tried.
  if (session.placements.length === 0) {
    showPoolExhausted({
      messageKey: cfg.poolExhaustedMessageKey,
      backAction: cfg.listAction,
      switchLabel: t(cfg.switchLabelKey),
      onSwitch: cfg.onSwitch,
    });
    return;
  }
  renderCuratedGame(session, kind);
}

function startCurated(collection, kind) {
  renderCuratedSession(collection, kind);
}

function renderCuratedGame(session, kind) {
  const cfg = MODE_CONFIG[kind];
  const { stotram: collection, gridSize } = session;
  const screen = el(`
    <div>
      <h2 style="text-align:center;">${collection.title}</h2>
      <p class="tagline" style="text-align:center;">${t(cfg.subtitleKey)}</p>
      <div class="grid-frame">
        <div class="grid" data-grid style="grid-template-columns:repeat(${gridSize}, 1fr); --cell-font-size:${cellFontSize(gridSize)};"></div>
      </div>
      <div class="game-toolbar">
        <button type="button" class="btn btn-secondary" data-new-puzzle>${t('newPuzzleBtn')}</button>
        <button type="button" class="btn btn-secondary" data-show-answer>${t('showAnswerBtn')}</button>
      </div>
      <div class="hints-panel">
        <h3>${t('hintsTitle')}</h3>
        ${syncsToBackend() ? `<p class="flag-hint-note">${t('flagHintExplainer')}</p>` : ''}
        <div data-hints></div>
        ${collection.source === 'hindupedia' ? `<p class="content-credit">${t('stotramSourceCreditHindupedia', collection.title, collection.sourceUrl)}</p>` : ''}
      </div>
    </div>
  `);
  screen.prepend(topBar({ backAction: cfg.listAction }));

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
    session.placements.forEach((p, idx) => {
      hintsEl.appendChild(el(`
        <div class="hint-item ${p.found ? 'found' : 'pending'}">
          <span class="hint-word">${p.letters.join('')}</span>
          ${gemBadge(p.entry.difficulty)}
          <span class="hint-meaning">${p.entry.meaning} <span class="hint-count">${t('syllableCount', p.letters.length)}</span></span>
          ${flagButtonHtml(idx)}
        </div>
      `));
    });
    wireFlagButtons(hintsEl, session.placements, collection.id);
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
    placement.cells.forEach(([r, c]) => {
      cellEls[r][c].classList.add('found');
      if (viaHint) cellEls[r][c].classList.add('via-hint');
    });
    if (placement.earnedGem) popGemFeedback(gridEl, cellEls, placement.cells, placement.entry.difficulty);
    renderHints();
    checkComplete();
  }

  function flashWrong(path) {
    path.forEach(({ r, c }) => cellEls[r][c].classList.add('wrong'));
    setTimeout(() => path.forEach(({ r, c }) => cellEls[r][c].classList.remove('wrong')), 400);
  }

  function checkComplete() {
    if (!session.placements.every((p) => p.found)) return;
    recordCuratedProgress(session, kind);
    toolbarEl.innerHTML = '';
    const btn = el(`<button type="button" class="btn btn-primary" data-continue>${t('continueLevelBtn')}</button>`);
    btn.addEventListener('click', () => showCuratedComplete(collection, kind));
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
      if (match) { markFound(match); }
      else { flashWrong(path); }
    },
  });

  screen.querySelector('[data-new-puzzle]').addEventListener('click', () => renderCuratedSession(collection, kind));
  screen.querySelector('[data-show-answer]').addEventListener('click', () => {
    const target = session.placements.find((p) => !p.found);
    if (target) markFound(target, true);
  });

  setScreen(screen);
}

function recordCuratedProgress(session, kind) {
  const gemCounts = { easy: 0, medium: 0, difficult: 0 };
  for (const p of session.placements) {
    if (p.earnedGem) gemCounts[p.entry.difficulty] = (gemCounts[p.entry.difficulty] || 0) + 1;
  }
  const progress = {
    category: MODE_CONFIG[kind].category,
    sub_category: session.stotram.id,
    level: 1,
    entries_found: session.placements.length,
    pearls_found: gemCounts.easy,
    gems_found: gemCounts.medium,
    diamonds_found: gemCounts.difficult,
    language: getLang(),
  };
  recordPuzzleProgressLocal(progress, getLang(), state.playerName);
  if (state.playerId && syncsToBackend()) syncPuzzleProgress(state.playerId, progress);
}

function showCuratedComplete(collection, kind) {
  const cfg = MODE_CONFIG[kind];
  const screen = el(`
    <div class="complete-screen">
      <div class="glow">🙏</div>
      <h2>${t('congratulations')}</h2>
      <p>${t('stotramFoundAll', collection.title)}</p>
      <div class="about-box">
        ${t('stotramAboutLabel', collection.title)} ${collection.about}
      </div>
      ${collection.source === 'hindupedia' ? `<p class="content-credit">${t('stotramSourceCreditHindupedia', collection.title, collection.sourceUrl)}</p>` : ''}
      <div class="btn-row" style="margin-top:12px;">
        <button type="button" class="btn btn-secondary" data-again>${t('playAgainBtn')}</button>
        <button type="button" class="btn btn-primary" data-list>${t('finishBtn')}</button>
      </div>
    </div>
  `);
  screen.querySelector('[data-again]').addEventListener('click', () => startCurated(collection, kind));
  screen.querySelector('[data-list]').addEventListener('click', cfg.listAction);
  setScreen(screen);
}

// ---------------------------------------------------------------------
// Likhita Japam (standalone + interlude share this engine)
// ---------------------------------------------------------------------

const MIC_ICON = `<svg viewBox="0 0 16 16"><rect x="6" y="1" width="4" height="8" rx="2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M3 7a5 5 0 0010 0M8 12v3M5.5 15h5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`;
const REC_STOP_ICON = `<svg viewBox="0 0 16 16"><rect x="4" y="4" width="8" height="8" rx="1" fill="currentColor"/></svg>`;
const REC_PLAY_ICON = `<svg viewBox="0 0 16 16"><path d="M4 2l10 6-10 6z" fill="currentColor"/></svg>`;
const REC_TRASH_ICON = `<svg viewBox="0 0 16 16"><path d="M3 4h10M6 4V2h4v2M4 4l1 10h6l1-10" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
const MAX_RECORDING_MS = 8000;

// Plays a saved on-device recording for `word` (if one exists) by
// creating a throwaway <audio> element from its Blob. Silently does
// nothing when no recording is stored - callers don't need to check
// first. Fire-and-forget: callers don't await this.
async function playRecording(lang, word) {
  const blob = await getRecording(lang, word);
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.addEventListener('ended', () => URL.revokeObjectURL(url));
  audio.play().catch(() => URL.revokeObjectURL(url));
}

// Renders the record/play/delete control for one Likhita Japam name card
// into `slot`, and wires up microphone capture via MediaRecorder. The
// recording is scoped to the *current* language + word (see
// js/recordings.js) so switching languages naturally offers a fresh,
// independent recording rather than reusing one made for a different
// script. Entirely on-device: nothing here ever reaches Supabase.
function wireRecordButton(slot, word) {
  if (!('mediaDevices' in navigator) || !window.MediaRecorder) return;
  const lang = getLang();
  let mediaRecorder = null;
  let autoStopTimer = null;

  async function render() {
    slot.innerHTML = '';
    const hasRecording = !!(await getRecording(lang, word));
    const recBtn = el(`<button type="button" class="record-btn" title="${hasRecording ? t('playRecordingTitle') : t('recordBtnTitle')}">${hasRecording ? REC_PLAY_ICON : MIC_ICON}</button>`);
    recBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (mediaRecorder && mediaRecorder.state === 'recording') { mediaRecorder.stop(); return; }
      if (hasRecording) { playRecording(lang, word); return; }
      startRecording(recBtn);
    });
    recBtn.addEventListener('keydown', (e) => e.stopPropagation());
    slot.appendChild(recBtn);
    if (hasRecording) {
      const delBtn = el(`<button type="button" class="record-delete-btn" title="${t('deleteRecordingTitle')}">${REC_TRASH_ICON}</button>`);
      delBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await deleteRecording(lang, word);
        await render();
      });
      slot.appendChild(delBtn);
    }
  }

  async function startRecording(recBtn) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = window.MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      const chunks = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      mediaRecorder.onstop = async () => {
        clearTimeout(autoStopTimer);
        stream.getTracks().forEach((tr) => tr.stop());
        const blob = new Blob(chunks, { type: mediaRecorder.mimeType || 'audio/webm' });
        await saveRecording(lang, word, blob);
        mediaRecorder = null;
        await render();
      };
      mediaRecorder.start();
      autoStopTimer = setTimeout(() => { if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop(); }, MAX_RECORDING_MS);
      recBtn.classList.add('recording');
      recBtn.innerHTML = REC_STOP_ICON;
      recBtn.title = t('stopRecordingTitle');
    } catch (err) {
      console.warn('Recording failed:', err);
    }
  }

  render();
}

function showJapamNamePicker() {
  const screen = el(`
    <div>
      <h2>${t('japamPickerTitle')}</h2>
      <p class="tagline" style="text-align:center;" data-network-total hidden></p>
      <p class="tagline" style="text-align:center;">${t('recordHintExplainer')}</p>
      <div class="card-grid" data-names></div>
      <div class="custom-word-block">
        <p class="tagline" style="text-align:center;">${t('japamCustomPrompt')}</p>
        <input type="text" class="text-input" maxlength="60" placeholder="${t('japamCustomPlaceholder')}" data-custom-word />
        <div class="btn-row">
          <button type="button" class="btn btn-primary" data-custom-start>${t('beginBtn')}</button>
          <div class="record-slot-inline" data-custom-record-slot></div>
        </div>
      </div>
    </div>
  `);
  screen.prepend(topBar({ backAction: showHome }));
  const container = screen.querySelector('[data-names]');
  japamNames().forEach(({ word, label }, i) => {
    // Was a <button>, but the per-name record control (see
    // wireRecordButton below) is itself an interactive button, and
    // buttons can't nest inside buttons - a div with role="button" plus
    // a keydown handler keeps the card equally operable by keyboard.
    const card = el(`
      <div class="card" style="text-align:center;" role="button" tabindex="0">
        <div class="card-title">${label}</div>
        ${i === 0 ? `<span class="badge">${t('suggestedBadge')}</span>` : ''}
        <div class="record-slot" data-record-slot></div>
      </div>
    `);
    const start = () => startJapamSession({ mode: 'standalone', word, target: null, onExit: showHome });
    card.addEventListener('click', start);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); start(); }
    });
    wireRecordButton(card.querySelector('[data-record-slot]'), word);
    container.appendChild(card);
  });

  const customInput = screen.querySelector('[data-custom-word]');
  const startCustom = () => {
    const typed = customInput.value.trim();
    if (!typed) { customInput.focus(); return; }
    // Telugu mode transliterates a Latin-typed guess ("rama") into Telugu
    // script; transliterate.js only knows Telugu output today, so every
    // other language (English, Kannada) traces the typed text as-is
    // rather than attempting a translation this app doesn't actually have.
    const word = getLang() === 'te' && looksLikeLatin(typed) ? transliterate(typed) : typed;
    startJapamSession({ mode: 'standalone', word, target: null, onExit: showHome });
  };
  screen.querySelector('[data-custom-start]').addEventListener('click', startCustom);
  customInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') startCustom(); });

  // The suggested-name cards can each have a voice recording attached
  // (see wireRecordButton) - a custom-typed name deserves the same, so
  // players aren't limited to recording only the two defaults. Recordings
  // are keyed by the exact word text, so the mic control has to be
  // re-wired to whatever's currently typed rather than wired once; wiring
  // on every keystroke would mean an IndexedDB lookup per keystroke, so
  // this waits for a short pause in typing instead. Blank input hides the
  // control entirely - there's nothing to attach a recording to yet.
  const customRecordSlot = screen.querySelector('[data-custom-record-slot]');
  let customRecordDebounce = null;
  const updateCustomRecordSlot = () => {
    const typed = customInput.value.trim();
    if (!typed) { customRecordSlot.innerHTML = ''; return; }
    wireRecordButton(customRecordSlot, typed);
  };
  customInput.addEventListener('input', () => {
    clearTimeout(customRecordDebounce);
    customRecordDebounce = setTimeout(updateCustomRecordSlot, 400);
  });
  customInput.addEventListener('blur', updateCustomRecordSlot);

  setScreen(screen);

  // Fetched after the picker is already on screen - a family/community
  // total is a nice-to-have, not something worth delaying the picker
  // (or its own network hiccup) over. Only meaningful with a shared
  // backend; local-only devices have no "everyone" to total across.
  // Cross-language (fetchJapamNetworkTotal, not fetchJapamLeaderboard) so
  // this matches the identically-worded total shown on Home and the
  // Scoreboard - a player switching languages seeing "everyone, together"
  // change was exactly the inconsistency reported and fixed everywhere
  // else this same figure appears.
  if (syncsToBackend()) {
    const totalEl = screen.querySelector('[data-network-total]');
    fetchJapamNetworkTotal().then((total) => {
      if (total == null || !totalEl.isConnected) return;
      totalEl.textContent = t('japamNetworkTotal', total);
      totalEl.hidden = false;
    });
  }
}

function startJapamSession(config) {
  const session = { ...config, count: 0 };
  renderJapamTrace(session);
}

// Sizes the Japam canvas to fill however much space is actually free
// around it - both width and height, measured for real - instead of a
// fixed width-only cap. A short word no longer sits small with blank
// space beside it just because a flat height guess happened to be the
// tighter constraint, and it can never overflow the viewport either,
// since both bounds come from the real layout at the moment it runs.
// Re-measures on resize/orientation change while this canvas is the one
// on screen; screens here have no explicit teardown hook, so the fit
// function drops its own listeners once the canvas it was sizing is no
// longer in the document (i.e. the player has navigated away).
function fitJapamCanvas(canvas, frame) {
  function fit() {
    if (!canvas.isConnected) {
      window.removeEventListener('resize', fit);
      window.removeEventListener('orientationchange', fit);
      return;
    }
    const naturalWidth = canvas.width;
    const naturalHeight = canvas.height;
    if (!naturalWidth || !naturalHeight) return;
    const cs = getComputedStyle(frame);
    const paddingX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const paddingY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const borderY = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
    const availableWidth = frame.clientWidth - paddingX;
    const bottomMargin = 8;
    const availableHeight = window.innerHeight - frame.getBoundingClientRect().top - paddingY - borderY - bottomMargin;
    const scale = Math.min(availableWidth / naturalWidth, availableHeight / naturalHeight);
    if (!(scale > 0) || !isFinite(scale)) return;
    canvas.style.width = `${naturalWidth * scale}px`;
    canvas.style.height = `${naturalHeight * scale}px`;
  }
  fit();
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', fit);
}

async function renderJapamTrace(session) {
  const isStandalone = !session.target;
  const screen = el(`
    <div class="japam-trace-screen">
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
  const frame = screen.querySelector('.japam-surface-frame');
  let trace;
  try {
    trace = await buildDotTrace(session.word);
  } catch (err) {
    // Everything above this (title, buttons, exit) already rendered fine -
    // only the trace surface itself depends on this. A failure here (a
    // stuck/rejected webfont fetch used to be the main one; ensureFontReady
    // in handwriting.js now times out and falls back instead of throwing,
    // but this stays as a last-resort net for anything else) used to leave
    // that surface silently blank forever instead of showing anything.
    console.warn('buildDotTrace failed:', err);
    frame.innerHTML = `
      <p class="tagline" style="text-align:center; padding: 24px 12px;">${t('japamTraceLoadError')}</p>
      <div class="btn-row"><button type="button" class="btn btn-secondary" data-retry>${t('japamTraceRetryBtn')}</button></div>
    `;
    frame.querySelector('[data-retry]').addEventListener('click', () => renderJapamTrace(session));
    return;
  }
  const { dots, width, height, baselineY, ink } = trace;
  canvas.width = width;
  canvas.height = height;
  fitJapamCanvas(canvas, frame);
  const ctx = canvas.getContext('2d');
  const filled = new Set();

  // The dots alone are a subtle "did that one just change color?" cue -
  // easy to miss, especially for anyone not looking closely. Solidifying
  // the actual letter as it's traced is far more obvious: solidInk is the
  // true glyph shape rendered once in solid color; revealMask accumulates
  // a filled circle at every traced dot; each draw() composites solidInk
  // through revealMask (canvas destination-in, GPU-composited - cheap
  // even on a slower phone, unlike re-checking every ink pixel by hand)
  // so only the traced portion of the letter actually shows.
  const solidInk = buildSolidInkCanvas(ink, width, height);
  const revealMask = document.createElement('canvas');
  revealMask.width = width;
  revealMask.height = height;
  const revealCtx = revealMask.getContext('2d');
  const REVEAL_RADIUS = 16;
  const revealed = new Set();

  // A trace counts as done once this much of the actual glyph's ink is
  // visibly revealed - a direct read of what the player sees on screen,
  // rather than counting "dots touched" (which struggled on tight curves
  // where the skeleton's nearest-neighbor walk leaves one dot an awkward
  // distance from its neighbors, order that has nothing to do with how
  // much of the letter is actually filled in). revealedInk mirrors
  // revealMask as a per-pixel bitmap so coverage can be measured exactly
  // instead of estimated; only the newly-revealed disk around each dot
  // is scanned per fill, not the whole canvas, so this stays cheap.
  //
  // A literal 100% isn't achievable for every word - a handful of pixels
  // right at the edge of the ink always fall just outside every nearby
  // dot's reveal radius, geometry that has nothing to do with how well
  // the player traced. Checked the actual max reachable coverage (every
  // dot touched) across the entire content pool (911 words, all three
  // languages): worst case was 99.29%, so 0.99 stays reachable everywhere
  // while requiring close to the whole glyph.
  //
  // English's joined cursive font (see handwriting.js's isJoinedLang) adds
  // thin connecting strokes between letters on top of that - fiddlier to
  // land a touch on than Telugu/Kannada's separated block letters, so
  // requiring the same near-total 99% there felt like it demanded tracing
  // literally every dot. 0.90 keeps the completion feeling reachable
  // without the pass genuinely finishing on a sloppy trace.
  const INK_COMPLETE_THRESHOLD = isJoinedLang(getLang()) ? 0.90 : 0.99;
  const totalInkPixels = ink.reduce((sum, v) => sum + v, 0);
  const revealedInk = new Uint8Array(ink.length);
  let revealedInkPixels = 0;
  let completed = false;

  function markInkRevealed(cx, cy) {
    const cxr = Math.round(cx);
    const cyr = Math.round(cy);
    const rSq = REVEAL_RADIUS * REVEAL_RADIUS;
    const minX = Math.max(0, cxr - REVEAL_RADIUS);
    const maxX = Math.min(width - 1, cxr + REVEAL_RADIUS);
    const minY = Math.max(0, cyr - REVEAL_RADIUS);
    const maxY = Math.min(height - 1, cyr + REVEAL_RADIUS);
    for (let y = minY; y <= maxY; y++) {
      const dy = y - cyr;
      for (let x = minX; x <= maxX; x++) {
        const dx = x - cxr;
        if (dx * dx + dy * dy > rSq) continue;
        const idx = y * width + x;
        if (ink[idx] && !revealedInk[idx]) {
          revealedInk[idx] = 1;
          revealedInkPixels++;
        }
      }
    }
  }

  function revealNewlyFilledDots() {
    filled.forEach((i) => {
      if (revealed.has(i)) return;
      revealed.add(i);
      const d = dots[i];
      revealCtx.beginPath();
      revealCtx.arc(d.x, d.y, REVEAL_RADIUS, 0, Math.PI * 2);
      revealCtx.fillStyle = '#000';
      revealCtx.fill();
      markInkRevealed(d.x, d.y);
    });
    // The 99% ink-coverage bar was tuned against this app's own bundled
    // Telugu/Kannada fonts, but English falls back to the device's
    // generic system sans-serif (no dedicated web font is loaded for
    // it - see fontStackFor in handwriting.js), which varies by
    // phone/OS and can have a lower max-achievable coverage ceiling
    // than what was measured here. Touching every single dot is
    // therefore also accepted as complete on its own, regardless of
    // the measured ink percentage - an unambiguous, purely geometric
    // signal that can't be blocked by any particular font's rendering.
    const allDotsTouched = filled.size >= dots.length;
    // Ink coverage alone can cross the threshold before the word's last
    // dot is ever touched: each touch reveals a 16px disk but dots sit
    // only 12px apart, so neighbouring reveals overlap and the *last*
    // dot in the trace typically adds little new ink (its surroundings
    // were already exposed by the dot before it). That let a trace read
    // as "done" while the last letter had never actually been attempted.
    // Dots are ordered left-to-right by stroke (see buildDotTrace), so
    // requiring the final dot specifically closes that gap without
    // otherwise changing how forgiving the coverage threshold is.
    const lastDotTouched = dots.length === 0 || filled.has(dots.length - 1);
    if (!completed && lastDotTouched && (allDotsTouched || (totalInkPixels > 0 && revealedInkPixels / totalInkPixels >= INK_COMPLETE_THRESHOLD))) {
      completed = true;
      onJapamSuccess(session);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(240, 210, 139, 0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, baselineY);
    ctx.lineTo(width, baselineY);
    ctx.stroke();

    ctx.save();
    ctx.drawImage(solidInk, 0, 0);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(revealMask, 0, 0);
    ctx.restore();

    dots.forEach((d, i) => {
      ctx.beginPath();
      ctx.arc(d.x, d.y, filled.has(i) ? 4.5 : 3.5, 0, Math.PI * 2);
      ctx.fillStyle = filled.has(i) ? '#c9962e' : '#4e1219';
      ctx.fill();
    });
  }
  draw();

  attachDotTracer(canvas, dots, filled, {
    onChange: () => { revealNewlyFilledDots(); draw(); },
    hitRadius: hitRadiusFor(getLang()),
  });
}

// The true glyph shape (from handwriting.js's ink mask) rendered once in
// solid color - see renderJapamTrace's revealMask for how it's revealed
// progressively as the dots covering it get traced.
function buildSolidInkCanvas(ink, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(width, height);
  for (let i = 0; i < ink.length; i++) {
    if (!ink[i]) continue;
    imgData.data[i * 4] = 201;
    imgData.data[i * 4 + 1] = 150;
    imgData.data[i * 4 + 2] = 46;
    imgData.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

function onJapamSuccess(session) {
  playRecording(getLang(), session.word);
  session.count += 1;
  const entry = {
    name_traced: session.word,
    count: 1,
    session_type: session.mode === 'interlude' ? 'interlude' : 'standalone',
    language: getLang(),
  };
  recordJapamLocal(entry, getLang(), state.playerName);
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
      ${syncsToBackend() ? `<p class="tagline" style="text-align:center;" data-member-count></p>` : ''}
      <div class="score-section">
        <h3>${t('puzzleBoardTitle')}</h3>
        <p class="gem-legend">${t('gemLegend', gemBadge('easy'), gemBadge('medium'), gemBadge('difficult'))}</p>
        <div data-puzzle-board>${t('loading')}</div>
      </div>
      <div class="score-section">
        <h3>${t('japamBoardTitle')}</h3>
        ${syncsToBackend() ? `<p class="tagline" style="text-align:center;" data-japam-network-total></p>` : ''}
        <div data-japam-board>${t('loading')}</div>
      </div>
      ${syncsToBackend() ? `
      <div class="score-section">
        <h3>${t('flaggedQuestionsTitle')}</h3>
        <div data-flagged-board>${t('loading')}</div>
      </div>` : ''}
    </div>
  `);
  screen.prepend(topBar({ backAction: showHome }));
  setScreen(screen);

  const puzzleBoardEl = screen.querySelector('[data-puzzle-board]');
  const japamBoardEl = screen.querySelector('[data-japam-board]');
  const flaggedBoardEl = screen.querySelector('[data-flagged-board]');

  if (syncsToBackend()) {
    const [puzzleRows, japamRows, flaggedRows, stotrams, saiSatcharitra, memberCount, japamTotal] = await Promise.all([
      fetchPuzzleLeaderboard(getLang()), fetchJapamLeaderboard(getLang()), fetchFlaggedEntries(getLang()), loadStotrams(getLang()), loadSaiSatcharitra(getLang()), fetchPlayerCount(), fetchJapamNetworkTotal(),
    ]);
    if (memberCount != null) screen.querySelector('[data-member-count]').textContent = t('scoreboardMemberCount', memberCount);
    const activePuzzleRows = (puzzleRows || []).filter((row) =>
      (row.total_pearls ?? 0) > 0 || (row.total_gems ?? 0) > 0 || (row.total_diamonds ?? 0) > 0 || (row.puzzles_completed ?? 0) > 0
    );
    puzzleBoardEl.replaceWith(renderLeaderboardTable(
      activePuzzleRows,
      ['display_name', 'total_pearls', 'total_gems', 'total_diamonds', 'puzzles_completed'],
      [t('colName'), `${gemBadge('easy')} ${t('colPearls')}`, `${gemBadge('medium')} ${t('colGems')}`, `${gemBadge('difficult')} ${t('colDiamonds')}`, t('colPuzzlesCompleted')],
      'data-puzzle-board'
    ));
    // Cross-language, same as Home's stat and the Japam picker's total
    // below - japamRows itself stays per-language, since the ranked
    // table under this (each player's own count + daily average) is
    // legitimately scoped to whichever language tab is open.
    if (japamTotal != null) screen.querySelector('[data-japam-network-total]').textContent = t('japamNetworkTotal', japamTotal);
    const japamRowsWithAverage = (japamRows || []).map((row) => ({
      ...row,
      daily_average: row.first_logged_at ? Math.round(row.total_count / daysElapsedInclusive(row.first_logged_at)) : 0,
    }));
    japamBoardEl.replaceWith(renderLeaderboardTable(
      japamRowsWithAverage,
      ['display_name', 'total_count', 'daily_average'],
      [t('colName'), t('colTotalJapamCount'), t('colDailyAverage')],
      'data-japam-board'
    ));
    // source_mode is 'general' or a curated collection id (a stotram or a
    // Sai Satcharitra theme) - map the id to its title (already loaded
    // above) so this reads like the app, not the schema.
    const stotramTitleById = new Map([...(stotrams || []), ...(saiSatcharitra || [])].map((s) => [s.id, s.title]));
    const flaggedRowsFormatted = (flaggedRows || []).map((row) => ({
      ...row,
      source_label: row.source_mode === 'general' ? t('sourceGeneral') : (stotramTitleById.get(row.source_mode) || row.source_mode),
      flagged_at: new Date(row.created_at).toLocaleString(),
    }));
    flaggedBoardEl.replaceWith(renderFlaggedTable(flaggedRowsFormatted));
  } else {
    const puzzleTotals = getLocalPuzzleTotals(getLang(), state.playerName);
    const japamTotals = getLocalJapamTotals(getLang(), state.playerName);
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
        <p>${t('localAverageJapam', japamTotals.average)}</p>
        <p class="score-note">${t('localOnlyNote')}</p>
      </div>`;
  }
}

// Shows only the top `limit` rows by default (the views already return
// rows best-first), with a "more"/"less" toggle to expand or collapse -
// as the family/community using this grows, a single long table gets
// unwieldy fast. The wrapper element is built once and re-rendered in
// place on toggle, rather than going through setScreen again.
function renderLeaderboardTable(rows, keys, labels, dataAttr, limit = 10, emptyKey = 'noScoresYet') {
  if (!rows || !rows.length) {
    return el(`<div ${dataAttr}><p class="score-note">${t(emptyKey)}</p></div>`);
  }
  let expanded = false;
  const wrap = el(`<div ${dataAttr}></div>`);
  const header = labels.map((l) => `<th>${l}</th>`).join('');
  const renderInner = () => {
    const visibleRows = expanded ? rows : rows.slice(0, limit);
    // Rows come straight from the shared Supabase leaderboard views - any
    // player's own chosen display_name ends up here, so it must be
    // escaped like any other untrusted input before going into innerHTML
    // (see escapeHtml's comment above).
    const body = visibleRows.map((row) => `<tr>${keys.map((k) => `<td>${escapeHtml(row[k] ?? 0)}</td>`).join('')}</tr>`).join('');
    const toggle = rows.length > limit
      ? `<p class="score-toggle"><button type="button" class="btn-link" data-toggle>${expanded ? t('showLessLink') : t('showMoreLink')}</button></p>`
      : '';
    wrap.innerHTML = `
      <table class="score-table">
        <thead><tr>${header}</tr></thead>
        <tbody>${body}</tbody>
      </table>
      ${toggle}
    `;
    const toggleBtn = wrap.querySelector('[data-toggle]');
    if (toggleBtn) toggleBtn.addEventListener('click', () => { expanded = !expanded; renderInner(); });
  };
  renderInner();
  return wrap;
}

// The flagged-entries table needs a per-row dismiss button (delete the
// flag once its word/meaning has been fixed in the content pool), which
// renderLeaderboardTable's generic key/label columns don't support - so
// this is its own small renderer rather than bolting a one-off feature
// onto the shared one.
function renderFlaggedTable(rows) {
  if (!rows || !rows.length) {
    return el(`<div data-flagged-board><p class="score-note">${t('noFlaggedEntries')}</p></div>`);
  }
  let expanded = false;
  const limit = 10;
  const wrap = el(`<div data-flagged-board></div>`);
  const renderInner = () => {
    const visibleRows = expanded ? rows : rows.slice(0, limit);
    // Same untrusted-input escaping note as renderLeaderboardTable above -
    // word/meaning/flagged_by all come from player-submitted flags.
    const body = visibleRows.map((row) => `
      <tr>
        <td>${escapeHtml(row.word)}</td>
        <td>${escapeHtml(row.meaning)}</td>
        <td>${escapeHtml(row.source_label)}</td>
        <td>${escapeHtml(row.flagged_by ?? '')}</td>
        <td>${escapeHtml(row.flagged_at)}</td>
        <td><button type="button" class="btn-link" data-dismiss="${row.id}">${t('dismissFlagBtn')}</button></td>
      </tr>
    `).join('');
    const toggle = rows.length > limit
      ? `<p class="score-toggle"><button type="button" class="btn-link" data-toggle>${expanded ? t('showLessLink') : t('showMoreLink')}</button></p>`
      : '';
    wrap.innerHTML = `
      <table class="score-table">
        <thead><tr><th>${t('colWord')}</th><th>${t('colMeaning')}</th><th>${t('colSource')}</th><th>${t('colFlaggedBy')}</th><th>${t('colFlaggedAt')}</th><th></th></tr></thead>
        <tbody>${body}</tbody>
      </table>
      ${toggle}
    `;
    const toggleBtn = wrap.querySelector('[data-toggle]');
    if (toggleBtn) toggleBtn.addEventListener('click', () => { expanded = !expanded; renderInner(); });
    wrap.querySelectorAll('[data-dismiss]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        const id = Number(btn.getAttribute('data-dismiss'));
        const { ok } = await dismissFlaggedEntry(id);
        if (!ok) { btn.disabled = false; return; }
        const idx = rows.findIndex((r) => r.id === id);
        if (idx !== -1) rows.splice(idx, 1);
        if (!rows.length) { wrap.replaceWith(renderFlaggedTable(rows)); return; }
        renderInner();
      });
    });
  };
  renderInner();
  return wrap;
}

// ---------------------------------------------------------------------

boot();
