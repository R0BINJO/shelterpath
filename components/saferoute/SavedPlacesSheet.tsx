/*
 * SafeRoute Varjumine — Saved Places panel + selected saved-place bottom sheet.
 *
 * USER SAVED PLACES - stored locally in browser localStorage / AsyncStorage.
 * SAVED PLACES WORK OFFLINE AFTER SAVING.
 * DO NOT SEND HOME/WORK/SCHOOL ADDRESSES TO BACKEND.
 */

import {
  Bookmark,
  Briefcase,
  GraduationCap,
  Home,
  MapPin,
  Pencil,
  Plus,
  Route as RouteIcon,
  Trash2,
  Users,
  X,
} from 'lucide-react-native';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { useSafeRouteStore } from '@/lib/saferouteStore';
import {
  USER_PLACE_TYPE_META,
  getUserPlaceMeta,
  type UserPlace,
  type UserPlaceType,
} from '@/src/types/userPlaces';

const TYPE_ICON: Record<UserPlaceType, React.ReactNode> = {
  home: <Home color={USER_PLACE_TYPE_META.home.color} size={18} />,
  work: <Briefcase color={USER_PLACE_TYPE_META.work.color} size={18} />,
  school: <GraduationCap color={USER_PLACE_TYPE_META.school.color} size={18} />,
  family: <Users color={USER_PLACE_TYPE_META.family.color} size={18} />,
  other: <Bookmark color={USER_PLACE_TYPE_META.other.color} size={18} />,
};

