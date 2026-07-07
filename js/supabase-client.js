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

// Finds a player row by display name, creating one if needed. Returns the
// player id, or null if the backend isn't configured / reachable.
export async function ensurePlayer(name) {
  const sb = await getClient();
  if (!sb) return null;
  try {
    const { data: existing } = await sb
      .from('players')
      .select('id')
      .eq('display_name', name)
      .maybeSingle();
    if (existing) return existing.id;

    const { data, error } = await sb
      .from('players')
      .insert({ display_name: name })
      .select('id')
      .single();
    if (error) throw error;
    return data.id;
  } catch (err) {
    console.warn('ensurePlayer failed, staying local-only:', err);
    return null;
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
