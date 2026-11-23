// Private content-admin page - see admin.html. Not linked from the
// player-facing app anywhere; reachable only by URL. Gated by a password
// whose SHA-256 hash (not the plaintext) is checked client-side - see
// admin.html's <head> comment and README.md for why this is a deterrent,
// not real security, on a public static site.
import {
  isBackendConfigured, fetchFlaggedEntries, dismissFlaggedEntry,
  fetchContentOverrides, saveContentOverride, deleteContentOverride,
} from './supabase-client.js';

const PASSWORD_HASH = '84233637ad1371206efeda05dd851edcead9b5177f1d766b31b6e3ad71fda477';
const SESSION_KEY = 'namanidhi.adminUnlocked';
const LANGS = ['te', 'en', 'kn'];

const root = document.getElementById('admin-app');

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function renderGate() {
  const gate = el(`
    <div class="admin-gate">
      <h1>Content Admin</h1>
      <p>Enter the admin password to continue.</p>
      <input type="password" data-pw autocomplete="current-password" />
      <p class="error" data-error></p>
      <button type="button" class="btn btn-primary" data-unlock>Unlock</button>
    </div>
  `);
  const input = gate.querySelector('[data-pw]');
  const errorEl = gate.querySelector('[data-error]');
  const attempt = async () => {
    const hash = await sha256Hex(input.value);
    if (hash === PASSWORD_HASH) {
      sessionStorage.setItem(SESSION_KEY, '1');
      renderApp();
    } else {
      errorEl.textContent = 'Wrong password.';
      input.value = '';
      input.focus();
    }
  };
  gate.querySelector('[data-unlock]').addEventListener('click', attempt);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') attempt(); });
  root.innerHTML = '';
  root.appendChild(gate);
  input.focus();
}

async function renderApp() {
  if (!isBackendConfigured()) {
    root.innerHTML = '<h1>Content Admin</h1><p>Supabase isn’t configured - nothing to manage here.</p>';
    return;
  }
  root.innerHTML = '<h1>Content Admin</h1><p class="status-msg">Loading…</p>';

  let flagged = [];
  let overrides = [];

  async function reloadAll() {
    const [flaggedByLang, overridesByLang] = await Promise.all([
      Promise.all(LANGS.map((lang) => fetchFlaggedEntries(lang).then((rows) => (rows || []).map((r) => ({ ...r, language: lang }))))),
      Promise.all(LANGS.map((lang) => fetchContentOverrides(lang).then((rows) => (rows || []).map((r) => ({ ...r, language: lang }))))),
    ]);
    flagged = flaggedByLang.flat().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    overrides = overridesByLang.flat().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    render();
  }

  function render() {
    root.innerHTML = '';
    root.appendChild(el(`
      <div>
        <h1>Content Admin</h1>
        <p class="status-msg">Fix a flagged entry here and it’s live for every player immediately – no deploy needed.</p>
        <div class="admin-section">
          <h2>Flagged questions (${flagged.length})</h2>
          <div data-flagged-list></div>
        </div>
        <div class="admin-section">
          <h2>Active corrections (${overrides.length})</h2>
          <div data-overrides-list></div>
        </div>
      </div>
    `));
    renderFlaggedList();
    renderOverridesList();
  }

  function renderFlaggedList() {
    const container = root.querySelector('[data-flagged-list]');
    if (!flagged.length) {
      container.appendChild(el('<p class="score-note">Nothing flagged right now.</p>'));
      return;
    }
    const table = el(`
      <table class="score-table">
        <thead><tr><th>Lang</th><th>Word</th><th>Meaning</th><th>Source</th><th>Flagged by</th><th>When</th><th></th></tr></thead>
        <tbody></tbody>
      </table>
    `);
    const tbody = table.querySelector('tbody');
    flagged.forEach((row) => {
      const tr = el(`
        <tr>
          <td><span class="lang-chip">${escapeHtml(row.language)}</span></td>
          <td class="row-edit"><input type="text" value="${escapeHtml(row.word)}" data-word /></td>
          <td class="row-edit"><input type="text" value="${escapeHtml(row.meaning)}" data-meaning /></td>
          <td>${escapeHtml(row.source_mode)}</td>
          <td>${escapeHtml(row.flagged_by ?? '')}</td>
          <td>${escapeHtml(new Date(row.created_at).toLocaleString())}</td>
          <td class="row-actions">
            <button type="button" class="btn btn-secondary" data-save>Save fix</button>
            <button type="button" class="btn-link" data-dismiss>Dismiss</button>
          </td>
        </tr>
      `);
      tr.querySelector('[data-save]').addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        const wordVal = tr.querySelector('[data-word]').value.trim();
        const meaningVal = tr.querySelector('[data-meaning]').value.trim();
        if (!wordVal || !meaningVal) {
          alert('Word and meaning can’t be empty.');
          btn.disabled = false;
          return;
        }
        const { ok } = await saveContentOverride({
          language: row.language,
          source_mode: row.source_mode,
          word: row.word,
          corrected_word: wordVal,
          corrected_meaning: meaningVal,
        });
        if (!ok) { alert('Save failed – check the console.'); btn.disabled = false; return; }
        await dismissFlaggedEntry(row.id);
        await reloadAll();
      });
      tr.querySelector('[data-dismiss]').addEventListener('click', async (e) => {
        e.currentTarget.disabled = true;
        const { ok } = await dismissFlaggedEntry(row.id);
        if (!ok) { alert('Dismiss failed – check the console.'); e.currentTarget.disabled = false; return; }
        await reloadAll();
      });
      tbody.appendChild(tr);
    });
    container.appendChild(table);
  }

  function renderOverridesList() {
    const container = root.querySelector('[data-overrides-list]');
    if (!overrides.length) {
      container.appendChild(el('<p class="score-note">No active corrections yet.</p>'));
      return;
    }
    const table = el(`
      <table class="score-table">
        <thead><tr><th>Lang</th><th>Source</th><th>Original word</th><th>Corrected word</th><th>Corrected meaning</th><th></th></tr></thead>
        <tbody></tbody>
      </table>
    `);
    const tbody = table.querySelector('tbody');
    overrides.forEach((row) => {
      const tr = el(`
        <tr>
          <td><span class="lang-chip">${escapeHtml(row.language)}</span></td>
          <td>${escapeHtml(row.source_mode)}</td>
          <td>${escapeHtml(row.word)}</td>
          <td>${escapeHtml(row.corrected_word ?? '')}</td>
          <td>${escapeHtml(row.corrected_meaning ?? '')}</td>
          <td class="row-actions"><button type="button" class="btn-link" data-delete>Delete</button></td>
        </tr>
      `);
      tr.querySelector('[data-delete]').addEventListener('click', async (e) => {
        e.currentTarget.disabled = true;
        const { ok } = await deleteContentOverride(row.id);
        if (!ok) { alert('Delete failed – check the console.'); e.currentTarget.disabled = false; return; }
        await reloadAll();
      });
      tbody.appendChild(tr);
    });
    container.appendChild(table);
  }

  await reloadAll();
}

if (sessionStorage.getItem(SESSION_KEY) === '1') {
  renderApp();
} else {
  renderGate();
}
