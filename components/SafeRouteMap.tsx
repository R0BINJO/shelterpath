/*
 * SafeRoute Varjumine — Native map (react-native-maps).
 *
 * Native fallback for the MapLibre web implementation. react-native-maps does
 * not render MapLibre vector styles natively, so we fall back to OSM raster
 * tiles via UrlTile. This keeps the UI consistent (real interactive map,
 * pan/pinch, real GeoJSON polylines) without paid SDKs or API keys.
 *
 * ONLINE DEMO MAP NATIVE: OpenStreetMap raster tiles (same data source family
 * as OpenFreeMap, just rastered). No API key.
 *
 * PRODUCTION OFFLINE MAP TODO:
 *   - Bundle a vector PMTiles file and serve via a native MapLibre SDK
 *     (`@maplibre/maplibre-react-native`), or
 *   - Ship a small raster MBTiles file and a self-hosted tile server.
 */

import { useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';
import MapView, {
  Circle,
  MAP_TYPES,
  Marker,
  Polyline,
  UrlTile,
  type Region,
} from 'react-native-maps';

import { SHELTER_COLORS } from '@/lib/constants';
import { DEMO_DANGER_ZONE, type Shelter } from '@/lib/shelters';

import type { SafeRouteMapProps } from './SafeRouteMap.types';

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

function regionFromUser(lat: number, lng: number): Region {
  return {
    latitude: lat,
    longitude: lng,
    latitudeDelta: 0.025,
    longitudeDelta: 0.025,
  };
}

export default function SafeRouteMap({
  shelters,
  selectedShelterId,
  route,
  userLocation,
  crisisMode,
  onSelectShelter,
  recenterToken,
  fitRouteToken,
}: SafeRouteMapProps) {
  const mapRef = useRef<MapView | null>(null);

  const initialRegion = useMemo(
    () => regionFromUser(userLocation.lat, userLocation.lng),
    // initial only — subsequent moves are imperative
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- mount-time only
    [],
  );

  useEffect(() => {
    if (recenterToken === undefined) return;
    mapRef.current?.animateToRegion(regionFromUser(userLocation.lat, userLocation.lng), 600);
  }, [recenterToken, userLocation]);

  useEffect(() => {
    if (fitRouteToken === undefined || !route) return;
    const coords = route.coordinates.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
    if (coords.length < 2) return;
    mapRef.current?.fitToCoordinates(coords, {
      edgePadding: { top: 120, bottom: 380, left: 60, right: 60 },
      animated: true,
    });
  }, [fitRouteToken, route]);

  const routeCoords = route?.coordinates.map(([lng, lat]) => ({ latitude: lat, longitude: lng })) ?? [];

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        initialRegion={initialRegion}
        mapType={MAP_TYPES.STANDARD}
        showsUserLocation={false}
        showsCompass={false}
        showsPointsOfInterest={false}
        pitchEnabled={false}
        rotateEnabled={false}
        toolbarEnabled={false}
      >
        {/* Real interactive map tiles (raster fallback on native). */}
        <UrlTile urlTemplate={TILE_URL} maximumZ={19} flipY={false} />

        {/* HARDCODED DEMO DANGER ZONE — visual only */}
        <Circle
          center={{ latitude: DEMO_DANGER_ZONE.centerLat, longitude: DEMO_DANGER_ZONE.centerLng }}
          radius={DEMO_DANGER_ZONE.radiusMeters}
          fillColor={SHELTER_COLORS.danger}
          strokeColor={SHELTER_COLORS.dangerStroke}
          strokeWidth={2}
        />

        {/* Route polyline (white casing + blue line) */}
        {routeCoords.length >= 2 ? (
          <>
            <Polyline
              coordinates={routeCoords}
              strokeColor="#ffffff"
              strokeWidth={9}
            />
            <Polyline
              coordinates={routeCoords}
              strokeColor={SHELTER_COLORS.route}
              strokeWidth={5.5}
            />
          </>
        ) : null}

        {/* User location marker (HARDCODED DEMO or device GPS) */}
        <Marker
          coordinate={{ latitude: userLocation.lat, longitude: userLocation.lng }}
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={false}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: 'rgba(34, 211, 238, 0.18)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                width: 14,
                height: 14,
                borderRadius: 7,
                backgroundColor: SHELTER_COLORS.user,
                borderColor: '#ffffff',
                borderWidth: 2,
              }}
            />
          </View>
        </Marker>

        {/* Shelter markers */}
        {shelters.map((s: Shelter) => {
          const selected = s.id === selectedShelterId;
          const color = SHELTER_COLORS[s.type];
          return (
            <Marker
              key={s.id}
              coordinate={{ latitude: s.lat, longitude: s.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
              onPress={() => onSelectShelter(s)}
              tracksViewChanges={selected}
            >
              <View
                style={{
                  width: selected ? 44 : 32,
                  height: selected ? 44 : 32,
                  borderRadius: selected ? 22 : 16,
                  backgroundColor: color,
                  borderColor: '#ffffff',
                  borderWidth: 3,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                  <View
                    style={{
                      paddingHorizontal: 2,
                    }}
                  />
                </View>
              </View>
            </Marker>
          );
        })}
      </MapView>
      {/* Avoid unused-var lint for crisisMode — native style is fixed raster.
         crisisMode is reflected in the chrome UI above the map instead. */}
      {/* eslint-disable-next-line @typescript-eslint/no-unused-expressions */}
      {crisisMode ? null : null}
    </View>
  );
}
