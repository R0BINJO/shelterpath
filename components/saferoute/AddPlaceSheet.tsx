/*
 * SafeRoute Varjumine — Add Place bottom sheet.
 *
 * Lets the user save a private, device-local location (Home / Work / School /
 * Family meeting point / Other).
 *
 * USER SAVED PLACES - stored locally in browser localStorage / AsyncStorage.
 * PROTOTYPE GEOCODING ENDPOINT - Photon public API.
 * ADDRESS SEARCH REQUIRES INTERNET.
 * SAVED PLACES WORK OFFLINE AFTER SAVING.
 * DO NOT SEND HOME/WORK/SCHOOL ADDRESSES TO BACKEND.
 */

import {
  AlertCircle,
  Bookmark,
  Briefcase,
  Check,
  GraduationCap,
  Home,
  Loader2,
  MapPin,
  Search,
  Users,
  X,
} from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import {
  describeGeocodingError,
  searchAddress,
  searchAddressNominatimOnce,
  validateEstoniaCoordinates,
  type GeocodeResult,
  type GeocodingError,
} from '@/lib/geocoding';
import { useSafeRouteStore } from '@/lib/saferouteStore';
import { cn } from '@/lib/utils';
import {
  USER_PLACE_TYPE_META,
  type UserPlace,
  type UserPlaceType,
} from '@/src/types/userPlaces';

const TYPE_OPTIONS: { value: UserPlaceType; icon: React.ReactNode }[] = [
  { value: 'home', icon: <Home color={USER_PLACE_TYPE_META.home.color} size={18} /> },
  { value: 'work', icon: <Briefcase color={USER_PLACE_TYPE_META.work.color} size={18} /> },
  {
    value: 'school',
    icon: <GraduationCap color={USER_PLACE_TYPE_META.school.color} size={18} />,
  },
  { value: 'family', icon: <Users color={USER_PLACE_TYPE_META.family.color} size={18} /> },
  { value: 'other', icon: <Bookmark color={USER_PLACE_TYPE_META.other.color} size={18} /> },
];

type ManualPinHandle = {
  setManualPinMode: (on: boolean) => void;
  getMapCenter: () => { lat: number; lng: number } | null;
  flyTo: (target: { lat: number; lng: number }) => void;
};

type Props = {
  manualPin: ManualPinHandle;
};

type Stage = 'pick-type' | 'search' | 'manual' | 'confirm';

