// Personal, on-device voice recordings for Likhita Japam names - captured
// via the browser's own microphone and MediaRecorder, stored as Blobs in
// IndexedDB (localStorage can't hold binary audio well), and never synced
// anywhere. Keyed by "<lang>:<word>" so each name/language pair keeps its
// own independent recording.

const DB_NAME = 'namanidhi-recordings';
const STORE_NAME = 'recordings';
const DB_VERSION = 1;

let dbPromise = null;

function openDb() {
  if (!('indexedDB' in window)) return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
  return dbPromise;
}

function recordingKey(lang, word) {
  return `${lang}:${word}`;
}

export async function saveRecording(lang, word, blob) {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(blob, recordingKey(lang, word));
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
}

export async function getRecording(lang, word) {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(recordingKey(lang, word));
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });
}

export async function deleteRecording(lang, word) {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(recordingKey(lang, word));
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
}
