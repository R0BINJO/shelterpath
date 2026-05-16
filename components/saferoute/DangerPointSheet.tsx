/*
 * SafeRoute Varjumine — Danger Point bottom sheet.
 *
 * Renders a public-data Danger Point selected on the map. Different from
 * ShelterSheet: no shelter-only fields (capacity/water/power/SA3/etc.) —
 * Danger Points are public-data caution markers, NOT shelters, NOT confirmed
 * threats.
 *
 * Required disclaimers shown in-line:
 *   "Public-data proximity caution"
 *   "This is not an official alert or confirmed threat area."
 */

import { useEffect } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  Bookmark,
  BookmarkCheck,
  Copy,
  Landmark,
  MapPin,
  Navigation,
} from 'lucide-react-native';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import type { RouteResult } from '@/lib/routing';
import { cn } from '@/lib/utils';
import { dangerPointDataSource, type DangerPoint } from '@/src/data/dangerPoints';

type RouteUiState = 'idle' | 'loading' | 'ready' | 'error';

type Props = {
  point: DangerPoint | null;
  route: RouteResult | null;
  routeShown: boolean;
  routeState: RouteUiState;
  routeError: string | null;
  isSaved: boolean;
  onClose: () => void;
  onNavigate: () => void;
  onSaveFallback: () => void;
  onCopyCoords: (lat: number, lng: number) => void;
};

const COLLAPSED_HEIGHT = 360;
const EXPANDED_HEIGHT = 620;

