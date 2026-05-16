/*
 * Importer for Maa- ja Ruumiamet X-GIS "Huvipunktid - Riigihaldus" layers.
 *
 * SOURCE: Maa- ja Ruumiamet X-GIS Huvipunktid
 *   - Map app:         https://xgis.maaamet.ee/xgis2/page/app/hp
 *   - App description: https://geoportaal.maaruum.ee/est/kaardirakendused/huvipunktid/huvipunktide-kaardirakenduse-kirjeldus-p917.html
 *
 * RULES (read before running):
 *   - Only uses official / public feature-service endpoints if configured.
 *   - Never scrapes the rendered X-GIS map UI for pixel data.
 *   - Never bypasses access controls, authentication, hidden / private
 *     systems, or rate limits.
 *   - Output is a static, hardcoded TypeScript file under src/data/. The
 *     runtime app never fetches Danger Point data at runtime.
 *
 * USAGE:
 *   1. Install dev dependencies once (`npm i -D proj4 @types/proj4 fast-xml-parser`).
 *   2. Set XGIS_FEATURE_ENDPOINT below to the official / public feature-service
 *      endpoint exposing the six Riigihaldus POI layers. Verify the URL
 *      against the public Maa- ja Ruumiamet geoportal before running.
 *   3. `npx tsx scripts/importDangerPoints.ts` (or ts-node).
 *
 * The script supports:
 *   - GeoJSON FeatureCollection responses (OGC API Features / GeoJSON WFS).
 *   - WFS 2.0 GML point geometry (`gml:Point/gml:pos`) when `fast-xml-parser`
 *     is available.
 *   - L-EST97 / EPSG:3301 projected coordinates (converted to WGS84 via proj4).
 *
 * Output: src/data/dangerPoints.generated.ts
 *
 * PRODUCTION TODO: refresh dangerPoints from official X-GIS / Maa- ja
 * Ruumiamet source via this script.
 */

/* eslint-disable no-console */
/* oxlint-disable */

import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// ---------------------------------------------------------------------------
// Layer + radius config (mirrors src/data/dangerPoints.ts)
// ---------------------------------------------------------------------------

const DANGER_POINT_LAYER_IDS = [
  'poi_administratiivkeskus',
  'poi_politsei',
  'poi_piirivalve',
  'poi_paastekomando',
  'poi_riigiasutus',
  'poi_valisesindus',
] as const;

type DangerPointLayerId = (typeof DANGER_POINT_LAYER_IDS)[number];

const LAYER_NAMES: Record<DangerPointLayerId, string> = {
  poi_administratiivkeskus: 'Administratiivkeskus',
  poi_politsei: 'Politseiasutus',
  poi_piirivalve: 'Piirivalve',
  poi_paastekomando: 'Päästekomando',
  poi_riigiasutus: 'Riigiasutus',
  poi_valisesindus: 'Välisesindus',
};

const DANGER_ZONE_DEFAULT_RADIUS_METERS = 500;
const SNAPSHOT_DATE = '2026-05-16';

// ---------------------------------------------------------------------------
// Endpoint configuration
// ---------------------------------------------------------------------------
//
// The Maa- ja Ruumiamet geoportal page (p917) describes the Huvipunktid
// kaardirakendus and lists deep-links into the X-GIS app for each layer:
//
//   https://xgis.maaamet.ee/xgis2/page/app/hp?recursive=true&setlegend=poi_politsei=1
//   https://xgis.maaamet.ee/xgis2/page/app/hp?searchid=poi_politsei
//
// These deep-links open the public web app — they are NOT documented as a
// feature/OGC API. The script accepts an explicit feature endpoint via
// XGIS_FEATURE_ENDPOINT; verify it points at a public/official service
// before running.
//
// Examples of patterns to look for once Maa- ja Ruumiamet publishes a public
// feature service (do NOT guess — only use an endpoint that the geoportal
// itself documents):
//
//   - OGC API Features:  https://<host>/<collection>/items?f=json&limit=1000
//   - WFS 2.0 GetFeature: https://<host>/wfs?service=WFS&version=2.0.0&request=GetFeature
//                          &typeNames=<typeName>&outputFormat=application/json
//
const XGIS_FEATURE_ENDPOINT: string | null =
  process.env.XGIS_FEATURE_ENDPOINT ?? null;

const FEATURE_ENDPOINT_NOTE = `
  How XGIS_FEATURE_ENDPOINT must be set:
    - It MUST be a public Maa- ja Ruumiamet endpoint documented in the
      geoportal / opendata pages. Do NOT point at private / internal URLs.
    - It MAY contain "{LAYER_ID}" — the script will substitute the layer id
      (e.g. poi_politsei) per request.
    - It should return GeoJSON FeatureCollection or WFS 2.0 GML.
`;

