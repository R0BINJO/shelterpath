/*
 * SafeRoute Varjumine — routing service.
 *
 * STREET-FOLLOWING WALKING ROUTING.
 * ------------------------------------------------
 * Routes are computed against a real walking street network so the polyline
 * follows roads, footways, paths, and pedestrian zones — it does NOT cut
 * across buildings, private land, or water.
 *
 * Tiered strategy:
 *   1. OSRM public demo server, foot profile
 *        https://routing.openstreetmap.de/routed-foot/route/v1/foot/...
 *      Returns a real OSM-pedestrian-network polyline with turn-by-turn steps.
 *      Backed by global OpenStreetMap data, identical coverage for Estonia.
 *   2. OSRM walking profile on router.project-osrm.org (fallback if the
 *      first endpoint is rate-limited or down). This profile is not strictly
 *      pedestrian but allows walking on most roads — still snapped to the
 *      street network so it won't cross buildings.
 *   3. Offline straight-line haversine as a last resort when both endpoints
 *      are unreachable. Flagged in the UI as a fallback estimate, NOT a
 *      true walking route.
 *
 * Walking pace is 1.35 m/s (calm pace) when we compute time from distance
 * ourselves; if OSRM returns a duration we use it directly.
 *
 * NEAREST-SHELTER STRATEGY:
 *   With 200+ shelters in the Päästeamet snapshot we pre-filter by
 *   haversine top-N candidates, run pedestrian routes for those in
 *   parallel with a short timeout each, then pick the shortest actual
 *   walking distance. If every routing call fails, the best haversine
 *   candidate wins and the result is labelled as a fallback estimate.
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

export type RouteSource =
  | 'osrm-foot'
  | 'osrm-walking'
  | 'offline-graph'
  | 'fallback-line';

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

// PROTOTYPE ROUTING ENDPOINTS — public demo servers. Replace with your own
// OSRM / Valhalla / GraphHopper instance for production.
const OSRM_FOOT_ENDPOINT = 'https://routing.openstreetmap.de/routed-foot/route/v1/foot';
const OSRM_WALKING_ENDPOINT = 'https://router.project-osrm.org/route/v1/walking';

const ROUTE_TIMEOUT_MS = 4500;
const NEAREST_CANDIDATE_COUNT = 8;

function walkingMinutes(meters: number, secondsFromService?: number): number {
  if (typeof secondsFromService === 'number' && Number.isFinite(secondsFromService) && secondsFromService > 0) {
    return Math.max(1, Math.round(secondsFromService / 60));
  }
  // 1.35 m/s ≈ 4.86 km/h calm walking pace.
  return Math.max(1, Math.round(meters / 1.35 / 60));
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Routing timeout')), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

type OsrmStep = {
  maneuver?: { instruction?: string; type?: string; modifier?: string };
  name?: string;
  distance?: number;
};

type OsrmLeg = {
  steps?: OsrmStep[];
};

type OsrmRoute = {
  distance?: number;
  duration?: number;
  geometry?: { coordinates?: [number, number][] };
  legs?: OsrmLeg[];
};

type OsrmResponse = {
  code?: string;
  routes?: OsrmRoute[];
};

function describeStep(step: OsrmStep): string | null {
  const m = step.maneuver;
  if (!m) return null;
  const verb = (() => {
    switch (m.type) {
      case 'depart':
        return 'Start walking';
      case 'arrive':
        return 'Arrive at destination';
      case 'turn':
      case 'continue':
      case 'new name':
      case 'merge':
      case 'fork':
      case 'end of road':
        return m.modifier
          ? `Take ${m.modifier}`
          : 'Continue';
      case 'roundabout':
      case 'rotary':
      case 'roundabout turn':
        return 'Take the roundabout';
      default:
        return m.modifier ? `Head ${m.modifier}` : 'Continue';
    }
  })();
  const name = step.name && step.name.trim().length > 0 ? ` onto ${step.name}` : '';
  const dist =
    typeof step.distance === 'number' && step.distance >= 1
      ? ` (${step.distance >= 1000 ? `${(step.distance / 1000).toFixed(1)} km` : `${Math.round(step.distance)} m`})`
      : '';
  return `${verb}${name}${dist}`.trim();
}

function stepsFromOsrm(route: OsrmRoute): string[] | undefined {
  const legs = route.legs ?? [];
  const out: string[] = [];
  for (const leg of legs) {
    for (const step of leg.steps ?? []) {
      const line = describeStep(step);
      if (line) out.push(line);
    }
  }
  return out.length > 0 ? out : undefined;
}

async function fetchOsrm(
  endpoint: string,
  start: LatLng,
  end: LatLng,
): Promise<OsrmRoute | null> {
  const url =
    `${endpoint}/${start.lng.toFixed(6)},${start.lat.toFixed(6)};` +
    `${end.lng.toFixed(6)},${end.lat.toFixed(6)}` +
    `?overview=full&geometries=geojson&steps=true&alternatives=false&annotations=false`;
  try {
    const res = await withTimeout(fetch(url, { method: 'GET' }), ROUTE_TIMEOUT_MS);
    if (!res.ok) return null;
    const json = (await res.json()) as OsrmResponse;
    if (json.code !== 'Ok') return null;
    const route = json.routes?.[0];
    if (!route || !route.geometry?.coordinates || route.geometry.coordinates.length < 2) {
      return null;
    }
    return route;
  } catch {
    return null;
  }
}

function osrmRouteToResult(
  shelterId: string,
  route: OsrmRoute,
  source: 'osrm-foot' | 'osrm-walking',
): RouteResult {
  const coords = (route.geometry?.coordinates ?? []) as [number, number][];
  const distance = Math.round(route.distance ?? 0);
  const sourceLabel =
    source === 'osrm-foot'
      ? 'Walking route on streets and paths'
      : 'Walking route (general roads)';
  return {
    shelterId,
    distanceMeters: distance,
    walkingTimeMinutes: walkingMinutes(distance, route.duration),
    coordinates: coords,
    source,
    sourceLabel,
    steps: stepsFromOsrm(route),
  };
}

function fallbackLineResult(shelterId: string, start: LatLng, end: LatLng): RouteResult {
  const distance = Math.round(haversineMeters(start, end));
  return {
    shelterId,
    distanceMeters: distance,
    walkingTimeMinutes: walkingMinutes(distance),
    coordinates: [
      [start.lng, start.lat],
      [end.lng, end.lat],
    ],
    source: 'fallback-line',
    sourceLabel: 'Offline fallback (straight-line estimate, not a real walking route)',
  };
}

/**
 * Compute a street-snapped walking route from `start` to `shelter`.
 * Tries OSRM foot profile, then OSRM walking profile, then a straight-line
 * fallback if the network is unreachable.
 */
