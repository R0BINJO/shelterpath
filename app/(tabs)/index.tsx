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

import { AccountChip } from '@/components/saferoute/AccountChip';
import { ActionsMenu } from '@/components/saferoute/ActionsMenu';
import { AddCommunityShelterSheet } from '@/components/saferoute/AddCommunityShelterSheet';
import { AuthSheet } from '@/components/saferoute/AuthSheet';
import { CommunityShelterSheet } from '@/components/saferoute/CommunityShelterSheet';
import { DangerPointSheet } from '@/components/saferoute/DangerPointSheet';
import { FindNearestFab } from '@/components/saferoute/FloatingControls';
import { InfoModal } from '@/components/saferoute/InfoModal';
import { LayersMenu } from '@/components/saferoute/LayersMenu';
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
import { useAuthStore } from '@/lib/authStore';
import { useCommunityShelterStore } from '@/lib/communityShelterStore';
import { useSafeRouteStore } from '@/lib/saferouteStore';
import { SHELTERS, type Shelter } from '@/lib/shelters';
import { cn } from '@/lib/utils';
import {
  dangerPoints as ALL_DANGER_POINTS,
  type DangerPoint,
} from '@/src/data/dangerPoints';
import { filterShelters, type ShelterRegion } from '@/src/data/officialShelters';
import type { CommunityShelter } from '@/src/types/communityShelters';

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

  // Community shelter store (Supabase-backed, AsyncStorage-cached).
  const communityShelters = useCommunityShelterStore((s) => s.shelters);
  const selectedCommunityShelterId = useCommunityShelterStore((s) => s.selectedId);
  const selectCommunityShelter = useCommunityShelterStore((s) => s.select);
  const loadCommunityFromCache = useCommunityShelterStore((s) => s.loadFromCache);
  const refreshCommunityFromServer = useCommunityShelterStore((s) => s.refreshFromServer);
  const setCommunityAddSheetOpen = useCommunityShelterStore((s) => s.setAddSheetOpen);

  // Auth (online-only).
  const authStatus = useAuthStore((s) => s.status);
  const [authSheetOpen, setAuthSheetOpen] = useState(false);

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

  // Load cached community shelters once, then try to refresh from server when
  // we're not in offline mode. The cache is what makes them visible offline.
  useEffect(() => {
    void loadCommunityFromCache();
  }, [loadCommunityFromCache]);

  useEffect(() => {
    if (offlineMode) return;
    void refreshCommunityFromServer();
  }, [offlineMode, refreshCommunityFromServer, authStatus]);

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

  const handleSelectCommunityShelter = useCallback(
    (s: CommunityShelter) => {
      // Selecting a community shelter clears any other selection so only one
      // detail sheet is visible at a time.
      selectShelter(null);
      selectUserPlace(null);
      selectDangerPoint(null);
      clearRoute();
      selectCommunityShelter(s.id);
    },
    [clearRoute, selectCommunityShelter, selectDangerPoint, selectShelter, selectUserPlace],
  );

  const handleOpenShareShelter = useCallback(() => {
    if (authStatus !== 'signed-in') {
      setAuthSheetOpen(true);
      return;
    }
    if (offlineMode) {
      // Offline: still open the sheet so the user sees the rationale. The
      // submit button is disabled inside the sheet when offline.
    }
    setCommunityAddSheetOpen(true);
  }, [authStatus, offlineMode, setCommunityAddSheetOpen]);

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
        communityShelters={communityShelters}
        selectedCommunityShelterId={selectedCommunityShelterId}
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
        onSelectCommunityShelter={handleSelectCommunityShelter}
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
          {layerVisibility.communityShelters ? (
            <View className="rounded-full bg-amber-500/15 border border-amber-500/40 px-2.5 py-1">
              <Text className="text-[10.5px] font-semibold text-amber-300">
                Community shelters (unverified) · {communityShelters.length}
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
        rightSlot={<AccountChip onOpenAuth={() => setAuthSheetOpen(true)} />}
      />

      {/* Region filter + Layers popup trigger */}
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
          <LayersMenu
            layers={layerVisibility}
            onToggle={toggleLayer}
            dangerFilter={dangerLayerFilter}
            onDangerFilterChange={setDangerLayerFilter}
          />
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

      <ActionsMenu
        onLocate={handleLocate}
        onOpenPlan={() => setOfflinePlanOpen(true)}
        onToggleStyle={handleToggleStyle}
        onOpenSavedPlaces={() => setSavedPlacesPanelOpen(true)}
        onAddPlace={() => openAddPlace()}
        onShareShelter={handleOpenShareShelter}
        mapStyleLabel={crisisMode ? 'Dark' : mapStyle === 'bright' ? 'Bright' : 'Dark'}
        savedPlacesCount={savedPlacesCount}
        communityShelterCount={communityShelters.length}
        bottomInset={Platform.select({ web: 150, default: 170 }) ?? 170}
      />

      {/* Saved fallback shortcut pill */}
      {!selectedShelter && !selectedUserPlace && !selectedDangerPoint && !selectedCommunityShelterId && Object.keys(fallbacks).length > 0 ? (
        <View
          pointerEvents="box-none"
          style={{ position: 'absolute', left: 12, top: 144, zIndex: 14 }}
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

      {!selectedShelter && !selectedUserPlace && !selectedDangerPoint && !selectedCommunityShelterId ? (
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
      <AddCommunityShelterSheet manualPin={manualPinHandle} />
      <CommunityShelterSheet onCopyCoords={handleCopyCoords} />
      <AuthSheet visible={authSheetOpen} onClose={() => setAuthSheetOpen(false)} />
      <InfoModal visible={infoOpen} onClose={() => setInfoOpen(false)} />

      {/* When the AddPlace sheet is in manual-pin mode, we hide the sheet via
          its internal stage. The crosshair overlay is rendered by the map. */}
      {addPlaceSheet.open ? null : null}
    </View>
  );
}