// ---------------------------------------------------------------------------
// Field-name normalization
// ---------------------------------------------------------------------------

const NAME_KEYS = ['name', 'nimi', 'nimetus', 'objekti_nimi', 'huvipunkt', 'title', 'alias'];
const ADDRESS_KEYS = [
  'address',
  'aadress',
  'taisaadress',
  'täisaadress',
  'asukoht',
  'lahiaadress',
  'lähiaadress',
];
const MUNICIPALITY_KEYS = ['omavalitsus', 'kov', 'municipality', 'local_government', 'vald_linn'];
const COUNTY_KEYS = ['maakond', 'county'];
const POI_TYPE_KEYS = ['tyyp', 'tüüp', 'liik', 'huviobjekti_tyyp', 'huviobjekti_tüüp', 'type', 'klass'];
const ID_KEYS = ['id', 'objectid', 'oid', 'fid', 'gid', 'hp_id', 'huvipunkti_id'];
const LON_KEYS = ['lon', 'lng', 'longitude', 'x', 'pikkus', 'geox'];
const LAT_KEYS = ['lat', 'latitude', 'y', 'laius', 'geoy'];

function pickField(props: Record<string, unknown>, keys: readonly string[]): string {
  for (const k of keys) {
    const v = props[k];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

function pickNumber(props: Record<string, unknown>, keys: readonly string[]): number | null {
  for (const k of keys) {
    const v = props[k];
    if (v == null) continue;
    const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Coordinate handling
// ---------------------------------------------------------------------------

function isLikelyWgs84(lat: number, lng: number): boolean {
  // Estonia-ish WGS84 ranges.
  return lat >= 57 && lat <= 60 && lng >= 21 && lng <= 29;
}

function isLikelyLEst97(x: number, y: number): boolean {
  // L-EST97 northing ~6,377,000-6,635,000; easting ~280,000-740,000.
  // X-GIS / Maa-amet often labels them `lest_x` = northing, `lest_y` = easting.
  const looksLikeNorthing = (v: number) => v >= 6_000_000 && v <= 7_000_000;
  const looksLikeEasting = (v: number) => v >= 200_000 && v <= 800_000;
  return (
    (looksLikeNorthing(x) && looksLikeEasting(y)) ||
    (looksLikeNorthing(y) && looksLikeEasting(x))
  );
}

type Wgs84 = { lat: number; lng: number };

/**
 * Convert a (possibly L-EST97) coordinate pair to WGS84.
 * Returns null when the input is unusable.
 */
async function toWgs84(rawA: number, rawB: number): Promise<Wgs84 | null> {
  // Try WGS84 directly first, in both lon/lat orderings.
  if (isLikelyWgs84(rawA, rawB)) return { lat: rawA, lng: rawB };
  if (isLikelyWgs84(rawB, rawA)) return { lat: rawB, lng: rawA };

  if (isLikelyLEst97(rawA, rawB)) {
    let proj4: typeof import('proj4').default;
    try {
      proj4 = (await import('proj4')).default;
    } catch {
      console.warn(
        '[importDangerPoints] proj4 is not installed; cannot convert L-EST97 coordinates.',
      );
      return null;
    }
    // EPSG:3301 = Estonian Coordinate System of 1997 (L-EST97), LCC 2SP on GRS80.
    proj4.defs(
      'EPSG:3301',
      '+proj=lcc +lat_1=59.33333333333334 +lat_2=58 ' +
        '+lat_0=57.51755393055556 +lon_0=24 +x_0=500000 +y_0=6375000 ' +
        '+ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
    );
    // Detect ordering: in Maaamet exports `lest_x` is northing (Y), `lest_y` is easting (X).
    const northing = rawA > 6_000_000 ? rawA : rawB;
    const easting = rawA > 6_000_000 ? rawB : rawA;
    const [lng, lat] = proj4('EPSG:3301', 'WGS84', [easting, northing]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Generic GeoJSON feature normalization
// ---------------------------------------------------------------------------

type NormalizedRecord = {
  id: string;
  name: string;
  address: string;
  municipality: string;
  county: string;
  lat: number;
  lng: number;
  poiType: string;
  originalProperties: Record<string, unknown>;
};

async function normalizeGeoJsonFeature(
  feature: GeoJSON.Feature,
  layerId: DangerPointLayerId,
  fallbackIndex: number,
): Promise<NormalizedRecord | null> {
  if (!feature || typeof feature !== 'object') return null;
  const props = (feature.properties ?? {}) as Record<string, unknown>;
  let lat: number | null = null;
  let lng: number | null = null;

  // Geometry: only POI Points / centroidable points.
  const geom = feature.geometry;
  if (geom?.type === 'Point') {
    const [a, b] = geom.coordinates as [number, number];
    const wgs = await toWgs84(b, a) ?? (await toWgs84(a, b));
    if (wgs) {
      lat = wgs.lat;
      lng = wgs.lng;
    }
  } else if (geom == null) {
    // No geometry — try property-level x/y.
    const px = pickNumber(props, LON_KEYS);
    const py = pickNumber(props, LAT_KEYS);
    if (px != null && py != null) {
      const wgs = (await toWgs84(py, px)) ?? (await toWgs84(px, py));
      if (wgs) {
        lat = wgs.lat;
        lng = wgs.lng;
      }
    }
  } else {
    console.warn(
      `[importDangerPoints] Skipping non-point geometry on ${layerId}: ${geom.type}`,
    );
    return null;
  }

  if (lat == null || lng == null) {
    console.warn(
      `[importDangerPoints] No usable coordinates on ${layerId} feature #${fallbackIndex}.`,
    );
    return null;
  }

  return {
    id: pickField(props, ID_KEYS) || `${layerId}:${fallbackIndex}`,
    name: pickField(props, NAME_KEYS),
    address: pickField(props, ADDRESS_KEYS),
    municipality: pickField(props, MUNICIPALITY_KEYS),
    county: pickField(props, COUNTY_KEYS),
    lat,
    lng,
    poiType: pickField(props, POI_TYPE_KEYS),
    originalProperties: props,
  };
}

// ---------------------------------------------------------------------------
// Optional WFS/GML support (lazy import of fast-xml-parser)
// ---------------------------------------------------------------------------

async function parseGmlFeatures(xml: string): Promise<GeoJSON.Feature[]> {
  let parserMod: typeof import('fast-xml-parser');
  try {
    parserMod = await import('fast-xml-parser');
  } catch {
    console.warn(
      '[importDangerPoints] fast-xml-parser not installed; cannot parse WFS GML payload.',
    );
    return [];
  }
  const parser = new parserMod.XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
  });
  const doc = parser.parse(xml) as Record<string, unknown>;
  // Walk for any `*member` nodes carrying a Point.
  const features: GeoJSON.Feature[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    const obj = node as Record<string, unknown>;
    if (obj.Point && typeof obj.Point === 'object') {
      const point = obj.Point as Record<string, unknown>;
      const pos =
        (point.pos as string | undefined) ??
        (point.coordinates as string | undefined);
      if (typeof pos === 'string') {
        const [a, b] = pos.trim().split(/\s+/).map(Number);
        if (Number.isFinite(a) && Number.isFinite(b)) {
          // GML pos for EPSG:3301 is northing easting; for EPSG:4326 lat lon.
          features.push({
            type: 'Feature',
            properties: { ...obj },
            geometry: { type: 'Point', coordinates: [a, b] },
          });
        }
      }
    }
    Object.values(obj).forEach(walk);
  };
  walk(doc);
  return features;
}

// ---------------------------------------------------------------------------
// Per-layer fetcher
// ---------------------------------------------------------------------------

async function fetchLayer(layerId: DangerPointLayerId): Promise<GeoJSON.Feature[]> {
  if (!XGIS_FEATURE_ENDPOINT) return [];
  const url = XGIS_FEATURE_ENDPOINT.replace('{LAYER_ID}', layerId);
  console.log(`[importDangerPoints] Fetching ${layerId} from ${url}`);
  const res = await fetch(url, { headers: { Accept: 'application/json, application/xml' } });
  if (!res.ok) {
    console.warn(`[importDangerPoints] ${layerId}: HTTP ${res.status}`);
    return [];
  }
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('json')) {
    const json = (await res.json()) as GeoJSON.FeatureCollection | GeoJSON.Feature;
    if ((json as GeoJSON.FeatureCollection).type === 'FeatureCollection') {
      return (json as GeoJSON.FeatureCollection).features ?? [];
    }
    if ((json as GeoJSON.Feature).type === 'Feature') return [json as GeoJSON.Feature];
    return [];
  }
  if (contentType.includes('xml') || contentType.includes('gml')) {
    const xml = await res.text();
    return parseGmlFeatures(xml);
  }
  console.warn(`[importDangerPoints] ${layerId}: unsupported content-type ${contentType}`);
  return [];
}

// ---------------------------------------------------------------------------
// Generated file writer
// ---------------------------------------------------------------------------

type DangerPointRecord = NormalizedRecord & {
  layerId: DangerPointLayerId;
};

function emitGeneratedFile(records: readonly DangerPointRecord[]): string {
  const header = `/*
 * GENERATED / HARDCODED DANGER POINT DATA SNAPSHOT
 *
 * Source: Maa- ja Ruumiamet X-GIS Huvipunktid
 *   - Map app:         https://xgis.maaamet.ee/xgis2/page/app/hp
 *   - App description: https://geoportaal.maaruum.ee/est/kaardirakendused/huvipunktid/huvipunktide-kaardirakenduse-kirjeldus-p917.html
 * Category: Huvipunktid - Riigihaldus
 *
 * Danger Points are generated from public administration POI records.
 * Danger Zones are public-data proximity caution zones only.
 *
 * NOT OFFICIAL ALERTS.
 * NOT CONFIRMED THREAT AREAS.
 * NOT TARGET OR VULNERABILITY ASSESSMENTS.
 *
 * Do not edit individual coordinates manually unless verifying against
 * the official source. Refresh this file by rerunning:
 *   scripts/importDangerPoints.ts
 *
 * SafeRoute is not an official public-sector or emergency application.
 */

import type { DangerPoint } from './dangerPoints';

export const generatedDangerPoints: readonly DangerPoint[] = Object.freeze([
${records
  .map((r) => {
    const layerName = LAYER_NAMES[r.layerId];
    const safeId = JSON.stringify(`${r.layerId}:${r.id}`);
    return `  {
    id: ${safeId},
    name: ${JSON.stringify(r.name)},
    address: ${JSON.stringify(r.address)},
    municipality: ${JSON.stringify(r.municipality)},
    county: ${JSON.stringify(r.county)},
    lat: ${r.lat.toFixed(7)},
    lng: ${r.lng.toFixed(7)},
    category: 'Riigihaldus',
    dangerPointType: 'PUBLIC_ADMINISTRATION',
    dangerZoneType: 'PUBLIC_DATA_PROXIMITY_CAUTION',
    layerId: ${JSON.stringify(r.layerId)},
    layerName: ${JSON.stringify(layerName)},
    poiType: ${JSON.stringify(r.poiType)},
    dangerZoneRadiusMeters: ${DANGER_ZONE_DEFAULT_RADIUS_METERS},
    source: 'Maa- ja Ruumiamet / X-GIS Huvipunktid',
    officialDataset: true,
    verified: true,
    dataSnapshotDate: ${JSON.stringify(SNAPSHOT_DATE)},
    safetyDisclaimer:
      'Public-data proximity caution point only. Not an official threat alert.',
    originalProperties: ${JSON.stringify(r.originalProperties)},
  },`;
  })
  .join('\n')}
]);

export const generatedDangerPointsSnapshotDate = ${JSON.stringify(SNAPSHOT_DATE)};
`;
  return header;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('[importDangerPoints] Starting Riigihaldus POI import.');
  console.log(FEATURE_ENDPOINT_NOTE);

  if (!XGIS_FEATURE_ENDPOINT) {
    console.warn(
      '\n[importDangerPoints] XGIS_FEATURE_ENDPOINT is not configured.\n' +
        'Running in PLACEHOLDER mode: dangerPoints.generated.ts will NOT be ' +
        'overwritten. Set the env var to a documented public Maa- ja Ruumiamet ' +
        'feature endpoint (OGC API Features or WFS 2.0 GeoJSON) and re-run.\n',
    );
    return;
  }

  const seen = new Map<string, DangerPointRecord>();
  let totalFetched = 0;
  const perLayerCounts: Record<DangerPointLayerId, number> = {
    poi_administratiivkeskus: 0,
    poi_politsei: 0,
    poi_piirivalve: 0,
    poi_paastekomando: 0,
    poi_riigiasutus: 0,
    poi_valisesindus: 0,
  };

  for (const layerId of DANGER_POINT_LAYER_IDS) {
    const features = await fetchLayer(layerId);
    totalFetched += features.length;
    let normalizedCount = 0;
    for (let i = 0; i < features.length; i++) {
      const norm = await normalizeGeoJsonFeature(features[i], layerId, i);
      if (!norm) continue;
      const dedupKey = `${layerId}|${norm.id}|${norm.lat.toFixed(6)}|${norm.lng.toFixed(6)}`;
      if (seen.has(dedupKey)) continue;
      seen.set(dedupKey, { ...norm, layerId });
      normalizedCount++;
    }
    perLayerCounts[layerId] = normalizedCount;
    console.log(
      `[importDangerPoints] ${layerId}: fetched ${features.length}, kept ${normalizedCount}`,
    );
  }

  const records = [...seen.values()];
  console.log(
    `[importDangerPoints] Done. Total fetched: ${totalFetched}, total imported: ${records.length}`,
  );
  console.table(perLayerCounts);

  if (records.length === 0) {
    console.error(
      '[importDangerPoints] No records imported. Failing — verify the endpoint URL and the layer ids.',
    );
    process.exit(1);
  }

  const out = emitGeneratedFile(records);
  const outPath = resolve(process.cwd(), 'src/data/dangerPoints.generated.ts');
  await writeFile(outPath, out, 'utf8');
  console.log(`[importDangerPoints] Wrote ${outPath}`);
}

main().catch((err) => {
  console.error('[importDangerPoints] FAILED', err);
  process.exit(1);
});