export async function getRouteToShelter(
  start: LatLng,
  shelter: Shelter,
  _options?: { allowLive?: boolean },
): Promise<RouteResult> {
  const end: LatLng = { lat: shelter.lat, lng: shelter.lng };

  const foot = await fetchOsrm(OSRM_FOOT_ENDPOINT, start, end);
  if (foot) return osrmRouteToResult(shelter.id, foot, 'osrm-foot');

  const walking = await fetchOsrm(OSRM_WALKING_ENDPOINT, start, end);
  if (walking) return osrmRouteToResult(shelter.id, walking, 'osrm-walking');

  return fallbackLineResult(shelter.id, start, end);
}

/**
 * Legacy offline-graph route (Dijkstra over the hardcoded lattice). Kept
 * exported for backwards compatibility; not used by the default flow.
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

/** Fetch routes to a (small!) set of shelters in parallel. */
export async function getRoutesToAllShelters(
  start: LatLng,
  shelters: readonly Shelter[] = SHELTERS,
  _options?: { allowLive?: boolean },
): Promise<RouteResult[]> {
  return Promise.all(shelters.map((s) => getRouteToShelter(start, s)));
}

/**
 * Find the nearest shelter by walking distance.
 *
 * Pre-filter by haversine top-N, run OSRM foot routes for each candidate in
 * parallel, pick the shortest actual walking distance. If every OSRM call
 * fails for every candidate, fall back to the best haversine candidate and
 * label the result as a fallback estimate.
 */
export async function findNearestByRouteDistance(
  start: LatLng,
  shelters: readonly Shelter[] = SHELTERS,
  options?: { allowLive?: boolean; candidateCount?: number },
): Promise<{ shelter: Shelter; route: RouteResult }> {
  if (shelters.length === 0) {
    throw new Error('No shelters available.');
  }
  const candidateCount = Math.max(1, options?.candidateCount ?? NEAREST_CANDIDATE_COUNT);
  const candidates = nearestByStraightLine(start, shelters, candidateCount);

  const routed = await Promise.all(
    candidates.map(async (shelter) => {
      const route = await getRouteToShelter(start, shelter);
      return { shelter, route };
    }),
  );

  // Prefer real OSRM routes over fallback lines.
  const real = routed.filter(
    (r) => r.route.source === 'osrm-foot' || r.route.source === 'osrm-walking',
  );
  const pool = real.length > 0 ? real : routed;
  pool.sort((a, b) => a.route.distanceMeters - b.route.distanceMeters);
  const winner = pool[0];
  return { shelter: winner.shelter, route: winner.route };
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
