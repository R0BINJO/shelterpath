/*
 * SafeRoute Varjumine — Danger Points and Danger Zones.
 *
 * HARDCODED DANGER POINT DATA SNAPSHOT
 * SOURCE: Maa- ja Ruumiamet / X-GIS Huvipunktid
 *   - https://xgis.maaamet.ee/xgis2/page/app/hp
 *   - https://geoportaal.maaruum.ee/est/kaardirakendused/huvipunktid/huvipunktide-kaardirakenduse-kirjeldus-p917.html
 * CATEGORY: Huvipunktid - Riigihaldus
 *
 * GENERATED PUBLIC-DATA PROXIMITY DANGER ZONES
 *
 * IMPORTANT FRAMING (read before touching anything in this file):
 *   - Danger Points are NOT confirmed active threats.
 *   - Danger Points are NOT targets.
 *   - Danger Points are NOT vulnerability assessments.
 *   - Danger Points are NOT official emergency warnings.
 *   - Danger Zones are NOT real-time threat areas.
 *   - SafeRoute is NOT an official emergency system.
 *   - They are public-data-based proximity *caution* zones around important
 *     public-administration / state-infrastructure points, used ONLY for
 *     civilian route awareness inside this prototype.
 *
 * Six Riigihaldus POI layers ship through this file:
 *   poi_administratiivkeskus  -> Administratiivkeskus
 *   poi_politsei              -> Politseiasutus
 *   poi_piirivalve            -> Piirivalve
 *   poi_paastekomando         -> Päästekomando
 *   poi_riigiasutus           -> Riigiasutus
 *   poi_valisesindus          -> Välisesindus
 *
 * The dataset itself is loaded from `dangerPoints.generated.ts`, written by
 * `scripts/importDangerPoints.ts`. The generated file starts empty (no public
 * feature endpoint is documented for these X-GIS layers at this snapshot date)
 * and exists so the importer can populate it without app code changes.
 *
 * PRODUCTION TODO: refresh dangerPoints from official X-GIS / Maa- ja Ruumiamet
 * source via scripts/importDangerPoints.ts, once a public OGC API / WFS / GPKG
 * endpoint is confirmed for the Riigihaldus POI layers.
 */

import { generatedDangerPoints } from './dangerPoints.generated';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Stable per-layer identifier from the X-GIS Huvipunktid map. */
export type DangerPointLayerId =
  | 'poi_administratiivkeskus'
  | 'poi_politsei'
  | 'poi_piirivalve'
  | 'poi_paastekomando'
  | 'poi_riigiasutus'
  | 'poi_valisesindus';

/** Human-readable Estonian layer label. */
export type DangerPointLayerName =
  | 'Administratiivkeskus'
  | 'Politseiasutus'
  | 'Piirivalve'
  | 'Päästekomando'
  | 'Riigiasutus'
  | 'Välisesindus';

export type DangerPoint = {
  id: string;
  name: string;
  address: string;
  municipality: string;
  county: string;
  lat: number;
  lng: number;

  category: 'Riigihaldus';
  dangerPointType: 'PUBLIC_ADMINISTRATION';
  dangerZoneType: 'PUBLIC_DATA_PROXIMITY_CAUTION';
  layerId: DangerPointLayerId;
  layerName: DangerPointLayerName;
  poiType: string;

  dangerZoneRadiusMeters: number;

  source: 'Maa- ja Ruumiamet / X-GIS Huvipunktid';
  officialDataset: true;
  verified: true;
  dataSnapshotDate: string;

  safetyDisclaimer: string;
  originalProperties: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Source attribution / config
// ---------------------------------------------------------------------------

export const dangerPointDataSource = {
  sourceName: 'Maa- ja Ruumiamet X-GIS Huvipunktid - Riigihaldus',
  sourcePageUrl: 'https://xgis.maaamet.ee/xgis2/page/app/hp',
  descriptionPageUrl:
    'https://geoportaal.maaruum.ee/est/kaardirakendused/huvipunktid/huvipunktide-kaardirakenduse-kirjeldus-p917.html',
  importedAt: '2026-05-16',
  licenseNote:
    'Maa- ja Ruumiamet public spatial data / source attribution required',
  snapshotNote:
    'Hardcoded dataset snapshot. Data may change on the official X-GIS source.',
  safetyNote:
    'Danger Points are public-data proximity caution markers only. They are not official alerts, confirmed threats, or targeting/vulnerability assessments.',
} as const;

export const dangerPointLayerIds: readonly DangerPointLayerId[] = [
  'poi_administratiivkeskus',
  'poi_politsei',
  'poi_piirivalve',
  'poi_paastekomando',
  'poi_riigiasutus',
  'poi_valisesindus',
];

export const dangerPointLayerNames: Record<
  DangerPointLayerId,
  DangerPointLayerName
> = {
  poi_administratiivkeskus: 'Administratiivkeskus',
  poi_politsei: 'Politseiasutus',
  poi_piirivalve: 'Piirivalve',
  poi_paastekomando: 'Päästekomando',
  poi_riigiasutus: 'Riigiasutus',
  poi_valisesindus: 'Välisesindus',
};

export const dangerZoneConfig = {
  /** Same radius for every Danger Point. We do NOT score by importance. */
  defaultRadiusMeters: 200,
  minRadiusMeters: 120,
  maxRadiusMeters: 300,
  zoneMeaning: 'Public-data proximity caution zone',
  zoneDisclaimer:
    'Generated from public Riigihaldus POI locations. Not a real-time threat zone.',
} as const;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** WGS84 Estonia bounding box used to drop invalid records from the map. */
export function isWithinEstonia(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return lat >= 57 && lat <= 60 && lng >= 21 && lng <= 29;
}

// ---------------------------------------------------------------------------
// Public dataset (read by the app at runtime)
// ---------------------------------------------------------------------------

/**
 * The full danger-point list — bundled, static, offline.
 * Filtered to only records whose WGS84 coordinates land inside Estonia.
 */
export const dangerPoints: readonly DangerPoint[] = Object.freeze(
  generatedDangerPoints.filter((p) => isWithinEstonia(p.lat, p.lng)),
);

// ---------------------------------------------------------------------------
// GeoJSON helpers (precomputed once at module load)
// ---------------------------------------------------------------------------

type DangerPointFeature = GeoJSON.Feature<
  GeoJSON.Point,
  {
    id: string;
    name: string;
    layerId: DangerPointLayerId;
    layerName: DangerPointLayerName;
    poiType: string;
    municipality: string;
    county: string;
    radiusMeters: number;
  }
>;

type DangerZoneFeature = GeoJSON.Feature<
  GeoJSON.Polygon,
  {
    id: string;
    dangerPointId: string;
    name: string;
    radiusMeters: number;
    category: 'Riigihaldus';
    dangerZoneType: 'PUBLIC_DATA_PROXIMITY_CAUTION';
    layerId: DangerPointLayerId;
    layerName: DangerPointLayerName;
    source: 'Maa- ja Ruumiamet / X-GIS Huvipunktid';
    dataSnapshotDate: string;
    safetyDisclaimer: string;
  }
>;

const ZONE_SEGMENTS = 48;
const EARTH_RADIUS_METERS = 6378137;

/** Build a GeoJSON Polygon circle (centerLat,centerLng,radiusMeters). */
export function buildDangerZonePolygon(
  centerLat: number,
  centerLng: number,
  radiusMeters: number,
  segments: number = ZONE_SEGMENTS,
): [number, number][] {
  const coords: [number, number][] = [];
  const cosLat = Math.cos((centerLat * Math.PI) / 180);
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * 2 * Math.PI;
    const dxDeg =
      ((radiusMeters * Math.cos(angle)) / (EARTH_RADIUS_METERS * cosLat)) *
      (180 / Math.PI);
    const dyDeg =
      ((radiusMeters * Math.sin(angle)) / EARTH_RADIUS_METERS) * (180 / Math.PI);
    coords.push([centerLng + dxDeg, centerLat + dyDeg]);
  }
  return coords;
}

