/*
 * SafeRoute Varjumine — Native map (react-native-maps).
 *
 * ONLINE DEMO MAP NATIVE: OpenStreetMap raster tiles via UrlTile (no API key).
 * Vector PMTiles would require `@maplibre/maplibre-react-native`.
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
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
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
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- mount-time only
    [],
  );

  useEffect(() => {
    if (recenterToken === undefined) return;
    mapRef.current?.animateToRegion(
      regionFromUser(userLocation.lat, userLocation.lng),
      600,
    );
  }, [recenterToken, userLocation]);

  useEffect(() => {
    if (fitRouteToken === undefined || !route) return;
    const coords = route.coordinates.map(([lng, lat]) => ({
      latitude: lat,
      longitude: lng,
    }));
    if (coords.length < 2) return;
    mapRef.current?.fitToCoordinates(coords, {
      edgePadding: { top: 120, bottom: 380, left: 60, right: 60 },
      animated: true,
    });
  }, [fitRouteToken, route]);

  const routeCoords =
    route?.coordinates.map(([lng, lat]) => ({ latitude: lat, longitude: lng })) ?? [];

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
        <UrlTile urlTemplate={TILE_URL} maximumZ={19} flipY={false} />

        {/* HARDCODED DEMO DANGER ZONE — visual only */}
        <Circle
          center={{
            latitude: DEMO_DANGER_ZONE.centerLat,
            longitude: DEMO_DANGER_ZONE.centerLng,
          }}
          radius={DEMO_DANGER_ZONE.radiusMeters}
          fillColor={SHELTER_COLORS.danger}
          strokeColor={SHELTER_COLORS.dangerStroke}
          strokeWidth={2}
        />

        {routeCoords.length >= 2 ? (
          <>
            <Polyline coordinates={routeCoords} strokeColor="#ffffff" strokeWidth={9} />
            <Polyline
              coordinates={routeCoords}
              strokeColor={SHELTER_COLORS.route}
              strokeWidth={5.5}
            />
          </>
        ) : null}

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
                  width: selected ? 36 : 26,
                  height: selected ? 36 : 26,
                  borderRadius: selected ? 18 : 13,
                  backgroundColor: color,
                  borderColor: '#ffffff',
                  borderWidth: 3,
                }}
              />
            </Marker>
          );
        })}
      </MapView>
      {/* crisisMode is reflected in the chrome UI above the map instead. */}
      {/* eslint-disable-next-line @typescript-eslint/no-unused-expressions */}
      {crisisMode ? null : null}
    </View>
  );
}
