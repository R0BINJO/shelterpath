/*
 * SafeRoute Varjumine — HARDCODED OFFLINE FALLBACK GRAPH (legacy)
 *
 * Simplified hand-drawn pedestrian lattice around Tallinn city centre.
 * Originally used for the 6-shelter demo dataset, the graph is retained here
 * because the routing service still exposes a "graph fallback" tier and we
 * want the code path intact for future use.
 *
 * In the current build the shelter dataset is the Päästeamet open-data
 * snapshot (200+ shelters across Estonia), and individual shelters are NOT
 * anchored to nodes in this tiny lattice. `anchorForShelter` therefore returns
 * `null` for official-dataset shelters, and the routing service falls through
 * to the haversine "Fallback distance estimate" tier.
 *
 * PRODUCTION TODO: replace this hand-drawn graph with a real offline
 * pedestrian network (e.g. extracted from OSM via OSRM-backend or a
 * GraphHopper export) bundled as JSON.
 */

import { DEMO_USER_LOCATION, type Shelter } from './shelters';

export type GraphNode = { id: string; lat: number; lng: number };
export type GraphEdge = { from: string; to: string; distanceMeters: number };

export const WALKING_NODES: GraphNode[] = [
  { id: 'u', lat: DEMO_USER_LOCATION.lat, lng: DEMO_USER_LOCATION.lng },
];

export const WALKING_EDGES: GraphEdge[] = [];

/**
 * Returns the graph node id that a shelter is anchored to, or `null` if the
 * shelter isn't part of the legacy demo lattice. The Päästeamet open-data
 * snapshot has no anchored shelters, so this always returns null in production.
 */
export function anchorForShelter(_shelter: Shelter): string | null {
  return null;
}

export function nearestNode(_lat: number, _lng: number): string {
  return WALKING_NODES[0].id;
}

/**
 * Classic Dijkstra placeholder. With the trimmed graph (single node) it can
 * only resolve trivial start === end paths. Kept exported so the routing
 * service's tier-3 fallback compiles cleanly.
 */
export function dijkstra(
  startId: string,
  endId: string,
): { distanceMeters: number; path: string[] } | null {
  if (startId === endId) {
    return { distanceMeters: 0, path: [startId] };
  }
  return null;
}

export function pathToGeoJsonCoords(path: string[]): [number, number][] {
  return path
    .map((id) => WALKING_NODES.find((n) => n.id === id))
    .filter((n): n is GraphNode => !!n)
    .map((n) => [n.lng, n.lat]);
}
