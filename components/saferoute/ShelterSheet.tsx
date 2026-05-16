/*
 * SafeRoute Varjumine — shelter detail bottom sheet.
 *
 * Two states: collapsed (peek), expanded (route + instructions).
 * Drag handle is functional via PanGesture to feel like a real map sheet.
 */

import { useEffect } from 'react';
import {
  Accessibility,
  BadgeCheck,
  BookmarkPlus,
  CircleCheck,
  CircleX,
  Droplets,
  Footprints,
  Navigation,
  Users,
  Zap,
} from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';
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
import { cn } from '@/lib/utils';
import { ROUTE_INSTRUCTIONS, type RoutePolyline, type Shelter } from '@/lib/shelters';
import { SHELTER_COLORS } from '@/lib/constants';

type Props = {
  shelter: Shelter | null;
  route: RoutePolyline | null;
  routeShown: boolean;
  isSaved: boolean;
  onClose: () => void;
  onNavigate: () => void;
  onSaveFallback: () => void;
};

const COLLAPSED_HEIGHT = 320;
const EXPANDED_HEIGHT = 560;

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
        <Text className="text-foreground text-[13px] font-semibold">{value}</Text>
      </View>
    </View>
  );
}

function YesNoIcon({ value }: { value: boolean }) {
  return value ? (
    <CircleCheck color="#22c55e" size={16} />
  ) : (
    <CircleX color="#94a3b8" size={16} />
  );
}

export function ShelterSheet({
  shelter,
  route,
  routeShown,
  isSaved,
  onClose,
  onNavigate,
  onSaveFallback,
}: Props) {
  const offset = useSharedValue(EXPANDED_HEIGHT); // hidden state: pushed off-screen
  const startOffset = useSharedValue(0);

  useEffect(() => {
    if (shelter) {
      // Open at collapsed peek when a shelter is freshly selected.
      offset.value = withSpring(EXPANDED_HEIGHT - COLLAPSED_HEIGHT, {
        damping: 18,
        stiffness: 160,
      });
    } else {
      offset.value = withTiming(EXPANDED_HEIGHT, { duration: 220 });
    }
  }, [offset, shelter]);

  useEffect(() => {
    // Auto-expand when navigation is triggered so route instructions are visible.
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

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            inset: 0,
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
                style={{ backgroundColor: color }}
                className="h-11 w-11 items-center justify-center rounded-full"
              >
                <Text className="text-[13px] font-bold text-[#0b1320]">{shelter.type}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-foreground text-[18px] font-semibold leading-[22px]">
                  {shelter.name}
                </Text>
                <Text className="text-muted-foreground text-[13px] mt-0.5">
                  {shelter.distanceMeters} m · {shelter.walkingTimeMinutes} min walk
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

            <Text className="text-muted-foreground text-[12px] mt-2">
              {shelter.description}
            </Text>

            <View className="mt-3 flex-row flex-wrap gap-2">
              <Stat
                icon={<Footprints color="#60a5fa" size={16} />}
                label="Distance"
                value={`${shelter.distanceMeters} m`}
              />
              <Stat
                icon={<Navigation color="#60a5fa" size={16} />}
                label="Walking"
                value={`${shelter.walkingTimeMinutes} min`}
              />
              <Stat
                icon={<Users color="#a78bfa" size={16} />}
                label="Capacity"
                value={String(shelter.capacity)}
              />
              <Stat
                icon={<Accessibility color="#34d399" size={16} />}
                label="Accessible"
                value={shelter.accessible ? 'Yes' : 'No'}
              />
            </View>

            <View className="mt-3 rounded-xl border border-border bg-secondary/40 px-3 py-2.5">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-1.5">
                  <Zap color="#f59e0b" size={14} />
                  <Text className="text-foreground text-[12px]">Power</Text>
                </View>
                <YesNoIcon value={shelter.hasPower} />
              </View>
              <View className="h-px bg-border my-2" />
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-1.5">
                  <Droplets color="#38bdf8" size={14} />
                  <Text className="text-foreground text-[12px]">Water</Text>
                </View>
                <YesNoIcon value={shelter.hasWater} />
              </View>
              <View className="h-px bg-border my-2" />
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-1.5">
                  <BadgeCheck color="#22d3ee" size={14} />
                  <Text className="text-foreground text-[12px]">Verified</Text>
                </View>
                <YesNoIcon value={shelter.verified} />
              </View>
              <View className="h-px bg-border my-2" />
              <View className="flex-row items-center justify-between">
                <Text className="text-muted-foreground text-[11px]">Last checked</Text>
                <Text className="text-foreground text-[12px] font-medium">
                  {shelter.lastChecked}
                </Text>
              </View>
              <View className="h-px bg-border my-2" />
              <View className="flex-row items-center justify-between">
                <Text className="text-muted-foreground text-[11px]">
                  Safety score (info only)
                </Text>
                <Text className="text-foreground text-[12px] font-medium">
                  {shelter.safetyScore}/100
                </Text>
              </View>
            </View>

            <Text className="text-[10.5px] text-muted-foreground mt-2 italic">
              Demo values · not official information
            </Text>

            {routeShown && route ? (
              <View className="mt-4 rounded-xl border border-primary/40 bg-primary/10 px-3 py-3">
                <Text className="text-foreground text-[13px] font-semibold mb-1">
                  Shortest demo route
                </Text>
                <Text className="text-muted-foreground text-[12px] mb-2">
                  {route.distanceMeters} m · {route.walkingTimeMinutes} min walk
                </Text>
                {ROUTE_INSTRUCTIONS.map((line) => (
                  <View key={line} className="flex-row items-start gap-2 mt-1">
                    <View className="h-1.5 w-1.5 rounded-full bg-primary mt-2" />
                    <Text className="text-foreground text-[12.5px] flex-1">{line}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View className="mt-4 flex-row gap-2">
              <Pressable
                onPress={onNavigate}
                accessibilityRole="button"
                accessibilityLabel="Navigate to shelter"
                className="flex-1 flex-row items-center justify-center gap-2 rounded-full bg-primary min-h-[48px] active:opacity-90"
              >
                <Navigation color="#ffffff" size={18} />
                <Text className="text-primary-foreground text-[14px] font-semibold">
                  Navigate
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
