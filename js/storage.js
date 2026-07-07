// Local-device state: player identity (name-only, no login) and a
// local fallback tally so the app still works fully offline / before a
// Supabase project is configured.

const PLAYER_NAME_KEY = 'namanidhi.playerName';
const PLAYER_ID_KEY = 'namanidhi.playerId';
const PUZZLE_LOG_KEY = 'namanidhi.puzzleLog';
const JAPAM_LOG_KEY = 'namanidhi.japamLog';

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

export function recordPuzzleProgressLocal(entry) {
  appendLog(PUZZLE_LOG_KEY, { ...entry, completed_at: new Date().toISOString() });
}

export function recordJapamLocal(entry) {
  appendLog(JAPAM_LOG_KEY, { ...entry, occurred_at: new Date().toISOString() });
}

export function getLocalPuzzleTotals() {
  const list = readLog(PUZZLE_LOG_KEY);
  return {
    entriesFound: list.reduce((sum, e) => sum + (e.entries_found || 0), 0),
    levelsCompleted: list.length,
  };
}

export function getLocalJapamTotals() {
  const list = readLog(JAPAM_LOG_KEY);
  const today = new Date().toDateString();
  return {
    total: list.reduce((sum, e) => sum + (e.count || 0), 0),
    today: list
      .filter((e) => new Date(e.occurred_at).toDateString() === today)
      .reduce((sum, e) => sum + (e.count || 0), 0),
  };
}
