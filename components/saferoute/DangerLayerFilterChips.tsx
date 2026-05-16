/*
 * SafeRoute Varjumine — Danger Point sub-layer filter chips.
 *
 * Lets the user narrow the visible Danger Points to a single Riigihaldus
 * X-GIS sub-layer (Administratiivkeskus / Politseiasutus / Piirivalve /
 * Päästekomando / Riigiasutus / Välisesindus) or "All". Backed by
 * dangerLayerFilter in the store.
 */

import { Pressable, ScrollView, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import type { DangerLayerFilter } from '@/lib/saferouteStore';
import { dangerPointLayerIds, dangerPointLayerNames } from '@/src/data/dangerPoints';

type Props = {
  value: DangerLayerFilter;
  onChange: (v: DangerLayerFilter) => void;
};

export function DangerLayerFilterChips({ value, onChange }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 12, gap: 6 }}
    >
      <Chip
        active={value === 'all'}
        onPress={() => onChange('all')}
        label="All Riigihaldus"
      />
      {dangerPointLayerIds.map((id) => (
        <Chip
          key={id}
          active={value === id}
          onPress={() => onChange(id)}
          label={dangerPointLayerNames[id]}
        />
      ))}
    </ScrollView>
  );
}

function Chip({
  active,
  onPress,
  label,
}: {
  active: boolean;
  onPress: () => void;
  label: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Filter danger points: ${label}`}
      className={cn(
        'rounded-full border px-3 py-1 min-h-[28px] flex-row items-center',
        active
          ? 'bg-orange-500/20 border-orange-500/60'
          : 'bg-card/60 border-border/60',
      )}
    >
      <View className="h-1.5 w-1.5 rounded-full bg-orange-400 mr-1.5" />
      <Text
        className={cn(
          'text-[10.5px] font-semibold',
          active ? 'text-orange-300' : 'text-muted-foreground',
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}
