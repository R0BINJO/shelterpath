/*
 * SafeRoute Varjumine — client state.
 *
 * Persists Offline Plan data (fallback shelters, family meeting point,
 * emergency notes) to AsyncStorage (the React Native equivalent of
 * localStorage — used on web too via the same package).
 *
 * The shelter dataset itself lives in src/data/officialShelters.ts and is
 * a hardcoded snapshot of the Päästeamet open-data feed.
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
import { SHELTERS, type Shelter } from './shelters';
import type { ShelterRegion } from '@/src/data/officialShelters';

export type FallbackSlot = 'home' | 'work' | 'school' | 'generic';

export type SavedFallback = {
  slot: FallbackSlot;
  shelterId: string;
  shelterName: string;
  shelterAddress: string;
  shelterLat: number;
  shelterLng: number;
  savedAt: string;
  dataSnapshotDate: string;
};

export type RouteState = 'idle' | 'loading' | 'ready' | 'error';

type SafeRouteState = {
  // UI state (not persisted)
  selectedShelterId: string | null;
  showRoute: boolean;
  crisisMode: boolean;
  offlineMode: boolean;
  offlinePlanOpen: boolean;
  infoOpen: boolean;
  region: ShelterRegion;

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
  selectShelter: (id: string | null) => void;
  navigateToShelter: (shelter: Shelter) => Promise<void>;
  findNearest: () => Promise<void>;
  toggleCrisisMode: () => void;
  toggleOfflineMode: () => void;
  setOfflinePlanOpen: (v: boolean) => void;
  setInfoOpen: (v: boolean) => void;
  setMapStyle: (style: 'bright' | 'dark') => void;
  setRegion: (region: ShelterRegion) => void;
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
      offlineMode: false,
      offlinePlanOpen: false,
      infoOpen: false,
      region: 'tallinn', // sensible default until geolocation succeeds

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
          // We pass the full official dataset; the routing service does the
          // haversine top-10 pre-filter before issuing OSRM requests.
          const { shelter, route } = await findNearestByRouteDistance(
            userLocation,
            SHELTERS,
            { allowLive: !offlineMode, candidateCount: 10 },
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
      setRegion: (region) => set({ region }),
      setUserLocation: (loc, live) =>
        set((s) => ({
          userLocation: loc,
          isLiveUserLocation: live,
          recenterToken: s.recenterToken + 1,
          // If the device is in Estonia we can now show "Near me" usefully.
          region: live && s.region === 'tallinn' ? 'near-me' : s.region,
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
              shelterAddress: shelter.address,
              shelterLat: shelter.lat,
              shelterLng: shelter.lng,
              savedAt: new Date().toISOString(),
              dataSnapshotDate: shelter.dataSnapshotDate,
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
      // Bump the persist key — previous shape used numeric ids.
      name: 'saferoute.offline-plan.v3-official',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        fallbacks: s.fallbacks,
        familyMeetingPoint: s.familyMeetingPoint,
        emergencyNotes: s.emergencyNotes,
      }),
    },
  ),
);
