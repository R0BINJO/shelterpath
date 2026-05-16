/*
 * SafeRoute Varjumine — DEMO DATA
 *
 * Everything in this file is HARDCODED for prototype purposes.
 * No real shelter registry, routing API, or government data is used.
 * Coordinates are around Tallinn city centre (~59.435, 24.753).
 *
 * Do NOT treat this data as official emergency information.
 */

export type ShelterType = 'SA1' | 'SA2' | 'SA3';

export type Shelter = {
  id: number;
  name: string;
  type: ShelterType;
  lat: number;
  lng: number;
  capacity: number;
  hasWater: boolean;
  hasPower: boolean;
  accessible: boolean;
  verified: boolean;
  lastChecked: string; // YYYY-MM-DD
  safetyScore: number; // NOT used for route selection in this MVP
  distanceMeters: number;
  walkingTimeMinutes: number;
  description: string;
};

// HARDCODED DEMO USER LOCATION (Tallinn city centre, near Viru Square).
export const DEMO_USER_LOCATION = {
  lat: 59.435,
  lng: 24.75,
} as const;

// HARDCODED DEMO SHELTER DATA — 6 entries spanning SA1 / SA2 / SA3.
export const SHELTERS: Shelter[] = [
  {
    id: 1,
    name: 'Rävala underground parking',
    type: 'SA2',
    lat: 59.4339,
    lng: 24.7536,
    capacity: 180,
    hasWater: false,
    hasPower: true,
    accessible: true,
    verified: true,
    lastChecked: '2026-05-01',
    safetyScore: 82,
    distanceMeters: 450,
    walkingTimeMinutes: 6,
    description: 'Multi-level underground parking. Strong concrete structure.',
  },
  {
    id: 2,
    name: 'School basement shelter',
    type: 'SA2',
    lat: 59.4312,
    lng: 24.7458,
    capacity: 90,
    hasWater: true,
    hasPower: false,
    accessible: false,
    verified: false,
    lastChecked: '2026-04-20',
    safetyScore: 74,
    distanceMeters: 720,
    walkingTimeMinutes: 9,
    description: 'School basement floor. Stairs only — limited accessibility.',
  },
  {
    id: 3,
    name: 'Community crisis centre',
    type: 'SA3',
    lat: 59.4378,
    lng: 24.7602,
    capacity: 250,
    hasWater: true,
    hasPower: true,
    accessible: true,
    verified: true,
    lastChecked: '2026-05-10',
    safetyScore: 94,
    distanceMeters: 980,
    walkingTimeMinutes: 12,
    description: 'Prepared crisis centre with supplies, water, power and communication.',
  },
  // Three additional demo shelters:
  {
    id: 4,
    name: 'Bus stop concrete cover',
    type: 'SA1',
    lat: 59.4361,
    lng: 24.7472,
    capacity: 12,
    hasWater: false,
    hasPower: false,
    accessible: true,
    verified: false,
    lastChecked: '2026-03-15',
    safetyScore: 38,
    distanceMeters: 280,
    walkingTimeMinutes: 4,
    description: 'Solid concrete bus stop with rear wall. Short-term cover only.',
  },
  {
    id: 5,
    name: 'Office tower garage',
    type: 'SA2',
    lat: 59.4322,
    lng: 24.7561,
    capacity: 220,
    hasWater: false,
    hasPower: true,
    accessible: true,
    verified: true,
    lastChecked: '2026-04-28',
    safetyScore: 80,
    distanceMeters: 610,
    walkingTimeMinutes: 8,
    description: 'Underground levels of an office tower. Reinforced concrete.',
  },
  {
    id: 6,
    name: 'Old town civil bunker',
    type: 'SA3',
    lat: 59.4395,
    lng: 24.745,
    capacity: 320,
    hasWater: true,
    hasPower: true,
    accessible: true,
    verified: true,
    lastChecked: '2026-05-12',
    safetyScore: 96,
    distanceMeters: 850,
    walkingTimeMinutes: 11,
    description: 'Restored historic civil bunker. Long-term protection capability.',
  },
];

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
  shelterId: number;
  distanceMeters: number;
  walkingTimeMinutes: number;
  coordinates: [number, number][]; // [lng, lat]
};

// HARDCODED DEMO ROUTES — one polyline per shelter from DEMO_USER_LOCATION.
// Distance / walking time mirror Shelter.distanceMeters / walkingTimeMinutes.
export const ROUTES: RoutePolyline[] = [
  {
    shelterId: 1,
    distanceMeters: 450,
    walkingTimeMinutes: 6,
    coordinates: [
      [24.75, 59.435],
      [24.751, 59.4347],
      [24.7524, 59.4342],
      [24.7536, 59.4339],
    ],
  },
  {
    shelterId: 2,
    distanceMeters: 720,
    walkingTimeMinutes: 9,
    coordinates: [
      [24.75, 59.435],
      [24.7488, 59.4338],
      [24.7472, 59.4325],
      [24.7458, 59.4312],
    ],
  },
  {
    shelterId: 3,
    distanceMeters: 980,
    walkingTimeMinutes: 12,
    coordinates: [
      [24.75, 59.435],
      [24.7528, 59.4356],
      [24.7565, 59.4368],
      [24.7602, 59.4378],
    ],
  },
  {
    shelterId: 4,
    distanceMeters: 280,
    walkingTimeMinutes: 4,
    coordinates: [
      [24.75, 59.435],
      [24.7488, 59.4355],
      [24.7472, 59.4361],
    ],
  },
  {
    shelterId: 5,
    distanceMeters: 610,
    walkingTimeMinutes: 8,
    coordinates: [
      [24.75, 59.435],
      [24.7522, 59.4342],
      [24.7545, 59.4332],
      [24.7561, 59.4322],
    ],
  },
  {
    shelterId: 6,
    distanceMeters: 850,
    walkingTimeMinutes: 11,
    coordinates: [
      [24.75, 59.435],
      [24.748, 59.4365],
      [24.7465, 59.438],
      [24.745, 59.4395],
    ],
  },
];

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

export function findNearestShelter(shelters: Shelter[] = SHELTERS): Shelter {
  // Shortest hardcoded distanceMeters wins. No real geometry.
  return shelters.reduce((best, s) => (s.distanceMeters < best.distanceMeters ? s : best));
}

export function getRouteForShelter(shelterId: number): RoutePolyline | undefined {
  return ROUTES.find((r) => r.shelterId === shelterId);
}
