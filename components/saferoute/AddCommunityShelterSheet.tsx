/*
 * SafeRoute Varjumine — Add Community Shelter sheet.
 *
 * Lets a signed-in user submit an unverified public shelter point.
 * Submission requires:
 *   - online connection (to reach Supabase)
 *   - a signed-in account
 *
 * Coordinates can come from the device location, or from a manual pin the
 * user drops by panning the map (re-using the same crosshair UX as Saved
 * Places).
 *
 * COMMUNITY SHELTERS ARE UNVERIFIED USER SUBMISSIONS. They are NEVER used as
 * routing candidates in "Find nearest shelter".
 */

import {
  AlertCircle,
  MapPin,
  Send,
  Target,
  Users,
  X,
} from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { useAuthStore } from '@/lib/authStore';
import {
  COMMUNITY_SHELTER_BUILD_ID,
  useCommunityShelterStore,
} from '@/lib/communityShelterStore';
import { useSafeRouteStore } from '@/lib/saferouteStore';
import { cn } from '@/lib/utils';
import {
  COMMUNITY_SHELTER_TYPES,
  COMMUNITY_SHELTER_TYPE_META,
  type CommunityShelterType,
} from '@/src/types/communityShelters';

type ManualPinHandle = {
  setManualPinMode: (on: boolean) => void;
  getMapCenter: () => { lat: number; lng: number } | null;
};

type Props = {
  manualPin: ManualPinHandle;
};

type Stage = 'form' | 'manual';

function isWithinEstonia(lat: number, lng: number): boolean {
  return lat >= 57 && lat <= 60 && lng >= 21 && lng <= 29;
}

