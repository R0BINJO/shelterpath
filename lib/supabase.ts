/*
 * SafeRoute Varjumine — Supabase client.
 *
 * COMMUNITY SHELTERS are a separate user-contributed dataset:
 *   - Account creation, sign-in, sign-out, profile display name → Supabase auth
 *     (online).
 *   - The community_shelters table is publicly readable; only authenticated
 *     users can insert rows (and only as themselves), only the submitter can
 *     update/delete their own rows. RLS enforces all of this.
 *
 * Community shelter records, once fetched, are cached locally in AsyncStorage
 * (see lib/communityShelterStore.ts) so the markers remain visible offline —
 * matching the brief's rule: "Make all the account stuff happen online, but
 * all the public shelters added by the people offline."
 *
 * COMMUNITY SHELTERS ARE UNVERIFIED USER-SUBMITTED LOCATIONS — they are NOT
 * official Päästeamet SA3 shelters and are never mixed into the
 * "Find nearest shelter" routing pipeline.
 */

import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

if (!supabaseConfigured) {
  // The auth UI surfaces a friendlier message; this is for the developer log.
  // eslint-disable-next-line no-console
  console.warn(
    '[SafeRoute] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY missing. ' +
      'Auth + community shelter sync will fail until they are set.',
  );
}

// `createClient` throws synchronously when either argument is empty, which
// crashes the whole app at import time. Fall back to harmless placeholder
// strings so the rest of the app can boot; every real network call will still
// fail (and the auth UI shows a configuration banner) until the env vars are
// provided.
export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY || 'placeholder-anon-key',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: supabaseConfigured,
      persistSession: supabaseConfigured,
      detectSessionInUrl: false,
    },
  },
);

export type CommunityShelterRow = {
  id: string;
  submitted_by: string;
  name: string;
  shelter_type: CommunityShelterType;
  notes: string | null;
  capacity_estimate: number | null;
  address: string | null;
  lat: number;
  lng: number;
  created_at: string;
  updated_at: string;
};

export type CommunityShelterType =
  | 'basement'
  | 'underground_parking'
  | 'metro_tunnel'
  | 'reinforced_building'
  | 'cellar'
  | 'tunnel'
  | 'other';

export type ProfileRow = {
  id: string;
  display_name: string;
  created_at: string;
};
