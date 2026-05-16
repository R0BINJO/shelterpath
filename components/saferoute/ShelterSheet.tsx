/*
 * SafeRoute Varjumine — shelter detail bottom sheet.
 *
 * Renders official Päästeamet shelter records. Fields that are NOT in the
 * source dataset (capacity, water, power, accessibility, safety score) are
 * NOT shown — we do not invent missing official attributes.
 *
 * Two states: collapsed (peek), expanded (route + instructions).
 * Drag handle is functional via PanGesture.
 *
 * Route source labels:
 *   - "Live walking route"           (online OSRM-compatible endpoint)
 *   - "Offline demo graph route"     (legacy local Dijkstra)
 *   - "Fallback distance estimate"   (haversine straight-line)
 */

import { useEffect } from 'react';
import {
  ActivityIcon,
  BadgeCheck,
  BookmarkPlus,
  Footprints,
  MapPin,
  Navigation,
  Radio,
  ShieldCheck,
  WifiOff,
} from 'lucide-react-native';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
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
import { SHELTER_COLORS } from '@/lib/constants';
import type { RouteResult, RouteSource } from '@/lib/routing';
import { ROUTE_INSTRUCTIONS, type Shelter } from '@/lib/shelters';
import { cn } from '@/lib/utils';

type RouteUiState = 'idle' | 'loading' | 'ready' | 'error';

type Props = {
  shelter: Shelter | null;
  route: RouteResult | null;
  routeShown: boolean;
  routeState: RouteUiState;
  routeError: string | null;
  isSaved: boolean;
  onClose: () => void;
  onNavigate: () => void;
  onSaveFallback: () => void;
};

const COLLAPSED_HEIGHT = 340;
const EXPANDED_HEIGHT = 600;

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <View className="flex-row items-center gap-2 flex-1 min-w-[44%] bg-secondary/60 rounded-xl px-3 py-2">
      {icon}
      <View className="flex-1">
        <Text className="text-muted-foreground text-[11px]">{label}</Text>
        <Text className="text-foreground text-[13px] font-semibold" numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function RouteSourceChip({ source, label }: { source: RouteSource; label: string }) {
  const colors: Record<RouteSource, { bg: string; border: string; dot: string }> = {
    'live': {
      bg: 'bg-emerald-500/15',
      border: 'border-emerald-500/40',
      dot: 'bg-emerald-400',
    },
    'offline-graph': {
      bg: 'bg-amber-500/15',
      border: 'border-amber-500/40',
      dot: 'bg-amber-400',
    },
    'fallback-line': {
      bg: 'bg-rose-500/15',
      border: 'border-rose-500/40',
      dot: 'bg-rose-400',
    },
  };
  const c = colors[source];
  const Icon = source === 'live' ? Radio : source === 'offline-graph' ? WifiOff : ActivityIcon;
  return (
    <View className={cn('flex-row items-center gap-1.5 rounded-full border px-2.5 py-1', c.bg, c.border)}>
      <View className={cn('h-1.5 w-1.5 rounded-full', c.dot)} />
      <Icon className="text-foreground" size={12} />
      <Text className="text-foreground text-[11px] font-semibold">{label}</Text>
    </View>
  );
}

