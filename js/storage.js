// Local-device state: player identity (name-only, no login) and a
// local fallback tally so the app still works fully offline / before a
// Supabase project is configured.
//
// Puzzle/Japam logs are namespaced per language (see LANGUAGE_KEY) so
// switching languages can't mix or lose either language's local tally.
// This is also the fallback used before a Supabase backend is configured
// (or while offline) - once configured, both languages sync to the
// shared scoreboard too (see syncsToBackend in app.js), each kept as its
// own per-language tally there as well.

const PLAYER_NAME_KEY = 'namanidhi.playerName';
const PLAYER_ID_KEY = 'namanidhi.playerId';
const INTRO_SEEN_KEY = 'namanidhi.introSeen';
const LANGUAGE_KEY = 'namanidhi.language';

function puzzleLogKey(lang) {
  return lang === 'te' ? 'namanidhi.puzzleLog' : `namanidhi.puzzleLog.${lang}`;
}

function japamLogKey(lang) {
  return lang === 'te' ? 'namanidhi.japamLog' : `namanidhi.japamLog.${lang}`;
}

export function hasSeenIntro() {
  return localStorage.getItem(INTRO_SEEN_KEY) === '1';
}

export function markIntroSeen() {
  localStorage.setItem(INTRO_SEEN_KEY, '1');
}

export function getLanguage() {
  return localStorage.getItem(LANGUAGE_KEY);
}

export function setLanguage(lang) {
  localStorage.setItem(LANGUAGE_KEY, lang);
}

export function getPlayerName() {
  return localStorage.getItem(PLAYER_NAME_KEY);
}

export function setPlayerName(name) {
  localStorage.setItem(PLAYER_NAME_KEY, name.trim());
}

export function getPlayerId() {
  return localStorage.getItem(PLAYER_ID_KEY);
}

export function setPlayerId(id) {
  if (id) localStorage.setItem(PLAYER_ID_KEY, id);
}

function readLog(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
}

function appendLog(key, entry) {
  const list = readLog(key);
  list.push(entry);
  localStorage.setItem(key, JSON.stringify(list));
}

export function recordPuzzleProgressLocal(entry, lang = 'te') {
  appendLog(puzzleLogKey(lang), { ...entry, completed_at: new Date().toISOString() });
}

export function recordJapamLocal(entry, lang = 'te') {
  appendLog(japamLogKey(lang), { ...entry, occurred_at: new Date().toISOString() });
}

export function getLocalPuzzleTotals(lang = 'te') {
  const list = readLog(puzzleLogKey(lang));
  return {
    entriesFound: list.reduce((sum, e) => sum + (e.entries_found || 0), 0),
    pearls: list.reduce((sum, e) => sum + (e.pearls_found || 0), 0),
    gems: list.reduce((sum, e) => sum + (e.gems_found || 0), 0),
    diamonds: list.reduce((sum, e) => sum + (e.diamonds_found || 0), 0),
    puzzlesCompleted: list.length,
  };
}

// Counts calendar days from `dateStr` through today, inclusive of both
// ends - a first japam logged earlier today counts as 1 day of practice,
// not 0, so a same-day average shows the day's real count rather than
// being undefined or infinite.
export function daysElapsedInclusive(dateStr) {
  const start = new Date(dateStr);
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const today = new Date();
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((todayDay - startDay) / 86400000) + 1;
}

export function getLocalJapamTotals(lang = 'te') {
  const list = readLog(japamLogKey(lang));
  const today = new Date().toDateString();
  const total = list.reduce((sum, e) => sum + (e.count || 0), 0);
  const firstOccurredAt = list.reduce((min, e) => (!min || e.occurred_at < min ? e.occurred_at : min), null);
  return {
    total,
    today: list
      .filter((e) => new Date(e.occurred_at).toDateString() === today)
      .reduce((sum, e) => sum + (e.count || 0), 0),
    average: firstOccurredAt ? (total / daysElapsedInclusive(firstOccurredAt)).toFixed(1) : '0.0',
  };
}
