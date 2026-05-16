/*
 * SafeRoute Varjumine — Offline Plan modal.
 *
 * Lists the user's locally saved places (home / work / school / family / other)
 * with quick route actions, plus family meeting point and emergency notes.
 * All values persist to AsyncStorage via lib/saferouteStore.ts.
 *
 * Saved places are private user-created records (SAVED PLACES WORK OFFLINE
 * AFTER SAVING). The modal does NOT force the user to pre-pin shelters per
 * slot — not everyone has a school or a workplace.
 *
 * "Last downloaded map" is a HARDCODED demo timestamp — no real tiles are stored.
 */

import {
  Bookmark,
  MapPin,
  Navigation,
  Plus,
  Shield,
  Trash2,
  Users,
  X,
} from 'lucide-react-native';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { DEMO_LAST_MAP_DOWNLOAD } from '@/lib/shelters';
import { useSafeRouteStore } from '@/lib/saferouteStore';
import { USER_PLACE_TYPE_META, type UserPlace } from '@/src/types/userPlaces';

export function OfflinePlanModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const {
    familyMeetingPoint,
    emergencyNotes,
    userPlaces,
    setFamilyMeetingPoint,
    setEmergencyNotes,
    openAddPlace,
    removeUserPlace,
    routeFromSavedPlaceToNearestShelter,
    routeFromCurrentLocationToSavedPlace,
  } = useSafeRouteStore();

  const handleRouteToShelter = async (place: UserPlace) => {
    onClose();
    await routeFromSavedPlaceToNearestShelter(place);
  };

  const handleRouteFromHere = async (place: UserPlace) => {
    onClose();
    await routeFromCurrentLocationToSavedPlace(place);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
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
                  Offline plan
                </Text>
                <Text className="text-muted-foreground text-[12px] mt-0.5">
                  Offline demo data stored locally
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close offline plan"
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
              <View className="rounded-xl bg-emerald-500/15 border border-emerald-500/40 px-3 py-2.5 mb-3">
                <Text className="text-emerald-300 text-[12px] font-semibold">
                  Offline plan saved
                </Text>
                <Text className="text-emerald-200/80 text-[11px] mt-0.5">
                  Last map snapshot · {DEMO_LAST_MAP_DOWNLOAD} (demo timestamp)
                </Text>
                <Text className="text-emerald-200/80 text-[11px] mt-1">
                  Live routing requires internet. Offline fallback uses haversine
                  distance estimates.
                </Text>
              </View>

              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-muted-foreground text-[11px] uppercase tracking-wider">
                  Saved places (private)
                </Text>
                <Pressable
                  onPress={() => {
                    onClose();
                    openAddPlace();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Add a saved place"
                  className="flex-row items-center gap-1 rounded-full bg-primary px-2.5 py-1 min-h-[28px]"
                >
                  <Plus color="#ffffff" size={12} />
                  <Text className="text-primary-foreground text-[10.5px] font-semibold">
                    Add place
                  </Text>
                </Pressable>
              </View>

              {userPlaces.length === 0 ? (
                <View className="rounded-xl bg-secondary/40 border border-border px-3 py-3 mb-2">
                  <Text className="text-foreground text-[12.5px] font-semibold mb-1">
                    No saved places yet
                  </Text>
                  <Text className="text-muted-foreground text-[11.5px]">
                    Add the places that matter to you — home, a relative, a workplace,
                    or anywhere else. Saved while online, they stay available offline.
                  </Text>
                </View>
              ) : (
                userPlaces.map((p) => {
                  const meta = USER_PLACE_TYPE_META[p.type];
                  return (
                    <View
                      key={p.id}
                      className="rounded-xl border border-border bg-secondary/40 px-3 py-3 mb-2"
                    >
                      <View className="flex-row items-center gap-2 mb-2">
                        <View
                          className="h-8 w-8 items-center justify-center rounded-full"
                          style={{
                            backgroundColor: meta.color + '33',
                            borderWidth: 1,
                            borderColor: meta.color,
                          }}
                        >
                          <Bookmark color={meta.color} size={15} />
                        </View>
                        <View className="flex-1">
                          <Text
                            className="text-foreground text-[13px] font-semibold"
                            numberOfLines={1}
                          >
                            {p.label}
                          </Text>
                          <Text
                            className="text-muted-foreground text-[11px]"
                            numberOfLines={1}
                          >
                            {p.address}
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => removeUserPlace(p.id)}
                          accessibilityRole="button"
                          accessibilityLabel={`Delete ${p.label}`}
                          hitSlop={8}
                          className="h-8 w-8 items-center justify-center rounded-full bg-card border border-border"
                        >
                          <Trash2 color="#ef4444" size={14} />
                        </Pressable>
                      </View>
                      <View className="flex-row gap-2">
                        <Pressable
                          onPress={() => handleRouteToShelter(p)}
                          accessibilityRole="button"
                          accessibilityLabel={`Route from ${p.label} to nearest shelter`}
                          className="flex-1 flex-row items-center justify-center gap-1.5 rounded-full bg-primary px-3 min-h-[36px]"
                        >
                          <Shield color="#ffffff" size={13} />
                          <Text className="text-primary-foreground text-[11.5px] font-semibold">
                            Nearest shelter
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => handleRouteFromHere(p)}
                          accessibilityRole="button"
                          accessibilityLabel={`Route from current location to ${p.label}`}
                          className="flex-1 flex-row items-center justify-center gap-1.5 rounded-full bg-card border border-border px-3 min-h-[36px]"
                        >
                          <Navigation className="text-foreground" size={13} />
                          <Text className="text-foreground text-[11.5px] font-semibold">
                            Route here
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })
              )}

              <Text className="text-muted-foreground text-[11px] uppercase tracking-wider mt-3 mb-2">
                Family meeting point
              </Text>
              <View className="flex-row items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-2">
                <Users color="#a78bfa" size={18} />
                <TextInput
                  value={familyMeetingPoint}
                  onChangeText={setFamilyMeetingPoint}
                  placeholder="e.g. Town Hall Square, west corner"
                  placeholderTextColor="hsl(215 15% 55%)"
                  className="flex-1 text-foreground text-[14px] min-h-[40px]"
                />
              </View>

              <Text className="text-muted-foreground text-[11px] uppercase tracking-wider mt-3 mb-2">
                Emergency notes
              </Text>
              <TextInput
                value={emergencyNotes}
                onChangeText={setEmergencyNotes}
                placeholder="Medications, allergies, contacts for trusted neighbours…"
                placeholderTextColor="hsl(215 15% 55%)"
                multiline
                className="rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-foreground text-[13px] min-h-[110px]"
                textAlignVertical="top"
              />

              <View className="flex-row items-center gap-1.5 mt-3">
                <MapPin color="hsl(215 15% 55%)" size={11} />
                <Text className="text-[10.5px] text-muted-foreground italic flex-1">
                  Shelter records are a hardcoded Päästeamet open-data snapshot.
                  Everything in this panel is stored on this device only. No backend.
                </Text>
              </View>
            </ScrollView>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
