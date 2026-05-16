/*
 * SafeRoute Varjumine — address geocoding.
 *
 * PROTOTYPE GEOCODING ENDPOINT: Photon public API. Suitable for MVP/demo only.
 * Production should self-host Photon/Pelias or use a managed geocoder.
 *
 * ADDRESS SEARCH REQUIRES INTERNET.
 * SAVED PLACES WORK OFFLINE AFTER SAVING.
 *
 * Notes:
 *   - Photon is OSM-based, free, no API key.
 *   - We debounce searches at the call site (700ms) and require 3+ chars.
 *   - We bias around the user's current location with lat/lon and ask Photon
 *     for et-language results.
 *   - Nominatim is intentionally NOT used for autocomplete (their usage policy
 *     forbids it). It's only allowed behind an explicit "Search once" button.
 *   - Coordinates outside Estonia's bbox are dropped.
 *
 * PRODUCTION TODO: self-host Photon/Pelias or use a managed geocoder.
 */

export const PHOTON_ENDPOINT = 'https://photon.komoot.io/api/';
export const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/search';

const FETCH_TIMEOUT_MS = 6000;

export type GeocodeResult = {
  id: string;
  displayName: string;
  address: string;
  secondaryLine: string;
  lat: number;
  lng: number;
  source: 'photon' | 'nominatim-fallback';
  raw: unknown;
};

export function validateEstoniaCoordinates(lat: number, lng: number): boolean {
  return lat >= 57 && lat <= 60 && lng >= 21 && lng <= 29;
}

type PhotonFeature = {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: Record<string, unknown>;
};

type PhotonResponse = {
  features?: PhotonFeature[];
};

function getString(o: Record<string, unknown>, k: string): string | undefined {
  const v = o[k];
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined;
}

export function buildDisplayName(props: Record<string, unknown>): {
  primary: string;
  secondary: string;
} {
  const name = getString(props, 'name');
  const street = getString(props, 'street');
  const housenumber = getString(props, 'housenumber');
  const city = getString(props, 'city');
  const district = getString(props, 'district') ?? getString(props, 'suburb');
  const postcode = getString(props, 'postcode');
  const country = getString(props, 'country');
  const state = getString(props, 'state');

  const streetLine = [street, housenumber].filter(Boolean).join(' ');
  const primary = name ?? streetLine ?? city ?? 'Unnamed location';

  const secondaryParts: string[] = [];
  if (name && streetLine && streetLine !== name) secondaryParts.push(streetLine);
  if (city) secondaryParts.push(city);
  else if (district) secondaryParts.push(district);
  if (state && state !== city) secondaryParts.push(state);
  if (postcode) secondaryParts.push(postcode);
  if (country) secondaryParts.push(country);

  return {
    primary,
    secondary: secondaryParts.join(', '),
  };
}

export function normalizePhotonResult(
  feature: PhotonFeature,
  index: number,
): GeocodeResult | null {
  const coords = feature?.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const lng = coords[0];
  const lat = coords[1];
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (!validateEstoniaCoordinates(lat, lng)) return null;

  const props = feature.properties ?? {};
  const { primary, secondary } = buildDisplayName(props);

  return {
    id: `photon_${index}_${lat.toFixed(5)}_${lng.toFixed(5)}`,
    displayName: secondary ? `${primary} — ${secondary}` : primary,
    address: primary,
    secondaryLine: secondary,
    lat,
    lng,
    source: 'photon',
    raw: feature,
  };
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(t);
    return res;
  } catch {
    return null;
  }
}

export type GeocodingError =
  | { kind: 'too-short' }
  | { kind: 'no-results' }
  | { kind: 'no-estonia-results' }
  | { kind: 'network' };

/**
 * PROTOTYPE GEOCODING ENDPOINT: Photon public API.
 * Returns either results (possibly empty after Estonia filter) or an error.
 */
export async function searchAddress(
  query: string,
  biasPoint?: { lat: number; lng: number },
): Promise<{ ok: true; results: GeocodeResult[] } | { ok: false; error: GeocodingError }> {
  const q = query.trim();
  if (q.length < 3) return { ok: false, error: { kind: 'too-short' } };

  const params = new URLSearchParams();
  params.set('q', q);
  params.set('limit', '5');
  params.set('lang', 'et');
  if (biasPoint) {
    params.set('lat', String(biasPoint.lat));
    params.set('lon', String(biasPoint.lng));
  }
  const url = `${PHOTON_ENDPOINT}?${params.toString()}`;

  const res = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
  if (!res || !res.ok) {
    return { ok: false, error: { kind: 'network' } };
  }
  let data: PhotonResponse;
  try {
    data = (await res.json()) as PhotonResponse;
  } catch {
    return { ok: false, error: { kind: 'network' } };
  }
  const features = Array.isArray(data.features) ? data.features : [];
  if (features.length === 0) return { ok: false, error: { kind: 'no-results' } };

  const normalized = features
    .map((f, i) => normalizePhotonResult(f, i))
    .filter((r): r is GeocodeResult => r !== null);

  if (normalized.length === 0) {
    return { ok: false, error: { kind: 'no-estonia-results' } };
  }
  return { ok: true, results: normalized };
}

/**
 * Manual fallback when Photon fails.
 * Only run on an explicit user gesture ("Search once" button) — Nominatim's
 * fair-use policy forbids autocomplete.
 */
export async function searchAddressNominatimOnce(
  query: string,
): Promise<{ ok: true; results: GeocodeResult[] } | { ok: false; error: GeocodingError }> {
  const q = query.trim();
  if (q.length < 3) return { ok: false, error: { kind: 'too-short' } };

  const params = new URLSearchParams();
  params.set('q', q);
  params.set('format', 'jsonv2');
  params.set('limit', '5');
  params.set('countrycodes', 'ee');
  const url = `${NOMINATIM_ENDPOINT}?${params.toString()}`;
  const res = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
  if (!res || !res.ok) return { ok: false, error: { kind: 'network' } };
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return { ok: false, error: { kind: 'network' } };
  }
  if (!Array.isArray(data)) return { ok: false, error: { kind: 'no-results' } };

  const results: GeocodeResult[] = [];
  for (let i = 0; i < data.length; i++) {
    const row = data[i] as Record<string, unknown>;
    const lat = Number(row.lat);
    const lng = Number(row.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (!validateEstoniaCoordinates(lat, lng)) continue;
    const display = typeof row.display_name === 'string' ? row.display_name : 'Address';
    const [primary, ...rest] = display.split(',');
    const secondary = rest.join(',').trim();
    results.push({
      id: `nominatim_${i}_${lat.toFixed(5)}_${lng.toFixed(5)}`,
      displayName: display,
      address: primary?.trim() ?? display,
      secondaryLine: secondary,
      lat,
      lng,
      source: 'nominatim-fallback',
      raw: row,
    });
  }
  if (results.length === 0) return { ok: false, error: { kind: 'no-estonia-results' } };
  return { ok: true, results };
}

export function describeGeocodingError(error: GeocodingError): string {
  switch (error.kind) {
    case 'too-short':
      return 'Type at least 3 characters to search.';
    case 'no-results':
      return 'No address matches. Try a more specific query.';
    case 'no-estonia-results':
      return 'No suitable Estonia address found. Try a more specific address.';
    case 'network':
    default:
      return 'Address search unavailable. You can place a pin manually on the map.';
  }
}
