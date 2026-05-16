/*
 * SafeRoute Varjumine — Web map (MapLibre GL JS + OpenFreeMap).
 *
 * ONLINE DEMO MAP: OpenFreeMap OSM-based vector tiles, no API key.
 *   - bright style: https://tiles.openfreemap.org/styles/bright
 *   - dark   style: https://tiles.openfreemap.org/styles/dark
 *
 * Map layers:
 *   - saferoute-danger        (HARDCODED DEMO DANGER ZONE - visual only)
 *   - saferoute-dangerzones   (GENERATED PUBLIC-DATA PROXIMITY DANGER ZONES)
 *   - saferoute-dangerpoints  (Maa- ja Ruumiamet X-GIS Huvipunktid / Riigihaldus)
 *   - saferoute-route         (active route polyline)
 *   - saferoute-user          (user location dot + halo)
 *   - saferoute-shelters      (official Päästeamet snapshot, green SA3)
 *   - saferoute-userplaces    (USER SAVED PLACES — local-only, type-coloured)
 *
 * PRODUCTION OFFLINE MAP TODO: replace the online style with a local PMTiles file.
 */

import maplibregl, {
  type Map as MaplibreMap,
  type LngLatBoundsLike,
} from 'maplibre-gl';
// oxlint-disable-next-line import/no-unassigned-import -- MapLibre stylesheet
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';

import { SHELTER_COLORS } from '@/lib/constants';
import { DEMO_DANGER_ZONE, type Shelter } from '@/lib/shelters';
import {
  buildDangerZonePolygon,
  type DangerPoint,
} from '@/src/data/dangerPoints';
import { USER_PLACE_TYPE_META, type UserPlace } from '@/src/types/userPlaces';

import type {
  SafeRouteLayerVisibility,
  SafeRouteMapProps,
  SafeRouteMapStyle,
} from './SafeRouteMap.types';

const STYLE_URLS: Record<SafeRouteMapStyle, string> = {
  bright: 'https://tiles.openfreemap.org/styles/bright',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};

const ESTONIA_BOUNDS: LngLatBoundsLike = [
  [21.5, 57.4],
  [28.4, 59.9],
];

function dangerCirclePolygon(): GeoJSON.Feature<GeoJSON.Polygon> {
  const { centerLat, centerLng, radiusMeters } = DEMO_DANGER_ZONE;
  const points = 48;
  const coords: [number, number][] = [];
  const earth = 6378137;
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const dx =
      (radiusMeters * Math.cos(angle)) / (earth * Math.cos((centerLat * Math.PI) / 180));
    const dy = (radiusMeters * Math.sin(angle)) / earth;
    coords.push([
      centerLng + (dx * 180) / Math.PI,
      centerLat + (dy * 180) / Math.PI,
    ]);
  }
  return {
    type: 'Feature',
    properties: { label: 'Demo danger area' },
    geometry: { type: 'Polygon', coordinates: [coords] },
  };
}

function sheltersToGeoJson(
  shelters: readonly Shelter[],
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: shelters.map((s) => ({
      type: 'Feature',
      properties: {
        id: s.id,
        name: s.name,
        type: s.type,
        color: SHELTER_COLORS[s.type],
      },
      geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
    })),
  };
}

function userPlacesToGeoJson(
  places: readonly UserPlace[],
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: places.map((p) => ({
      type: 'Feature',
      properties: {
        id: p.id,
        label: p.label,
        type: p.type,
        color: USER_PLACE_TYPE_META[p.type].color,
      },
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
    })),
  };
}

function dangerPointsToGeoJson(
  points: readonly DangerPoint[],
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: points.map((p) => ({
      type: 'Feature',
      properties: {
        id: p.id,
        name: p.name,
        layerId: p.layerId,
        layerName: p.layerName,
      },
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
    })),
  };
}

