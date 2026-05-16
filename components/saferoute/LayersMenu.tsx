/*
 * SafeRoute Varjumine — Layers popup menu.
 *
 * Replaces the always-visible LayerToggleChips + DangerLayerFilterChips rows
 * with a single compact pill that opens a popup containing:
 *   - all layer visibility toggles
 *   - the Riigihaldus danger sub-layer filter (when danger layers are on)
 *
 * Drastically reduces top-edge UI footprint.
 */

import {
  Bookmark,
  CircleAlert,
  Eye,
  EyeOff,
  Landmark,
  Layers as LayersIcon,
  ShieldAlert,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import type {
  DangerLayerFilter,
  LayerVisibility,
} from '@/lib/saferouteStore';
import {
  dangerPointLayerIds,
  dangerPointLayerNames,
} from '@/src/data/dangerPoints';

type Props = {
  layers: LayerVisibility;
  onToggle: (key: keyof LayerVisibility) => void;
  dangerFilter: DangerLayerFilter;
  onDangerFilterChange: (v: DangerLayerFilter) => void;
};

type LayerRow = {
  key: keyof LayerVisibility;
  label: string;
  icon: (active: boolean) => React.ReactNode;
};

const LAYER_ROWS: LayerRow[] = [
  {
    key: 'shelters',
    label: 'Official shelters',
    icon: (a) => <ShieldCheck color={a ? '#34d399' : '#9ca3af'} size={16} />,
  },
  {
    key: 'savedPlaces',
    label: 'Saved places',
    icon: (a) => <Bookmark color={a ? '#a855f7' : '#9ca3af'} size={16} />,
  },
  {
    key: 'communityShelters',
    label: 'Community shelters',
    icon: (a) => <Users color={a ? '#f59e0b' : '#9ca3af'} size={16} />,
  },
  {
    key: 'dangerPoints',
    label: 'Danger Points',
    icon: (a) => <Landmark color={a ? '#f97316' : '#9ca3af'} size={16} />,
  },
  {
    key: 'dangerZones',
    label: 'Danger Zones',
    icon: (a) => <ShieldAlert color={a ? '#ef4444' : '#9ca3af'} size={16} />,
  },
  {
    key: 'danger',
    label: 'Demo danger area',
    icon: (a) => <CircleAlert color={a ? '#ef4444' : '#9ca3af'} size={16} />,
  },
];

export function LayersMenu({
  layers,
  onToggle,
  dangerFilter,
  onDangerFilterChange,
}: Props) {
  const [open, setOpen] = useState(false);

  const activeCount = LAYER_ROWS.reduce(
    (n, r) => n + (layers[r.key] ? 1 : 0),
    0,
  );

  const showDangerSubFilter = layers.dangerPoints || layers.dangerZones;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Open layers menu"
        className="flex-row items-center gap-1.5 rounded-full bg-card/90 border border-border px-3 py-1.5 min-h-[34px]"
      >
        <LayersIcon className="text-foreground" size={14} />
        <Text className="text-foreground text-[12px] font-semibold">
          Layers
        </Text>
        <View className="rounded-full bg-secondary px-1.5 py-0.5">
          <Text className="text-muted-foreground text-[10.5px] font-semibold">
            {activeCount}
          </Text>
        </View>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          onPress={() => setOpen(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }}
        >
          <View
            pointerEvents="box-none"
            style={{
              position: 'absolute',
              top: 130,
              left: 12,
              width: 280,
            }}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              className="rounded-2xl bg-card border border-border overflow-hidden"
            >
              <View className="flex-row items-center justify-between px-3 py-2.5 border-b border-border">
                <Text className="text-foreground text-[13px] font-semibold">
                  Map layers
                </Text>
                <Pressable
                  onPress={() => setOpen(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Close layers menu"
                  className="h-7 w-7 items-center justify-center rounded-full"
                >
                  <X className="text-muted-foreground" size={16} />
                </Pressable>
              </View>

              <View>
                {LAYER_ROWS.map((row, idx) => {
                  const active = layers[row.key];
                  return (
                    <Pressable
                      key={row.key}
                      onPress={() => onToggle(row.key)}
                      accessibilityRole="button"
                      accessibilityLabel={`Toggle ${row.label}`}
                      className={cn(
                        'flex-row items-center gap-3 px-3 py-2.5 active:bg-secondary',
                        idx === LAYER_ROWS.length - 1 ? '' : 'border-b border-border',
                      )}
                    >
                      <View className="h-7 w-7 items-center justify-center rounded-full bg-secondary">
                        {row.icon(active)}
                      </View>
                      <Text
                        className={cn(
                          'flex-1 text-[12.5px] font-semibold',
                          active ? 'text-foreground' : 'text-muted-foreground',
                        )}
                      >
                        {row.label}
                      </Text>
                      {active ? (
                        <Eye color="#9ca3af" size={14} />
                      ) : (
                        <EyeOff color="#9ca3af" size={14} />
                      )}
                    </Pressable>
                  );
                })}
              </View>

              {showDangerSubFilter ? (
                <View className="border-t border-border px-3 py-2.5">
                  <Text className="text-muted-foreground text-[10.5px] font-semibold uppercase tracking-wide mb-1.5">
                    Riigihaldus filter
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 6 }}
                  >
                    <FilterChip
                      active={dangerFilter === 'all'}
                      onPress={() => onDangerFilterChange('all')}
                      label="All"
                    />
                    {dangerPointLayerIds.map((id) => (
                      <FilterChip
                        key={id}
                        active={dangerFilter === id}
                        onPress={() => onDangerFilterChange(id)}
                        label={dangerPointLayerNames[id]}
                      />
                    ))}
                  </ScrollView>
                </View>
              ) : null}
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

function FilterChip({
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
        'rounded-full border px-3 py-1 min-h-[26px] flex-row items-center',
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
