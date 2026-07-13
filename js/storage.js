// Local-device state: player identity (name-only, no login) and a
// local fallback tally so the app still works fully offline / before a
// Supabase project is configured.
//
// Puzzle/Japam logs and draw queues are namespaced per language (see
// LANGUAGE_KEY) AND per player name, so a shared family device switching
// names via "మార్చు"/"Change" gives each person their own independent
// difficulty ramp, draw-queue cycling, and local scoreboard totals -
// without the per-player split, one person's play history would leak
// into whoever switches to a different name next, and a "fresh" second
// player would inherit the first player's experience level instead of
// starting at the easy end themselves. This is also the fallback used
// before a Supabase backend is configured (or while offline) - once
// configured, both languages sync to the shared scoreboard too (see
// syncsToBackend in app.js), each kept as its own per-language,
// per-player tally there as well (Supabase's is keyed by player_id, not
// name, so it was never subject to this device-sharing bug).

const PLAYER_NAME_KEY = 'namanidhi.playerName';
const PLAYER_ID_KEY = 'namanidhi.playerId';
const INTRO_SEEN_KEY = 'namanidhi.introSeen';
const LANGUAGE_KEY = 'namanidhi.language';
const DRAW_QUEUES_KEY = 'namanidhi.drawQueues';
const STOTRAM_DRAW_QUEUES_KEY = 'namanidhi.stotramDrawQueues';
const LEGACY_MIGRATED_KEY = 'namanidhi.legacyDataMigrated';

function playerScopedKey(baseKey, playerName) {
  return `${baseKey}.${playerName || '_default'}`;
}

function puzzleLogKey(lang, playerName) {
  const base = lang === 'te' ? 'namanidhi.puzzleLog' : `namanidhi.puzzleLog.${lang}`;
  return playerScopedKey(base, playerName);
}

function japamLogKey(lang, playerName) {
  const base = lang === 'te' ? 'namanidhi.japamLog' : `namanidhi.japamLog.${lang}`;
  return playerScopedKey(base, playerName);
}

// One-time migration for devices that had data saved before per-player
// scoping existed: copies each older, unscoped key's data onto whoever is
// the CURRENTLY active player name at the moment this runs (call once,
// early at boot) - never lazily on every read, since that would make
// every subsequently-added new name on the device also inherit the
// original player's history instead of starting its own clean record.
// Safe to call on every boot; does nothing once the flag is set.
export function migrateLegacyDataOnce() {
  if (localStorage.getItem(LEGACY_MIGRATED_KEY) === '1') return;
  const currentPlayer = localStorage.getItem(PLAYER_NAME_KEY);
  if (currentPlayer) {
    const legacyKeys = [
      'namanidhi.puzzleLog', 'namanidhi.puzzleLog.en',
      'namanidhi.japamLog', 'namanidhi.japamLog.en',
      DRAW_QUEUES_KEY, STOTRAM_DRAW_QUEUES_KEY,
    ];
    for (const legacyKey of legacyKeys) {
      const legacy = localStorage.getItem(legacyKey);
      const scoped = playerScopedKey(legacyKey, currentPlayer);
      if (legacy !== null && localStorage.getItem(scoped) === null) {
        localStorage.setItem(scoped, legacy);
      }
    }
  }
  localStorage.setItem(LEGACY_MIGRATED_KEY, '1');
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

// The per-difficulty "shuffle then cycle through every word before
// repeating" draw queues (see grid.js/app.js) used to live only in memory,
// so a word that had just been shown could resurface right after any page
// reload - closing the tab, the phone locking, etc. - which is normal,
// frequent behavior for casual daily play, not an edge case. Persisting
// them here makes the "no repeat until the tier fully cycles" guarantee
// hold across reloads too, not just within one continuous session.
function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || '{}');
  } catch {
    return {};
  }
}

export function getPersistedDrawQueues(playerName) {
  return readJson(playerScopedKey(DRAW_QUEUES_KEY, playerName));
}

export function setPersistedDrawQueues(queues, playerName) {
  localStorage.setItem(playerScopedKey(DRAW_QUEUES_KEY, playerName), JSON.stringify(queues));
}

export function getPersistedStotramDrawQueues(playerName) {
  return readJson(playerScopedKey(STOTRAM_DRAW_QUEUES_KEY, playerName));
}

export function setPersistedStotramDrawQueues(queues, playerName) {
  localStorage.setItem(playerScopedKey(STOTRAM_DRAW_QUEUES_KEY, playerName), JSON.stringify(queues));
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

export function recordPuzzleProgressLocal(entry, lang = 'te', playerName) {
  appendLog(puzzleLogKey(lang, playerName), { ...entry, completed_at: new Date().toISOString() });
}

export function recordJapamLocal(entry, lang = 'te', playerName) {
  appendLog(japamLogKey(lang, playerName), { ...entry, occurred_at: new Date().toISOString() });
}

export function getLocalPuzzleTotals(lang = 'te', playerName) {
  const list = readLog(puzzleLogKey(lang, playerName));
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

export function getLocalJapamTotals(lang = 'te', playerName) {
  const list = readLog(japamLogKey(lang, playerName));
  const today = new Date().toDateString();
  const total = list.reduce((sum, e) => sum + (e.count || 0), 0);
  const firstOccurredAt = list.reduce((min, e) => (!min || e.occurred_at < min ? e.occurred_at : min), null);
  return {
    total,
    today: list
      .filter((e) => new Date(e.occurred_at).toDateString() === today)
      .reduce((sum, e) => sum + (e.count || 0), 0),
    average: firstOccurredAt ? Math.round(total / daysElapsedInclusive(firstOccurredAt)) : 0,
  };
}