export const dangerPointsGeoJson: GeoJSON.FeatureCollection<
  GeoJSON.Point,
  DangerPointFeature['properties']
> = {
  type: 'FeatureCollection',
  features: dangerPoints.map<DangerPointFeature>((p) => ({
    type: 'Feature',
    properties: {
      id: p.id,
      name: p.name,
      layerId: p.layerId,
      layerName: p.layerName,
      poiType: p.poiType,
      municipality: p.municipality,
      county: p.county,
      radiusMeters: p.dangerZoneRadiusMeters,
    },
    geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
  })),
};

export const dangerZonesGeoJson: GeoJSON.FeatureCollection<
  GeoJSON.Polygon,
  DangerZoneFeature['properties']
> = {
  type: 'FeatureCollection',
  features: dangerPoints.map<DangerZoneFeature>((p) => ({
    type: 'Feature',
    properties: {
      id: `zone:${p.id}`,
      dangerPointId: p.id,
      name: p.name,
      radiusMeters: p.dangerZoneRadiusMeters,
      category: 'Riigihaldus',
      dangerZoneType: 'PUBLIC_DATA_PROXIMITY_CAUTION',
      layerId: p.layerId,
      layerName: p.layerName,
      source: 'Maa- ja Ruumiamet / X-GIS Huvipunktid',
      dataSnapshotDate: p.dataSnapshotDate,
      safetyDisclaimer:
        'Generated proximity caution zone only. Not an official alert or confirmed threat area.',
    },
    geometry: {
      type: 'Polygon',
      coordinates: [
        buildDangerZonePolygon(p.lat, p.lng, p.dangerZoneRadiusMeters),
      ],
    },
  })),
};

// ---------------------------------------------------------------------------
// Route ↔ Danger Zone intersection (used for the caution warning)
// ---------------------------------------------------------------------------

function haversineMetersLocal(
  a: [number, number],
  b: [number, number],
): number {
  // a/b in [lng, lat]
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * For each pair of consecutive route vertices, walk along the segment in
 * ~30 m steps and ask: does any sample point fall inside one of the visible
 * Danger Zones? If yes, return the matching Danger Points (deduped).
 *
 * This is intentionally a simple sampling approach. It is NOT a precise
 * geometric segment-circle intersection — for the prototype's purpose
 * (visual warning, not safety claim) sampling is enough.
 */
export function findDangerZonesAlongRoute(
  routeCoords: readonly [number, number][],
  pool: readonly DangerPoint[] = dangerPoints,
): DangerPoint[] {
  if (routeCoords.length < 2 || pool.length === 0) return [];
  const hits = new Map<string, DangerPoint>();
  const STEP_METERS = 30;
  for (let i = 0; i < routeCoords.length - 1; i++) {
    const a = routeCoords[i];
    const b = routeCoords[i + 1];
    const segMeters = haversineMetersLocal(a, b);
    const steps = Math.max(1, Math.ceil(segMeters / STEP_METERS));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const lng = a[0] + (b[0] - a[0]) * t;
      const lat = a[1] + (b[1] - a[1]) * t;
      for (const p of pool) {
        if (hits.has(p.id)) continue;
        const d = haversineMetersLocal([lng, lat], [p.lng, p.lat]);
        if (d <= p.dangerZoneRadiusMeters) {
          hits.set(p.id, p);
        }
      }
    }
  }
  return [...hits.values()];
}
