/*
 * SafeRoute Varjumine — client state.
 *
 * Persists Offline Plan data (fallback shelters, family meeting point,
 * emergency notes) AND user-saved places to AsyncStorage (the React Native
 * equivalent of localStorage — used on web too via the same package).
 *
 * USER SAVED PLACES - stored locally in AsyncStorage under
 * `saferoute.userPlaces.v1`. They are NOT shelters. They are private,
 * device-local records describing the user's own significant locations.
 *
 * DO NOT SEND HOME/WORK/SCHOOL ADDRESSES TO BACKEND.
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
import {
  deleteUserPlace as deleteUserPlaceFromStorage,
  getSavedUserPlaces,
  newUserPlaceId,
  saveUserPlace as saveUserPlaceToStorage,
  updateUserPlace as updateUserPlaceInStorage,
} from './userPlacesStorage';
import {
  findDangerZonesAlongRoute,
  type DangerPoint,
  type DangerPointLayerId,
} from '@/src/data/dangerPoints';
import type { ShelterRegion } from '@/src/data/officialShelters';
import type { UserPlace, UserPlaceType } from '@/src/types/userPlaces';

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

export type LayerVisibility = {
  shelters: boolean;
  savedPlaces: boolean;
  /** COMMUNITY SHELTERS — unverified user submissions. Online-cached-offline. */
  communityShelters: boolean;
  danger: boolean;
  dangerPoints: boolean;
  dangerZones: boolean;
};

export type DangerLayerFilter = 'all' | DangerPointLayerId;

export type FallbackDangerPoint = {
  fallbackDangerPointId: string;
  fallbackDangerPointName: string;
  fallbackDangerPointAddress: string;
  fallbackDangerPointLat: number;
  fallbackDangerPointLng: number;
  fallbackDangerPointLayerId: DangerPointLayerId;
  fallbackDangerPointLayerName: string;
  fallbackDangerZoneRadiusMeters: number;
  savedAt: string;
  dataSnapshotDate: string;
};

export type AddPlaceSheetState =
  | { open: false }
  | { open: true; editingId?: string; presetType?: UserPlaceType };

type SafeRouteState = {
  // UI state (not persisted)
  selectedShelterId: string | null;
  selectedUserPlaceId: string | null;
  selectedDangerPointId: string | null;
  showRoute: boolean;
  crisisMode: boolean;
  offlineMode: boolean;
  offlinePlanOpen: boolean;
  infoOpen: boolean;
  region: ShelterRegion;
  addPlaceSheet: AddPlaceSheetState;
  savedPlacesPanelOpen: boolean;
  layerVisibility: LayerVisibility;
  dangerLayerFilter: DangerLayerFilter;

  // Real interactive map state (not persisted)
  userLocation: LatLng;
  isLiveUserLocation: boolean;
  mapStyle: 'bright' | 'dark';

  // Routing state (not persisted)
  route: RouteResult | null;
  routeState: RouteState;
  routeError: string | null;
  routeStart: LatLng | null;
  routeStartLabel: string | null;
  recenterToken: number;
  fitRouteToken: number;
  /** Danger Points whose proximity zone the current route intersects. */
  routeDangerHits: DangerPoint[];

  // User saved places (loaded once on mount, persisted under userPlaces.v1)
  userPlaces: UserPlace[];
  userPlacesLoaded: boolean;

  // Persisted offline plan
  fallbacks: Partial<Record<FallbackSlot, SavedFallback>>;
  fallbackDangerPoint: FallbackDangerPoint | null;
  familyMeetingPoint: string;
  emergencyNotes: string;

  // Actions
  selectShelter: (id: string | null) => void;
  selectUserPlace: (id: string | null) => void;
  selectDangerPoint: (id: string | null) => void;
  navigateToShelter: (shelter: Shelter) => Promise<void>;
  navigateToDangerPoint: (point: DangerPoint) => Promise<void>;
  findNearest: () => Promise<void>;
  routeFromSavedPlaceToNearestShelter: (place: UserPlace) => Promise<void>;
  routeFromCurrentLocationToSavedPlace: (place: UserPlace) => Promise<void>;
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
  saveFallbackDangerPoint: (point: DangerPoint) => void;
  clearFallbackDangerPoint: () => void;
  setFamilyMeetingPoint: (v: string) => void;
  setEmergencyNotes: (v: string) => void;
  clearRoute: () => void;
  setDangerLayerFilter: (f: DangerLayerFilter) => void;

  // Saved-place actions
  loadUserPlaces: () => Promise<void>;
  addUserPlace: (
    input: Omit<UserPlace, 'id' | 'createdAt' | 'updatedAt' | 'isUserSaved'>,
  ) => Promise<UserPlace>;
  replaceUserPlace: (place: UserPlace) => Promise<UserPlace>;
  removeUserPlace: (id: string) => Promise<void>;
  openAddPlace: (preset?: { editingId?: string; presetType?: UserPlaceType }) => void;
  closeAddPlace: () => void;
  setSavedPlacesPanelOpen: (v: boolean) => void;
  toggleLayer: (key: keyof LayerVisibility) => void;
};

