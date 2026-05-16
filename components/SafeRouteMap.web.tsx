/*
 * SafeRoute Varjumine — Web map (MapLibre GL JS + OpenFreeMap).
 *
 * ONLINE DEMO MAP: OpenFreeMap OSM-based vector tiles, no API key.
 *   - bright style: https://tiles.openfreemap.org/styles/bright
 *   - dark   style: https://tiles.openfreemap.org/styles/dark
 *
 * PRODUCTION OFFLINE MAP TODO: replace the online style with a local PMTiles
 * file (e.g. /maps/estonia.pmtiles). Sketch:
 *
 *   import maplibregl from 'maplibre-gl';
 *   import { Protocol } from 'pmtiles';
 *   const protocol = new Protocol();
 *   maplibregl.addProtocol('pmtiles', protocol.tile);
 *
 * Do NOT bulk-download OpenStreetMap raster tiles in production.
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

import type { SafeRouteMapProps, SafeRouteMapStyle } from './SafeRouteMap.types';

const STYLE_URLS: Record<SafeRouteMapStyle, string> = {
  bright: 'https://tiles.openfreemap.org/styles/bright',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};

// Estonia bounding box (loose) — gives users freedom to pan across the country
// without losing context.
const ESTONIA_BOUNDS: LngLatBoundsLike = [
  [21.5, 57.4], // SW
  [28.4, 59.9], // NE
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

function routeFeature(coords: [number, number][]): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: coords },
  };
}

export default function SafeRouteMap({
  shelters,
  selectedShelterId,
  route,
  userLocation,
  isLiveUserLocation,
  crisisMode,
  mapStyle,
  onSelectShelter,
  recenterToken,
  fitRouteToken,
}: SafeRouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const styleLoadedRef = useRef(false);
  const onSelectRef = useRef(onSelectShelter);
  onSelectRef.current = onSelectShelter;
  const sheltersRef = useRef(shelters);
  sheltersRef.current = shelters;
  const selectedRef = useRef(selectedShelterId);
  selectedRef.current = selectedShelterId;
  const routeRef = useRef(route);
  routeRef.current = route;
  const userLocationRef = useRef(userLocation);
  userLocationRef.current = userLocation;

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

    map.on('load', () => {
      styleLoadedRef.current = true;
      attachLayers(map);
    });

    map.on('styledata', () => {
      if (map.isStyleLoaded()) {
        styleLoadedRef.current = true;
        attachLayers(map);
      }
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      styleLoadedRef.current = false;
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- init-once effect
  }, []);

  // Switch style when crisis mode flips.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(STYLE_URLS[crisisMode ? 'dark' : mapStyle]);
    styleLoadedRef.current = false;
  }, [crisisMode, mapStyle]);

  // Push data updates whenever shelters / route / selection / user-location change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoadedRef.current) return;
    updateData(map, {
      shelters,
      selectedShelterId,
      routeCoords: route?.coordinates ?? null,
      userLocation,
    });
  }, [shelters, selectedShelterId, route, userLocation]);

  // Imperative recenter.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || recenterToken === undefined) return;
    map.easeTo({ center: [userLocation.lng, userLocation.lat], zoom: 14, duration: 600 });
  }, [recenterToken, userLocation]);

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

      // Cluster bubbles
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

      // Unclustered individual shelters
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
        if (found) onSelectRef.current(found);
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

    updateData(map, {
      shelters: currentShelters,
      selectedShelterId: currentSelected,
      routeCoords: currentRoute?.coordinates ?? null,
      userLocation: currentUser,
    });
  }

  function getGeoJsonSource(map: MaplibreMap, id: string): maplibregl.GeoJSONSource | undefined {
    const src = map.getSource(id);
    return src as maplibregl.GeoJSONSource | undefined;
  }

  function updateData(
    map: MaplibreMap,
    args: {
      shelters: readonly Shelter[];
      selectedShelterId: string | null;
      routeCoords: [number, number][] | null;
      userLocation: { lat: number; lng: number };
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
  }

  void isLiveUserLocation;

  return (
    <View style={{ flex: 1 }}>
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', minHeight: 200 }}
      />
    </View>
  );
}
