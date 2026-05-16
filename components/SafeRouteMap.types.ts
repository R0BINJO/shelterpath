/*
 * SafeRoute Varjumine — cross-platform map props.
 *
 * Both the web (maplibre-gl) and native (react-native-maps) implementations
 * consume the same prop shape so the screen above them is identical.
 */

import type { RouteResult } from '@/lib/routing';
import type { Shelter } from '@/lib/shelters';

export type SafeRouteMapStyle = 'bright' | 'dark';

export type SafeRouteMapProps = {
  shelters: Shelter[];
  selectedShelterId: number | null;
  route: RouteResult | null;
  userLocation: { lat: number; lng: number };
  isLiveUserLocation: boolean;
  crisisMode: boolean;
  mapStyle: SafeRouteMapStyle;
  onSelectShelter: (s: Shelter) => void;
  /** Imperative recenter to user (called when "Locate" tapped). */
  recenterToken?: number;
  /** Imperative fit to current route. */
  fitRouteToken?: number;
};
