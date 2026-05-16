/*
 * SafeRoute Varjumine — main map screen (real interactive map).
 *
 * Layers (toggleable via chip row):
 *   - Official shelters (HARDCODED Päästeamet open-data snapshot)
 *   - USER SAVED PLACES - stored locally in AsyncStorage (private)
 *   - DANGER POINTS / DANGER ZONES (HARDCODED DANGER POINT DATA SNAPSHOT
 *     from Maa- ja Ruumiamet X-GIS Huvipunktid / Riigihaldus, GENERATED
 *     PUBLIC-DATA PROXIMITY DANGER ZONES — NOT OFFICIAL ALERTS)
 *   - DEMO DANGER ZONE  (visual only)
 *
 * USER SAVED PLACES - stored locally in browser localStorage / AsyncStorage.
 * DO NOT SEND HOME/WORK/SCHOOL ADDRESSES TO BACKEND.
 * SAVED PLACES WORK OFFLINE AFTER SAVING.
 * ADDRESS SEARCH REQUIRES INTERNET.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DangerLayerFilterChips } from '@/components/saferoute/DangerLayerFilterChips';
import { DangerPointSheet } from '@/components/saferoute/DangerPointSheet';
import { FindNearestFab, MapFabStack } from '@/components/saferoute/FloatingControls';
import { InfoModal } from '@/components/saferoute/InfoModal';
import { LayerToggleChips } from '@/components/saferoute/LayerToggleChips';
import { OfflinePlanModal } from '@/components/saferoute/OfflinePlanModal';
import { AddPlaceSheet } from '@/components/saferoute/AddPlaceSheet';
import {
  SavedPlaceBottomSheet,
  SavedPlacesPanel,
} from '@/components/saferoute/SavedPlacesSheet';
import SafeRouteMap from '@/components/SafeRouteMap';
import { ShelterSheet } from '@/components/saferoute/ShelterSheet';
import { TopStatusBar } from '@/components/saferoute/TopStatusBar';
import { Text } from '@/components/ui/text';
import { useSafeRouteStore } from '@/lib/saferouteStore';
import { SHELTERS, type Shelter } from '@/lib/shelters';
import { cn } from '@/lib/utils';
import {
  dangerPoints as ALL_DANGER_POINTS,
  type DangerPoint,
} from '@/src/data/dangerPoints';
import { filterShelters, type ShelterRegion } from '@/src/data/officialShelters';

const REGION_OPTIONS: { value: ShelterRegion; label: string }[] = [
  { value: 'near-me', label: 'Near me' },
  { value: 'tallinn', label: 'Tallinn' },
  { value: 'harju', label: 'Harju' },
  { value: 'all', label: 'All Estonia' },
];

export default function MapScreen() {
  const {
    selectedShelterId,
    selectedUserPlaceId,
    selectedDangerPointId,
    showRoute,
    crisisMode,
    offlineMode,
    offlinePlanOpen,
    infoOpen,
    region,
    fallbacks,
    fallbackDangerPoint,
    userLocation,
    isLiveUserLocation,
    mapStyle,
    route,
    routeState,
    routeError,
    routeDangerHits,
    recenterToken,
    fitRouteToken,
    userPlaces,
    addPlaceSheet,
    savedPlacesPanelOpen,
    layerVisibility,
    dangerLayerFilter,
    selectShelter,
    selectUserPlace,
    selectDangerPoint,
    navigateToShelter,
    navigateToDangerPoint,
    findNearest,
    toggleCrisisMode,
    toggleOfflineMode,
    setOfflinePlanOpen,
    setInfoOpen,
    setMapStyle,
    setRegion,
    setUserLocation,
    bumpRecenter,
    saveFallback,
    saveFallbackDangerPoint,
    clearRoute,
    loadUserPlaces,
    openAddPlace,
    setSavedPlacesPanelOpen,
    toggleLayer,
    setDangerLayerFilter,
  } = useSafeRouteStore();

  // Manual-pin and flyTo plumbing — owned by this screen, passed down to map.
  const [manualPinMode, setManualPinMode] = useState(false);
  const mapCenterRef = useRef<{ lat: number; lng: number }>(userLocation);
  const [flyToTarget, setFlyToTarget] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [flyToToken, setFlyToToken] = useState(0);

  const manualPinHandle = useMemo(
    () => ({
      setManualPinMode,
      getMapCenter: () => mapCenterRef.current,
      flyTo: (target: { lat: number; lng: number }) => {
        setFlyToTarget(target);
        setFlyToToken((t) => t + 1);
      },
    }),
    [],
  );

  const visibleShelters = useMemo<Shelter[]>(
    () => filterShelters(region, isLiveUserLocation ? userLocation : undefined),
    [region, isLiveUserLocation, userLocation],
  );

  const selectedShelter: Shelter | null = useMemo(() => {
    if (selectedShelterId === null) return null;
    return SHELTERS.find((s) => s.id === selectedShelterId) ?? null;
  }, [selectedShelterId]);

  const selectedUserPlace = useMemo(() => {
    if (!selectedUserPlaceId) return null;
    return userPlaces.find((p) => p.id === selectedUserPlaceId) ?? null;
  }, [selectedUserPlaceId, userPlaces]);

  // Apply the per-layer filter (All / Administratiivkeskus / Politseiasutus / …).
  const visibleDangerPoints = useMemo<readonly DangerPoint[]>(() => {
    if (dangerLayerFilter === 'all') return ALL_DANGER_POINTS;
    return ALL_DANGER_POINTS.filter((p) => p.layerId === dangerLayerFilter);
  }, [dangerLayerFilter]);

  const selectedDangerPoint = useMemo<DangerPoint | null>(() => {
    if (!selectedDangerPointId) return null;
    return ALL_DANGER_POINTS.find((p) => p.id === selectedDangerPointId) ?? null;
  }, [selectedDangerPointId]);

  const isSelectedDangerPointSaved = useMemo(() => {
    if (!selectedDangerPoint) return false;
    return (
      fallbackDangerPoint?.fallbackDangerPointId === selectedDangerPoint.id
    );
  }, [fallbackDangerPoint, selectedDangerPoint]);

  const isSelectedSaved = useMemo(() => {
    if (!selectedShelter) return false;
    return Object.values(fallbacks).some((f) => f?.shelterId === selectedShelter.id);
  }, [fallbacks, selectedShelter]);

  // Load saved places once on mount.
  useEffect(() => {
    void loadUserPlaces();
  }, [loadUserPlaces]);

  // Try browser geolocation once on web.
  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return undefined;
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        setUserLocation(
          { lat: pos.coords.latitude, lng: pos.coords.longitude },
          true,
        );
      },
      () => {
        // Denied / unavailable — keep HARDCODED DEMO USER LOCATION.
      },
      { timeout: 5000, maximumAge: 60_000 },
    );
    return () => {
      cancelled = true;
    };
  }, [setUserLocation]);

  const handleSelectShelter = useCallback(
    (s: Shelter) => {
      selectShelter(s.id);
    },
    [selectShelter],
  );

  const handleSelectUserPlace = useCallback(
    (p: { id: string }) => {
      selectUserPlace(p.id);
    },
    [selectUserPlace],
  );

  const handleSelectDangerPoint = useCallback(
    (p: DangerPoint) => {
      selectDangerPoint(p.id);
    },
    [selectDangerPoint],
  );

  const handleNavigateDangerPoint = useCallback(() => {
    if (selectedDangerPoint) void navigateToDangerPoint(selectedDangerPoint);
  }, [navigateToDangerPoint, selectedDangerPoint]);

  const handleSaveFallbackDangerPoint = useCallback(() => {
    if (selectedDangerPoint) saveFallbackDangerPoint(selectedDangerPoint);
  }, [saveFallbackDangerPoint, selectedDangerPoint]);

  const handleCopyCoords = useCallback((lat: number, lng: number) => {
    const text = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(text);
    }
    // On native we don't add a new dep; silently no-op rather than mis-claim.
  }, []);

  const handleCloseDangerPoint = useCallback(() => {
    selectDangerPoint(null);
    clearRoute();
  }, [clearRoute, selectDangerPoint]);

  const handleFindNearest = useCallback(() => {
    void findNearest();
  }, [findNearest]);

  const handleNavigate = useCallback(() => {
    if (selectedShelter) void navigateToShelter(selectedShelter);
  }, [navigateToShelter, selectedShelter]);

  const handleSaveFallback = useCallback(() => {
    if (!selectedShelter) return;
    saveFallback('generic', selectedShelter);
  }, [saveFallback, selectedShelter]);

  const handleCloseSheet = useCallback(() => {
    selectShelter(null);
    clearRoute();
  }, [clearRoute, selectShelter]);

  const handleLocate = useCallback(() => {
    bumpRecenter();
  }, [bumpRecenter]);

  const handleToggleStyle = useCallback(() => {
    setMapStyle(mapStyle === 'bright' ? 'dark' : 'bright');
  }, [mapStyle, setMapStyle]);

  const handleCenterChange = useCallback((c: { lat: number; lng: number }) => {
    mapCenterRef.current = c;
  }, []);

  const savedPlacesCount = userPlaces.length;

  return (
    <View className="flex-1 bg-background">
      <SafeRouteMap
        shelters={visibleShelters}
        selectedShelterId={selectedShelterId}
        userPlaces={userPlaces}
        selectedUserPlaceId={selectedUserPlaceId}
        dangerPoints={visibleDangerPoints}
        selectedDangerPointId={selectedDangerPointId}
        route={route}
        userLocation={userLocation}
        isLiveUserLocation={isLiveUserLocation}
        crisisMode={crisisMode}
        mapStyle={mapStyle}
        layerVisibility={layerVisibility}
        manualPinMode={manualPinMode}
        onSelectShelter={handleSelectShelter}
        onSelectUserPlace={handleSelectUserPlace}
        onSelectDangerPoint={handleSelectDangerPoint}
        onCenterChange={handleCenterChange}
        recenterToken={recenterToken}
        fitRouteToken={fitRouteToken}
        flyToTarget={flyToTarget}
        flyToToken={flyToToken}
      />

      {/* Persistent demo + data-source chips bottom-centre */}
      <SafeAreaView
        edges={['bottom']}
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 10,
          alignItems: 'center',
        }}
      >
        <View
          pointerEvents="none"
          className="mb-2 flex-row gap-1.5 flex-wrap justify-center px-3"
        >
          <View className="rounded-full bg-card/90 border border-border px-2.5 py-1">
            <Text className="text-[10.5px] text-muted-foreground">
              {isLiveUserLocation ? 'Using device location' : 'Using demo location'}
            </Text>
          </View>
          <View className="rounded-full bg-card/90 border border-border px-2.5 py-1">
            <Text className="text-[10.5px] text-muted-foreground">
              Map: OpenFreeMap tiles · OSM data
            </Text>
          </View>
          <View className="rounded-full bg-emerald-500/15 border border-emerald-500/40 px-2.5 py-1">
            <Text className="text-[10.5px] font-semibold text-emerald-300">
              Päästeamet data snapshot · {visibleShelters.length} shelters
            </Text>
          </View>
          <View className="rounded-full bg-purple-500/15 border border-purple-500/40 px-2.5 py-1">
            <Text className="text-[10.5px] font-semibold text-purple-300">
              {savedPlacesCount} saved place{savedPlacesCount === 1 ? '' : 's'} · offline ready
            </Text>
          </View>
          {layerVisibility.dangerPoints || layerVisibility.dangerZones ? (
            <View className="rounded-full bg-orange-500/15 border border-orange-500/40 px-2.5 py-1">
              <Text className="text-[10.5px] font-semibold text-orange-300">
                Public-data Danger Zone snapshot · {visibleDangerPoints.length} points
              </Text>
            </View>
          ) : null}
        </View>
      </SafeAreaView>

      <TopStatusBar
        crisisMode={crisisMode}
        offlineMode={offlineMode}
        onToggleCrisis={toggleCrisisMode}
        onToggleOffline={toggleOfflineMode}
        onOpenInfo={() => setInfoOpen(true)}
      />

      {/* Region filter + layer toggles */}
      <SafeAreaView
        edges={['top']}
        pointerEvents="box-none"
        style={{ position: 'absolute', top: 96, left: 0, right: 0, zIndex: 18 }}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
        >
          {REGION_OPTIONS.map((opt) => {
            const active = region === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setRegion(opt.value)}
                accessibilityRole="button"
                accessibilityLabel={`Filter shelters: ${opt.label}`}
                className={cn(
                  'rounded-full border px-3 py-1.5 min-h-[34px] flex-row items-center',
                  active ? 'bg-primary border-primary' : 'bg-card/90 border-border',
                )}
              >
                <Text
                  className={cn(
                    'text-[12px] font-semibold',
                    active ? 'text-primary-foreground' : 'text-foreground',
                  )}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View className="px-3 mt-1.5">
          <LayerToggleChips layers={layerVisibility} onToggle={toggleLayer} />
        </View>

        {layerVisibility.dangerPoints || layerVisibility.dangerZones ? (
          <View className="mt-1.5">
            <DangerLayerFilterChips
              value={dangerLayerFilter}
              onChange={setDangerLayerFilter}
            />
          </View>
        ) : null}
      </SafeAreaView>

      {/* Persistent disclaimer */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 12,
          bottom: Platform.select({ web: 130, default: 150 }),
          zIndex: 12,
        }}
      >
        <View className="rounded-xl bg-card/90 border border-border px-2.5 py-1.5 max-w-[260px]">
          <Text className="text-[10.5px] text-muted-foreground leading-[14px]">
            SafeRoute is a civilian preparedness assistant, not an official
            emergency system. Always follow official instructions.
          </Text>
        </View>
      </View>

      <MapFabStack
        onLocate={handleLocate}
        onOpenPlan={() => setOfflinePlanOpen(true)}
        onToggleStyle={handleToggleStyle}
        onOpenSavedPlaces={() => setSavedPlacesPanelOpen(true)}
        onAddPlace={() => openAddPlace()}
        mapStyleLabel={crisisMode ? 'Dark' : mapStyle === 'bright' ? 'Bright' : 'Dark'}
        savedPlacesCount={savedPlacesCount}
        bottomInset={Platform.select({ web: 150, default: 170 }) ?? 170}
      />

      {/* Saved fallback shortcut pill */}
      {!selectedShelter && !selectedUserPlace && !selectedDangerPoint && Object.keys(fallbacks).length > 0 ? (
        <View
          pointerEvents="box-none"
          style={{ position: 'absolute', left: 12, top: 178, zIndex: 14 }}
        >
          <Pressable
            onPress={() => setOfflinePlanOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="View saved fallback shelters"
            className="rounded-full bg-card/90 border border-border px-3 py-1.5 flex-row items-center gap-2"
          >
            <View className="h-2 w-2 rounded-full bg-emerald-400" />
            <Text className="text-foreground text-[11.5px] font-medium">
              {Object.keys(fallbacks).length} fallback saved
            </Text>
          </Pressable>
        </View>
      ) : null}

      {!selectedShelter && !selectedUserPlace && !selectedDangerPoint ? (
        <FindNearestFab
          onPress={handleFindNearest}
          loading={routeState === 'loading'}
          bottomInset={Platform.select({ web: 70, default: 80 }) ?? 80}
        />
      ) : null}

      <ShelterSheet
        shelter={selectedShelter}
        route={showRoute ? route : null}
        routeShown={showRoute}
        routeState={routeState}
        routeError={routeError}
        isSaved={isSelectedSaved}
        dangerHits={routeDangerHits.map((d) => ({
          id: d.id,
          name: d.name,
          layerName: d.layerName,
        }))}
        onClose={handleCloseSheet}
        onNavigate={handleNavigate}
        onSaveFallback={handleSaveFallback}
      />

      <DangerPointSheet
        point={selectedDangerPoint}
        route={showRoute ? route : null}
        routeShown={showRoute}
        routeState={routeState}
        routeError={routeError}
        isSaved={isSelectedDangerPointSaved}
        onClose={handleCloseDangerPoint}
        onNavigate={handleNavigateDangerPoint}
        onSaveFallback={handleSaveFallbackDangerPoint}
        onCopyCoords={handleCopyCoords}
      />

      <SavedPlaceBottomSheet
        place={selectedUserPlace}
        onClose={() => selectUserPlace(null)}
      />

      <OfflinePlanModal
        visible={offlinePlanOpen}
        onClose={() => setOfflinePlanOpen(false)}
      />
      <SavedPlacesPanel
        visible={savedPlacesPanelOpen}
        onClose={() => setSavedPlacesPanelOpen(false)}
        onFlyTo={(t) => {
          setFlyToTarget(t);
          setFlyToToken((tok) => tok + 1);
        }}
      />
      <AddPlaceSheet manualPin={manualPinHandle} />
      <InfoModal visible={infoOpen} onClose={() => setInfoOpen(false)} />

      {/* When the AddPlace sheet is in manual-pin mode, we hide the sheet via
          its internal stage. The crosshair overlay is rendered by the map. */}
      {addPlaceSheet.open ? null : null}
    </View>
  );
}
