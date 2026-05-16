/*
 * SafeRoute Varjumine — routing service.
 *
 * DIRECT WALKING ROUTING (crow-flies / off-road).
 * ------------------------------------------------
 * In a crisis you do NOT want a car-style route that drags you a kilometre
 * around the block to obey one-way streets. People on foot cut across parks,
 * courtyards, pedestrian zones, and squares. So this build computes the
 * route as a great-circle straight line from the user to the shelter,
 * sampled into intermediate points so the polyline curves correctly on the
 * map at any zoom level.
 *
 * Key properties:
 *   - No street-network constraint. The path goes in ANY direction, over
 *     streets, across parks, through pedestrian zones.
 *   - Distance = haversine (great-circle) metres between endpoints.
 *   - Walking time = distance / 1.35 m/s (calm walking pace).
 *   - Steps = compass-bearing directions ("Walk northeast ~320 m") plus a
 *     final arrive line. No road names — there's no road network involved.
 *   - No network calls. Fully offline. Identical on every device.
 *
 * NEAREST-SHELTER STRATEGY:
 *   With 200+ shelters in the Päästeamet snapshot we still pre-filter by
 *   haversine top-N. Because the route is itself the haversine line, the
 *   nearest by straight-line IS the nearest by route — no second pass
 *   needed, no network round-trip.
 *
 * The legacy offline-graph Dijkstra path is kept exported for backwards
 * compatibility but is never invoked by default — `getRouteToShelter` now
 * always returns a direct walking route.
 */

import {
  DEMO_USER_LOCATION,
  haversineMeters,
  nearestByStraightLine,
  SHELTERS,
  type RoutePolyline,
  type Shelter,
} from './shelters';
import {
  anchorForShelter,
  dijkstra,
  pathToGeoJsonCoords,
} from './walkingGraph';

export type RouteSource = 'direct-walk' | 'offline-graph' | 'fallback-line';

export type RouteResult = {
  shelterId: string;
  distanceMeters: number;
  walkingTimeMinutes: number;
  coordinates: [number, number][]; // GeoJSON [lng, lat]
  source: RouteSource;
  sourceLabel: string;
  steps?: string[];
};

export type LatLng = { lat: number; lng: number };

// Sample the great-circle line every ~25 metres so the rendered polyline
// curves smoothly at every zoom level without being chunky at city scale.
const SAMPLE_INTERVAL_METERS = 25;
const MIN_SAMPLES = 2;
const MAX_SAMPLES = 64;

function toRad(d: number): number {
  return (d * Math.PI) / 180;
}
function toDeg(r: number): number {
  return (r * 180) / Math.PI;
}

function walkingMinutes(meters: number): number {
  // 1.35 m/s ≈ 4.86 km/h calm walking pace.
  return Math.max(1, Math.round(meters / 1.35 / 60));
}

/**
 * Compass bearing in degrees from `a` to `b` (0 = north, 90 = east).
 */
function bearingDegrees(a: LatLng, b: LatLng): number {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const bearing = (toDeg(Math.atan2(y, x)) + 360) % 360;
  return bearing;
}

function bearingToCompass(bearing: number): string {
  const dirs = [
    'north',
    'northeast',
    'east',
    'southeast',
    'south',
    'southwest',
    'west',
    'northwest',
  ];
  const idx = Math.round(bearing / 45) % 8;
  return dirs[idx];
}

/**
 * Interpolate a point on the great-circle line from `a` to `b` at fraction
 * `f` ∈ [0, 1]. Standard slerp on the unit sphere.
 */
function interpolateGreatCircle(a: LatLng, b: LatLng, f: number): [number, number] {
  // f=0 → a, f=1 → b
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const lng1 = toRad(a.lng);
  const lng2 = toRad(b.lng);

  // Angular distance.
  const sinHalfDLat = Math.sin((lat2 - lat1) / 2);
  const sinHalfDLng = Math.sin((lng2 - lng1) / 2);
  const aHav =
    sinHalfDLat * sinHalfDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinHalfDLng * sinHalfDLng;
  const delta = 2 * Math.atan2(Math.sqrt(aHav), Math.sqrt(1 - aHav));

  if (delta < 1e-9) return [a.lng, a.lat];

  const A = Math.sin((1 - f) * delta) / Math.sin(delta);
  const B = Math.sin(f * delta) / Math.sin(delta);

  const x = A * Math.cos(lat1) * Math.cos(lng1) + B * Math.cos(lat2) * Math.cos(lng2);
  const y = A * Math.cos(lat1) * Math.sin(lng1) + B * Math.cos(lat2) * Math.sin(lng2);
  const z = A * Math.sin(lat1) + B * Math.sin(lat2);

  const lat = Math.atan2(z, Math.sqrt(x * x + y * y));
  const lng = Math.atan2(y, x);
  return [toDeg(lng), toDeg(lat)];
}

function sampleDirectPath(start: LatLng, end: LatLng, distanceMeters: number): [number, number][] {
  const samples = Math.max(
    MIN_SAMPLES,
    Math.min(MAX_SAMPLES, Math.ceil(distanceMeters / SAMPLE_INTERVAL_METERS) + 1),
  );
  const coords: [number, number][] = [];
  for (let i = 0; i < samples; i++) {
    const f = i / (samples - 1);
    coords.push(interpolateGreatCircle(start, end, f));
  }
  // Force exact endpoints to avoid tiny floating-point drift.
  coords[0] = [start.lng, start.lat];
  coords[coords.length - 1] = [end.lng, end.lat];
  return coords;
}

