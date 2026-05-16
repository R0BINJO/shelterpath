/*
 * GENERATED / HARDCODED DANGER POINT DATA SNAPSHOT
 *
 * Source: Maa- ja Ruumiamet X-GIS Huvipunktid
 *   - Map app:          https://xgis.maaamet.ee/xgis2/page/app/hp
 *   - App description:  https://geoportaal.maaruum.ee/est/kaardirakendused/huvipunktid/huvipunktide-kaardirakenduse-kirjeldus-p917.html
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
 *
 * ---------------------------------------------------------------------------
 * NOTE ON THIS SNAPSHOT
 *
 * As of the snapshot date (2026-05-16) the Maa- ja Ruumiamet geoportal does
 * not document a public OGC API / WFS / GPKG endpoint for the
 * `poi_administratiivkeskus / poi_politsei / poi_piirivalve /
 *  poi_paastekomando / poi_riigiasutus / poi_valisesindus` layers of the
 * X-GIS Huvipunktid kaardirakendus. Only deep-links into the X-GIS web app
 * (`?setlegend=...`) are documented.
 *
 * Per the product rules we do NOT:
 *   - scrape rendered map pixels,
 *   - bypass access controls,
 *   - poke at internal/private endpoints,
 *   - or copy values out of the UI by hand.
 *
 * Therefore this generated file starts empty. The runtime app code and UI
 * are fully wired — the moment a public feature endpoint is confirmed,
 * scripts/importDangerPoints.ts will populate this array and the map
 * overlay + caution warning will light up with no additional changes.
 * ---------------------------------------------------------------------------
 */

import type { DangerPoint } from './dangerPoints';

export const generatedDangerPoints: readonly DangerPoint[] = Object.freeze([
  // PRODUCTION TODO: populate via scripts/importDangerPoints.ts once a public
  // feature endpoint is confirmed for the six Riigihaldus POI layers.
]);

export const generatedDangerPointsSnapshotDate = '2026-05-16';
