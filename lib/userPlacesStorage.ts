/*
 * SafeRoute Varjumine — USER SAVED PLACES persistence helper.
 *
 * USER SAVED PLACES - stored locally in AsyncStorage (web: localStorage shim).
 *
 * Storage key: saferoute.userPlaces.v1
 *
 * Functions:
 *   - getSavedUserPlaces()
 *   - saveUserPlace(place)
 *   - updateUserPlace(place)
 *   - deleteUserPlace(id)
 *   - clearAllUserPlaces()
 *
 * DO NOT SEND HOME/WORK/SCHOOL ADDRESSES TO BACKEND.
 * SAVED PLACES WORK OFFLINE AFTER SAVING.
 *
 * PRODUCTION TODO: consider encrypted local storage for sensitive saved places.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { UserPlace } from '@/src/types/userPlaces';

export const USER_PLACES_STORAGE_KEY = 'saferoute.userPlaces.v1';

export async function getSavedUserPlaces(): Promise<UserPlace[]> {
  try {
    const raw = await AsyncStorage.getItem(USER_PLACES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isUserPlace);
  } catch {
    return [];
  }
}

export async function saveUserPlace(place: UserPlace): Promise<UserPlace[]> {
  const current = await getSavedUserPlaces();
  const next = [...current.filter((p) => p.id !== place.id), place];
  await persist(next);
  return next;
}

export async function updateUserPlace(place: UserPlace): Promise<UserPlace[]> {
  const current = await getSavedUserPlaces();
  const next = current.map((p) =>
    p.id === place.id ? { ...place, updatedAt: new Date().toISOString() } : p,
  );
  await persist(next);
  return next;
}

export async function deleteUserPlace(id: string): Promise<UserPlace[]> {
  const current = await getSavedUserPlaces();
  const next = current.filter((p) => p.id !== id);
  await persist(next);
  return next;
}

export async function clearAllUserPlaces(): Promise<void> {
  await AsyncStorage.removeItem(USER_PLACES_STORAGE_KEY);
}

async function persist(places: UserPlace[]): Promise<void> {
  try {
    await AsyncStorage.setItem(USER_PLACES_STORAGE_KEY, JSON.stringify(places));
  } catch {
    // Surfacing the error is the caller's job — UI shows
    // "Could not save place on this device."
    throw new Error('Could not save place on this device.');
  }
}

function isUserPlace(v: unknown): v is UserPlace {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.type === 'string' &&
    typeof o.label === 'string' &&
    typeof o.lat === 'number' &&
    typeof o.lng === 'number' &&
    typeof o.address === 'string'
  );
}

export function newUserPlaceId(): string {
  // Local random id — no need for crypto.randomUUID (not on RN by default).
  return `up_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