export function AddCommunityShelterSheet({ manualPin }: Props) {
  const addSheetOpen = useCommunityShelterStore((s) => s.addSheetOpen);
  const setAddSheetOpen = useCommunityShelterStore((s) => s.setAddSheetOpen);
  const submit = useCommunityShelterStore((s) => s.submit);

  const offlineMode = useSafeRouteStore((s) => s.offlineMode);
  const userLocation = useSafeRouteStore((s) => s.userLocation);
  const isLiveUserLocation = useSafeRouteStore((s) => s.isLiveUserLocation);

  const authStatus = useAuthStore((s) => s.status);
  const authUserId = useAuthStore((s) => s.userId);

  // Project ref (NOT the key) for the dev diagnostics line. Showing it on the
  // sheet makes it obvious if the running bundle is talking to the wrong
  // Supabase project.
  const projectRef = useMemo(() => {
    const raw = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
    return raw.replace(/^https?:\/\//, '').split('.')[0] || 'unknown';
  }, []);

  const [stage, setStage] = useState<Stage>('form');
  const [name, setName] = useState('');
  const [type, setType] = useState<CommunityShelterType>('basement');
  const [notes, setNotes] = useState('');
  const [address, setAddress] = useState('');
  const [capacity, setCapacity] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form state only when the sheet is fully closed AND we're not in the
  // middle of letting the user drop a pin on the map (we temporarily close
  // the modal during the 'manual' stage so the map is visible underneath).
  useEffect(() => {
    if (!addSheetOpen && stage !== 'manual') {
      setStage('form');
      setName('');
      setType('basement');
      setNotes('');
      setAddress('');
      setCapacity('');
      setCoords(null);
      setBusy(false);
      setError(null);
      manualPin.setManualPinMode(false);
    }
  }, [addSheetOpen, stage, manualPin]);

  const useCurrentLocation = () => {
    if (!isLiveUserLocation) {
      setError(
        'Device location unavailable — drop a pin on the map instead.',
      );
      return;
    }
    if (!isWithinEstonia(userLocation.lat, userLocation.lng)) {
      setError('Current location is outside Estonia.');
      return;
    }
    setError(null);
    setCoords({ lat: userLocation.lat, lng: userLocation.lng });
  };

  const startManualPin = () => {
    setError(null);
    setStage('manual');
    setAddSheetOpen(false);
    manualPin.setManualPinMode(true);
  };

  const confirmManualPin = () => {
    const center = manualPin.getMapCenter();
    if (!center) {
      setError('Could not read map position.');
      return;
    }
    if (!isWithinEstonia(center.lat, center.lng)) {
      setError('Pin is outside Estonia.');
      return;
    }
    setCoords(center);
    manualPin.setManualPinMode(false);
    setStage('form');
    setAddSheetOpen(true);
  };

  const cancelManualPin = () => {
    manualPin.setManualPinMode(false);
    setStage('form');
    setAddSheetOpen(true);
  };

  const canSubmit = useMemo(() => {
    if (!coords) return false;
    if (name.trim().length < 2) return false;
    if (offlineMode) return false;
    if (authStatus !== 'signed-in') return false;
    return true;
  }, [coords, name, offlineMode, authStatus]);

  const handleSubmit = async () => {
    if (!coords) return;
    setBusy(true);
    setError(null);
    try {
      const cap = capacity.trim() ? Number.parseInt(capacity.trim(), 10) : null;
      await submit({
        name: name.trim(),
        shelterType: type,
        notes: notes.trim() ? notes.trim() : null,
        address: address.trim() ? address.trim() : null,
        capacityEstimate: Number.isFinite(cap) && cap !== null && cap >= 0 ? cap : null,
        lat: coords.lat,
        lng: coords.lng,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit shelter.');
    } finally {
      setBusy(false);
    }
  };

  // Floating "Use this location" bar shown while picking pin on the map.
  if (stage === 'manual') {
    return (
      <View
        pointerEvents="box-none"
        style={{ position: 'absolute', left: 0, right: 0, bottom: 24, zIndex: 30, alignItems: 'center' }}
      >
        <View className="flex-row gap-2 bg-card border border-border rounded-full px-2 py-2 shadow-xl">
          <Pressable
            onPress={cancelManualPin}
            accessibilityRole="button"
            accessibilityLabel="Cancel pin placement"
            className="h-10 px-3 rounded-full bg-secondary items-center justify-center flex-row gap-1.5"
          >
            <X className="text-foreground" size={16} />
            <Text className="text-foreground text-[12px] font-semibold">Cancel</Text>
          </Pressable>
          <Pressable
            onPress={confirmManualPin}
            accessibilityRole="button"
            accessibilityLabel="Use this location"
            className="h-10 px-4 rounded-full bg-primary items-center justify-center flex-row gap-1.5"
          >
            <Target color="#ffffff" size={16} />
            <Text className="text-primary-foreground text-[12px] font-semibold">
              Use this location
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <Modal
      visible={addSheetOpen}
      transparent
      animationType="slide"
      onRequestClose={() => setAddSheetOpen(false)}
    >
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }}>
        <Pressable
          onPress={() => setAddSheetOpen(false)}
          accessibilityLabel="Dismiss"
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
        />
        <SafeAreaView edges={['bottom']} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View
              className="bg-card border-t border-x border-border rounded-t-3xl overflow-hidden"
              style={{ maxHeight: '92%' }}
            >
              <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
                <View className="flex-row items-center gap-2">
                  <View className="h-9 w-9 rounded-full bg-amber-500/20 items-center justify-center">
                    <Users color="#f59e0b" size={20} />
                  </View>
                  <View>
                    <Text className="text-foreground text-[16px] font-semibold">
                      Share a public shelter
                    </Text>
                    <Text className="text-muted-foreground text-[11px]">
                      Unverified community submission
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => setAddSheetOpen(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  className="h-9 w-9 items-center justify-center rounded-full bg-secondary"
                >
                  <X className="text-foreground" size={18} />
                </Pressable>
              </View>

              <ScrollView
                className="px-5 pb-5"
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <View className="rounded-xl bg-amber-500/15 border border-amber-500/40 px-3 py-2.5">
                  <Text className="text-amber-300 text-[12px] font-semibold">
                    Visible to everyone, clearly unverified
                  </Text>
                  <Text className="text-amber-200/90 text-[11.5px] mt-1 leading-[16px]">
                    What you share here is public and stored online. It is shown
                    on the map as a community submission and is never treated as
                    an official Päästeamet shelter. Do not include private
                    address details. Always check the location yourself before
                    relying on it.
                  </Text>
                </View>

                {offlineMode ? (
                  <View className="mt-3 rounded-xl bg-secondary px-3 py-2.5">
                    <Text className="text-muted-foreground text-[12px]">
                      Offline mode is on. Posting a community shelter needs
                      internet. Saved community shelters remain visible on the map.
                    </Text>
                  </View>
                ) : null}

                {authStatus !== 'signed-in' ? (
                  <View className="mt-3 rounded-xl bg-destructive/15 border border-destructive/40 px-3 py-2.5">
                    <Text className="text-destructive text-[12px] font-semibold">
                      Sign in required
                    </Text>
                    <Text className="text-destructive/90 text-[11.5px] mt-1">
                      You need an account to share shelter points so we can show
                      who submitted them and let you delete your own.
                    </Text>
                  </View>
                ) : null}

                <Field label="Shelter name">
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="e.g. Kalamaja apartment block basement"
                    placeholderTextColor="#6b7280"
                    maxLength={120}
                    className="bg-secondary rounded-xl px-3 py-3 text-foreground text-[14px]"
                  />
                </Field>

                <View className="mt-3">
                  <Text className="text-muted-foreground text-[11px] mb-1.5 uppercase tracking-wider">
                    Type
                  </Text>
                  <View className="flex-row flex-wrap gap-1.5">
                    {COMMUNITY_SHELTER_TYPES.map((t) => {
                      const active = t === type;
                      return (
                        <Pressable
                          key={t}
                          onPress={() => setType(t)}
                          accessibilityRole="button"
                          accessibilityLabel={`Type: ${COMMUNITY_SHELTER_TYPE_META[t].label}`}
                          className={cn(
                            'rounded-full px-3 py-1.5 border min-h-[34px] items-center justify-center',
                            active
                              ? 'bg-primary border-primary'
                              : 'bg-secondary border-border',
                          )}
                        >
                          <Text
                            className={cn(
                              'text-[12px] font-semibold',
                              active ? 'text-primary-foreground' : 'text-foreground',
                            )}
                          >
                            {COMMUNITY_SHELTER_TYPE_META[t].label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <Field label="Address (optional)">
                  <TextInput
                    value={address}
                    onChangeText={setAddress}
                    placeholder="e.g. Kopli 25, Tallinn"
                    placeholderTextColor="#6b7280"
                    maxLength={240}
                    className="bg-secondary rounded-xl px-3 py-3 text-foreground text-[14px]"
                  />
                </Field>

                <Field label="Capacity estimate (optional)">
                  <TextInput
                    value={capacity}
                    onChangeText={(v) => setCapacity(v.replace(/\D/g, '').slice(0, 6))}
                    placeholder="e.g. 30"
                    placeholderTextColor="#6b7280"
                    keyboardType="number-pad"
                    className="bg-secondary rounded-xl px-3 py-3 text-foreground text-[14px]"
                  />
                </Field>

                <Field label="Notes (optional)">
                  <TextInput
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Access, condition, hours, contact info…"
                    placeholderTextColor="#6b7280"
                    multiline
                    numberOfLines={3}
                    maxLength={1000}
                    className="bg-secondary rounded-xl px-3 py-3 text-foreground text-[14px] min-h-[80px]"
                    style={{ textAlignVertical: 'top' }}
                  />
                </Field>

                <Text className="text-muted-foreground text-[11px] mt-3 uppercase tracking-wider">
                  Location
                </Text>
                <View className="mt-1.5 gap-1.5">
                  <Pressable
                    onPress={useCurrentLocation}
                    accessibilityRole="button"
                    accessibilityLabel="Use my current location"
                    className="rounded-xl bg-secondary px-3 py-3 flex-row items-center gap-2.5"
                  >
                    <MapPin className="text-foreground" size={18} />
                    <View className="flex-1">
                      <Text className="text-foreground text-[13px] font-semibold">
                        Use my current location
                      </Text>
                      <Text className="text-muted-foreground text-[11.5px]">
                        {isLiveUserLocation
                          ? `Live: ${userLocation.lat.toFixed(5)}, ${userLocation.lng.toFixed(5)}`
                          : 'Device location not available'}
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable
                    onPress={startManualPin}
                    accessibilityRole="button"
                    accessibilityLabel="Drop a pin on the map"
                    className="rounded-xl bg-secondary px-3 py-3 flex-row items-center gap-2.5"
                  >
                    <Target className="text-foreground" size={18} />
                    <View className="flex-1">
                      <Text className="text-foreground text-[13px] font-semibold">
                        Drop a pin on the map
                      </Text>
                      <Text className="text-muted-foreground text-[11.5px]">
                        Pan the map; the crosshair marks the spot.
                      </Text>
                    </View>
                  </Pressable>

                  {coords ? (
                    <View className="rounded-xl bg-amber-500/15 border border-amber-500/40 px-3 py-2 flex-row items-center gap-2">
                      <Target color="#f59e0b" size={14} />
                      <Text className="text-amber-300 text-[12px] font-semibold">
                        Pin set · {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {error ? (
                  <View className="mt-3 rounded-xl bg-destructive/15 border border-destructive/40 px-3 py-2 flex-row items-center gap-2">
                    <AlertCircle color="#ef4444" size={14} />
                    <Text className="text-destructive text-[12px] font-semibold flex-1">
                      {error}
                    </Text>
                  </View>
                ) : null}

                {__DEV__ ? (
                  <View className="mt-3 rounded-xl bg-secondary border border-border px-3 py-2">
                    <Text className="text-muted-foreground text-[10.5px] font-semibold uppercase tracking-wider">
                      Dev diagnostics
                    </Text>
                    <Text className="text-muted-foreground text-[10.5px] mt-1 leading-[14px]">
                      Build: {COMMUNITY_SHELTER_BUILD_ID}
                      {'\n'}Project: {projectRef}
                      {'\n'}Session: {authStatus === 'signed-in' ? 'yes' : 'no'}
                      {'\n'}User id: {authUserId ?? '—'}
                      {'\n'}Table: community_shelters
                    </Text>
                  </View>
                ) : null}

                <Pressable
                  onPress={handleSubmit}
                  disabled={!canSubmit || busy}
                  accessibilityRole="button"
                  accessibilityLabel="Share shelter publicly"
                  className={cn(
                    'mt-4 h-12 rounded-full flex-row items-center justify-center gap-2',
                    canSubmit && !busy ? 'bg-primary' : 'bg-primary/40',
                  )}
                >
                  {busy ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Send color="#ffffff" size={16} />
                  )}
                  <Text className="text-primary-foreground text-[14px] font-semibold">
                    {busy ? 'Sharing…' : 'Share with everyone'}
                  </Text>
                </Pressable>

                <Text className="text-[10.5px] text-muted-foreground mt-3 italic leading-[14px]">
                  Submissions are public. They appear with your display name and
                  can be deleted by you at any time. Your saved places (home,
                  work, school, family) remain private and are never uploaded.
                </Text>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="mt-3">
      <Text className="text-muted-foreground text-[11px] mb-1 uppercase tracking-wider">
        {label}
      </Text>
      {children}
    </View>
  );
}
