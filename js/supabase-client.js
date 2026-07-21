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
    // Pinned to an exact release rather than the "@2" tag - esm.sh would
    // otherwise be free to serve a different minor/patch build over time
    // without this repo ever changing, which is a supply-chain risk for
    // code that runs unaudited in every player's browser. Bump this
    // deliberately (and re-test) rather than letting it drift silently.
    clientPromise = import('https://esm.sh/@supabase/supabase-js@2.110.2')
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

// Finds a player row by display name, creating one if needed, and always
// resumes it - there's no login here (see schema.sql's RLS comment: a
// permissive, trust-based family/community tally, not authenticated data),
// so there is no way to actually verify "is this device's owner the same
// person who first used this name," and a family sharing one device
// between members (switching names back and forth) is the expected common
// case, not an edge case. Blocking a name as "already taken" used to lock
// a returning player out of their own name the moment any other name was
// used on the same device in between - resuming unconditionally fixes that
// while costing only the rarer, lower-stakes case of two unrelated people
// independently picking an identical display name.
//
// Returns { id, status, resumed } where status is 'ok' (created or
// resumed), 'offline' (backend not reachable), or 'error' (unexpected
// failure - caller should stay local-only). `resumed` is true when the
// name already had history - callers use that to flag "you're picking up
// an existing name" so a genuine name collision between two different
// people is at least noticeable, even though it isn't blocked.
export async function ensurePlayer(name) {
  const sb = await getClient();
  if (!sb) return { id: null, status: 'offline' };
  try {
    const { data: existing } = await sb
      .from('players')
      .select('id')
      .eq('display_name', name)
      .maybeSingle();
    if (existing) return { id: existing.id, status: 'ok', resumed: true };

    const { data, error } = await sb
      .from('players')
      .insert({ display_name: name })
      .select('id')
      .single();
    if (error) {
      if (error.code === '23505') {
        // Race: someone else inserted this exact name between our SELECT
        // and INSERT. Just resume it, same as if we'd looked it up a
        // moment later.
        const { data: raced } = await sb.from('players').select('id').eq('display_name', name).maybeSingle();
        if (raced) return { id: raced.id, status: 'ok', resumed: true };
      }
      throw error;
    }
    return { id: data.id, status: 'ok', resumed: false };
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

export async function fetchPuzzleLeaderboard(lang) {
  const sb = await getClient();
  if (!sb) return null;
  const { data, error } = await sb
    .from('puzzle_leaderboard')
    .select('*')
    .eq('language', lang)
    .order('total_score', { ascending: false });
  if (error) {
    console.warn('fetchPuzzleLeaderboard failed:', error);
    return null;
  }
  return data;
}

// One-tap "this looks off" report from a puzzle's hints panel - see
// js/app.js's flag button. `entry` is { word, meaning, language,
// difficulty, source_mode, flagged_by }; returns { ok } rather than
// throwing so a flag tap never disrupts the puzzle itself.
export async function flagEntry(entry) {
  const sb = await getClient();
  if (!sb) return { ok: false };
  const { error } = await sb.from('flagged_entries').insert(entry);
  if (error) {
    console.warn('flagEntry failed:', error);
    return { ok: false };
  }
  return { ok: true };
}

export async function fetchFlaggedEntries(lang) {
  const sb = await getClient();
  if (!sb) return null;
  const { data, error } = await sb
    .from('flagged_entries')
    .select('*')
    .eq('language', lang)
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('fetchFlaggedEntries failed:', error);
    return null;
  }
  return data;
}

// Removes a flag once its word/meaning has been fixed in the content pool
// - see supabase/add-flagged-entries-delete-policy.sql for the RLS policy
// this relies on. Returns { ok } rather than throwing, same as flagEntry.
export async function dismissFlaggedEntry(id) {
  const sb = await getClient();
  if (!sb) return { ok: false };
  const { error } = await sb.from('flagged_entries').delete().eq('id', id);
  if (error) {
    console.warn('dismissFlaggedEntry failed:', error);
    return { ok: false };
  }
  return { ok: true };
}

export async function fetchJapamLeaderboard(lang) {
  const sb = await getClient();
  if (!sb) return null;
  const { data, error } = await sb
    .from('japam_leaderboard')
    .select('*')
    .eq('language', lang)
    .order('total_count', { ascending: false });
  if (error) {
    console.warn('fetchJapamLeaderboard failed:', error);
    return null;
  }
  return data;
}
