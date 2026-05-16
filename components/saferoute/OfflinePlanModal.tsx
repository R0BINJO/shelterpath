/*
 * SafeRoute Varjumine — Offline Plan modal.
 *
 * Lets the user pin saved fallback shelters (home / work / school / generic),
 * a family meeting point and emergency notes. All values persist to
 * AsyncStorage via lib/saferouteStore.ts (the RN equivalent of localStorage).
 *
 * Saved fallback shelters store id, name, address, lat, lng, snapshot date and
 * a saved-at timestamp so the offline view still works when the dataset is
 * not loaded.
 *
 * "Last downloaded map" is a HARDCODED demo timestamp — no real tiles are stored.
 */

import { Briefcase, Bookmark, GraduationCap, Home, Users, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import {
  DEMO_LAST_MAP_DOWNLOAD,
  haversineMeters,
  SHELTERS,
  type Shelter,
} from '@/lib/shelters';
import {
  type FallbackSlot,
  type SavedFallback,
  useSafeRouteStore,
} from '@/lib/saferouteStore';

type SlotMeta = {
  slot: FallbackSlot;
  label: string;
  icon: React.ReactNode;
};

const SLOTS: SlotMeta[] = [
  { slot: 'home', label: 'Home fallback', icon: <Home color="#60a5fa" size={18} /> },
  { slot: 'work', label: 'Work fallback', icon: <Briefcase color="#a78bfa" size={18} /> },
  {
    slot: 'school',
    label: 'School fallback',
    icon: <GraduationCap color="#34d399" size={18} />,
  },
  {
    slot: 'generic',
    label: 'Other saved shelter',
    icon: <Bookmark color="#fbbf24" size={18} />,
  },
];

function SlotRow({
  meta,
  saved,
  candidates,
  onPick,
  onClear,
}: {
  meta: SlotMeta;
  saved: SavedFallback | undefined;
  candidates: Shelter[];
  onPick: (shelter: Shelter) => void;
  onClear: () => void;
}) {
  return (
    <View className="rounded-xl border border-border bg-secondary/40 px-3 py-3 mb-2">
      <View className="flex-row items-center gap-2 mb-2">
        {meta.icon}
        <Text className="text-foreground text-[13px] font-semibold flex-1">
          {meta.label}
        </Text>
        {saved ? (
          <Pressable
            onPress={onClear}
            accessibilityRole="button"
            accessibilityLabel={`Clear ${meta.label}`}
            className="h-7 px-2.5 items-center justify-center rounded-full bg-card border border-border"
          >
            <Text className="text-[11px] text-muted-foreground">Clear</Text>
          </Pressable>
        ) : null}
      </View>
      {saved ? (
        <View className="mb-2">
          <Text className="text-foreground text-[12.5px]" numberOfLines={1}>
            {saved.shelterName}
          </Text>
          <Text className="text-muted-foreground text-[11px] mt-0.5" numberOfLines={1}>
            {saved.shelterAddress}
          </Text>
          <Text className="text-muted-foreground text-[10px] mt-0.5">
            Saved {new Date(saved.savedAt).toLocaleDateString()} · snapshot{' '}
            {saved.dataSnapshotDate}
          </Text>
        </View>
      ) : (
        <Text className="text-muted-foreground text-[12px] mb-2">Not set</Text>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-2">
          {candidates.map((s) => {
            const active = saved?.shelterId === s.id;
            return (
              <Pressable
                key={s.id}
                onPress={() => onPick(s)}
                accessibilityRole="button"
                accessibilityLabel={`Pick ${s.name}`}
                className={
                  'rounded-full border px-3 py-1.5 ' +
                  (active ? 'bg-primary border-primary' : 'bg-card border-border')
                }
              >
                <Text
                  className={
                    'text-[11.5px] font-medium ' +
                    (active ? 'text-primary-foreground' : 'text-foreground')
                  }
                  numberOfLines={1}
                >
                  {s.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

export function OfflinePlanModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const {
    fallbacks,
    familyMeetingPoint,
    emergencyNotes,
    userLocation,
    saveFallback,
    clearFallback,
    setFamilyMeetingPoint,
    setEmergencyNotes,
  } = useSafeRouteStore();

  const [query, setQuery] = useState('');

  // Show the 20 nearest shelters to the user's location, optionally filtered
  // by a free-text search.
  const candidates = useMemo<Shelter[]>(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? SHELTERS.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            s.address.toLowerCase().includes(q),
        )
      : SHELTERS;
    return [...filtered]
      .map((s) => ({ s, d: haversineMeters(userLocation, s) }))
      .toSorted((a, b) => a.d - b.d)
      .slice(0, 20)
      .map((x) => x.s);
  }, [query, userLocation]);

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

              <Text className="text-muted-foreground text-[11px] uppercase tracking-wider mb-2">
                Search shelters
              </Text>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Filter by name or address…"
                placeholderTextColor="hsl(215 15% 55%)"
                className="rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-foreground text-[13px] mb-3"
              />

              <Text className="text-muted-foreground text-[11px] uppercase tracking-wider mb-2">
                Saved shelters
              </Text>
              {SLOTS.map((meta) => (
                <SlotRow
                  key={meta.slot}
                  meta={meta}
                  saved={fallbacks[meta.slot]}
                  candidates={candidates}
                  onPick={(s) => saveFallback(meta.slot, s)}
                  onClear={() => clearFallback(meta.slot)}
                />
              ))}

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

              <Text className="text-[10.5px] text-muted-foreground mt-3 italic">
                Shelter records are a hardcoded Päästeamet open-data snapshot.
                Everything in this panel is stored on this device only. No backend.
              </Text>
            </ScrollView>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
