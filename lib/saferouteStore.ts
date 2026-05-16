/*
 * SafeRoute Varjumine — client state.
 *
 * Persists Offline Plan data (fallback shelters, family meeting point, emergency notes)
 * to AsyncStorage (the React Native equivalent of localStorage — used on web too
 * via the same package).
 *
 * Shelter / danger-zone / walking-graph data lives in lib/shelters.ts and
 * lib/walkingGraph.ts and is all hardcoded demo data.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  findNearestByRouteDistance,
  getDemoStart,
  getRouteToShelter,
  type LatLng,
  type RouteResult,
} from './routing';
import type { Shelter } from './shelters';

export type FallbackSlot = 'home' | 'work' | 'school' | 'generic';

export type SavedFallback = {
  slot: FallbackSlot;
  shelterId: number;
  shelterName: string;
  savedAt: string;
};

export type RouteState = 'idle' | 'loading' | 'ready' | 'error';

type SafeRouteState = {
  // UI state (not persisted)
  selectedShelterId: number | null;
  showRoute: boolean;
  crisisMode: boolean;
  offlineMode: boolean;
  offlinePlanOpen: boolean;
  infoOpen: boolean;

  // Real interactive map state (not persisted)
  userLocation: LatLng;
  isLiveUserLocation: boolean;
  mapStyle: 'bright' | 'dark';

  // Routing state (not persisted)
  route: RouteResult | null;
  routeState: RouteState;
  routeError: string | null;
  recenterToken: number;
  fitRouteToken: number;

  // Persisted offline plan
  fallbacks: Partial<Record<FallbackSlot, SavedFallback>>;
  familyMeetingPoint: string;
  emergencyNotes: string;

  // Actions
  selectShelter: (id: number | null) => void;
  navigateToShelter: (shelter: Shelter) => Promise<void>;
  findNearest: () => Promise<void>;
  toggleCrisisMode: () => void;
  toggleOfflineMode: () => void;
  setOfflinePlanOpen: (v: boolean) => void;
  setInfoOpen: (v: boolean) => void;
  setMapStyle: (style: 'bright' | 'dark') => void;
  setUserLocation: (loc: LatLng, live: boolean) => void;
  bumpRecenter: () => void;
  bumpFitRoute: () => void;
  saveFallback: (slot: FallbackSlot, shelter: Shelter) => void;
  clearFallback: (slot: FallbackSlot) => void;
  setFamilyMeetingPoint: (v: string) => void;
  setEmergencyNotes: (v: string) => void;
  clearRoute: () => void;
};

export const useSafeRouteStore = create<SafeRouteState>()(
  persist(
    (set, get) => ({
      selectedShelterId: null,
      showRoute: false,
      crisisMode: true,
      offlineMode: false, // start online so live OSRM is attempted
      offlinePlanOpen: false,
      infoOpen: false,

      // HARDCODED DEMO USER LOCATION - used only when browser geolocation is unavailable
      userLocation: getDemoStart(),
      isLiveUserLocation: false,
      mapStyle: 'bright',

      route: null,
      routeState: 'idle',
      routeError: null,
      recenterToken: 0,
      fitRouteToken: 0,

      fallbacks: {},
      familyMeetingPoint: '',
      emergencyNotes: '',

      selectShelter: (id) =>
        set((s) => {
          // Selecting a different shelter clears the previously shown route.
          if (id === s.selectedShelterId) return { selectedShelterId: id };
          return {
            selectedShelterId: id,
            showRoute: false,
            route: null,
            routeState: 'idle',
            routeError: null,
          };
        }),

      navigateToShelter: async (shelter) => {
        const { userLocation, offlineMode } = get();
        set({
          selectedShelterId: shelter.id,
          showRoute: true,
          routeState: 'loading',
          routeError: null,
        });
        try {
          const result = await getRouteToShelter(userLocation, shelter, {
            allowLive: !offlineMode,
          });
          set((s) => ({
            route: result,
            routeState: 'ready',
            fitRouteToken: s.fitRouteToken + 1,
          }));
        } catch (e) {
          set({
            routeState: 'error',
            routeError: e instanceof Error ? e.message : 'Routing failed',
          });
        }
      },

      findNearest: async () => {
        const { userLocation, offlineMode } = get();
        set({ routeState: 'loading', routeError: null, showRoute: true });
        try {
          const { shelter, route } = await findNearestByRouteDistance(
            userLocation,
            undefined,
            { allowLive: !offlineMode },
          );
          set((s) => ({
            selectedShelterId: shelter.id,
            route,
            routeState: 'ready',
            fitRouteToken: s.fitRouteToken + 1,
          }));
        } catch (e) {
          set({
            routeState: 'error',
            routeError: e instanceof Error ? e.message : 'Routing failed',
          });
        }
      },

      toggleCrisisMode: () => set((s) => ({ crisisMode: !s.crisisMode })),
      toggleOfflineMode: () => set((s) => ({ offlineMode: !s.offlineMode })),
      setOfflinePlanOpen: (v) => set({ offlinePlanOpen: v }),
      setInfoOpen: (v) => set({ infoOpen: v }),
      setMapStyle: (style) => set({ mapStyle: style }),
      setUserLocation: (loc, live) =>
        set((s) => ({
          userLocation: loc,
          isLiveUserLocation: live,
          recenterToken: s.recenterToken + 1,
        })),
      bumpRecenter: () => set((s) => ({ recenterToken: s.recenterToken + 1 })),
      bumpFitRoute: () => set((s) => ({ fitRouteToken: s.fitRouteToken + 1 })),

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
      clearRoute: () =>
        set({ route: null, routeState: 'idle', showRoute: false, routeError: null }),
    }),
    {
      name: 'saferoute.offline-plan.v2',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        fallbacks: s.fallbacks,
        familyMeetingPoint: s.familyMeetingPoint,
        emergencyNotes: s.emergencyNotes,
      }),
    },
  ),
);
