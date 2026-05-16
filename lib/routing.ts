/*
 * SafeRoute Varjumine — routing service.
 *
 * Three-tier strategy:
 *   1. Online: OSRM-compatible public demo endpoint (foot profile, OSM data)
 *   2. Offline fallback: hardcoded simplified walking graph + Dijkstra
 *   3. Haversine fallback: straight-line guess (last resort, clearly labelled)
 *
 * PROTOTYPE ROUTING ENDPOINT
 *   The OSRM public demo endpoint is rate-limited and routes by car by default;
 *   we request /foot/ but transparently fall back if foot is unsupported.
 *
 * PRODUCTION TODO: self-host OSRM (`osrm-backend`) or GraphHopper with a pedestrian
 *   profile and OpenStreetMap Tallinn extract. Replace OSRM_BASE_URL below.
 */

import {
  DEMO_USER_LOCATION,
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
// Production should use a self-hosted OSRM or GraphHopper server.
export const OSRM_BASE_URL = 'https://router.project-osrm.org';

export type RouteSource = 'live' | 'offline-graph' | 'fallback-line';

export type RouteResult = {
  shelterId: number;
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

type OsrmResponse = {
  code: string;
  routes?: {
    geometry: { type: 'LineString'; coordinates: [number, number][] };
    distance: number; // meters
    duration: number; // seconds
    legs?: {
      steps?: {
        maneuver?: { type?: string; modifier?: string };
        name?: string;
        distance?: number;
      }[];
    }[];
  }[];
};

function simplifyStep(
  step: NonNullable<NonNullable<OsrmResponse['routes']>[number]['legs']>[number]['steps'] extends (infer S)[] | undefined ? S : never,
): string {
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

async function fetchOsrm(start: LatLng, end: LatLng, profile: string): Promise<OsrmResponse | null> {
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
      sourceLabel: `Live route · OSRM ${profile}`,
      steps,
    };
  }
  return null;
}

/** Tier 2: offline graph (Dijkstra over the hardcoded lattice). */
export function fallbackLocalGraphRoute(start: LatLng, shelter: Shelter): RouteResult | null {
  // The hardcoded graph anchors start at the demo user node "u". For arbitrary
  // start positions we'd nearest-node them; for this MVP the user node is fixed.
  const startId = 'u';
  const endId = anchorForShelter(shelter);
  const result = dijkstra(startId, endId);
  if (!result) return null;
  let coords = pathToGeoJsonCoords(result.path);
  // If the device's real geolocation differs from the demo user node, prepend
  // a leg from the real start to the first graph node so the route line
  // actually starts where the user is.
  const first = coords[0];
  if (first && (Math.abs(first[1] - start.lat) > 1e-5 || Math.abs(first[0] - start.lng) > 1e-5)) {
    coords = [[start.lng, start.lat], ...coords];
  }
  // Same for shelter terminus.
  const last = coords[coords.length - 1];
  if (last && (Math.abs(last[1] - shelter.lat) > 1e-5 || Math.abs(last[0] - shelter.lng) > 1e-5)) {
    coords = [...coords, [shelter.lng, shelter.lat]];
  }
  return {
    shelterId: shelter.id,
    distanceMeters: result.distanceMeters,
    walkingTimeMinutes: walkingMinutes(result.distanceMeters),
    coordinates: coords,
    source: 'offline-graph',
    sourceLabel: 'Offline route · simplified demo walking graph',
  };
}

/** Tier 3: haversine-only straight line. */
function toRadDeg(d: number): number {
  return (d * Math.PI) / 180;
}

function haversineFallback(start: LatLng, shelter: Shelter): RouteResult {
  const R = 6371000;
  const dLat = toRadDeg(shelter.lat - start.lat);
  const dLng = toRadDeg(shelter.lng - start.lng);
  const lat1 = toRadDeg(start.lat);
  const lat2 = toRadDeg(shelter.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const distance = Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(h))));
  return {
    shelterId: shelter.id,
    distanceMeters: distance,
    walkingTimeMinutes: walkingMinutes(distance),
    coordinates: [
      [start.lng, start.lat],
      [shelter.lng, shelter.lat],
    ],
    source: 'fallback-line',
    sourceLabel: 'Demo fallback · straight-line estimate',
  };
}

/** Main entry point — try tiers in order. */
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

/** Fetch routes to every shelter. Parallel. */
export async function getRoutesToAllShelters(
  start: LatLng,
  shelters: Shelter[] = SHELTERS,
  options?: { allowLive?: boolean },
): Promise<RouteResult[]> {
  return Promise.all(shelters.map((s) => getRouteToShelter(start, s, options)));
}

/** Find nearest by *route* distance (not straight-line) once we've fetched them. */
export async function findNearestByRouteDistance(
  start: LatLng,
  shelters: Shelter[] = SHELTERS,
  options?: { allowLive?: boolean },
): Promise<{ shelter: Shelter; route: RouteResult }> {
  const routes = await getRoutesToAllShelters(start, shelters, options);
  let best = 0;
  for (let i = 1; i < routes.length; i++) {
    if (routes[i].distanceMeters < routes[best].distanceMeters) best = i;
  }
  return { shelter: shelters[best], route: routes[best] };
}

/** Convert a RouteResult back to the legacy RoutePolyline shape the SVG canvas wants. */
export function routeResultToPolyline(r: RouteResult): RoutePolyline {
  return {
    shelterId: r.shelterId,
    distanceMeters: r.distanceMeters,
    walkingTimeMinutes: r.walkingTimeMinutes,
    coordinates: r.coordinates,
  };
}

/** Default start position: device geolocation if available, otherwise hardcoded demo. */
export function getDemoStart(): LatLng {
  // HARDCODED DEMO USER LOCATION - used only when browser geolocation is unavailable.
  return { lat: DEMO_USER_LOCATION.lat, lng: DEMO_USER_LOCATION.lng };
}
