/*
 * scripts/importOfficialShelters.ts
 *
 * Refresh the hardcoded Päästeamet shelter snapshot.
 *
 *   1. download or read the Päästeamet CSV
 *      (https://opendata.smit.ee/gis/varjumiskohad.csv)
 *   2. detect coordinate fields (lest_x / lest_y, lat / lng, etc.)
 *   3. normalize field names (nimi → name, aadress → address, …)
 *   4. convert L-EST97 / EPSG:3301 → WGS84 if needed (proj4)
 *   5. write src/data/officialShelters.generated.ts
 *   6. warn about rows without coordinates
 *   7. preserve original source columns under originalProperties
 *
 * Run manually:
 *   npx tsx scripts/importOfficialShelters.ts
 *
 * Notes:
 *   - The runtime in src/data/officialShelters.ts already embeds the raw rows
 *     AND the conversion math, so refreshing the dataset is a one-shot edit of
 *     the RAW_ROWS array in that file. This script is the canonical recipe for
 *     producing that array from the public CSV.
 *   - We deliberately do not import this script from app code. Shelter data is
 *     a static snapshot bundled with the app.
 */

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

import proj4 from 'proj4'; // run `npm i -D proj4 @types/proj4` before invoking

// L-EST97 / EPSG:3301
proj4.defs(
  'EPSG:3301',
  '+proj=lcc +lat_1=59.33333333333334 +lat_2=58 +lat_0=57.51755393055556 ' +
    '+lon_0=24 +x_0=500000 +y_0=6375000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 ' +
    '+units=m +no_defs',
);

const CSV_URL = 'https://opendata.smit.ee/gis/varjumiskohad.csv';
const OUT_PATH = resolve(__dirname, '../src/data/officialShelters.generated.ts');

type NormalizedRow = {
  id: string;
  name: string;
  address: string;
  county: string;
  municipality: string;
  lat: number;
  lng: number;
  originalProperties: Record<string, string | number>;
};

const NAME_FIELDS = ['name', 'nimi', 'nimetus', 'objekti_nimi', 'varjumiskoht', 'title'];
const ADDR_FIELDS = ['address', 'aadress', 'taisaadress', 'täisaadress', 'asukoht'];
const MUNI_FIELDS = ['omavalitsus', 'kov', 'municipality', 'local_government'];
const COUNTY_FIELDS = ['maakond', 'county'];
const LON_FIELDS = ['lon', 'lng', 'longitude', 'x', 'pikkus', 'geox'];
const LAT_FIELDS = ['lat', 'latitude', 'y', 'laius', 'geoy'];
// In the Päästeamet CSV, x/y are projected; field names are lest_x / lest_y.
const PROJ_X_FIELDS = ['lest_x', 'x_lest', 'x_proj'];
const PROJ_Y_FIELDS = ['lest_y', 'y_lest', 'y_proj'];

function pick(row: Record<string, string>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = row[k] ?? row[k.toUpperCase()];
    if (v != null && v !== '') return v;
  }
  return undefined;
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  const headerLine = lines.shift();
  if (!headerLine) return [];
  const sep = headerLine.includes(';') ? ';' : ',';
  const headers = splitCsvLine(headerLine, sep).map((h) =>
    h.replace(/^"|"$/g, '').trim().toLowerCase(),
  );
  return lines.map((line) => {
    const cells = splitCsvLine(line, sep);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = (cells[i] ?? '').replace(/^"|"$/g, '').trim();
    });
    return row;
  });
}

function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQ = !inQ;
      cur += c;
      continue;
    }
    if (c === sep && !inQ) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

function inEstoniaBbox(lat: number, lng: number): boolean {
  return lat >= 57 && lat <= 60 && lng >= 21 && lng <= 29;
}

function normalize(row: Record<string, string>): NormalizedRow | null {
  const id = (row.id ?? row.ID ?? '').toString();
  const name = pick(row, NAME_FIELDS) ?? '';
  const address = pick(row, ADDR_FIELDS) ?? '';
  const county =
    pick(row, COUNTY_FIELDS) ?? address.split(',')[0]?.trim() ?? '';
  const municipality =
    pick(row, MUNI_FIELDS) ?? address.split(',')[1]?.trim() ?? '';

  // First try plain WGS84 fields.
  const lngRaw = pick(row, LON_FIELDS);
  const latRaw = pick(row, LAT_FIELDS);
  let lat = latRaw ? Number(latRaw) : NaN;
  let lng = lngRaw ? Number(lngRaw) : NaN;

  // Otherwise look for projected L-EST97 coords.
  if (!inEstoniaBbox(lat, lng)) {
    const projXRaw = pick(row, PROJ_X_FIELDS);
    const projYRaw = pick(row, PROJ_Y_FIELDS);
    if (projXRaw && projYRaw) {
      // CSV ships lest_x = northing, lest_y = easting (yes, swapped names).
      const northing = Number(projXRaw);
      const easting = Number(projYRaw);
      const [lon, latP] = proj4('EPSG:3301', 'EPSG:4326', [easting, northing]);
      lat = latP;
      lng = lon;
    }
  }

  if (!inEstoniaBbox(lat, lng)) {
    console.warn(`[importOfficialShelters] drop ${id} "${name}" — no usable coords`);
    return null;
  }

  return {
    id,
    name,
    address,
    county,
    municipality,
    lat: +lat.toFixed(6),
    lng: +lng.toFixed(6),
    originalProperties: row,
  };
}

async function loadCsv(): Promise<string> {
  const localPath = resolve(__dirname, '../data/varjumiskohad.csv');
  if (existsSync(localPath)) {
    return readFileSync(localPath, 'utf8');
  }
  const res = await fetch(CSV_URL);
  if (!res.ok) throw new Error(`CSV download failed: HTTP ${res.status}`);
  return res.text();
}

async function main() {
  console.log('Fetching Päästeamet shelters CSV from', CSV_URL);
  const text = await loadCsv();
  const rows = parseCsv(text);
  console.log(`Parsed ${rows.length} rows`);

  const normalized: NormalizedRow[] = [];
  for (const r of rows) {
    const n = normalize(r);
    if (n) normalized.push(n);
  }
  console.log(`Kept ${normalized.length} rows with valid WGS84 coordinates`);

  const header = `/*
 * GENERATED / HARDCODED SHELTER DATA SNAPSHOT
 * Source: Päästeamet avalikud varjumiskohad open data
 *   ${CSV_URL}
 * Do not edit individual coordinates manually unless verifying against official source.
 * Refresh this file by rerunning scripts/importOfficialShelters.ts.
 */
import type { OfficialShelter } from './officialShelters';

export const officialSheltersGenerated: readonly OfficialShelter[] = Object.freeze(${JSON.stringify(
    normalized.map((n) => ({
      id: n.id,
      name: n.name,
      address: n.address,
      municipality: n.municipality,
      county: n.county,
      lat: n.lat,
      lng: n.lng,
      type: 'SA3' as const,
      source: 'Päästeamet' as const,
      official: true as const,
      verified: true as const,
      dataSnapshotDate: '2026-05-16' as const,
      originalProperties: n.originalProperties,
    })),
    null,
    2,
  )});
`;

  writeFileSync(OUT_PATH, header, 'utf8');
  console.log(`Wrote ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
