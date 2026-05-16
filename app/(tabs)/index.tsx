/*
 * SafeRoute Varjumine — main map screen (real interactive map).
 *
 * Map renderer (platform-split):
 *   web    → maplibre-gl with OpenFreeMap bright/dark vector tiles
 *   native → react-native-maps with OpenStreetMap raster tiles
 *
 * Shelter dataset: HARDCODED Päästeamet open-data snapshot
 * (src/data/officialShelters.ts). The app does NOT fetch shelter data at
 * runtime.
 *
 * Layout:
 *   - Top status pills (crisis / offline / demo data / info)
 *   - Region filter chips (Near me / Tallinn / Harju / All Estonia)
 *   - Right floating stack (offline plan, map style, locate)
 *   - "Find nearest shelter" CTA
 *   - Bottom sheet with shelter detail + route source + turn-by-turn
 *   - Demo data chips
 *   - Saved-fallback shortcut pill
 *   - Offline plan + info modals
 */

import { useCallback, useEffect, useMemo } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FindNearestFab, MapFabStack } from '@/components/saferoute/FloatingControls';
import { InfoModal } from '@/components/saferoute/InfoModal';
import { OfflinePlanModal } from '@/components/saferoute/OfflinePlanModal';
import SafeRouteMap from '@/components/SafeRouteMap';
import { ShelterSheet } from '@/components/saferoute/ShelterSheet';
import { TopStatusBar } from '@/components/saferoute/TopStatusBar';
import { Text } from '@/components/ui/text';
import { useSafeRouteStore } from '@/lib/saferouteStore';
import { SHELTERS, type Shelter } from '@/lib/shelters';
import { cn } from '@/lib/utils';
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
    showRoute,
    crisisMode,
    offlineMode,
    offlinePlanOpen,
    infoOpen,
    region,
    fallbacks,
    userLocation,
    isLiveUserLocation,
    mapStyle,
    route,
    routeState,
    routeError,
    recenterToken,
    fitRouteToken,
    selectShelter,
    navigateToShelter,
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
    clearRoute,
  } = useSafeRouteStore();

  // Region-filtered shelters for the map view.
  const visibleShelters = useMemo<Shelter[]>(
    () => filterShelters(region, isLiveUserLocation ? userLocation : undefined),
    [region, isLiveUserLocation, userLocation],
  );

  const selectedShelter: Shelter | null = useMemo(() => {
    if (selectedShelterId === null) return null;
    // Look up in the full dataset, not just visible — so saved/selected shelters
    // outside the active filter still resolve.
    return SHELTERS.find((s) => s.id === selectedShelterId) ?? null;
  }, [selectedShelterId]);

  const isSelectedSaved = useMemo(() => {
    if (!selectedShelter) return false;
    return Object.values(fallbacks).some(
      (f) => f?.shelterId === selectedShelter.id,
    );
  }, [fallbacks, selectedShelter]);

  // Try browser geolocation once on web for the "Using device location" label
  // and to enable a useful "Near me" default.
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

  return (
    <View className="flex-1 bg-background">
      <SafeRouteMap
        shelters={visibleShelters}
        selectedShelterId={selectedShelterId}
        route={route}
        userLocation={userLocation}
        isLiveUserLocation={isLiveUserLocation}
        crisisMode={crisisMode}
        mapStyle={mapStyle}
        onSelectShelter={handleSelectShelter}
        recenterToken={recenterToken}
        fitRouteToken={fitRouteToken}
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
        </View>
      </SafeAreaView>

      <TopStatusBar
        crisisMode={crisisMode}
        offlineMode={offlineMode}
        onToggleCrisis={toggleCrisisMode}
        onToggleOffline={toggleOfflineMode}
        onOpenInfo={() => setInfoOpen(true)}
      />

      {/* Region filter chips, sitting just below the top status bar */}
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
        <View className="rounded-xl bg-card/90 border border-border px-2.5 py-1.5 max-w-[240px]">
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
        mapStyleLabel={crisisMode ? 'Dark' : mapStyle === 'bright' ? 'Bright' : 'Dark'}
        bottomInset={Platform.select({ web: 150, default: 170 }) ?? 170}
      />

      {/* Saved fallback shortcut pill */}
      {!selectedShelter && Object.keys(fallbacks).length > 0 ? (
        <View
          pointerEvents="box-none"
          style={{ position: 'absolute', left: 12, top: 140, zIndex: 14 }}
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

      <FindNearestFab
        onPress={handleFindNearest}
        loading={routeState === 'loading'}
        bottomInset={Platform.select({ web: 70, default: 80 }) ?? 80}
      />

      <ShelterSheet
        shelter={selectedShelter}
        route={showRoute ? route : null}
        routeShown={showRoute}
        routeState={routeState}
        routeError={routeError}
        isSaved={isSelectedSaved}
        onClose={handleCloseSheet}
        onNavigate={handleNavigate}
        onSaveFallback={handleSaveFallback}
      />

      <OfflinePlanModal
        visible={offlinePlanOpen}
        onClose={() => setOfflinePlanOpen(false)}
      />
      <InfoModal visible={infoOpen} onClose={() => setInfoOpen(false)} />
    </View>
  );
}
