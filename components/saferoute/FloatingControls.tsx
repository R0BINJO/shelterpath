/*
 * SafeRoute Varjumine — floating action buttons.
 * Right-side stack: locate, zoom in/out, offline plan.
 * Bottom-centre: large "Find nearest shelter" primary CTA.
 */

import {
  Crosshair,
  ListChecks,
  MapPin,
  Plus,
  Minus,
} from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';

type StackProps = {
  onLocate: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onOpenPlan: () => void;
  bottomInset: number;
};

export function MapFabStack({
  onLocate,
  onZoomIn,
  onZoomOut,
  onOpenPlan,
  bottomInset,
}: StackProps) {
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        right: 12,
        bottom: bottomInset,
        zIndex: 15,
      }}
    >
      <View className="gap-2.5 items-end">
        <Pressable
          onPress={onOpenPlan}
          accessibilityRole="button"
          accessibilityLabel="Open offline plan"
          className="h-12 w-12 items-center justify-center rounded-full bg-card border border-border shadow-md"
        >
          <ListChecks className="text-foreground" size={22} />
        </Pressable>

        <View className="rounded-2xl bg-card border border-border overflow-hidden">
          <Pressable
            onPress={onZoomIn}
            accessibilityRole="button"
            accessibilityLabel="Zoom in"
            className="h-12 w-12 items-center justify-center"
          >
            <Plus className="text-foreground" size={22} />
          </Pressable>
          <View className="h-px bg-border" />
          <Pressable
            onPress={onZoomOut}
            accessibilityRole="button"
            accessibilityLabel="Zoom out"
            className="h-12 w-12 items-center justify-center"
          >
            <Minus className="text-foreground" size={22} />
          </Pressable>
        </View>

        <Pressable
          onPress={onLocate}
          accessibilityRole="button"
          accessibilityLabel="Center on my location"
          className="h-12 w-12 items-center justify-center rounded-full bg-card border border-border shadow-md"
        >
          <Crosshair className="text-primary" size={22} />
        </Pressable>
      </View>
    </View>
  );
}

type NearestProps = {
  onPress: () => void;
  bottomInset: number;
};

export function FindNearestFab({ onPress, bottomInset }: NearestProps) {
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: bottomInset,
        zIndex: 15,
        alignItems: 'center',
      }}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Find nearest shelter"
        className="flex-row items-center gap-2 rounded-full bg-primary px-6 min-h-[56px] shadow-xl active:opacity-90"
        style={{ shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } }}
      >
        <MapPin color="#ffffff" size={22} />
        <Text className="text-primary-foreground text-[16px] font-semibold">
          Find nearest shelter
        </Text>
      </Pressable>
    </View>
  );
}