export function AddPlaceSheet({ manualPin }: Props) {
  const {
    addPlaceSheet,
    closeAddPlace,
    userPlaces,
    addUserPlace,
    replaceUserPlace,
    removeUserPlace,
    userLocation,
    offlineMode,
  } = useSafeRouteStore();
  const editing = addPlaceSheet.open
    ? userPlaces.find((p) => p.id === addPlaceSheet.editingId) ?? null
    : null;

  const [stage, setStage] = useState<Stage>('pick-type');
  const [type, setType] = useState<UserPlaceType>('home');
  const [label, setLabel] = useState('Home');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<GeocodeResult | null>(null);
  const [manualCoords, setManualCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [searchState, setSearchState] = useState<
    'idle' | 'loading' | 'error' | 'done'
  >('idle');
  const [searchError, setSearchError] = useState<GeocodingError | null>(null);
  const [duplicate, setDuplicate] = useState<UserPlace | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Reset on open
  useEffect(() => {
    if (!addPlaceSheet.open) return;
    const editingId = addPlaceSheet.open ? addPlaceSheet.editingId : undefined;
    const sheetPresetType = addPlaceSheet.open ? addPlaceSheet.presetType : undefined;
    const presetType: UserPlaceType =
      sheetPresetType ?? editing?.type ?? 'home';
    setType(presetType);
    setLabel(editing?.label ?? USER_PLACE_TYPE_META[presetType].defaultLabel);
    setQuery(editing?.address ?? '');
    setResults([]);
    setSelectedResult(null);
    setManualCoords(editing ? { lat: editing.lat, lng: editing.lng } : null);
    setStage(editing ? 'confirm' : 'pick-type');
    setSearchState('idle');
    setSearchError(null);
    setDuplicate(null);
    setSaveError(null);
    manualPin.setManualPinMode(false);
    void editingId;
  }, [addPlaceSheet, editing, manualPin]);

  // Debounced Photon search
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (stage !== 'search') return undefined;
    if (offlineMode) return undefined;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      setSearchState('idle');
      setSearchError(null);
      return undefined;
    }
    setSearchState('loading');
    debounceRef.current = setTimeout(async () => {
      const res = await searchAddress(q, userLocation);
      if (res.ok) {
        setResults(res.results);
        setSearchState('done');
        setSearchError(null);
      } else {
        setResults([]);
        setSearchState('error');
        setSearchError(res.error);
      }
    }, 700);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, stage, userLocation, offlineMode]);

  const onPickType = (t: UserPlaceType) => {
    setType(t);
    setLabel(USER_PLACE_TYPE_META[t].defaultLabel);
    setStage('search');
  };

  const onSelectResult = (r: GeocodeResult) => {
    setSelectedResult(r);
    manualPin.flyTo({ lat: r.lat, lng: r.lng });
    setStage('confirm');
  };

  const enterManualPin = () => {
    setStage('manual');
    manualPin.setManualPinMode(true);
  };

  const confirmManualPin = () => {
    const c = manualPin.getMapCenter();
    if (!c) return;
    if (!validateEstoniaCoordinates(c.lat, c.lng)) {
      setSaveError('Selected pin is outside Estonia.');
      return;
    }
    setManualCoords(c);
    setSelectedResult(null);
    setSaveError(null);
    manualPin.setManualPinMode(false);
    setStage('confirm');
  };

  const cancelManualPin = () => {
    manualPin.setManualPinMode(false);
    setStage('search');
  };

  const onNominatimRetry = async () => {
    setSearchState('loading');
    const res = await searchAddressNominatimOnce(query);
    if (res.ok) {
      setResults(res.results);
      setSearchState('done');
      setSearchError(null);
    } else {
      setSearchError(res.error);
      setSearchState('error');
    }
  };

  const buildPlaceDraft = (): Omit<
    UserPlace,
    'id' | 'createdAt' | 'updatedAt' | 'isUserSaved'
  > | null => {
    if (selectedResult) {
      return {
        type,
        label: label.trim() || USER_PLACE_TYPE_META[type].defaultLabel,
        address: selectedResult.address,
        displayName: selectedResult.displayName,
        lat: selectedResult.lat,
        lng: selectedResult.lng,
        source: selectedResult.source,
        originalGeocoderResult: selectedResult.raw,
      };
    }
    if (manualCoords) {
      return {
        type,
        label: label.trim() || USER_PLACE_TYPE_META[type].defaultLabel,
        address: 'Manual map location',
        displayName: `Manual map location (${manualCoords.lat.toFixed(5)}, ${manualCoords.lng.toFixed(5)})`,
        lat: manualCoords.lat,
        lng: manualCoords.lng,
        source: 'manual-pin',
      };
    }
    return null;
  };

  const checkDuplicate = (): UserPlace | null => {
    if (editing) return null;
    if (type === 'other') return null;
    return userPlaces.find((p) => p.type === type) ?? null;
  };

  const onAttemptSave = () => {
    const draft = buildPlaceDraft();
    if (!draft) return;
    const dup = checkDuplicate();
    if (dup) {
      setDuplicate(dup);
      return;
    }
    void doSave(draft);
  };

  const doSave = async (
    draft: Omit<UserPlace, 'id' | 'createdAt' | 'updatedAt' | 'isUserSaved'>,
    replaceTargetId?: string,
  ) => {
    try {
      setSaving(true);
      setSaveError(null);
      if (editing) {
        await replaceUserPlace({
          ...editing,
          ...draft,
          updatedAt: new Date().toISOString(),
        });
      } else if (replaceTargetId) {
        await removeUserPlace(replaceTargetId);
        await addUserPlace(draft);
      } else {
        await addUserPlace(draft);
      }
      closeAddPlace();
    } catch (e) {
      setSaveError(
        e instanceof Error ? e.message : 'Could not save place on this device.',
      );
    } finally {
      setSaving(false);
    }
  };

  const previewLat = selectedResult?.lat ?? manualCoords?.lat;
  const previewLng = selectedResult?.lng ?? manualCoords?.lng;

  const stageTitle = useMemo(() => {
    if (editing) return 'Edit place';
    if (stage === 'pick-type') return 'Save a common place';
    if (stage === 'manual') return 'Choose on map';
    return 'Save a common place';
  }, [editing, stage]);

  return (
    <Modal
      visible={addPlaceSheet.open}
      animationType="slide"
      transparent
      onRequestClose={closeAddPlace}
    >
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }}>
        <Pressable style={{ flex: 1 }} onPress={closeAddPlace} accessibilityLabel="Dismiss" />
        <SafeAreaView edges={['bottom']} style={{ backgroundColor: 'transparent' }}>
          <View className="rounded-t-3xl bg-card border-t border-border max-h-[88vh]">
            <View className="items-center pt-2.5 pb-1">
              <View className="h-1.5 w-12 rounded-full bg-muted-foreground/40" />
            </View>

            <View className="flex-row items-center justify-between px-5 pb-2">
              <View className="flex-1 pr-3">
                <Text className="text-foreground text-[18px] font-semibold">
                  {stageTitle}
                </Text>
                <Text className="text-muted-foreground text-[11.5px] mt-0.5">
                  Home, work, and school addresses are sensitive. SafeRoute stores
                  them locally on this device only.
                </Text>
              </View>
              <Pressable
                onPress={closeAddPlace}
                accessibilityRole="button"
                accessibilityLabel="Close add place"
                className="h-9 w-9 items-center justify-center rounded-full bg-secondary"
              >
                <X className="text-foreground" size={18} />
              </Pressable>
            </View>

            {stage === 'manual' ? (
              <View className="px-5 pb-5">
                <Text className="text-foreground text-[13px] font-medium mb-2">
                  Pan the map to position the pin, then confirm.
                </Text>
                <Text className="text-muted-foreground text-[11px] mb-3">
                  Manual pin is not a verified address — it will be saved as
                  &quot;Manual map location&quot;.
                </Text>
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={cancelManualPin}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel manual pin"
                    className="flex-1 min-h-[44px] items-center justify-center rounded-full bg-secondary"
                  >
                    <Text className="text-foreground text-[13px] font-semibold">
                      Cancel
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={confirmManualPin}
                    accessibilityRole="button"
                    accessibilityLabel="Use this location"
                    className="flex-1 min-h-[44px] items-center justify-center rounded-full bg-primary"
                  >
                    <Text className="text-primary-foreground text-[13px] font-semibold">
                      Use this location
                    </Text>
                  </Pressable>
                </View>
                {saveError ? (
                  <Text className="text-destructive text-[12px] mt-2">{saveError}</Text>
                ) : null}
              </View>
            ) : null}

            {stage === 'pick-type' ? (
              <View className="px-5 pb-5">
                <Text className="text-muted-foreground text-[11px] uppercase tracking-wider mb-2">
                  Place type
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {TYPE_OPTIONS.map((opt) => {
                    const meta = USER_PLACE_TYPE_META[opt.value];
                    return (
                      <Pressable
                        key={opt.value}
                        onPress={() => onPickType(opt.value)}
                        accessibilityRole="button"
                        accessibilityLabel={`Pick ${meta.label}`}
                        className="flex-row items-center gap-2 rounded-2xl border border-border bg-secondary/40 px-3 py-2.5 min-h-[44px]"
                      >
                        {opt.icon}
                        <Text className="text-foreground text-[13px] font-medium">
                          {meta.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {stage === 'search' || stage === 'confirm' ? (
              <ScrollView
                className="px-5"
                contentContainerStyle={{ paddingBottom: 24 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <View className="flex-row items-center gap-2 mb-3">
                  {TYPE_OPTIONS.map((opt) => {
                    const meta = USER_PLACE_TYPE_META[opt.value];
                    const active = opt.value === type;
                    return (
                      <Pressable
                        key={opt.value}
                        onPress={() => {
                          setType(opt.value);
                          if (!editing) {
                            setLabel(meta.defaultLabel);
                          }
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={meta.label}
                        className={cn(
                          'h-10 w-10 items-center justify-center rounded-full border',
                          active ? 'bg-primary border-primary' : 'bg-secondary border-border',
                        )}
                        style={{ borderColor: active ? meta.color : undefined }}
                      >
                        {opt.icon}
                      </Pressable>
                    );
                  })}
                </View>

                <Text className="text-muted-foreground text-[11px] uppercase tracking-wider mb-1.5">
                  Label
                </Text>
                <TextInput
                  value={label}
                  onChangeText={setLabel}
                  placeholder="e.g. Home"
                  placeholderTextColor="hsl(215 15% 55%)"
                  editable={type === 'other' || !!editing || true}
                  className="rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-foreground text-[13px] mb-3 min-h-[44px]"
                />

                <Text className="text-muted-foreground text-[11px] uppercase tracking-wider mb-1.5">
                  Address
                </Text>
                <View className="flex-row items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3 mb-2">
                  <Search className="text-muted-foreground" size={16} />
                  <TextInput
                    value={query}
                    onChangeText={(v) => {
                      setQuery(v);
                      setSelectedResult(null);
                      setManualCoords(null);
                      if (stage === 'confirm') setStage('search');
                    }}
                    placeholder="Type a street, place, or postcode"
                    placeholderTextColor="hsl(215 15% 55%)"
                    editable={!offlineMode}
                    className="flex-1 text-foreground text-[13px] py-2.5 min-h-[44px]"
                  />
                  {searchState === 'loading' ? (
                    <ActivityIndicator size="small" />
                  ) : null}
                </View>

                {offlineMode ? (
                  <View className="rounded-xl bg-amber-500/15 border border-amber-500/40 px-3 py-2 mb-3">
                    <Text className="text-amber-200 text-[11.5px]">
                      Address search requires internet. You can still place a pin
                      manually on the map.
                    </Text>
                  </View>
                ) : null}

                <Pressable
                  onPress={enterManualPin}
                  accessibilityRole="button"
                  accessibilityLabel="Choose on map instead"
                  className="rounded-xl border border-dashed border-border bg-secondary/30 px-3 py-2.5 mb-3 flex-row items-center gap-2 min-h-[44px]"
                >
                  <MapPin className="text-foreground" size={16} />
                  <Text className="text-foreground text-[12.5px] font-medium">
                    Choose on map instead
                  </Text>
                </Pressable>

                {searchState === 'error' && searchError ? (
                  <View className="rounded-xl bg-destructive/15 border border-destructive/40 px-3 py-2 mb-3">
                    <View className="flex-row items-center gap-1.5 mb-1">
                      <AlertCircle color="#ef4444" size={14} />
                      <Text className="text-destructive text-[12px] font-semibold">
                        {describeGeocodingError(searchError)}
                      </Text>
                    </View>
                    {searchError.kind === 'network' && !offlineMode ? (
                      <Pressable
                        onPress={onNominatimRetry}
                        accessibilityRole="button"
                        accessibilityLabel="Search once with Nominatim"
                        className="self-start mt-1 rounded-full bg-card border border-border px-2.5 py-1"
                      >
                        <Text className="text-foreground text-[11px] font-semibold">
                          Search once (Nominatim)
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}

                {results.length > 0 ? (
                  <View className="mb-3">
                    {results.map((r) => {
                      const active = selectedResult?.id === r.id;
                      return (
                        <Pressable
                          key={r.id}
                          onPress={() => onSelectResult(r)}
                          accessibilityRole="button"
                          accessibilityLabel={`Pick ${r.displayName}`}
                          className={cn(
                            'rounded-xl border px-3 py-2.5 mb-1.5 min-h-[56px]',
                            active
                              ? 'bg-primary/20 border-primary'
                              : 'bg-secondary/40 border-border',
                          )}
                        >
                          <View className="flex-row items-center gap-2">
                            <MapPin
                              color={active ? '#60a5fa' : '#9ca3af'}
                              size={14}
                            />
                            <Text
                              className="text-foreground text-[12.5px] font-semibold flex-1"
                              numberOfLines={1}
                            >
                              {r.address}
                            </Text>
                          </View>
                          {r.secondaryLine ? (
                            <Text
                              className="text-muted-foreground text-[11px] mt-0.5"
                              numberOfLines={1}
                            >
                              {r.secondaryLine}
                            </Text>
                          ) : null}
                          <Text className="text-muted-foreground/70 text-[9.5px] mt-0.5">
                            Address result · {r.source}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}

                {stage === 'confirm' && previewLat !== undefined && previewLng !== undefined ? (
                  <View className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-3 mb-3">
                    <Text className="text-emerald-300 text-[12px] font-semibold mb-1">
                      Save this place?
                    </Text>
                    <Text className="text-foreground text-[13px]" numberOfLines={2}>
                      {label}
                    </Text>
                    <Text className="text-muted-foreground text-[11.5px] mt-0.5" numberOfLines={2}>
                      {selectedResult?.displayName ??
                        (manualCoords ? 'Manual map location' : '')}
                    </Text>
                    <Text className="text-muted-foreground text-[10px] mt-1">
                      {previewLat.toFixed(5)}, {previewLng.toFixed(5)}
                    </Text>
                  </View>
                ) : null}

                {duplicate ? (
                  <View className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-3 mb-3">
                    <Text className="text-amber-200 text-[12.5px] font-semibold mb-2">
                      You already saved {USER_PLACE_TYPE_META[type].label}. Replace it?
                    </Text>
                    <Text className="text-muted-foreground text-[11px] mb-2" numberOfLines={2}>
                      Existing: {duplicate.address}
                    </Text>
                    <View className="flex-row gap-2 flex-wrap">
                      <Pressable
                        onPress={() => {
                          const draft = buildPlaceDraft();
                          if (draft) void doSave(draft, duplicate.id);
                          setDuplicate(null);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Replace existing"
                        className="rounded-full bg-primary px-3 min-h-[36px] items-center justify-center"
                      >
                        <Text className="text-primary-foreground text-[12px] font-semibold">
                          Replace
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          // Save anyway with type "other"
                          const draft = buildPlaceDraft();
                          if (draft) void doSave({ ...draft, type: 'other' });
                          setDuplicate(null);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Save as another"
                        className="rounded-full bg-secondary px-3 min-h-[36px] items-center justify-center"
                      >
                        <Text className="text-foreground text-[12px] font-semibold">
                          Save as another
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setDuplicate(null)}
                        accessibilityRole="button"
                        accessibilityLabel="Cancel"
                        className="rounded-full bg-card border border-border px-3 min-h-[36px] items-center justify-center"
                      >
                        <Text className="text-foreground text-[12px] font-semibold">
                          Cancel
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}

                {saveError ? (
                  <View className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 mb-3">
                    <Text className="text-destructive text-[12px]">{saveError}</Text>
                  </View>
                ) : null}

                <View className="flex-row gap-2 mt-1">
                  <Pressable
                    onPress={closeAddPlace}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel"
                    className="flex-1 min-h-[48px] items-center justify-center rounded-full bg-secondary"
                  >
                    <Text className="text-foreground text-[13px] font-semibold">
                      Cancel
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={onAttemptSave}
                    disabled={saving || (!selectedResult && !manualCoords)}
                    accessibilityRole="button"
                    accessibilityLabel="Save place"
                    className={cn(
                      'flex-1 min-h-[48px] items-center justify-center rounded-full flex-row gap-2',
                      !selectedResult && !manualCoords
                        ? 'bg-primary/40'
                        : 'bg-primary',
                    )}
                  >
                    {saving ? (
                      <Loader2 color="#ffffff" size={16} />
                    ) : (
                      <Check color="#ffffff" size={16} />
                    )}
                    <Text className="text-primary-foreground text-[13px] font-semibold">
                      {editing ? 'Update place' : 'Save place'}
                    </Text>
                  </Pressable>
                </View>

                <Text className="text-[10.5px] text-muted-foreground mt-3 italic">
                  Saved only on this device. No backend, no sync, no analytics.
                </Text>
              </ScrollView>
            ) : null}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
