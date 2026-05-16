/*
 * SafeRoute Varjumine — HARDCODED DEMO WALKING GRAPH
 *
 * Simplified offline-fallback pedestrian graph around Tallinn city centre.
 * NOT full Tallinn routing data — this is a small hand-drawn lattice of
 * ~20 nodes intersecting along the same demo "streets" rendered on the map.
 *
 * Used by `lib/routing.ts → fallbackLocalGraphRoute()` when:
 *  - the user is offline, or
 *  - the OSRM public endpoint fails / times out.
 *
 * The solver is a textbook Dijkstra over `edges[].distanceMeters`.
 * Shelters are connected to the closest graph node manually below.
 *
 * PRODUCTION TODO: replace this hand-drawn graph with a real offline
 * pedestrian network (e.g. extracted from OSM via OSRM-backend or a
 * GraphHopper export) bundled as JSON or a vector dataset.
 */

import { DEMO_USER_LOCATION, SHELTERS, type Shelter } from './shelters';

export type GraphNode = { id: string; lat: number; lng: number };
export type GraphEdge = { from: string; to: string; distanceMeters: number };

// Hand-drawn lattice of pedestrian intersections around the demo user position.
// IDs encode their grid position only for readability.
export const WALKING_NODES: GraphNode[] = [
  // Centre / user start
  { id: 'u', lat: DEMO_USER_LOCATION.lat, lng: DEMO_USER_LOCATION.lng }, // 59.4350, 24.7500
  // North row
  { id: 'n1', lat: 59.4365, lng: 24.7475 },
  { id: 'n2', lat: 59.4365, lng: 24.75 },
  { id: 'n3', lat: 59.4365, lng: 24.7525 },
  { id: 'n4', lat: 59.4365, lng: 24.7555 },
  { id: 'n5', lat: 59.438, lng: 24.7585 },
  { id: 'n6', lat: 59.4395, lng: 24.745 },
  // Centre row
  { id: 'c1', lat: 59.435, lng: 24.7475 },
  { id: 'c2', lat: 59.435, lng: 24.7525 },
  { id: 'c3', lat: 59.435, lng: 24.7555 },
  // South row
  { id: 's1', lat: 59.4335, lng: 24.7475 },
  { id: 's2', lat: 59.4335, lng: 24.75 },
  { id: 's3', lat: 59.4335, lng: 24.7525 },
  { id: 's4', lat: 59.4335, lng: 24.7555 },
  { id: 's5', lat: 59.432, lng: 24.7555 },
  { id: 's6', lat: 59.4315, lng: 24.747 },
  // Shelter anchor nodes (one per shelter, geographically near each shelter)
  { id: 'sh1', lat: 59.4339, lng: 24.7536 },
  { id: 'sh2', lat: 59.4312, lng: 24.7458 },
  { id: 'sh3', lat: 59.4378, lng: 24.7602 },
  { id: 'sh4', lat: 59.4361, lng: 24.7472 },
  { id: 'sh5', lat: 59.4322, lng: 24.7561 },
  { id: 'sh6', lat: 59.4395, lng: 24.745 },
];

function toRad(d: number): number {
  return (d * Math.PI) / 180;
}

