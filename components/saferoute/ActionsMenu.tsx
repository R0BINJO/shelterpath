/*
 * SafeRoute Varjumine — Actions popup menu.
 *
 * Replaces the tall stack of FABs (Share / Add place / Saved / Plan / Style)
 * with a single floating "More" button that opens a compact popup menu.
 * Keeps the Locate button as a separate primary FAB so re-centring stays
 * one tap. Reduces the right-edge UI footprint substantially.
 */

import {
  Bookmark,
  Crosshair,
  Layers as LayersIcon,
  ListChecks,
  MoreHorizontal,
  Plus,
  Users,
  X,
} from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';

type Props = {
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

export function ActionsMenu({
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
}: Props) {
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);
  const run = (fn: () => void) => () => {
    close();
    fn();
  };

  return (
    <>
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
            onPress={() => setOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Open actions menu"
            className="h-12 w-12 items-center justify-center rounded-full bg-card border border-border shadow-md"
          >
            <MoreHorizontal className="text-foreground" size={22} />
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

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={close}
      >
        <Pressable
          onPress={close}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }}
        >
          <View
            pointerEvents="box-none"
            style={{
              position: 'absolute',
              right: 12,
              bottom: bottomInset + 56,
              width: 260,
            }}
          >
            <Pressable
              // Stop propagation so taps inside the menu don't close it via
              // the backdrop Pressable.
              onPress={(e) => e.stopPropagation()}
              className="rounded-2xl bg-card border border-border overflow-hidden"
            >
              <View className="flex-row items-center justify-between px-3 py-2.5 border-b border-border">
                <Text className="text-foreground text-[13px] font-semibold">
                  Actions
                </Text>
                <Pressable
                  onPress={close}
                  accessibilityRole="button"
                  accessibilityLabel="Close menu"
                  className="h-7 w-7 items-center justify-center rounded-full"
                >
                  <X className="text-muted-foreground" size={16} />
                </Pressable>
              </View>

              <MenuRow
                onPress={run(onShareShelter)}
                icon={<Users color="#f59e0b" size={18} />}
                label="Share shelter"
                trailing={
                  communityShelterCount > 0 ? `${communityShelterCount}` : null
                }
              />
              <MenuRow
                onPress={run(onAddPlace)}
                icon={<Plus className="text-primary" size={18} />}
                label="Add place"
              />
              <MenuRow
                onPress={run(onOpenSavedPlaces)}
                icon={<Bookmark className="text-foreground" size={18} />}
                label="Saved places"
                trailing={savedPlacesCount > 0 ? `${savedPlacesCount}` : null}
              />
              <MenuRow
                onPress={run(onOpenPlan)}
                icon={<ListChecks className="text-foreground" size={18} />}
                label="Offline plan"
              />
              <MenuRow
                onPress={run(onToggleStyle)}
                icon={<LayersIcon className="text-foreground" size={18} />}
                label="Map style"
                trailing={mapStyleLabel}
                last
              />
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

function MenuRow({
  onPress,
  icon,
  label,
  trailing,
  last,
}: {
  onPress: () => void;
  icon: React.ReactNode;
  label: string;
  trailing?: string | null;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={
        'flex-row items-center gap-3 px-3 py-3 active:bg-secondary' +
        (last ? '' : ' border-b border-border')
      }
    >
      <View className="h-8 w-8 items-center justify-center rounded-full bg-secondary">
        {icon}
      </View>
      <Text className="flex-1 text-foreground text-[13px] font-medium">
        {label}
      </Text>
      {trailing ? (
        <Text className="text-muted-foreground text-[11.5px] font-semibold">
          {trailing}
        </Text>
      ) : null}
    </Pressable>
  );
}