function dangerZonesToGeoJson(
  points: readonly DangerPoint[],
): GeoJSON.FeatureCollection<GeoJSON.Polygon> {
  return {
    type: 'FeatureCollection',
    features: points.map((p) => ({
      type: 'Feature',
      properties: { id: `zone:${p.id}`, dangerPointId: p.id },
      geometry: {
        type: 'Polygon',
        coordinates: [
          buildDangerZonePolygon(p.lat, p.lng, p.dangerZoneRadiusMeters),
        ],
      },
    })),
  };
}

function routeFeature(coords: [number, number][]): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: coords },
  };
}

function setLayerVisible(map: MaplibreMap, id: string, visible: boolean) {
  if (!map.getLayer(id)) return;
  map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
}

export default function SafeRouteMap({
  shelters,
  selectedShelterId,
  userPlaces,
  selectedUserPlaceId,
  dangerPoints,
  selectedDangerPointId,
  route,
  userLocation,
  isLiveUserLocation,
  crisisMode,
  mapStyle,
  layerVisibility,
  manualPinMode,
  onSelectShelter,
  onSelectUserPlace,
  onSelectDangerPoint,
  recenterToken,
  fitRouteToken,
  flyToToken,
  flyToTarget,
  onCenterChange,
}: SafeRouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const styleLoadedRef = useRef(false);
  const onSelectShelterRef = useRef(onSelectShelter);
  onSelectShelterRef.current = onSelectShelter;
  const onSelectUserPlaceRef = useRef(onSelectUserPlace);
  onSelectUserPlaceRef.current = onSelectUserPlace;
  const onSelectDangerPointRef = useRef(onSelectDangerPoint);
  onSelectDangerPointRef.current = onSelectDangerPoint;
  const sheltersRef = useRef(shelters);
  sheltersRef.current = shelters;
  const selectedRef = useRef(selectedShelterId);
  selectedRef.current = selectedShelterId;
  const userPlacesRef = useRef(userPlaces);
  userPlacesRef.current = userPlaces;
  const selectedUserPlaceRef = useRef(selectedUserPlaceId);
  selectedUserPlaceRef.current = selectedUserPlaceId;
  const dangerPointsRef = useRef(dangerPoints);
  dangerPointsRef.current = dangerPoints;
  const selectedDangerPointRef = useRef(selectedDangerPointId);
  selectedDangerPointRef.current = selectedDangerPointId;
  const routeRef = useRef(route);
  routeRef.current = route;
  const userLocationRef = useRef(userLocation);
  userLocationRef.current = userLocation;
  const layerVisibilityRef = useRef(layerVisibility);
  layerVisibilityRef.current = layerVisibility;
  const onCenterChangeRef = useRef(onCenterChange);
  onCenterChangeRef.current = onCenterChange;
  const isFirstStyleEffect = useRef(true);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URLS[crisisMode ? 'dark' : mapStyle],
      center: [userLocation.lng, userLocation.lat],
      zoom: 13,
      maxBounds: ESTONIA_BOUNDS,
      dragPan: true,
      scrollZoom: true,
      touchZoomRotate: true,
      cooperativeGestures: false,
      attributionControl: { compact: true },
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: false,
        showAccuracyCircle: true,
      }),
      'top-right',
    );

    const handleStyleLoad = () => {
      styleLoadedRef.current = true;
      attachLayers(map);
    };
    map.on('load', handleStyleLoad);
    map.on('style.load', handleStyleLoad);

    map.on('move', () => {
      const c = map.getCenter();
      onCenterChangeRef.current?.({ lat: c.lat, lng: c.lng });
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      styleLoadedRef.current = false;
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- init-once effect
  }, []);

  // Switch style when crisis mode / map style flips.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (isFirstStyleEffect.current) {
      isFirstStyleEffect.current = false;
      return;
    }
    styleLoadedRef.current = false;
    map.setStyle(STYLE_URLS[crisisMode ? 'dark' : mapStyle], { diff: false });
  }, [crisisMode, mapStyle]);

  // Data updates.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoadedRef.current) return;
    updateData(map, {
      shelters,
      selectedShelterId,
      userPlaces,
      selectedUserPlaceId,
      dangerPoints,
      selectedDangerPointId,
      routeCoords: route?.coordinates ?? null,
      userLocation,
      layerVisibility,
    });
  }, [
    shelters,
    selectedShelterId,
    userPlaces,
    selectedUserPlaceId,
    dangerPoints,
    selectedDangerPointId,
    route,
    userLocation,
    layerVisibility,
  ]);

  // Imperative recenter.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || recenterToken === undefined) return;
    map.easeTo({ center: [userLocation.lng, userLocation.lat], zoom: 14, duration: 600 });
  }, [recenterToken, userLocation]);

  // Imperative flyTo (used to preview a geocoded address).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || flyToToken === undefined || !flyToTarget) return;
    map.flyTo({ center: [flyToTarget.lng, flyToTarget.lat], zoom: 16, duration: 700 });
  }, [flyToToken, flyToTarget]);

  // Imperative fit-to-route.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || fitRouteToken === undefined || !route) return;
    const coords = route.coordinates;
    if (coords.length < 2) return;
    const bounds = coords.reduce(
      (b, c) => b.extend(c as [number, number]),
      new maplibregl.LngLatBounds(coords[0], coords[0]),
    );
    map.fitBounds(bounds, {
      padding: { top: 100, bottom: 360, left: 60, right: 60 },
      maxZoom: 16,
      duration: 700,
    });
  }, [fitRouteToken, route]);

  function attachLayers(map: MaplibreMap) {
    const currentShelters = sheltersRef.current;
    const currentSelected = selectedRef.current;
    const currentUserPlaces = userPlacesRef.current;
    const currentSelectedUserPlace = selectedUserPlaceRef.current;
    const currentDangerPoints = dangerPointsRef.current;
    const currentSelectedDangerPoint = selectedDangerPointRef.current;
    const currentRoute = routeRef.current;
    const currentUser = userLocationRef.current;

    if (!map.getSource('saferoute-danger')) {
      map.addSource('saferoute-danger', { type: 'geojson', data: dangerCirclePolygon() });
      map.addLayer({
        id: 'saferoute-danger-fill',
        type: 'fill',
        source: 'saferoute-danger',
        paint: { 'fill-color': SHELTER_COLORS.danger, 'fill-opacity': 0.7 },
      });
      map.addLayer({
        id: 'saferoute-danger-line',
        type: 'line',
        source: 'saferoute-danger',
        paint: {
          'line-color': SHELTER_COLORS.dangerStroke,
          'line-width': 2,
          'line-dasharray': [3, 2],
        },
      });
    }

    if (!map.getSource('saferoute-route')) {
      map.addSource('saferoute-route', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'saferoute-route-casing',
        type: 'line',
        source: 'saferoute-route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#ffffff', 'line-width': 9, 'line-opacity': 0.85 },
      });
      map.addLayer({
        id: 'saferoute-route-line',
        type: 'line',
        source: 'saferoute-route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': SHELTER_COLORS.route, 'line-width': 5.5 },
      });
    }

    if (!map.getSource('saferoute-user')) {
      map.addSource('saferoute-user', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'Point', coordinates: [currentUser.lng, currentUser.lat] },
        },
      });
      map.addLayer({
        id: 'saferoute-user-halo',
        type: 'circle',
        source: 'saferoute-user',
        paint: {
          'circle-radius': 18,
          'circle-color': SHELTER_COLORS.user,
          'circle-opacity': 0.18,
        },
      });
      map.addLayer({
        id: 'saferoute-user-dot',
        type: 'circle',
        source: 'saferoute-user',
        paint: {
          'circle-radius': 7,
          'circle-color': SHELTER_COLORS.user,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
        },
      });
    }

    if (!map.getSource('saferoute-shelters')) {
      map.addSource('saferoute-shelters', {
        type: 'geojson',
        data: sheltersToGeoJson(currentShelters),
        cluster: true,
        clusterRadius: 48,
        clusterMaxZoom: 12,
      });

      map.addLayer({
        id: 'saferoute-clusters',
        type: 'circle',
        source: 'saferoute-shelters',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': SHELTER_COLORS.SA3,
          'circle-opacity': 0.85,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            16,
            10,
            20,
            25,
            24,
            50,
            30,
          ],
        },
      });
      map.addLayer({
        id: 'saferoute-cluster-count',
        type: 'symbol',
        source: 'saferoute-shelters',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-size': 12,
          'text-font': ['Noto Sans Bold', 'Open Sans Bold', 'Arial Unicode MS Bold'],
        },
        paint: { 'text-color': '#0b1320' },
      });

      map.addLayer({
        id: 'saferoute-shelters-halo',
        type: 'circle',
        source: 'saferoute-shelters',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': [
            'case',
            ['==', ['get', 'id'], currentSelected ?? ''],
            22,
            0,
          ],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.25,
        },
      });
      map.addLayer({
        id: 'saferoute-shelters-circle',
        type: 'circle',
        source: 'saferoute-shelters',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': [
            'case',
            ['==', ['get', 'id'], currentSelected ?? ''],
            14,
            10,
          ],
          'circle-color': ['get', 'color'],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2.5,
        },
      });

      map.on('click', 'saferoute-clusters', (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const src = map.getSource('saferoute-shelters') as maplibregl.GeoJSONSource;
        const clusterId = f.properties?.cluster_id as number | undefined;
        if (clusterId == null) return;
        src.getClusterExpansionZoom(clusterId).then((zoom) => {
          const coords = (f.geometry as GeoJSON.Point).coordinates as [number, number];
          map.easeTo({ center: coords, zoom });
        }).catch(() => {});
      });

      map.on('click', 'saferoute-shelters-circle', (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const id = String(f.properties?.id ?? '');
        const found = sheltersRef.current.find((s) => s.id === id);
        if (found) onSelectShelterRef.current(found);
      });
      map.on('mouseenter', 'saferoute-shelters-circle', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'saferoute-shelters-circle', () => {
        map.getCanvas().style.cursor = '';
      });
      map.on('mouseenter', 'saferoute-clusters', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'saferoute-clusters', () => {
        map.getCanvas().style.cursor = '';
      });
    }

    // USER SAVED PLACES layer — different marker shape (diamond-ish square with
    // outline) so it visually contrasts with the round green shelter dots.
    if (!map.getSource('saferoute-userplaces')) {
      map.addSource('saferoute-userplaces', {
        type: 'geojson',
        data: userPlacesToGeoJson(currentUserPlaces),
      });

      map.addLayer({
        id: 'saferoute-userplaces-halo',
        type: 'circle',
        source: 'saferoute-userplaces',
        paint: {
          'circle-radius': [
            'case',
            ['==', ['get', 'id'], currentSelectedUserPlace ?? ''],
            22,
            0,
          ],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.3,
        },
      });
      map.addLayer({
        id: 'saferoute-userplaces-square',
        type: 'circle',
        source: 'saferoute-userplaces',
        paint: {
          'circle-radius': [
            'case',
            ['==', ['get', 'id'], currentSelectedUserPlace ?? ''],
            13,
            10,
          ],
          'circle-color': ['get', 'color'],
          'circle-stroke-color': '#0b1320',
          'circle-stroke-width': 3,
        },
      });

      map.on('click', 'saferoute-userplaces-square', (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const id = String(f.properties?.id ?? '');
        const found = userPlacesRef.current.find((p) => p.id === id);
        if (found) onSelectUserPlaceRef.current(found);
      });
      map.on('mouseenter', 'saferoute-userplaces-square', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'saferoute-userplaces-square', () => {
        map.getCanvas().style.cursor = '';
      });
    }

    // PUBLIC-DATA DANGER ZONES — translucent orange/red proximity caution
    // polygons around each Riigihaldus POI Danger Point. They MUST sit below
    // the shelter and saved-place markers so they never hide them.
    if (!map.getSource('saferoute-dangerzones')) {
      map.addSource('saferoute-dangerzones', {
        type: 'geojson',
        data: dangerZonesToGeoJson(currentDangerPoints),
      });
      // Insert BELOW the shelter halo so green shelter dots stay legible.
      const beforeId = map.getLayer('saferoute-shelters-halo')
        ? 'saferoute-shelters-halo'
        : undefined;
      map.addLayer(
        {
          id: 'saferoute-dangerzones-fill',
          type: 'fill',
          source: 'saferoute-dangerzones',
          paint: {
            'fill-color': '#ef4444',
            'fill-opacity': 0.12,
          },
        },
        beforeId,
      );
      map.addLayer(
        {
          id: 'saferoute-dangerzones-line',
          type: 'line',
          source: 'saferoute-dangerzones',
          paint: {
            'line-color': '#f97316',
            'line-width': 1.5,
            'line-opacity': 0.7,
            'line-dasharray': [3, 2],
          },
        },
        beforeId,
      );
    }

    // PUBLIC-DATA DANGER POINTS — orange warning markers (visually distinct
    // from green shelter dots and from coloured saved-place squares).
    if (!map.getSource('saferoute-dangerpoints')) {
      map.addSource('saferoute-dangerpoints', {
        type: 'geojson',
        data: dangerPointsToGeoJson(currentDangerPoints),
      });
      map.addLayer({
        id: 'saferoute-dangerpoints-halo',
        type: 'circle',
        source: 'saferoute-dangerpoints',
        paint: {
          'circle-radius': [
            'case',
            ['==', ['get', 'id'], currentSelectedDangerPoint ?? ''],
            22,
            0,
          ],
          'circle-color': '#f97316',
          'circle-opacity': 0.3,
        },
      });
      map.addLayer({
        id: 'saferoute-dangerpoints-circle',
        type: 'circle',
        source: 'saferoute-dangerpoints',
        paint: {
          'circle-radius': [
            'case',
            ['==', ['get', 'id'], currentSelectedDangerPoint ?? ''],
            13,
            9,
          ],
          'circle-color': '#f97316',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2.5,
        },
      });

      map.on('click', 'saferoute-dangerpoints-circle', (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const id = String(f.properties?.id ?? '');
        const found = dangerPointsRef.current.find((p) => p.id === id);
        if (found) onSelectDangerPointRef.current(found);
      });
      map.on('mouseenter', 'saferoute-dangerpoints-circle', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'saferoute-dangerpoints-circle', () => {
        map.getCanvas().style.cursor = '';
      });
    }

    updateData(map, {
      shelters: currentShelters,
      selectedShelterId: currentSelected,
      userPlaces: currentUserPlaces,
      selectedUserPlaceId: currentSelectedUserPlace,
      dangerPoints: currentDangerPoints,
      selectedDangerPointId: currentSelectedDangerPoint,
      routeCoords: currentRoute?.coordinates ?? null,
      userLocation: currentUser,
      layerVisibility: layerVisibilityRef.current,
    });
  }

  function getGeoJsonSource(map: MaplibreMap, id: string): maplibregl.GeoJSONSource | undefined {
    return map.getSource(id) as maplibregl.GeoJSONSource | undefined;
  }

  function updateData(
    map: MaplibreMap,
    args: {
      shelters: readonly Shelter[];
      selectedShelterId: string | null;
      userPlaces: readonly UserPlace[];
      selectedUserPlaceId: string | null;
      dangerPoints: readonly DangerPoint[];
      selectedDangerPointId: string | null;
      routeCoords: [number, number][] | null;
      userLocation: { lat: number; lng: number };
      layerVisibility: SafeRouteLayerVisibility;
    },
  ) {
    const shelterSrc = getGeoJsonSource(map, 'saferoute-shelters');
    shelterSrc?.setData(sheltersToGeoJson(args.shelters));
    if (map.getLayer('saferoute-shelters-halo')) {
      map.setPaintProperty('saferoute-shelters-halo', 'circle-radius', [
        'case',
        ['==', ['get', 'id'], args.selectedShelterId ?? ''],
        22,
        0,
      ]);
      map.setPaintProperty('saferoute-shelters-circle', 'circle-radius', [
        'case',
        ['==', ['get', 'id'], args.selectedShelterId ?? ''],
        14,
        10,
      ]);
    }

    const userPlacesSrc = getGeoJsonSource(map, 'saferoute-userplaces');
    userPlacesSrc?.setData(userPlacesToGeoJson(args.userPlaces));
    if (map.getLayer('saferoute-userplaces-halo')) {
      map.setPaintProperty('saferoute-userplaces-halo', 'circle-radius', [
        'case',
        ['==', ['get', 'id'], args.selectedUserPlaceId ?? ''],
        22,
        0,
      ]);
      map.setPaintProperty('saferoute-userplaces-square', 'circle-radius', [
        'case',
        ['==', ['get', 'id'], args.selectedUserPlaceId ?? ''],
        13,
        10,
      ]);
    }

    const dangerPointsSrc = getGeoJsonSource(map, 'saferoute-dangerpoints');
    dangerPointsSrc?.setData(dangerPointsToGeoJson(args.dangerPoints));
    const dangerZonesSrc = getGeoJsonSource(map, 'saferoute-dangerzones');
    dangerZonesSrc?.setData(dangerZonesToGeoJson(args.dangerPoints));
    if (map.getLayer('saferoute-dangerpoints-halo')) {
      map.setPaintProperty('saferoute-dangerpoints-halo', 'circle-radius', [
        'case',
        ['==', ['get', 'id'], args.selectedDangerPointId ?? ''],
        22,
        0,
      ]);
      map.setPaintProperty('saferoute-dangerpoints-circle', 'circle-radius', [
        'case',
        ['==', ['get', 'id'], args.selectedDangerPointId ?? ''],
        13,
        9,
      ]);
    }

    const routeSrc = getGeoJsonSource(map, 'saferoute-route');
    if (routeSrc) {
      const data: GeoJSON.FeatureCollection<GeoJSON.LineString> = args.routeCoords
        ? { type: 'FeatureCollection', features: [routeFeature(args.routeCoords)] }
        : { type: 'FeatureCollection', features: [] };
      routeSrc.setData(data);
    }

    const userSrc = getGeoJsonSource(map, 'saferoute-user');
    userSrc?.setData({
      type: 'Feature',
      properties: {},
      geometry: { type: 'Point', coordinates: [args.userLocation.lng, args.userLocation.lat] },
    });

    // Layer visibility toggles.
    const v = args.layerVisibility;
    setLayerVisible(map, 'saferoute-shelters-halo', v.shelters);
    setLayerVisible(map, 'saferoute-shelters-circle', v.shelters);
    setLayerVisible(map, 'saferoute-clusters', v.shelters);
    setLayerVisible(map, 'saferoute-cluster-count', v.shelters);
    setLayerVisible(map, 'saferoute-userplaces-halo', v.savedPlaces);
    setLayerVisible(map, 'saferoute-userplaces-square', v.savedPlaces);
    setLayerVisible(map, 'saferoute-danger-fill', v.danger);
    setLayerVisible(map, 'saferoute-danger-line', v.danger);
    setLayerVisible(map, 'saferoute-dangerzones-fill', v.dangerZones);
    setLayerVisible(map, 'saferoute-dangerzones-line', v.dangerZones);
    setLayerVisible(map, 'saferoute-dangerpoints-halo', v.dangerPoints);
    setLayerVisible(map, 'saferoute-dangerpoints-circle', v.dangerPoints);
  }

  void isLiveUserLocation;

  return (
    <View style={{ flex: 1, position: 'relative' }}>
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', minHeight: 200 }}
      />
      {manualPinMode ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            inset: 0,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              borderWidth: 3,
              borderColor: '#ffffff',
              backgroundColor: '#a855f7',
              shadowColor: '#000',
              shadowOpacity: 0.35,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
            }}
          />
          <View
            style={{
              position: 'absolute',
              width: 2,
              height: 56,
              top: '50%',
              backgroundColor: 'rgba(255,255,255,0.5)',
            }}
          />
          <View
            style={{
              position: 'absolute',
              height: 2,
              width: 56,
              left: '50%',
              backgroundColor: 'rgba(255,255,255,0.5)',
            }}
          />
        </View>
      ) : null}
    </View>
  );
}
