/*
 * SafeRoute Varjumine — USER SAVED PLACES types.
 *
 * USER SAVED PLACES - stored locally in browser localStorage / AsyncStorage.
 * These are NOT shelters. They are private, user-created records describing
 * the user's own significant locations (home, work, school, family meeting
 * point, other).
 *
 * DO NOT SEND HOME/WORK/SCHOOL ADDRESSES TO BACKEND.
 * SafeRoute keeps these locally on this device only.
 *
 * PRODUCTION TODO: consider encrypted local storage for sensitive saved places.
 */

export type UserPlaceType = 'home' | 'work' | 'school' | 'family' | 'other';

export type UserPlaceSource = 'photon' | 'nominatim-fallback' | 'manual-pin';

export interface UserPlace {
  id: string;
  type: UserPlaceType;
  label: string;
  address: string;
  displayName: string;
  lat: number;
  lng: number;
  source: UserPlaceSource;
  createdAt: string;
  updatedAt: string;
  isUserSaved: true;
  originalGeocoderResult?: unknown;
}

export const USER_PLACE_TYPE_META: Record<
  UserPlaceType,
  { label: string; color: string; defaultLabel: string }
> = {
  // Saved place marker colours per spec.
  home: { label: 'Home', color: '#a855f7', defaultLabel: 'Home' }, // purple
  work: { label: 'Work', color: '#f97316', defaultLabel: 'Work' }, // orange
  school: { label: 'School', color: '#06b6d4', defaultLabel: 'School' }, // cyan
  family: {
    label: 'Family meeting point',
    color: '#ec4899',
    defaultLabel: 'Family meeting point',
  }, // pink
  other: { label: 'Other', color: '#e5e7eb', defaultLabel: 'Saved place' }, // light gray
};