/** Bottom-sheet style modal listing all saved places. */
export function SavedPlacesPanel({
  visible,
  onClose,
  onFlyTo,
}: {
  visible: boolean;
  onClose: () => void;
  onFlyTo: (target: { lat: number; lng: number }) => void;
}) {
  const {
    userPlaces,
    openAddPlace,
    selectUserPlace,
    removeUserPlace,
    routeFromSavedPlaceToNearestShelter,
    routeFromCurrentLocationToSavedPlace,
  } = useSafeRouteStore();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Dismiss" />
        <SafeAreaView edges={['bottom']} style={{ backgroundColor: 'transparent' }}>
          <View className="rounded-t-3xl bg-card border-t border-border max-h-[88vh]">
            <View className="items-center pt-2.5 pb-1">
              <View className="h-1.5 w-12 rounded-full bg-muted-foreground/40" />
            </View>

            <View className="flex-row items-center justify-between px-5 pb-2">
              <View>
                <Text className="text-foreground text-[18px] font-semibold">
                  Saved places
                </Text>
                <Text className="text-muted-foreground text-[11.5px] mt-0.5">
                  Private user-created locations · saved only on this device
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close saved places"
                className="h-9 w-9 items-center justify-center rounded-full bg-secondary"
              >
                <X className="text-foreground" size={18} />
              </Pressable>
            </View>

            <ScrollView
              className="px-5"
              contentContainerStyle={{ paddingBottom: 24 }}
              showsVerticalScrollIndicator={false}
            >
              <Pressable
                onPress={() => openAddPlace()}
                accessibilityRole="button"
                accessibilityLabel="Add a new place"
                className="flex-row items-center gap-2 rounded-2xl border border-dashed border-primary/50 bg-primary/10 px-3 py-3 mb-3 min-h-[52px]"
              >
                <Plus className="text-primary" size={18} />
                <Text className="text-primary text-[13px] font-semibold">
                  Add a new place
                </Text>
              </Pressable>

              {userPlaces.length === 0 ? (
                <View className="rounded-xl bg-secondary/40 border border-border px-3 py-4">
                  <Text className="text-muted-foreground text-[12.5px]">
                    No saved places yet. Add home, work, or school while online to
                    make offline planning easier.
                  </Text>
                </View>
              ) : (
                userPlaces.map((p) => (
                  <SavedPlaceCard
                    key={p.id}
                    place={p}
                    onShowOnMap={() => {
                      selectUserPlace(p.id);
                      onFlyTo({ lat: p.lat, lng: p.lng });
                      onClose();
                    }}
                    onRouteToShelter={() => {
                      void routeFromSavedPlaceToNearestShelter(p);
                      onClose();
                    }}
                    onRouteFromHere={() => {
                      void routeFromCurrentLocationToSavedPlace(p);
                      onClose();
                    }}
                    onEdit={() => openAddPlace({ editingId: p.id })}
                    onDelete={() => void removeUserPlace(p.id)}
                  />
                ))
              )}

              <Text className="text-[10.5px] text-muted-foreground mt-3 italic">
                Official shelters come from a hardcoded Päästeamet data snapshot.
                Saved places are private user-created locations stored locally on
                this device.
              </Text>
            </ScrollView>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function SavedPlaceCard({
  place,
  onShowOnMap,
  onRouteToShelter,
  onRouteFromHere,
  onEdit,
  onDelete,
}: {
  place: UserPlace;
  onShowOnMap: () => void;
  onRouteToShelter: () => void;
  onRouteFromHere: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const meta = getUserPlaceMeta(place.type);
  const icon = TYPE_ICON[place.type] ?? TYPE_ICON.other;
  return (
    <View className="rounded-2xl border border-border bg-secondary/40 px-3 py-3 mb-2">
      <View className="flex-row items-center gap-2 mb-2">
        <View
          className="h-8 w-8 items-center justify-center rounded-full"
          style={{ backgroundColor: meta.color + '33', borderWidth: 1, borderColor: meta.color }}
        >
          {icon}
        </View>
        <View className="flex-1">
          <Text className="text-foreground text-[13.5px] font-semibold" numberOfLines={1}>
            {place.label}
          </Text>
          <Text className="text-muted-foreground text-[11.5px] mt-0.5" numberOfLines={1}>
            {place.address}
          </Text>
        </View>
      </View>
      <Text className="text-muted-foreground/80 text-[10.5px] mb-2">
        {place.lat.toFixed(5)}, {place.lng.toFixed(5)} · {meta.label}
      </Text>

      <View className="flex-row flex-wrap gap-1.5">
        <ActionChip onPress={onShowOnMap} label="Show on map" icon={<MapPin size={12} color="#e5e7eb" />} />
        <ActionChip
          onPress={onRouteFromHere}
          label="Route to here"
          icon={<RouteIcon size={12} color="#e5e7eb" />}
        />
        <ActionChip
          onPress={onRouteToShelter}
          label="Nearest shelter"
          icon={<RouteIcon size={12} color="#34d399" />}
        />
        <ActionChip onPress={onEdit} label="Edit" icon={<Pencil size={12} color="#e5e7eb" />} />
        <ActionChip
          onPress={onDelete}
          label="Delete"
          icon={<Trash2 size={12} color="#ef4444" />}
          danger
        />
      </View>
    </View>
  );
}

function ActionChip({
  onPress,
  label,
  icon,
  danger,
}: {
  onPress: () => void;
  label: string;
  icon: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={
        'flex-row items-center gap-1.5 rounded-full px-2.5 py-1.5 min-h-[32px] border ' +
        (danger ? 'border-destructive/40 bg-destructive/10' : 'border-border bg-card')
      }
    >
      {icon}
      <Text
        className={
          'text-[11.5px] font-medium ' + (danger ? 'text-destructive' : 'text-foreground')
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Bottom sheet pinned to the bottom when a saved place is selected on the map. */
export function SavedPlaceBottomSheet({
  place,
  onClose,
}: {
  place: UserPlace | null;
  onClose: () => void;
}) {
  const {
    openAddPlace,
    removeUserPlace,
    routeFromSavedPlaceToNearestShelter,
    routeFromCurrentLocationToSavedPlace,
  } = useSafeRouteStore();
  if (!place) return null;
  const meta = getUserPlaceMeta(place.type);
  const icon = TYPE_ICON[place.type] ?? TYPE_ICON.other;

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 22 }}
    >
      <SafeAreaView edges={['bottom']} style={{ backgroundColor: 'transparent' }}>
        <View className="mx-2 mb-2 rounded-2xl bg-card border border-border px-3 py-3 shadow-xl">
          <View className="flex-row items-center gap-2 mb-2">
            <View
              className="h-9 w-9 items-center justify-center rounded-full"
              style={{
                backgroundColor: meta.color + '33',
                borderWidth: 1,
                borderColor: meta.color,
              }}
            >
              {icon}
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-1.5">
                <Text className="text-foreground text-[14px] font-semibold flex-1" numberOfLines={1}>
                  {place.label}
                </Text>
                <View className="rounded-full bg-secondary px-2 py-0.5">
                  <Text className="text-[10px] font-semibold text-muted-foreground">
                    {meta.label}
                  </Text>
                </View>
              </View>
              <Text className="text-muted-foreground text-[11.5px] mt-0.5" numberOfLines={1}>
                {place.address}
              </Text>
              <Text className="text-muted-foreground/80 text-[10px] mt-0.5">
                Saved {new Date(place.createdAt).toLocaleDateString()} · device-local
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              className="h-8 w-8 items-center justify-center rounded-full bg-secondary"
            >
              <X className="text-foreground" size={16} />
            </Pressable>
          </View>

          <View className="rounded-xl bg-secondary/40 border border-border px-2.5 py-1.5 mb-2">
            <Text className="text-[10.5px] text-muted-foreground">
              Saved only on this device.
            </Text>
          </View>

          <View className="flex-row flex-wrap gap-1.5">
            <Pressable
              onPress={() => void routeFromSavedPlaceToNearestShelter(place)}
              accessibilityRole="button"
              accessibilityLabel="Route to nearest shelter from here"
              className="flex-row items-center gap-1.5 rounded-full bg-primary px-3 py-2 min-h-[40px]"
            >
              <RouteIcon size={14} color="#ffffff" />
              <Text className="text-primary-foreground text-[12px] font-semibold">
                Route to nearest shelter
              </Text>
            </Pressable>
            <Pressable
              onPress={() => void routeFromCurrentLocationToSavedPlace(place)}
              accessibilityRole="button"
              accessibilityLabel="Route from current location"
              className="flex-row items-center gap-1.5 rounded-full bg-secondary px-3 py-2 min-h-[40px] border border-border"
            >
              <MapPin size={14} color="#e5e7eb" />
              <Text className="text-foreground text-[12px] font-semibold">
                Route from current location
              </Text>
            </Pressable>
            <Pressable
              onPress={() => openAddPlace({ editingId: place.id })}
              accessibilityRole="button"
              accessibilityLabel="Edit"
              className="flex-row items-center gap-1.5 rounded-full bg-card border border-border px-3 py-2 min-h-[40px]"
            >
              <Pencil size={14} color="#e5e7eb" />
              <Text className="text-foreground text-[12px] font-semibold">Edit</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                void removeUserPlace(place.id);
                onClose();
              }}
              accessibilityRole="button"
              accessibilityLabel="Delete"
              className="flex-row items-center gap-1.5 rounded-full bg-destructive/15 border border-destructive/40 px-3 py-2 min-h-[40px]"
            >
              <Trash2 size={14} color="#ef4444" />
              <Text className="text-destructive text-[12px] font-semibold">Delete</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
