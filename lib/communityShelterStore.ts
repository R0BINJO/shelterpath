/*
 * SafeRoute Varjumine — COMMUNITY SHELTER store + offline cache.
 *
 * Account-related actions are online (Supabase auth — see lib/authStore.ts).
 * The shelter dataset is fetched from Supabase when online, then cached
 * locally to AsyncStorage so the markers remain available offline.
 *
 * Local cache key: saferoute.communityShelters.v1
 *
 * COMMUNITY SHELTERS ARE UNVERIFIED USER SUBMISSIONS. They are stored online
 * via Supabase row-level security (public read, authed self-insert/update/delete).
 * They are NEVER mixed into Find-Nearest-Shelter routing — Päästeamet SA3
 * shelters remain the only routing candidates.
 *
 * SHELTER DATA WORKS OFFLINE AFTER THE FIRST SUCCESSFUL FETCH.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { supabase, type CommunityShelterRow, type CommunityShelterType } from './supabase';
import type { CommunityShelter } from '@/src/types/communityShelters';

const CACHE_KEY = 'saferoute.communityShelters.v1';
const META_KEY = 'saferoute.communityShelters.meta.v1';

// Build marker — bump this when the share-auth code path changes so stale
// bundles are easy to spot in the dev diagnostics panel.
export const COMMUNITY_SHELTER_BUILD_ID = 'shelter-share-auth-fix-v1';

// ── Dev diagnostics ────────────────────────────────────────────────────────
// Logged only in development. NEVER logs the JWT access_token, refresh_token,
// or any user PII. The user id is logged because RLS errors are usually
// caused by the wrong / missing user id and you can't debug without it.
function logDiag(event: string, payload?: unknown) {
  if (!__DEV__) return;
  // eslint-disable-next-line no-console
  console.log(`[community-shelter:${COMMUNITY_SHELTER_BUILD_ID}] ${event}`, payload ?? '');
}

function getProjectUrl(): string {
  const raw = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  // Project ref only — never log keys.
  return raw.replace(/^https?:\/\//, '').split('.')[0] || 'unknown';
}

type SupabaseInsertError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
} | null;

function mapSupabaseInsertError(err: SupabaseInsertError): string {
  if (!err) return 'Could not submit shelter.';
  const code = err.code ?? '';
  const msg = (err.message ?? '').toLowerCase();
  if (code === 'PGRST205' || msg.includes('schema cache')) {
    return 'Database schema cache error. Try refreshing the app.';
  }
  if (code === '42501' || msg.includes('row-level security')) {
    return 'You need an authenticated session before sharing.';
  }
  if (msg.includes('jwt') || msg.includes('expired') || msg.includes('invalid token')) {
    return 'Your sign-in session expired. Sign in again to share a shelter.';
  }
  if (msg.includes('network') || msg.includes('failed to fetch')) {
    return 'No internet. Sharing a shelter needs a connection.';
  }
  return err.message ?? 'Could not submit shelter.';
}

type CachedMeta = {
  lastFetchedAt: string | null;
};

type SubmitInput = {
  name: string;
  shelterType: CommunityShelterType;
  notes: string | null;
  capacityEstimate: number | null;
  address: string | null;
  lat: number;
  lng: number;
};

type SyncStatus = 'idle' | 'loading' | 'ready' | 'error';

type CommunityState = {
  shelters: CommunityShelter[];
  loaded: boolean;
  syncStatus: SyncStatus;
  syncError: string | null;
  lastFetchedAt: string | null;
  selectedId: string | null;
  addSheetOpen: boolean;
  panelOpen: boolean;

  loadFromCache: () => Promise<void>;
  refreshFromServer: () => Promise<void>;
  submit: (input: SubmitInput) => Promise<CommunityShelter>;
  remove: (id: string) => Promise<void>;
  select: (id: string | null) => void;
  setAddSheetOpen: (open: boolean) => void;
  setPanelOpen: (open: boolean) => void;
};

function rowToShelter(
  row: CommunityShelterRow,
  displayNameById: Map<string, string>,
): CommunityShelter {
  return {
    id: row.id,
    submittedBy: row.submitted_by,
    submittedByDisplayName: displayNameById.get(row.submitted_by) ?? null,
    name: row.name,
    shelterType: row.shelter_type,
    notes: row.notes,
    capacityEstimate: row.capacity_estimate,
    address: row.address,
    lat: row.lat,
    lng: row.lng,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function readCache(): Promise<CommunityShelter[]> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isCommunityShelter);
  } catch {
    return [];
  }
}

async function writeCache(rows: CommunityShelter[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(rows));
  } catch {
    // ignore — cache is a nice-to-have
  }
}

async function readMeta(): Promise<CachedMeta> {
  try {
    const raw = await AsyncStorage.getItem(META_KEY);
    if (!raw) return { lastFetchedAt: null };
    const parsed = JSON.parse(raw) as CachedMeta;
    return { lastFetchedAt: parsed.lastFetchedAt ?? null };
  } catch {
    return { lastFetchedAt: null };
  }
}

async function writeMeta(meta: CachedMeta): Promise<void> {
  try {
    await AsyncStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    // ignore
  }
}

function isCommunityShelter(v: unknown): v is CommunityShelter {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.name === 'string' &&
    typeof o.lat === 'number' &&
    typeof o.lng === 'number' &&
    typeof o.shelterType === 'string'
  );
}

export const useCommunityShelterStore = create<CommunityState>((set, get) => ({
  shelters: [],
  loaded: false,
  syncStatus: 'idle',
  syncError: null,
  lastFetchedAt: null,
  selectedId: null,
  addSheetOpen: false,
  panelOpen: false,

  loadFromCache: async () => {
    if (get().loaded) return;
    const [cached, meta] = await Promise.all([readCache(), readMeta()]);
    set({ shelters: cached, loaded: true, lastFetchedAt: meta.lastFetchedAt });
  },

  refreshFromServer: async () => {
    set({ syncStatus: 'loading', syncError: null });
    try {
      const { data, error } = await supabase
        .from('community_shelters')
        .select(
          'id, submitted_by, name, shelter_type, notes, capacity_estimate, address, lat, lng, created_at, updated_at',
        )
        .order('updated_at', { ascending: false });
      if (error) throw error;

      const rows = (data ?? []) as CommunityShelterRow[];

      // Fetch display names in a single batch.
      const submitterIds = Array.from(new Set(rows.map((r) => r.submitted_by)));
      const displayNameById = new Map<string, string>();
      if (submitterIds.length > 0) {
        const { data: profileRows } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', submitterIds);
        for (const p of profileRows ?? []) {
          displayNameById.set(p.id as string, p.display_name as string);
        }
      }

      const shelters = rows.map((r) => rowToShelter(r, displayNameById));
      const now = new Date().toISOString();
      await Promise.all([writeCache(shelters), writeMeta({ lastFetchedAt: now })]);
      set({
        shelters,
        syncStatus: 'ready',
        syncError: null,
        lastFetchedAt: now,
        loaded: true,
      });
    } catch (e) {
      // Offline / network: keep whatever cache we already have. The UI shows
      // the cached count plus "last synced …".
      set({
        syncStatus: 'error',
        syncError: e instanceof Error ? e.message : 'Sync failed',
      });
    }
  },

  submit: async (input) => {
    // ── Session guard ──────────────────────────────────────────────────────
    // The Supabase test confirmed an authenticated INSERT succeeds, while
    // anonymous INSERT fails with RLS (42501). Make absolutely sure we have a
    // live access token + user id BEFORE attempting the insert, so we can
    // surface a precise error instead of the misleading "schema cache" one.
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      logDiag('session_error', sessionError.message);
      throw new Error('Could not read your sign-in session. Try signing out and back in.');
    }
    const session = sessionData.session;
    if (!session || !session.user?.id || !session.access_token) {
      logDiag('no_session', 'submit called without an authenticated session');
      throw new Error('Sign in is required before sharing a shelter.');
    }

    logDiag('insert_attempt', {
      projectUrl: getProjectUrl(),
      hasSession: true,
      userId: session.user.id,
      table: 'community_shelters',
    });

    const { data, error } = await supabase
      .from('community_shelters')
      .insert({
        // RLS policy: auth.uid() = submitted_by. The id MUST come from the
        // live session, never from auth.getUser() (which can return null
        // during cold start) and never from local storage.
        submitted_by: session.user.id,
        name: input.name,
        shelter_type: input.shelterType,
        notes: input.notes,
        capacity_estimate: input.capacityEstimate,
        address: input.address,
        lat: input.lat,
        lng: input.lng,
      })
      .select(
        'id, submitted_by, name, shelter_type, notes, capacity_estimate, address, lat, lng, created_at, updated_at',
      )
      .single<CommunityShelterRow>();
    if (error || !data) {
      logDiag('insert_error', {
        code: error?.code ?? null,
        message: error?.message ?? null,
        details: error?.details ?? null,
      });
      throw new Error(mapSupabaseInsertError(error));
    }

    // Pull the submitter's display name for the local cache row.
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', data.submitted_by)
      .maybeSingle<{ display_name: string }>();
    const displayNameById = new Map<string, string>();
    if (profile?.display_name) displayNameById.set(data.submitted_by, profile.display_name);

    const shelter = rowToShelter(data, displayNameById);
    const next = [shelter, ...get().shelters.filter((s) => s.id !== shelter.id)];
    await writeCache(next);
    set({ shelters: next, addSheetOpen: false });
    return shelter;
  },

  remove: async (id) => {
    const { error } = await supabase.from('community_shelters').delete().eq('id', id);
    if (error) throw new Error(error.message);
    const next = get().shelters.filter((s) => s.id !== id);
    await writeCache(next);
    set((s) => ({
      shelters: next,
      selectedId: s.selectedId === id ? null : s.selectedId,
    }));
  },

  select: (id) => set({ selectedId: id }),
  setAddSheetOpen: (open) => set({ addSheetOpen: open }),
  setPanelOpen: (open) => set({ panelOpen: open }),
}));