function Field({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const shown = value && value.trim() !== '' ? value : 'Not provided in source data';
  const muted = !value || value.trim() === '';
  return (
    <View className="flex-row items-center justify-between py-1.5">
      <Text className="text-muted-foreground text-[11.5px]">{label}</Text>
      <Text
        className={cn(
          'text-[12.5px] font-medium flex-1 text-right ml-3',
          muted ? 'text-muted-foreground italic' : 'text-foreground',
        )}
        numberOfLines={2}
      >
        {shown}
      </Text>
    </View>
  );
}

export function DangerPointSheet({
  point,
  route,
  routeShown,
  routeState,
  routeError,
  isSaved,
  onClose,
  onNavigate,
  onSaveFallback,
  onCopyCoords,
}: Props) {
  const offset = useSharedValue(EXPANDED_HEIGHT);
  const startOffset = useSharedValue(0);

  useEffect(() => {
    if (point) {
      offset.value = withSpring(EXPANDED_HEIGHT - COLLAPSED_HEIGHT, {
        damping: 18,
        stiffness: 160,
      });
    } else {
      offset.value = withTiming(EXPANDED_HEIGHT, { duration: 220 });
    }
  }, [offset, point]);

  useEffect(() => {
    if (point && routeShown) {
      offset.value = withSpring(0, { damping: 18, stiffness: 160 });
    }
  }, [offset, routeShown, point]);

  const pan = Gesture.Pan()
    .onStart(() => {
      startOffset.value = offset.value;
    })
    .onUpdate((e) => {
      const next = startOffset.value + e.translationY;
      offset.value = Math.max(0, Math.min(EXPANDED_HEIGHT, next));
    })
    .onEnd((e) => {
      const projected = offset.value + e.velocityY * 0.15;
      if (projected > EXPANDED_HEIGHT * 0.75) {
        offset.value = withTiming(EXPANDED_HEIGHT, { duration: 200 });
        runOnJS(onClose)();
      } else if (
        projected >
        (EXPANDED_HEIGHT - COLLAPSED_HEIGHT) * 0.6 + 80
      ) {
        offset.value = withSpring(EXPANDED_HEIGHT - COLLAPSED_HEIGHT, {
          damping: 18,
          stiffness: 160,
        });
      } else {
        offset.value = withSpring(0, { damping: 18, stiffness: 160 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      offset.value,
      [0, EXPANDED_HEIGHT - COLLAPSED_HEIGHT, EXPANDED_HEIGHT],
      [0.35, 0, 0],
      Extrapolation.CLAMP,
    ),
  }));

  if (!point) return null;

  const distanceMeters = route?.distanceMeters;
  const walkingMin = route?.walkingTimeMinutes;
  const distanceLabel =
    distanceMeters == null
      ? '—'
      : distanceMeters >= 1000
        ? `${(distanceMeters / 1000).toFixed(2)} km`
        : `${distanceMeters} m`;
  const walkingLabel = walkingMin == null ? '—' : `${walkingMin} min`;

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: 'black',
            zIndex: 18,
          },
          backdropStyle,
        ]}
      />
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: EXPANDED_HEIGHT,
            zIndex: 25,
          },
          sheetStyle,
        ]}
      >
        <View className="flex-1 rounded-t-3xl bg-card border-t border-border shadow-2xl overflow-hidden">
          <GestureDetector gesture={pan}>
            <View className="items-center pt-2.5 pb-1">
              <View className="h-1.5 w-12 rounded-full bg-muted-foreground/40" />
            </View>
          </GestureDetector>

          <ScrollView
            className="px-5"
            contentContainerStyle={{ paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          >
            <View className="flex-row items-start gap-3">
              <View
                style={{ backgroundColor: '#f97316' }}
                className="h-11 w-11 items-center justify-center rounded-full"
              >
                <Landmark color="#fff" size={20} />
              </View>
              <View className="flex-1">
                <Text
                  className="text-foreground text-[18px] font-semibold leading-[22px]"
                  numberOfLines={2}
                >
                  {point.name || 'Unnamed Riigihaldus POI'}
                </Text>
                <Text
                  className="text-muted-foreground text-[12px] mt-1"
                  numberOfLines={2}
                >
                  {point.address || 'Not provided in source data'}
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close danger point details"
                className="h-9 w-9 items-center justify-center rounded-full bg-secondary"
              >
                <Text className="text-foreground text-base">×</Text>
              </Pressable>
            </View>

            {/* Badges */}
            <View className="mt-2.5 flex-row flex-wrap gap-1.5">
              <View className="flex-row items-center gap-1 rounded-full border border-orange-500/40 bg-orange-500/15 px-2 py-1">
                <AlertTriangle color="#fb923c" size={12} />
                <Text className="text-[10.5px] font-semibold text-orange-300">
                  Danger Point
                </Text>
              </View>
              <View className="flex-row items-center gap-1 rounded-full border border-border bg-secondary/60 px-2 py-1">
                <BadgeCheck color="#22d3ee" size={12} />
                <Text className="text-[10.5px] font-semibold text-foreground">
                  Public X-GIS POI dataset
                </Text>
              </View>
              <View className="flex-row items-center gap-1 rounded-full border border-border bg-secondary/60 px-2 py-1">
                <Text className="text-[10.5px] font-semibold text-muted-foreground">
                  Public-data proximity caution
                </Text>
              </View>
            </View>

            {/* Caution disclaimer */}
            <View className="mt-3 rounded-xl border border-orange-500/40 bg-orange-500/10 px-3 py-2.5">
              <View className="flex-row items-center gap-1.5 mb-1">
                <AlertTriangle color="#fb923c" size={14} />
                <Text className="text-orange-300 text-[12px] font-semibold">
                  This is not an official alert or confirmed threat area.
                </Text>
              </View>
              <Text className="text-muted-foreground text-[11px] leading-[15px]">
                Danger Points come from a public POI dataset published by
                Maa- ja Ruumiamet (X-GIS Huvipunktid). The proximity caution
                zone around each point is a SafeRoute prototype overlay for
                civilian route awareness. SafeRoute is not an official
                emergency system.
              </Text>
            </View>

            {/* Source fields card */}
            <View className="mt-3 rounded-xl border border-border bg-secondary/40 px-3 py-2.5">
              <Field label="Category" value="Riigihaldus" />
              <View className="h-px bg-border my-1" />
              <Field label="Layer" value={point.layerName} />
              <View className="h-px bg-border my-1" />
              <Field label="POI type" value={point.poiType} />
              <View className="h-px bg-border my-1" />
              <Field label="Municipality" value={point.municipality} />
              <View className="h-px bg-border my-1" />
              <Field label="County" value={point.county} />
              <View className="h-px bg-border my-1" />
              <Field
                label="Danger zone radius"
                value={`${point.dangerZoneRadiusMeters} m`}
              />
              <View className="h-px bg-border my-1" />
              <Field label="Source" value={dangerPointDataSource.sourceName} />
              <View className="h-px bg-border my-1" />
              <Field label="Snapshot" value={point.dataSnapshotDate} />
              <View className="h-px bg-border my-1" />
              <Field label="Record id" value={point.id} />
            </View>

            {routeShown ? (
              <View className="mt-4 rounded-xl border border-primary/40 bg-primary/10 px-3 py-3">
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-foreground text-[13px] font-semibold">
                    Walking route to Danger Point
                  </Text>
                  {routeState === 'loading' ? (
                    <View className="flex-row items-center gap-1.5">
                      <ActivityIndicator size="small" color="#60a5fa" />
                      <Text className="text-muted-foreground text-[11px]">
                        Calculating…
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text className="text-muted-foreground text-[10.5px] italic mb-1">
                  Destination is a public-data Danger Point marker, not a shelter.
                </Text>
                {route ? (
                  <>
                    <Text className="text-muted-foreground text-[12px] mb-1">
                      {distanceLabel} · {walkingLabel} walk
                    </Text>
                    <Text className="text-muted-foreground text-[10.5px] italic">
                      {route.sourceLabel}
                    </Text>
                  </>
                ) : routeState === 'error' ? (
                  <Text className="text-destructive text-[12px] mt-1">
                    {routeError ?? 'Could not compute route.'}
                  </Text>
                ) : null}
              </View>
            ) : null}

            <View className="mt-4 flex-row gap-2">
              <Pressable
                onPress={onNavigate}
                accessibilityRole="button"
                accessibilityLabel="Navigate to danger point"
                disabled={routeState === 'loading'}
                className="flex-1 flex-row items-center justify-center gap-2 rounded-full bg-primary min-h-[48px] active:opacity-90"
                style={{ opacity: routeState === 'loading' ? 0.7 : 1 }}
              >
                <Navigation color="#ffffff" size={18} />
                <Text className="text-primary-foreground text-[14px] font-semibold">
                  {routeState === 'loading' ? 'Routing…' : 'Navigate'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => onCopyCoords(point.lat, point.lng)}
                accessibilityRole="button"
                accessibilityLabel="Copy coordinates"
                className="flex-row items-center justify-center gap-2 rounded-full border border-border bg-card px-4 min-h-[48px] active:opacity-90"
              >
                <Copy className="text-foreground" size={16} />
                <Text className="text-foreground text-[13px] font-semibold">
                  Copy coords
                </Text>
              </Pressable>
            </View>

            <Pressable
              onPress={onSaveFallback}
              accessibilityRole="button"
              accessibilityLabel="Save danger point as offline reference"
              className={cn(
                'mt-2 flex-row items-center justify-center gap-2 rounded-full border min-h-[44px] active:opacity-90',
                isSaved ? 'bg-secondary border-primary' : 'bg-card border-border',
              )}
            >
              {isSaved ? (
                <BookmarkCheck className="text-foreground" size={16} />
              ) : (
                <Bookmark className="text-foreground" size={16} />
              )}
              <Text className="text-foreground text-[13px] font-semibold">
                {isSaved
                  ? 'Saved as offline Danger Point reference'
                  : 'Save offline Danger Point reference'}
              </Text>
            </Pressable>

            <View className="flex-row items-start gap-1.5 mt-3 mb-2">
              <MapPin color="#9ca3af" size={12} />
              <Text className="text-muted-foreground text-[10.5px] flex-1 leading-[14px]">
                {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
              </Text>
            </View>
          </ScrollView>
        </View>
      </Animated.View>
    </>
  );
}
