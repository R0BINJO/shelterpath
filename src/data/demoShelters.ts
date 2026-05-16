/*
 * LEGACY DEMO SHELTERS — kept only as emergency fallback if officialShelters
 * is empty. The app defaults to the Päästeamet open-data snapshot in
 * src/data/officialShelters.ts.
 *
 * These records are entirely fabricated for prototype demonstration and do NOT
 * correspond to real Tallinn shelters. They are NOT shown on the map by default.
 */

import type { OfficialShelter } from './officialShelters';

// HARDCODED DEMO SHELTER DATA — fallback only.
export const demoShelters: readonly OfficialShelter[] = Object.freeze([
  {
    id: 'demo-1',
    name: 'Rävala underground parking (demo)',
    address: 'Tallinn, Kesklinna linnaosa, Rävala pst (demo)',
    municipality: 'Tallinn',
    county: 'Harju maakond',
    lat: 59.4339,
    lng: 24.7536,
    type: 'SA3',
    source: 'Päästeamet',
    official: true,
    verified: true,
    dataSnapshotDate: '2026-05-16',
    originalProperties: {
      id: 'demo-1',
      nimi: 'Rävala underground parking (demo)',
      aadress: 'demo',
      lest_x: 0,
      lest_y: 0,
    },
  },
]);