// Haversine — used to compute edge weights at module-load time, not for routing
// preference. The graph itself is what the solver searches.
function haversineMeters(a: GraphNode, b: GraphNode): number {
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

const nodeMap: Record<string, GraphNode> = Object.fromEntries(
  WALKING_NODES.map((n) => [n.id, n]),
);

function edge(from: string, to: string): GraphEdge {
  const a = nodeMap[from];
  const b = nodeMap[to];
  if (!a || !b) throw new Error(`Unknown graph node: ${from} / ${to}`);
  return { from, to, distanceMeters: Math.round(haversineMeters(a, b)) };
}

// Manually wired streets — mirrors the orthogonal lattice we drew on the SVG
// map background. Edges are undirected; the solver inserts the reverse pair.
const RAW_EDGES: [string, string][] = [
  // North row street
  ['n1', 'n2'],
  ['n2', 'n3'],
  ['n3', 'n4'],
  ['n4', 'n5'],
  ['n6', 'n1'],
  // Centre row street (the main east-west corridor through user)
  ['c1', 'u'],
  ['u', 'c2'],
  ['c2', 'c3'],
  // South row street
  ['s1', 's2'],
  ['s2', 's3'],
  ['s3', 's4'],
  ['s4', 's5'],
  ['s6', 's1'],
  // North-south connectors
  ['n1', 'c1'],
  ['c1', 's1'],
  ['n2', 'u'],
  ['u', 's2'],
  ['n3', 'c2'],
  ['c2', 's3'],
  ['n4', 'c3'],
  ['c3', 's4'],
  ['n5', 'c3'],
  // Shelter anchor edges — each shelter pinned to closest lattice node(s)
  ['sh1', 'c2'],
  ['sh1', 's3'],
  ['sh2', 's6'],
  ['sh3', 'n5'],
  ['sh4', 'n1'],
  ['sh4', 'c1'],
  ['sh5', 's4'],
  ['sh5', 's5'],
  ['sh6', 'n6'],
];

export const WALKING_EDGES: GraphEdge[] = RAW_EDGES.map(([a, b]) => edge(a, b));

// Shelter id -> graph anchor node
const SHELTER_ANCHOR: Record<number, string> = {
  1: 'sh1',
  2: 'sh2',
  3: 'sh3',
  4: 'sh4',
  5: 'sh5',
  6: 'sh6',
};

export function anchorForShelter(shelter: Shelter): string {
  return SHELTER_ANCHOR[shelter.id] ?? 'u';
}

export function nearestNode(lat: number, lng: number): string {
  let bestId = WALKING_NODES[0].id;
  let bestDist = Infinity;
  for (const n of WALKING_NODES) {
    const d = haversineMeters({ id: 'x', lat, lng }, n);
    if (d < bestDist) {
      bestDist = d;
      bestId = n.id;
    }
  }
  return bestId;
}

// Adjacency list (undirected).
function buildAdjacency() {
  const adj: Record<string, { to: string; w: number }[]> = {};
  for (const n of WALKING_NODES) adj[n.id] = [];
  for (const e of WALKING_EDGES) {
    adj[e.from].push({ to: e.to, w: e.distanceMeters });
    adj[e.to].push({ to: e.from, w: e.distanceMeters });
  }
  return adj;
}

const ADJ = buildAdjacency();

// Classic Dijkstra (priority queue replaced with linear scan — graph is tiny).
export function dijkstra(
  startId: string,
  endId: string,
): { distanceMeters: number; path: string[] } | null {
  const dist: Record<string, number> = {};
  const prev: Record<string, string | null> = {};
  for (const n of WALKING_NODES) {
    dist[n.id] = Infinity;
    prev[n.id] = null;
  }
  dist[startId] = 0;
  const unvisited = new Set(WALKING_NODES.map((n) => n.id));

  while (unvisited.size > 0) {
    let curr: string | null = null;
    let best = Infinity;
    for (const id of unvisited) {
      if (dist[id] < best) {
        best = dist[id];
        curr = id;
      }
    }
    if (curr === null || best === Infinity) break;
    if (curr === endId) break;
    unvisited.delete(curr);
    for (const { to, w } of ADJ[curr] ?? []) {
      if (!unvisited.has(to)) continue;
      const alt = dist[curr] + w;
      if (alt < dist[to]) {
        dist[to] = alt;
        prev[to] = curr;
      }
    }
  }

  if (dist[endId] === Infinity) return null;
  const path: string[] = [];
  let node: string | null = endId;
  while (node) {
    path.unshift(node);
    node = prev[node];
  }
  return { distanceMeters: Math.round(dist[endId]), path };
}

export function pathToGeoJsonCoords(path: string[]): [number, number][] {
  return path.map((id) => {
    const n = nodeMap[id];
    return [n.lng, n.lat];
  });
}

// Sanity check exported for tests/demo: ensure every shelter has a reachable anchor.
export function _selfTest() {
  return SHELTERS.every((s) => {
    const result = dijkstra('u', anchorForShelter(s));
    return result !== null && result.path.length > 1;
  });
}