export function ShelterSheet({
  shelter,
  route,
  routeShown,
  routeState,
  routeError,
  isSaved,
  onClose,
  onNavigate,
  onSaveFallback,
}: Props) {
  const offset = useSharedValue(EXPANDED_HEIGHT);
  const startOffset = useSharedValue(0);

  useEffect(() => {
    if (shelter) {
      offset.value = withSpring(EXPANDED_HEIGHT - COLLAPSED_HEIGHT, {
        damping: 18,
        stiffness: 160,
      });
    } else {
      offset.value = withTiming(EXPANDED_HEIGHT, { duration: 220 });
    }
  }, [offset, shelter]);

  useEffect(() => {
    if (shelter && routeShown) {
      offset.value = withSpring(0, { damping: 18, stiffness: 160 });
    }
  }, [offset, routeShown, shelter]);

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
      } else if (projected > (EXPANDED_HEIGHT - COLLAPSED_HEIGHT) * 0.6 + 80) {
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

  if (!shelter) return null;

  const color = SHELTER_COLORS[shelter.type];
  const distanceMeters = route?.distanceMeters;
  const walkingMin = route?.walkingTimeMinutes;
  const distanceLabel =
    distanceMeters == null
      ? 'Tap Navigate to compute'
      : distanceMeters >= 1000
        ? `${(distanceMeters / 1000).toFixed(2)} km`
        : `${distanceMeters} m`;
  const walkingLabel = walkingMin == null ? '—' : `${walkingMin} min`;

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[
          { position: 'absolute', inset: 0, backgroundColor: 'black', zIndex: 18 },
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
                style={{ backgroundColor: color }}
                className="h-11 w-11 items-center justify-center rounded-full"
              >
                <Text className="text-[13px] font-bold text-[#0b1320]">{shelter.type}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-foreground text-[18px] font-semibold leading-[22px]">
                  {shelter.name}
                </Text>
                <Text className="text-muted-foreground text-[12px] mt-1" numberOfLines={2}>
                  {shelter.address}
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close shelter details"
                className="h-9 w-9 items-center justify-center rounded-full bg-secondary"
              >
                <Text className="text-foreground text-base">×</Text>
              </Pressable>
            </View>

            {/* Source / official badges */}
            <View className="mt-2.5 flex-row flex-wrap gap-1.5">
              <View className="flex-row items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1">
                <ShieldCheck color="#34d399" size={12} />
                <Text className="text-[10.5px] font-semibold text-emerald-300">
                  Official public shelter dataset
                </Text>
              </View>
              <View className="flex-row items-center gap-1 rounded-full border border-border bg-secondary/60 px-2 py-1">
                <BadgeCheck color="#22d3ee" size={12} />
                <Text className="text-[10.5px] font-semibold text-foreground">SA3</Text>
              </View>
            </View>

            {/* Stats grid */}
            <View className="mt-3 flex-row flex-wrap gap-2">
              <Stat
                icon={<Footprints color="#60a5fa" size={16} />}
                label="Route distance"
                value={distanceLabel}
              />
              <Stat
                icon={<Navigation color="#60a5fa" size={16} />}
                label="Walking"
                value={walkingLabel}
              />
              <Stat
                icon={<MapPin color="#a78bfa" size={16} />}
                label="Municipality"
                value={shelter.municipality || 'Not provided in source data'}
              />
              <Stat
                icon={<MapPin color="#34d399" size={16} />}
                label="County"
                value={shelter.county || 'Not provided in source data'}
              />
            </View>

            {/* Source attribution */}
            <View className="mt-3 rounded-xl border border-border bg-secondary/40 px-3 py-2.5">
              <View className="flex-row items-center justify-between mb-1">
                <Text className="text-muted-foreground text-[11px]">Source</Text>
                <Text className="text-foreground text-[12px] font-medium">
                  Päästeamet open data
                </Text>
              </View>
              <View className="h-px bg-border my-1.5" />
              <View className="flex-row items-center justify-between mb-1">
                <Text className="text-muted-foreground text-[11px]">Snapshot</Text>
                <Text className="text-foreground text-[12px] font-medium">
                  {shelter.dataSnapshotDate}
                </Text>
              </View>
              <View className="h-px bg-border my-1.5" />
              <View className="flex-row items-center justify-between">
                <Text className="text-muted-foreground text-[11px]">Record id</Text>
                <Text className="text-foreground text-[12px] font-medium">{shelter.id}</Text>
              </View>
            </View>

            <Text className="text-[10.5px] text-muted-foreground mt-2 italic">
              Capacity, water, power and accessibility are not provided in the source data.
            </Text>

            {routeShown ? (
              <View className="mt-4 rounded-xl border border-primary/40 bg-primary/10 px-3 py-3">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-foreground text-[13px] font-semibold">
                    Walking route
                  </Text>
                  {routeState === 'loading' ? (
                    <View className="flex-row items-center gap-1.5">
                      <ActivityIndicator size="small" color="#60a5fa" />
                      <Text className="text-muted-foreground text-[11px]">Calculating…</Text>
                    </View>
                  ) : route ? (
                    <RouteSourceChip source={route.source} label={routeLabel(route.source)} />
                  ) : routeState === 'error' ? (
                    <Text className="text-destructive text-[11px]">Failed</Text>
                  ) : null}
                </View>

                {route ? (
                  <>
                    <Text className="text-muted-foreground text-[12px] mb-1">
                      {distanceLabel} · {walkingLabel} walk
                    </Text>
                    <Text className="text-muted-foreground text-[10.5px] italic mb-2">
                      {route.sourceLabel}
                    </Text>

                    {route.steps && route.steps.length > 0 ? (
                      <View className="mb-2">
                        <Text className="text-foreground text-[11.5px] font-semibold mb-1">
                          Turn-by-turn
                        </Text>
                        {route.steps.slice(0, 6).map((step, i) => (
                          <View
                            key={`step-${i}-${step.slice(0, 16)}`}
                            className="flex-row items-start gap-2 mt-1"
                          >
                            <Text className="text-muted-foreground text-[11px] w-5">
                              {i + 1}.
                            </Text>
                            <Text className="text-foreground text-[12px] flex-1">{step}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}

                    <Text className="text-foreground text-[11.5px] font-semibold mt-1 mb-1">
                      Calm safety reminders
                    </Text>
                    {ROUTE_INSTRUCTIONS.map((line) => (
                      <View key={line} className="flex-row items-start gap-2 mt-0.5">
                        <View className="h-1.5 w-1.5 rounded-full bg-primary mt-2" />
                        <Text className="text-foreground text-[12.5px] flex-1">{line}</Text>
                      </View>
                    ))}
                  </>
                ) : routeState === 'error' ? (
                  <Text className="text-destructive text-[12px]">
                    {routeError ?? 'Could not compute route.'}
                  </Text>
                ) : null}
              </View>
            ) : null}

            <View className="mt-4 flex-row gap-2">
              <Pressable
                onPress={onNavigate}
                accessibilityRole="button"
                accessibilityLabel="Navigate to shelter"
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
                onPress={onSaveFallback}
                accessibilityRole="button"
                accessibilityLabel="Save shelter as fallback"
                className={cn(
                  'flex-1 flex-row items-center justify-center gap-2 rounded-full border min-h-[48px] active:opacity-90',
                  isSaved ? 'bg-secondary border-primary' : 'bg-card border-border',
                )}
              >
                <BookmarkPlus className="text-foreground" size={18} />
                <Text className="text-foreground text-[14px] font-semibold">
                  {isSaved ? 'Saved' : 'Save fallback'}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Animated.View>
    </>
  );
}

function routeLabel(source: RouteSource): string {
  switch (source) {
    case 'live':
      return 'Live route';
    case 'offline-graph':
      return 'Offline graph';
    case 'fallback-line':
      return 'Fallback estimate';
    default:
      return 'Route';
  }
}
