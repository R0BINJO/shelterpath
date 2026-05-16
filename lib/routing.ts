/*
 * SafeRoute Varjumine — routing service.
 *
 * Three-tier strategy when computing a route to ONE shelter:
 *   1. Online: OSRM-compatible public demo endpoint (foot profile, OSM data)
 *      "Live walking route"
 *   2. Fallback: haversine straight-line, clearly labelled
 *      "Fallback distance estimate"
 *   3. Optional: hardcoded simplified walking graph (kept for the demo nodes
 *      around Tallinn city centre) — "Offline demo graph route"
 *
 * NEAREST-SHELTER STRATEGY:
 *   The official Päästeamet snapshot contains 200+ shelters across Estonia.
 *   We never request OSRM routes to all of them. Instead:
 *     a. compute cheap haversine distance to every candidate,
 *     b. take the top 10 closest by straight-line distance,
 *     c. request OSRM walking routes for just those 10,
 *     d. pick the smallest actual route distance.
 *   If OSRM fails for every candidate, return the haversine winner with a
 *   "Fallback distance estimate" label.
 *
 * PROTOTYPE ROUTING ENDPOINT
 *   The OSRM public demo endpoint is rate-limited and routes by car by default;
 *   we request /foot/ but transparently fall back to /walking/ if foot is
 *   unsupported.
 *
 * PRODUCTION TODO: self-host OSRM (`osrm-backend`) or GraphHopper with a
 * pedestrian profile and OpenStreetMap Estonia extract. Replace OSRM_BASE_URL.
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

// PUBLIC OSRM DEMO ENDPOINT — for prototype only.
export const OSRM_BASE_URL = 'https://router.project-osrm.org';

export type RouteSource = 'live' | 'offline-graph' | 'fallback-line';

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

const FOOT_PROFILES = ['foot', 'walking'] as const;
const FETCH_TIMEOUT_MS = 4500;
const NEAREST_CANDIDATE_COUNT = 10;

async function fetchWithTimeout(url: string, ms: number): Promise<Response | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), ms);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(t);
    return res;
  } catch {
    return null;
  }
}

type OsrmStep = {
  maneuver?: { type?: string; modifier?: string };
  name?: string;
  distance?: number;
};

type OsrmResponse = {
  code: string;
  routes?: {
    geometry: { type: 'LineString'; coordinates: [number, number][] };
    distance: number;
    duration: number;
    legs?: { steps?: OsrmStep[] }[];
  }[];
};

function simplifyStep(step: OsrmStep): string {
  const type = step?.maneuver?.type ?? 'continue';
  const modifier = step?.maneuver?.modifier;
  const name = step?.name?.trim();
  const dist = step?.distance ? `${Math.round(step.distance)} m` : '';
  const verb =
    type === 'depart'
      ? 'Start'
      : type === 'arrive'
        ? 'Arrive'
        : type === 'turn'
          ? `Turn ${modifier ?? 'ahead'}`
          : type === 'continue'
            ? 'Continue'
            : type === 'roundabout'
              ? 'Take roundabout'
              : 'Proceed';
  const where = name ? ` on ${name}` : '';
  return `${verb}${where}${dist ? ` (${dist})` : ''}`;
}

async function fetchOsrm(
  start: LatLng,
  end: LatLng,
  profile: string,
): Promise<OsrmResponse | null> {
  const url =
    `${OSRM_BASE_URL}/route/v1/${profile}/` +
    `${start.lng},${start.lat};${end.lng},${end.lat}` +
    `?overview=full&geometries=geojson&steps=true&alternatives=false`;
  const res = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
  if (!res || !res.ok) return null;
  try {
    const data: unknown = await res.json();
    return data as OsrmResponse;
  } catch {
    return null;
  }
}

function walkingMinutes(meters: number): number {
  // 1.35 m/s ≈ 4.86 km/h calm walking pace.
  return Math.max(1, Math.round(meters / 1.35 / 60));
}

/** Tier 1: live OSRM. Returns null on any failure. */
async function getLiveRoute(start: LatLng, shelter: Shelter): Promise<RouteResult | null> {
  const end: LatLng = { lat: shelter.lat, lng: shelter.lng };
  for (const profile of FOOT_PROFILES) {
    const json = await fetchOsrm(start, end, profile);
    const route = json?.routes?.[0];
    if (!route || json?.code !== 'Ok') continue;
    const coords = route.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;
    const stepObjs = route.legs?.[0]?.steps ?? [];
    const steps = stepObjs.slice(0, 8).map(simplifyStep);
    return {
      shelterId: shelter.id,
      distanceMeters: Math.round(route.distance),
      walkingTimeMinutes:
        profile === 'foot'
          ? Math.max(1, Math.round(route.duration / 60))
          : walkingMinutes(route.distance),
      coordinates: coords,
      source: 'live',
      sourceLabel: `Live walking route · OSRM ${profile}`,
      steps,
    };
  }
  return null;
}

/**
 * Tier 3 (legacy, optional): offline graph (Dijkstra over the hardcoded
 * lattice). Only works for the few legacy demo shelter ids that were anchored
 * to the graph. Returns null for official-snapshot shelters, which is fine —
 * the haversine fallback covers them.
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

/** Haversine-only straight line. */
function haversineFallback(start: LatLng, shelter: Shelter): RouteResult {
  const distance = Math.round(haversineMeters(start, shelter));
  return {
    shelterId: shelter.id,
    distanceMeters: distance,
    walkingTimeMinutes: walkingMinutes(distance),
    coordinates: [
      [start.lng, start.lat],
      [shelter.lng, shelter.lat],
    ],
    source: 'fallback-line',
    sourceLabel: 'Fallback distance estimate · straight-line',
  };
}

/** Main entry point — try tiers in order for a single shelter. */
export async function getRouteToShelter(
  start: LatLng,
  shelter: Shelter,
  options?: { allowLive?: boolean },
): Promise<RouteResult> {
  if (options?.allowLive !== false) {
    const live = await getLiveRoute(start, shelter);
    if (live) return live;
  }
  const graph = fallbackLocalGraphRoute(start, shelter);
  if (graph) return graph;
  return haversineFallback(start, shelter);
}

/** Fetch routes to all of a (small!) set of shelters in parallel. */
export async function getRoutesToAllShelters(
  start: LatLng,
  shelters: readonly Shelter[] = SHELTERS,
  options?: { allowLive?: boolean },
): Promise<RouteResult[]> {
  return Promise.all(shelters.map((s) => getRouteToShelter(start, s, options)));
}

/**
 * Find the nearest shelter by *route* distance.
 *
 * Performance strategy:
 *   1. Haversine top-N (default 10) candidates from the full dataset.
 *   2. OSRM routes for just those N.
 *   3. Pick the smallest actual route distance.
 *   4. If all OSRM calls failed, the best haversine candidate wins.
 */
export async function findNearestByRouteDistance(
  start: LatLng,
  shelters: readonly Shelter[] = SHELTERS,
  options?: { allowLive?: boolean; candidateCount?: number },
): Promise<{ shelter: Shelter; route: RouteResult }> {
  if (shelters.length === 0) {
    throw new Error('No shelters available.');
  }
  const count = options?.candidateCount ?? NEAREST_CANDIDATE_COUNT;
  const candidates = nearestByStraightLine(start, shelters, Math.min(count, shelters.length));
  const routes = await getRoutesToAllShelters(start, candidates, options);
  let best = 0;
  for (let i = 1; i < routes.length; i++) {
    if (routes[i].distanceMeters < routes[best].distanceMeters) best = i;
  }
  return { shelter: candidates[best], route: routes[best] };
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
