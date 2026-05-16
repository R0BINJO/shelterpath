/*
 * SafeRoute Varjumine — main map screen.
 *
 * Single full-screen surface:
 *  - SVG interactive map (components/MapCanvas.tsx) with hardcoded demo data
 *  - Top status pills (crisis mode / offline ready / demo data label)
 *  - Floating "Find nearest shelter" CTA
 *  - Right FAB stack: offline plan, zoom, locate
 *  - Bottom sheet for shelter detail + route instructions
 *  - Demo data label is also rendered inside the map area itself
 */

import { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { InfoModal } from '@/components/saferoute/InfoModal';
import { MapCanvas } from '@/components/MapCanvas';
import { OfflinePlanModal } from '@/components/saferoute/OfflinePlanModal';
import { ShelterSheet } from '@/components/saferoute/ShelterSheet';
import { Text } from '@/components/ui/text';
import { FindNearestFab, MapFabStack } from '@/components/saferoute/FloatingControls';
import { TopStatusBar } from '@/components/saferoute/TopStatusBar';
import {
  findNearestShelter,
  getRouteForShelter,
  SHELTERS,
  type Shelter,
} from '@/lib/shelters';
import { useSafeRouteStore } from '@/lib/saferouteStore';

export default function MapScreen() {
  const {
    selectedShelterId,
    showRoute,
    crisisMode,
    offlineMode,
    offlinePlanOpen,
    infoOpen,
    fallbacks,
    selectShelter,
    toggleCrisisMode,
    toggleOfflineMode,
    setOfflinePlanOpen,
    setInfoOpen,
    saveFallback,
  } = useSafeRouteStore();

  const [zoom, setZoom] = useState(1);

  const selectedShelter: Shelter | null = useMemo(() => {
    if (selectedShelterId === null) return null;
    return SHELTERS.find((s) => s.id === selectedShelterId) ?? null;
  }, [selectedShelterId]);

  const route = useMemo(() => {
    if (!selectedShelter) return null;
    return getRouteForShelter(selectedShelter.id) ?? null;
  }, [selectedShelter]);

  const isSelectedSaved = useMemo(() => {
    if (!selectedShelter) return false;
    return Object.values(fallbacks).some((f) => f?.shelterId === selectedShelter.id);
  }, [fallbacks, selectedShelter]);

  const handleSelectShelter = useCallback(
    (s: Shelter) => {
      // Tap on marker → show details; route only after Navigate / "Find nearest".
      selectShelter(s.id, false);
    },
    [selectShelter],
  );

  const handleFindNearest = useCallback(() => {
    const nearest = findNearestShelter();
    selectShelter(nearest.id, true);
  }, [selectShelter]);

  const handleNavigate = useCallback(() => {
    if (selectedShelter) selectShelter(selectedShelter.id, true);
  }, [selectShelter, selectedShelter]);

  const handleSaveFallback = useCallback(() => {
    if (!selectedShelter) return;
    // Default slot — user can re-assign from the Offline Plan panel.
    saveFallback('generic', selectedShelter);
  }, [saveFallback, selectedShelter]);

  const handleCloseSheet = useCallback(() => {
    selectShelter(null, false);
  }, [selectShelter]);

  const handleLocate = useCallback(() => {
    // Recenter would reset MapCanvas pan; for the demo we keep that responsibility
    // there and simply nudge zoom back to 1.
    setZoom(1);
  }, []);

  return (
    <View className="flex-1 bg-background">
      <MapCanvas
        selectedShelterId={selectedShelterId}
        route={showRoute ? route : null}
        crisisMode={crisisMode}
        onSelectShelter={handleSelectShelter}
        zoom={zoom}
      />

      {/* Demo data label anchored inside the map area (visible even with sheet closed). */}
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
          className="mb-2 rounded-full bg-card/85 border border-border px-3 py-1.5"
        >
          <Text className="text-[10.5px] text-muted-foreground">
            Demo mode: shelters, routes, danger area and map data are hardcoded.
          </Text>
        </View>
      </SafeAreaView>

      <TopStatusBar
        crisisMode={crisisMode}
        offlineMode={offlineMode}
        onToggleCrisis={toggleCrisisMode}
        onToggleOffline={toggleOfflineMode}
        onOpenInfo={() => setInfoOpen(true)}
      />

      {/* Small persistent disclaimer chip on the right edge */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 12,
          bottom: Platform.select({ web: 110, default: 130 }),
          zIndex: 12,
        }}
      >
        <View className="rounded-xl bg-card/85 border border-border px-2.5 py-1.5 max-w-[200px]">
          <Text className="text-[10.5px] text-muted-foreground leading-[14px]">
            SafeRoute is a preparedness assistant, not an official emergency system.
          </Text>
        </View>
      </View>

      <MapFabStack
        onLocate={handleLocate}
        onZoomIn={() => setZoom((z) => Math.min(2.5, z + 0.25))}
        onZoomOut={() => setZoom((z) => Math.max(0.6, z - 0.25))}
        onOpenPlan={() => setOfflinePlanOpen(true)}
        bottomInset={Platform.select({ web: 130, default: 150 }) ?? 150}
      />

      {/* Saved fallback shortcut pill (visible when something is saved and sheet is closed) */}
      {!selectedShelter && Object.keys(fallbacks).length > 0 ? (
        <View
          pointerEvents="box-none"
          style={{ position: 'absolute', left: 12, top: 130, zIndex: 14 }}
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
        bottomInset={Platform.select({ web: 56, default: 70 }) ?? 70}
      />

      <ShelterSheet
        shelter={selectedShelter}
        route={route}
        routeShown={showRoute}
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
