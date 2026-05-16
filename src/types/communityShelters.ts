/*
 * SafeRoute Varjumine — COMMUNITY SHELTER types.
 *
 * COMMUNITY SHELTERS are user-submitted shelter candidates. They are stored
 * in Supabase online and CACHED locally to AsyncStorage so the markers stay
 * visible offline once they have been fetched at least once.
 *
 * COMMUNITY SHELTERS ARE UNVERIFIED. They are NOT official Päästeamet SA3
 * shelters. They are NEVER used as routing candidates in
 * "Find nearest shelter". Users can still navigate to one explicitly by
 * tapping the marker.
 */

import type { CommunityShelterType } from '@/lib/supabase';

export type { CommunityShelterType };

export type CommunityShelter = {
  id: string;
  submittedBy: string;
  submittedByDisplayName: string | null;
  name: string;
  shelterType: CommunityShelterType;
  notes: string | null;
  capacityEstimate: number | null;
  address: string | null;
  lat: number;
  lng: number;
  createdAt: string;
  updatedAt: string;
};

export const COMMUNITY_SHELTER_TYPE_META: Record<
  CommunityShelterType,
  { label: string; color: string; shortLabel: string }
> = {
  basement: { label: 'Basement', shortLabel: 'Basement', color: '#f59e0b' },
  underground_parking: {
    label: 'Underground parking',
    shortLabel: 'Parking',
    color: '#f59e0b',
  },
  metro_tunnel: { label: 'Metro / tunnel', shortLabel: 'Metro', color: '#f59e0b' },
  reinforced_building: {
    label: 'Reinforced building',
    shortLabel: 'Reinforced',
    color: '#f59e0b',
  },
  cellar: { label: 'Cellar', shortLabel: 'Cellar', color: '#f59e0b' },
  tunnel: { label: 'Tunnel', shortLabel: 'Tunnel', color: '#f59e0b' },
  other: { label: 'Other', shortLabel: 'Other', color: '#f59e0b' },
};

export const COMMUNITY_SHELTER_TYPES: CommunityShelterType[] = [
  'basement',
  'underground_parking',
  'cellar',
  'reinforced_building',
  'metro_tunnel',
  'tunnel',
  'other',
];

/** Safe getter — returns the `other` entry when an unknown type slips through. */
export function getCommunityShelterMeta(type: string | undefined | null) {
  if (
    type &&
    Object.prototype.hasOwnProperty.call(COMMUNITY_SHELTER_TYPE_META, type)
  ) {
    return COMMUNITY_SHELTER_TYPE_META[type as CommunityShelterType];
  }
  return COMMUNITY_SHELTER_TYPE_META.other;
}
