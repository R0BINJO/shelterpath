/*
 * SafeRoute Varjumine — layer/filter chip row.
 * Lets the user toggle visibility of the official shelters, saved places, the
 * demo danger zone, and the public-data Danger Points / Danger Zones.
 */

import {
  Bookmark,
  CircleAlert,
  Eye,
  EyeOff,
  Landmark,
  ShieldAlert,
  ShieldCheck,
  Users,
} from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import type { LayerVisibility } from '@/lib/saferouteStore';

type Props = {
  layers: LayerVisibility;
  onToggle: (key: keyof LayerVisibility) => void;
};

export function LayerToggleChips({ layers, onToggle }: Props) {
  return (
    <View className="flex-row gap-1.5 flex-wrap">
      <Chip
        active={layers.shelters}
        onPress={() => onToggle('shelters')}
        label="Official shelters"
        icon={
          <ShieldCheck
            color={layers.shelters ? '#34d399' : '#9ca3af'}
            size={12}
          />
        }
      />
      <Chip
        active={layers.savedPlaces}
        onPress={() => onToggle('savedPlaces')}
        label="Saved places"
        icon={
          <Bookmark
            color={layers.savedPlaces ? '#a855f7' : '#9ca3af'}
            size={12}
          />
        }
      />
      <Chip
        active={layers.communityShelters}
        onPress={() => onToggle('communityShelters')}
        label="Community shelters"
        icon={
          <Users
            color={layers.communityShelters ? '#f59e0b' : '#9ca3af'}
            size={12}
          />
        }
      />
      <Chip
        active={layers.dangerPoints}
        onPress={() => onToggle('dangerPoints')}
        label="Danger Points"
        icon={
          <Landmark
            color={layers.dangerPoints ? '#f97316' : '#9ca3af'}
            size={12}
          />
        }
      />
      <Chip
        active={layers.dangerZones}
        onPress={() => onToggle('dangerZones')}
        label="Danger Zones"
        icon={
          <ShieldAlert
            color={layers.dangerZones ? '#ef4444' : '#9ca3af'}
            size={12}
          />
        }
      />
      <Chip
        active={layers.danger}
        onPress={() => onToggle('danger')}
        label="Demo danger area"
        icon={
          <CircleAlert
            color={layers.danger ? '#ef4444' : '#9ca3af'}
            size={12}
          />
        }
      />
    </View>
  );
}

function Chip({
  active,
  onPress,
  label,
  icon,
}: {
  active: boolean;
  onPress: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Toggle ${label}`}
      className={cn(
        'flex-row items-center gap-1.5 rounded-full border px-2.5 py-1 min-h-[28px]',
        active ? 'bg-card border-border' : 'bg-card/60 border-border/60',
      )}
    >
      {icon}
      <Text
        className={cn(
          'text-[10.5px] font-semibold',
          active ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {label}
      </Text>
      {active ? (
        <Eye color="#9ca3af" size={11} />
      ) : (
        <EyeOff color="#9ca3af" size={11} />
      )}
    </Pressable>
  );
}