export const useSafeRouteStore = create<SafeRouteState>()(
  persist(
    (set, get) => ({
      selectedShelterId: null,
      selectedUserPlaceId: null,
      selectedDangerPointId: null,
      showRoute: false,
      crisisMode: true,
      offlineMode: false,
      offlinePlanOpen: false,
      infoOpen: false,
      region: 'tallinn',
      addPlaceSheet: { open: false },
      savedPlacesPanelOpen: false,
      layerVisibility: {
        shelters: true,
        savedPlaces: true,
        communityShelters: true,
        danger: true,
        dangerPoints: true,
        dangerZones: true,
      },
      dangerLayerFilter: 'all',

      userLocation: getDemoStart(),
      isLiveUserLocation: false,
      mapStyle: 'bright',

      route: null,
      routeState: 'idle',
      routeError: null,
      routeStart: null,
      routeStartLabel: null,
      recenterToken: 0,
      fitRouteToken: 0,
      routeDangerHits: [],

      userPlaces: [],
      userPlacesLoaded: false,

      fallbacks: {},
      fallbackDangerPoint: null,
      familyMeetingPoint: '',
      emergencyNotes: '',

      selectShelter: (id) =>
        set((s) => {
          if (id === s.selectedShelterId) return { selectedShelterId: id };
          return {
            selectedShelterId: id,
            selectedUserPlaceId: id ? null : s.selectedUserPlaceId,
            selectedDangerPointId: id ? null : s.selectedDangerPointId,
            showRoute: false,
            route: null,
            routeState: 'idle',
            routeError: null,
            routeStart: null,
            routeStartLabel: null,
            routeDangerHits: [],
          };
        }),

      selectUserPlace: (id) =>
        set((s) => ({
          selectedUserPlaceId: id,
          selectedShelterId: id ? null : s.selectedShelterId,
          selectedDangerPointId: id ? null : s.selectedDangerPointId,
          showRoute: false,
          route: null,
          routeState: 'idle',
          routeError: null,
          routeStart: null,
          routeStartLabel: null,
          routeDangerHits: [],
        })),

      selectDangerPoint: (id) =>
        set((s) => ({
          selectedDangerPointId: id,
          selectedShelterId: id ? null : s.selectedShelterId,
          selectedUserPlaceId: id ? null : s.selectedUserPlaceId,
          showRoute: false,
          route: null,
          routeState: 'idle',
          routeError: null,
          routeStart: null,
          routeStartLabel: null,
          routeDangerHits: [],
        })),

      navigateToShelter: async (shelter) => {
        const { userLocation, offlineMode } = get();
        set({
          selectedShelterId: shelter.id,
          selectedUserPlaceId: null,
          selectedDangerPointId: null,
          showRoute: true,
          routeState: 'loading',
          routeError: null,
          routeStart: userLocation,
          routeStartLabel: 'Current location',
          routeDangerHits: [],
        });
        try {
          const result = await getRouteToShelter(userLocation, shelter, {
            allowLive: !offlineMode,
          });
          set((s) => ({
            route: result,
            routeState: 'ready',
            fitRouteToken: s.fitRouteToken + 1,
            routeDangerHits: findDangerZonesAlongRoute(result.coordinates),
          }));
        } catch (e) {
          set({
            routeState: 'error',
            routeError: e instanceof Error ? e.message : 'Routing failed',
          });
        }
      },

      navigateToDangerPoint: async (point) => {
        const { userLocation, offlineMode } = get();
        // Synthesise a shelter-shaped destination so we can reuse the routing
        // primitive. We do NOT classify the Danger Point as a shelter.
        const syntheticDest = {
          id: `dangerpoint:${point.id}`,
          name: point.name,
          address: point.address,
          municipality: point.municipality,
          county: point.county,
          lat: point.lat,
          lng: point.lng,
          type: 'SA3',
          source: 'danger-point',
          official: false,
          verified: false,
          dataSnapshotDate: point.dataSnapshotDate,
          originalProperties: {},
        } as unknown as Shelter;
        set({
          selectedDangerPointId: point.id,
          selectedShelterId: null,
          selectedUserPlaceId: null,
          showRoute: true,
          routeState: 'loading',
          routeError: null,
          routeStart: userLocation,
          routeStartLabel: 'Current location',
          routeDangerHits: [],
        });
        try {
          const result = await getRouteToShelter(userLocation, syntheticDest, {
            allowLive: !offlineMode,
          });
          set((s) => ({
            route: result,
            routeState: 'ready',
            fitRouteToken: s.fitRouteToken + 1,
            routeDangerHits: findDangerZonesAlongRoute(result.coordinates),
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
        set({
          routeState: 'loading',
          routeError: null,
          showRoute: true,
          routeStart: userLocation,
          routeStartLabel: 'Current location',
          routeDangerHits: [],
        });
        try {
          const { shelter, route } = await findNearestByRouteDistance(
            userLocation,
            SHELTERS,
            { allowLive: !offlineMode, candidateCount: 10 },
          );
          set((s) => ({
            selectedShelterId: shelter.id,
            selectedUserPlaceId: null,
            selectedDangerPointId: null,
            route,
            routeState: 'ready',
            fitRouteToken: s.fitRouteToken + 1,
            routeDangerHits: findDangerZonesAlongRoute(route.coordinates),
          }));
        } catch (e) {
          set({
            routeState: 'error',
            routeError: e instanceof Error ? e.message : 'Routing failed',
          });
        }
      },

      routeFromSavedPlaceToNearestShelter: async (place) => {
        const { offlineMode } = get();
        const start: LatLng = { lat: place.lat, lng: place.lng };
        set({
          showRoute: true,
          routeState: 'loading',
          routeError: null,
          routeStart: start,
          routeStartLabel: place.label,
          selectedUserPlaceId: place.id,
          selectedDangerPointId: null,
          routeDangerHits: [],
        });
        try {
          const { shelter, route } = await findNearestByRouteDistance(
            start,
            SHELTERS,
            { allowLive: !offlineMode, candidateCount: 10 },
          );
          set((s) => ({
            selectedShelterId: shelter.id,
            route,
            routeState: 'ready',
            fitRouteToken: s.fitRouteToken + 1,
            routeDangerHits: findDangerZonesAlongRoute(route.coordinates),
          }));
        } catch (e) {
          set({
            routeState: 'error',
            routeError: e instanceof Error ? e.message : 'Routing failed',
          });
        }
      },

      routeFromCurrentLocationToSavedPlace: async (place) => {
        const { userLocation, offlineMode } = get();
        // Treat the saved place as a synthetic shelter-shaped destination
        // for the OSRM call. We do NOT classify it as a shelter; we just
        // reuse the routing primitive.
        const syntheticDest: Shelter = {
          id: `userplace:${place.id}`,
          name: place.label,
          address: place.address,
          municipality: '',
          county: '',
          lat: place.lat,
          lng: place.lng,
          type: 'SA3',
          source: 'user-saved',
          official: false,
          verified: false,
          dataSnapshotDate: place.createdAt.slice(0, 10),
          originalProperties: {},
        } as unknown as Shelter;
        set({
          showRoute: true,
          routeState: 'loading',
          routeError: null,
          routeStart: userLocation,
          routeStartLabel: 'Current location',
          selectedUserPlaceId: place.id,
          selectedShelterId: null,
          selectedDangerPointId: null,
          routeDangerHits: [],
        });
        try {
          const result = await getRouteToShelter(userLocation, syntheticDest, {
            allowLive: !offlineMode,
          });
          set((s) => ({
            route: result,
            routeState: 'ready',
            fitRouteToken: s.fitRouteToken + 1,
            routeDangerHits: findDangerZonesAlongRoute(result.coordinates),
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

      saveFallbackDangerPoint: (point) =>
        set({
          fallbackDangerPoint: {
            fallbackDangerPointId: point.id,
            fallbackDangerPointName: point.name,
            fallbackDangerPointAddress: point.address,
            fallbackDangerPointLat: point.lat,
            fallbackDangerPointLng: point.lng,
            fallbackDangerPointLayerId: point.layerId,
            fallbackDangerPointLayerName: point.layerName,
            fallbackDangerZoneRadiusMeters: point.dangerZoneRadiusMeters,
            savedAt: new Date().toISOString(),
            dataSnapshotDate: point.dataSnapshotDate,
          },
        }),
      clearFallbackDangerPoint: () => set({ fallbackDangerPoint: null }),

      setDangerLayerFilter: (f) => set({ dangerLayerFilter: f }),
      clearRoute: () =>
        set({
          route: null,
          routeState: 'idle',
          showRoute: false,
          routeError: null,
          routeStart: null,
          routeStartLabel: null,
          routeDangerHits: [],
        }),

      // USER SAVED PLACES
      loadUserPlaces: async () => {
        if (get().userPlacesLoaded) return;
        const places = await getSavedUserPlaces();
        set({ userPlaces: places, userPlacesLoaded: true });
      },

      addUserPlace: async (input) => {
        const now = new Date().toISOString();
        const place: UserPlace = {
          ...input,
          id: newUserPlaceId(),
          createdAt: now,
          updatedAt: now,
          isUserSaved: true,
        };
        const next = await saveUserPlaceToStorage(place);
        set({ userPlaces: next });
        return place;
      },

      replaceUserPlace: async (place) => {
        const next = await updateUserPlaceInStorage(place);
        set({ userPlaces: next });
        return place;
      },

      removeUserPlace: async (id) => {
        const next = await deleteUserPlaceFromStorage(id);
        set((s) => ({
          userPlaces: next,
          selectedUserPlaceId: s.selectedUserPlaceId === id ? null : s.selectedUserPlaceId,
        }));
      },

      openAddPlace: (preset) =>
        set({
          addPlaceSheet: {
            open: true,
            editingId: preset?.editingId,
            presetType: preset?.presetType,
          },
          savedPlacesPanelOpen: false,
        }),
      closeAddPlace: () => set({ addPlaceSheet: { open: false } }),
      setSavedPlacesPanelOpen: (v) => set({ savedPlacesPanelOpen: v }),

      toggleLayer: (key) =>
        set((s) => ({
          layerVisibility: { ...s.layerVisibility, [key]: !s.layerVisibility[key] },
        })),
    }),
    {
      name: 'saferoute.offline-plan.v4-danger',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        fallbacks: s.fallbacks,
        fallbackDangerPoint: s.fallbackDangerPoint,
        familyMeetingPoint: s.familyMeetingPoint,
        emergencyNotes: s.emergencyNotes,
      }),
    },
  ),
);