function directWalkSteps(start: LatLng, end: LatLng, distanceMeters: number): string[] {
  const bearing = bearingDegrees(start, end);
  const compass = bearingToCompass(bearing);
  const distLabel =
    distanceMeters >= 1000
      ? `${(distanceMeters / 1000).toFixed(1)} km`
      : `${Math.round(distanceMeters)} m`;
  return [
    `Start walking ${compass} (bearing ${Math.round(bearing)}°)`,
    `Head in a direct line — cut across streets, parks, and squares as needed`,
    `Continue ${compass} for about ${distLabel}`,
    `Arrive at the shelter`,
  ];
}

/**
 * Direct walking route from `start` to `shelter`. No road snapping, no
 * network call. The polyline is the great-circle line between the two
 * points sampled into ~25 m segments.
 */
export function getDirectWalkRoute(start: LatLng, shelter: Shelter): RouteResult {
  const end: LatLng = { lat: shelter.lat, lng: shelter.lng };
  const distance = Math.round(haversineMeters(start, end));
  const coords = sampleDirectPath(start, end, distance);
  return {
    shelterId: shelter.id,
    distanceMeters: distance,
    walkingTimeMinutes: walkingMinutes(distance),
    coordinates: coords,
    source: 'direct-walk',
    sourceLabel: 'Direct walking route · go any direction, over streets',
    steps: directWalkSteps(start, end, distance),
  };
}

/**
 * Legacy offline-graph route (Dijkstra over the hardcoded lattice). Kept
 * exported for backwards compatibility but no longer invoked by default.
 * Returns null for official-dataset shelters, which is fine — the direct
 * walking route covers them.
 */
export function fallbackLocalGraphRoute(start: LatLng, shelter: Shelter): RouteResult | null {
  const endId = anchorForShelter(shelter);
  if (!endId) return null;
  const result = dijkstra('u', endId);
  if (!result) return null;
  let coords = pathToGeoJsonCoords(result.path);
  const first = coords[0];
  if (
    first &&
    (Math.abs(first[1] - start.lat) > 1e-5 || Math.abs(first[0] - start.lng) > 1e-5)
  ) {
    coords = [[start.lng, start.lat], ...coords];
  }
  const last = coords[coords.length - 1];
  if (
    last &&
    (Math.abs(last[1] - shelter.lat) > 1e-5 || Math.abs(last[0] - shelter.lng) > 1e-5)
  ) {
    coords = [...coords, [shelter.lng, shelter.lat]];
  }
  return {
    shelterId: shelter.id,
    distanceMeters: result.distanceMeters,
    walkingTimeMinutes: walkingMinutes(result.distanceMeters),
    coordinates: coords,
    source: 'offline-graph',
    sourceLabel: 'Offline demo graph route',
  };
}

/**
 * Main entry point.
 *
 * The `options.allowLive` flag is accepted for backwards compatibility with
 * existing call sites in the store but has no effect — there is no remote
 * routing tier any more. Every result is a deterministic direct walking
 * route.
 */
export async function getRouteToShelter(
  start: LatLng,
  shelter: Shelter,
  _options?: { allowLive?: boolean },
): Promise<RouteResult> {
  return getDirectWalkRoute(start, shelter);
}

/** Fetch routes to all of a (small!) set of shelters. */
export async function getRoutesToAllShelters(
  start: LatLng,
  shelters: readonly Shelter[] = SHELTERS,
  _options?: { allowLive?: boolean },
): Promise<RouteResult[]> {
  return shelters.map((s) => getDirectWalkRoute(start, s));
}

/**
 * Find the nearest shelter by walking distance.
 *
 * Because the route IS the great-circle line between the two points, the
 * straight-line nearest shelter is also the nearest by route. No second
 * pass needed.
 */
export async function findNearestByRouteDistance(
  start: LatLng,
  shelters: readonly Shelter[] = SHELTERS,
  _options?: { allowLive?: boolean; candidateCount?: number },
): Promise<{ shelter: Shelter; route: RouteResult }> {
  if (shelters.length === 0) {
    throw new Error('No shelters available.');
  }
  const [winner] = nearestByStraightLine(start, shelters, 1);
  const route = getDirectWalkRoute(start, winner);
  return { shelter: winner, route };
}

/** Legacy adapter — kept for any external consumer. */
export function routeResultToPolyline(r: RouteResult): RoutePolyline {
  return {
    shelterId: r.shelterId,
    distanceMeters: r.distanceMeters,
    walkingTimeMinutes: r.walkingTimeMinutes,
    coordinates: r.coordinates,
  };
}

/** Default start position: hardcoded demo (overridden by device geolocation in UI). */
export function getDemoStart(): LatLng {
  // HARDCODED DEMO USER LOCATION - used only when browser geolocation is unavailable.
  return { lat: DEMO_USER_LOCATION.lat, lng: DEMO_USER_LOCATION.lng };
}
