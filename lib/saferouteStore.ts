/*
 * SafeRoute Varjumine — client state.
 *
 * Persists Offline Plan data (fallback shelters, family meeting point, emergency notes)
 * to AsyncStorage (the React Native equivalent of localStorage — used on web too
 * via the same package).
 *
 * All shelter/route/danger data lives in lib/shelters.ts and is hardcoded demo data.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Shelter } from './shelters';

export type FallbackSlot = 'home' | 'work' | 'school' | 'generic';

export type SavedFallback = {
  slot: FallbackSlot;
  shelterId: number;
  shelterName: string;
  savedAt: string;
};

type SafeRouteState = {
  // UI state (not persisted)
  selectedShelterId: number | null;
  showRoute: boolean;
  crisisMode: boolean;
  offlineMode: boolean;
  offlinePlanOpen: boolean;
  infoOpen: boolean;
  // Persisted offline plan
  fallbacks: Partial<Record<FallbackSlot, SavedFallback>>;
  familyMeetingPoint: string;
  emergencyNotes: string;

  selectShelter: (id: number | null, withRoute?: boolean) => void;
  setShowRoute: (v: boolean) => void;
  toggleCrisisMode: () => void;
  toggleOfflineMode: () => void;
  setOfflinePlanOpen: (v: boolean) => void;
  setInfoOpen: (v: boolean) => void;
  saveFallback: (slot: FallbackSlot, shelter: Shelter) => void;
  clearFallback: (slot: FallbackSlot) => void;
  setFamilyMeetingPoint: (v: string) => void;
  setEmergencyNotes: (v: string) => void;
};

export const useSafeRouteStore = create<SafeRouteState>()(
  persist(
    (set) => ({
      selectedShelterId: null,
      showRoute: false,
      crisisMode: true, // open in crisis-ready state per spec
      offlineMode: true,
      offlinePlanOpen: false,
      infoOpen: false,
      fallbacks: {},
      familyMeetingPoint: '',
      emergencyNotes: '',

      selectShelter: (id, withRoute = false) =>
        set({ selectedShelterId: id, showRoute: withRoute && id !== null }),
      setShowRoute: (v) => set({ showRoute: v }),
      toggleCrisisMode: () => set((s) => ({ crisisMode: !s.crisisMode })),
      toggleOfflineMode: () => set((s) => ({ offlineMode: !s.offlineMode })),
      setOfflinePlanOpen: (v) => set({ offlinePlanOpen: v }),
      setInfoOpen: (v) => set({ infoOpen: v }),
      saveFallback: (slot, shelter) =>
        set((s) => ({
          fallbacks: {
            ...s.fallbacks,
            [slot]: {
              slot,
              shelterId: shelter.id,
              shelterName: shelter.name,
              savedAt: new Date().toISOString(),
            },
          },
        })),
      clearFallback: (slot) =>
        set((s) => {
          const next = { ...s.fallbacks };
          delete next[slot];
          return { fallbacks: next };
        }),
      setFamilyMeetingPoint: (v) => set({ familyMeetingPoint: v }),
      setEmergencyNotes: (v) => set({ emergencyNotes: v }),
    }),
    {
      name: 'saferoute.offline-plan.v1',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist the offline-plan slice. UI state stays in memory.
      partialize: (s) => ({
        fallbacks: s.fallbacks,
        familyMeetingPoint: s.familyMeetingPoint,
        emergencyNotes: s.emergencyNotes,
      }),
    },
  ),
);
