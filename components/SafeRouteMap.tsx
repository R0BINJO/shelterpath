/*
 * SafeRoute Varjumine — Native map (react-native-maps).
 *
 * ONLINE DEMO MAP NATIVE: OpenStreetMap raster tiles via UrlTile (no API key).
 * Vector PMTiles would require `@maplibre/maplibre-react-native`.
 *
 * Renders:
 *   - DEMO DANGER ZONE (visual)
 *   - active route polyline
 *   - user location dot
 *   - official Päästeamet shelters (green SA3 markers)
 *   - USER SAVED PLACES (type-coloured square markers, local-only)
 *   - manual-pin overlay (when adding a place by panning the map)
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import MapView, {
  Circle,
  Marker,
  Polyline,
  UrlTile,
  type Region,
} from 'react-native-maps';

import { SHELTER_COLORS } from '@/lib/constants';
import { DEMO_DANGER_ZONE, type Shelter } from '@/lib/shelters';
import { getUserPlaceMeta, type UserPlace } from '@/src/types/userPlaces';

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
  userPlaces,
  selectedUserPlaceId,
  route,
  userLocation,
  crisisMode,
  layerVisibility,
  manualPinMode,
  onSelectShelter,
  onSelectUserPlace,
  recenterToken,
  fitRouteToken,
  flyToToken,
  flyToTarget,
  onCenterChange,
}: SafeRouteMapProps) {
  const mapRef = useRef<MapView | null>(null);
  const [centerOverride, setCenterOverride] = useState<Region | null>(null);

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
    if (flyToToken === undefined || !flyToTarget) return;
    mapRef.current?.animateToRegion(
      {
        latitude: flyToTarget.lat,
        longitude: flyToTarget.lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      600,
    );
  }, [flyToToken, flyToTarget]);

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

  void centerOverride; // ref-only; suppress unused warning

  const routeCoords =
    route?.coordinates.map(([lng, lat]) => ({ latitude: lat, longitude: lng })) ?? [];

  return (
    <View style={{ flex: 1, position: 'relative' }}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        initialRegion={initialRegion}
        mapType={Platform.OS === 'android' ? 'none' : 'standard'}
        showsUserLocation={false}
        showsCompass={false}
        showsPointsOfInterest={false}
        pitchEnabled={false}
        rotateEnabled={false}
        toolbarEnabled={false}
        onRegionChange={(r) => {
          setCenterOverride(r);
          onCenterChange?.({ lat: r.latitude, lng: r.longitude });
        }}
      >
        <UrlTile urlTemplate={TILE_URL} maximumZ={19} flipY={false} />

        {layerVisibility.danger ? (
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
        ) : null}

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

        {layerVisibility.shelters
          ? shelters.map((s: Shelter) => {
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
            })
          : null}

        {layerVisibility.savedPlaces
          ? userPlaces
              .filter(
                (p): p is UserPlace =>
                  typeof p?.lat === 'number' &&
                  typeof p?.lng === 'number' &&
                  Number.isFinite(p.lat) &&
                  Number.isFinite(p.lng),
              )
              .map((p) => {
              const selected = p.id === selectedUserPlaceId;
              const color = getUserPlaceMeta(p.type).color;
              return (
                <Marker
                  key={`up:${p.id}`}
                  coordinate={{ latitude: p.lat, longitude: p.lng }}
                  anchor={{ x: 0.5, y: 0.5 }}
                  onPress={() => onSelectUserPlace(p)}
                  tracksViewChanges={selected}
                >
                  <View
                    style={{
                      width: selected ? 30 : 22,
                      height: selected ? 30 : 22,
                      backgroundColor: color,
                      borderColor: '#0b1320',
                      borderWidth: 3,
                      transform: [{ rotate: '45deg' }],
                    }}
                  />
                </Marker>
              );
            })
          : null}
      </MapView>

      {manualPinMode ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
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
            }}
          />
        </View>
      ) : null}

      {/* eslint-disable-next-line @typescript-eslint/no-unused-expressions */}
      {crisisMode || Platform.OS ? null : null}
    </View>
  );
}
