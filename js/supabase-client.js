import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

let client = null;
let clientPromise = null;

export function isBackendConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

async function getClient() {
  if (!isBackendConfigured()) return null;
  if (client) return client;
  if (!clientPromise) {
    clientPromise = import('https://esm.sh/@supabase/supabase-js@2')
      .then(({ createClient }) => {
        client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        return client;
      })
      .catch((err) => {
        console.warn('Supabase client unavailable, staying local-only:', err);
        clientPromise = null; // allow a retry on the next call instead of failing forever
        return null;
      });
  }
  return clientPromise;
}

// Finds a player row by display name, creating one if needed. `knownPlayerId`
// is this device's already-saved player id (if any) - when the found row's id
// matches it, the name belongs to the device asking for it, so it's a normal
// resume rather than a conflict.
//
// Returns { id, status } where status is 'ok' (created or resumed),
// 'taken' (another player already owns this name), 'offline' (backend not
// reachable), or 'error' (unexpected failure - caller should stay local-only).
export async function ensurePlayer(name, knownPlayerId = null) {
  const sb = await getClient();
  if (!sb) return { id: null, status: 'offline' };
  try {
    const { data: existing } = await sb
      .from('players')
      .select('id')
      .eq('display_name', name)
      .maybeSingle();
    if (existing) {
      if (knownPlayerId && existing.id === knownPlayerId) {
        return { id: existing.id, status: 'ok' };
      }
      return { id: null, status: 'taken' };
    }

    const { data, error } = await sb
      .from('players')
      .insert({ display_name: name })
      .select('id')
      .single();
    if (error) {
      if (error.code === '23505') return { id: null, status: 'taken' }; // unique_violation: lost a race
      throw error;
    }
    return { id: data.id, status: 'ok' };
  } catch (err) {
    console.warn('ensurePlayer failed, staying local-only:', err);
    return { id: null, status: 'error' };
  }
}

export async function syncPuzzleProgress(playerId, entry) {
  const sb = await getClient();
  if (!sb || !playerId) return;
  const { error } = await sb.from('puzzle_progress').insert({ player_id: playerId, ...entry });
  if (error) console.warn('syncPuzzleProgress failed:', error);
}

export async function syncJapamLog(playerId, entry) {
  const sb = await getClient();
  if (!sb || !playerId) return;
  const { error } = await sb.from('japam_log').insert({ player_id: playerId, ...entry });
  if (error) console.warn('syncJapamLog failed:', error);
}

export async function fetchPuzzleLeaderboard() {
  const sb = await getClient();
  if (!sb) return null;
  const { data, error } = await sb
    .from('puzzle_leaderboard')
    .select('*')
    .order('total_entries_found', { ascending: false });
  if (error) {
    console.warn('fetchPuzzleLeaderboard failed:', error);
    return null;
  }
  return data;
}

export async function fetchJapamLeaderboard() {
  const sb = await getClient();
  if (!sb) return null;
  const { data, error } = await sb
    .from('japam_leaderboard')
    .select('*')
    .order('total_count', { ascending: false });
  if (error) {
    console.warn('fetchJapamLeaderboard failed:', error);
    return null;
  }
  return data;
}
