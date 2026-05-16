/*
 * SafeRoute Varjumine — floating action buttons.
 *
 * Right-side stack: locate + offline plan + map style + saved places + add place.
 * (Zoom is handled by pinch on native and the MapLibre NavigationControl on web.)
 * Bottom-centre: large "Find nearest shelter" primary CTA.
 */

import {
  Bookmark,
  Crosshair,
  Layers,
  ListChecks,
  MapPin,
  Plus,
  Users,
} from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';

type StackProps = {
  onLocate: () => void;
  onOpenPlan: () => void;
  onToggleStyle: () => void;
  onOpenSavedPlaces: () => void;
  onAddPlace: () => void;
  onShareShelter: () => void;
  mapStyleLabel: string;
  savedPlacesCount: number;
  communityShelterCount: number;
  bottomInset: number;
};

export function MapFabStack({
  onLocate,
  onOpenPlan,
  onToggleStyle,
  onOpenSavedPlaces,
  onAddPlace,
  onShareShelter,
  mapStyleLabel,
  savedPlacesCount,
  communityShelterCount,
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
          onPress={onShareShelter}
          accessibilityRole="button"
          accessibilityLabel="Share a community shelter"
          className="h-12 px-3 items-center justify-center rounded-full bg-amber-500 shadow-md flex-row gap-1.5"
        >
          <Users color="#ffffff" size={18} />
          <Text className="text-white text-[12px] font-semibold">
            Share shelter {communityShelterCount > 0 ? `· ${communityShelterCount}` : ''}
          </Text>
        </Pressable>

        <Pressable
          onPress={onAddPlace}
          accessibilityRole="button"
          accessibilityLabel="Add a saved place"
          className="h-12 px-3 items-center justify-center rounded-full bg-primary shadow-md flex-row gap-1.5"
        >
          <Plus color="#ffffff" size={18} />
          <Text className="text-primary-foreground text-[12px] font-semibold">
            Add place
          </Text>
        </Pressable>

        <Pressable
          onPress={onOpenSavedPlaces}
          accessibilityRole="button"
          accessibilityLabel="Open saved places"
          className="h-12 px-3 items-center justify-center rounded-full bg-card border border-border shadow-md flex-row gap-1.5"
        >
          <Bookmark className="text-foreground" size={18} />
          <Text className="text-foreground text-[12px] font-semibold">
            Saved {savedPlacesCount > 0 ? `· ${savedPlacesCount}` : ''}
          </Text>
        </Pressable>

        <Pressable
          onPress={onOpenPlan}
          accessibilityRole="button"
          accessibilityLabel="Open offline plan"
          className="h-12 w-12 items-center justify-center rounded-full bg-card border border-border shadow-md"
        >
          <ListChecks className="text-foreground" size={22} />
        </Pressable>

        <Pressable
          onPress={onToggleStyle}
          accessibilityRole="button"
          accessibilityLabel={`Switch map style, currently ${mapStyleLabel}`}
          className="h-12 px-3 items-center justify-center rounded-full bg-card border border-border shadow-md flex-row gap-1.5"
        >
          <Layers className="text-foreground" size={18} />
          <Text className="text-foreground text-[11.5px] font-semibold">{mapStyleLabel}</Text>
        </Pressable>

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
  loading?: boolean;
  bottomInset: number;
};

export function FindNearestFab({ onPress, loading, bottomInset }: NearestProps) {
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
        disabled={loading}
        className="flex-row items-center gap-2 rounded-full bg-primary px-6 min-h-[56px] shadow-xl active:opacity-90"
        style={{
          shadowColor: '#000',
          shadowOpacity: 0.3,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          opacity: loading ? 0.7 : 1,
        }}
      >
        <MapPin color="#ffffff" size={22} />
        <Text className="text-primary-foreground text-[16px] font-semibold">
          {loading ? 'Finding shelter…' : 'Find nearest shelter'}
        </Text>
      </Pressable>
    </View>
  );
}
