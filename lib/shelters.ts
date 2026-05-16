/*
 * SafeRoute Varjumine — shared demo constants.
 *
 * The shelter dataset itself now lives in src/data/officialShelters.ts and is
 * a hardcoded snapshot of the Päästeamet open-data feed. This file keeps the
 * other small static pieces:
 *
 *   - HARDCODED DEMO USER LOCATION (Tallinn city centre)
 *   - HARDCODED DEMO DANGER ZONE   (visual only)
 *   - HARDCODED DEMO ROUTE INSTRUCTIONS (same calm reminders shown for any route)
 *   - HARDCODED DEMO offline-map timestamp
 *
 * Re-export `OfficialShelter` as the canonical Shelter type used across the
 * app so that consumers don't have to know about two parallel shapes.
 */

import {
  officialShelters,
  type OfficialShelter,
} from '@/src/data/officialShelters';

// Canonical shelter type for the rest of the app.
export type Shelter = OfficialShelter;
export type ShelterType = OfficialShelter['type'];

// Default shelter list = the official Päästeamet snapshot.
// HARDCODED OFFICIAL SHELTER DATA SNAPSHOT (see src/data/officialShelters.ts).
export const SHELTERS: readonly Shelter[] = officialShelters;

// HARDCODED DEMO USER LOCATION (Tallinn city centre, near Viru Square).
export const DEMO_USER_LOCATION = {
  lat: 59.435,
  lng: 24.75,
} as const;

// HARDCODED DEMO DANGER ZONE — circular red overlay near the map centre.
// Purely visual in this version. NOT used for route calculation.
export const DEMO_DANGER_ZONE = {
  id: 'demo-danger-1',
  centerLat: 59.4362,
  centerLng: 24.7515,
  radiusMeters: 180,
  label: 'Active hazard area (demo)',
};

export type RoutePolyline = {
  shelterId: string;
  distanceMeters: number;
  walkingTimeMinutes: number;
  coordinates: [number, number][]; // [lng, lat]
};

// HARDCODED DEMO WALKING INSTRUCTIONS — same calm guidance shown for any route.
export const ROUTE_INSTRUCTIONS: string[] = [
  'Stay away from windows',
  'Move calmly',
  'Avoid open squares when possible',
  'Help children and elderly people',
  'Keep two walls between you and outside where possible',
  'Follow official instructions',
];

// HARDCODED DEMO offline-map timestamp (mock — no real tiles are downloaded).
export const DEMO_LAST_MAP_DOWNLOAD = '2026-05-12 09:14';

function toRadDeg(d: number): number {
  return (d * Math.PI) / 180;
}

/** Cheap haversine distance in metres. */
export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000;
  const dLat = toRadDeg(b.lat - a.lat);
  const dLng = toRadDeg(b.lng - a.lng);
  const lat1 = toRadDeg(a.lat);
  const lat2 = toRadDeg(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Find nearest N shelters by straight-line distance from origin. */
export function nearestByStraightLine<T extends Shelter>(
  origin: { lat: number; lng: number },
  shelters: readonly T[],
  count: number,
): T[] {
  return shelters
    .map((s) => ({ s, d: haversineMeters(origin, s) }))
    .toSorted((a, b) => a.d - b.d)
    .slice(0, count)
    .map((x) => x.s);
}
