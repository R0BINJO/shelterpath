/*
 * SafeRoute Varjumine — cross-platform map props.
 *
 * Both the web (maplibre-gl) and native (react-native-maps) implementations
 * consume the same prop shape so the screen above them is identical.
 */

import type { RouteResult } from '@/lib/routing';
import type { Shelter } from '@/lib/shelters';
import type { DangerPoint } from '@/src/data/dangerPoints';
import type { UserPlace } from '@/src/types/userPlaces';

export type SafeRouteMapStyle = 'bright' | 'dark';

export type SafeRouteLayerVisibility = {
  shelters: boolean;
  savedPlaces: boolean;
  danger: boolean;
  dangerPoints: boolean;
  dangerZones: boolean;
};

export type SafeRouteMapProps = {
  shelters: readonly Shelter[];
  selectedShelterId: string | null;
  userPlaces: readonly UserPlace[];
  selectedUserPlaceId: string | null;
  dangerPoints: readonly DangerPoint[];
  selectedDangerPointId: string | null;
  route: RouteResult | null;
  userLocation: { lat: number; lng: number };
  isLiveUserLocation: boolean;
  crisisMode: boolean;
  mapStyle: SafeRouteMapStyle;
  layerVisibility: SafeRouteLayerVisibility;
  onSelectShelter: (s: Shelter) => void;
  onSelectUserPlace: (p: UserPlace) => void;
  onSelectDangerPoint: (p: DangerPoint) => void;
  /** Manual-pin mode: when true, the map shows a centred crosshair the user pans. */
  manualPinMode?: boolean;
  /** Imperative recenter to user (called when "Locate" tapped). */
  recenterToken?: number;
  /** Imperative fit to current route. */
  fitRouteToken?: number;
  /** Imperative center the map on these coords (e.g. preview a geocoded place). */
  flyToToken?: number;
  flyToTarget?: { lat: number; lng: number } | null;
  /** Reports the current map center, used by manual pin mode. */
  onCenterChange?: (c: { lat: number; lng: number }) => void;
};
