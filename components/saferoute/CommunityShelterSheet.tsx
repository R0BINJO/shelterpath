/*
 * SafeRoute Varjumine — Community Shelter detail sheet.
 *
 * Opened when a community shelter marker is tapped on the map.
 *
 * UNVERIFIED COMMUNITY SUBMISSION — clearly badged. NEVER mixed into shelter
 * routing candidates. The user can still navigate to it explicitly (uses the
 * same OSRM/haversine pipeline as Saved Places).
 */

import {
  Copy,
  Navigation,
  ShieldQuestion,
  Trash2,
  Users,
  X,
} from 'lucide-react-native';
import { useEffect } from 'react';
import { Animated, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { useAuthStore } from '@/lib/authStore';
import { useCommunityShelterStore } from '@/lib/communityShelterStore';
import { useSafeRouteStore } from '@/lib/saferouteStore';
import { cn } from '@/lib/utils';
import {
  getCommunityShelterMeta,
  type CommunityShelter,
} from '@/src/types/communityShelters';

type Props = {
  onCopyCoords: (lat: number, lng: number) => void;
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString();
  } catch {
    return iso;
  }
}

export function CommunityShelterSheet({ onCopyCoords }: Props) {
  const selectedId = useCommunityShelterStore((s) => s.selectedId);
  const shelters = useCommunityShelterStore((s) => s.shelters);
  const select = useCommunityShelterStore((s) => s.select);
  const remove = useCommunityShelterStore((s) => s.remove);

  const route = useSafeRouteStore((s) => s.route);
  const routeState = useSafeRouteStore((s) => s.routeState);
  const showRoute = useSafeRouteStore((s) => s.showRoute);
  const routeFromCurrentToCommunity = useRouteFromCurrentToCommunity();

  const userId = useAuthStore((s) => s.userId);

  const shelter = selectedId ? shelters.find((s) => s.id === selectedId) ?? null : null;
  const visible = !!shelter;

  const translateY = useTranslateY(visible);

  if (!shelter) return null;

  const meta = getCommunityShelterMeta(shelter.shelterType);
  const submittedBy = shelter.submittedByDisplayName ?? 'Community member';
  const isOwn = userId !== null && userId === shelter.submittedBy;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 25,
        transform: [{ translateY }],
      }}
    >
      <SafeAreaView edges={['bottom']}>
        <View
          className="mx-2 mb-2 rounded-3xl bg-card border border-border overflow-hidden"
          style={{ maxHeight: Platform.select({ web: 520, default: 560 }) }}
        >
          <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
            <View className="flex-row items-center gap-2 flex-1">
              <View
                className="h-9 w-9 rounded-full items-center justify-center"
                style={{ backgroundColor: 'rgba(245, 158, 11, 0.18)' }}
              >
                <Users color={meta.color} size={20} />
              </View>
              <View className="flex-1">
                <Text className="text-foreground text-[15px] font-semibold" numberOfLines={1}>
                  {shelter.name}
                </Text>
                <Text className="text-muted-foreground text-[11px]" numberOfLines={1}>
                  {meta.label} · submitted by {submittedBy}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={() => select(null)}
              accessibilityRole="button"
              accessibilityLabel="Close"
              className="h-9 w-9 items-center justify-center rounded-full bg-secondary"
            >
              <X className="text-foreground" size={18} />
            </Pressable>
          </View>

          <ScrollView className="px-4 pb-4" showsVerticalScrollIndicator={false}>
            <View className="flex-row gap-1.5 flex-wrap">
              <Badge
                tone="amber"
                icon={<Users color="#f59e0b" size={11} />}
                label="Community submission"
              />
              <Badge
                tone="amber"
                icon={<ShieldQuestion color="#f59e0b" size={11} />}
                label="Unverified"
              />
            </View>

            <View className="mt-3 rounded-xl bg-amber-500/15 border border-amber-500/40 px-3 py-2.5">
              <Text className="text-amber-300 text-[11.5px] leading-[16px]">
                This shelter point was shared by a SafeRoute user. It is not an
                official Päästeamet shelter and is not used by &quot;Find
                nearest shelter&quot;. Always verify the location yourself
                before relying on it.
              </Text>
            </View>

            {shelter.address ? <Row label="Address" value={shelter.address} /> : null}
            {shelter.capacityEstimate !== null ? (
              <Row
                label="Capacity (user estimate)"
                value={`${shelter.capacityEstimate} people`}
              />
            ) : null}
            {shelter.notes ? <Row label="Notes" value={shelter.notes} multiline /> : null}
            <Row
              label="Coordinates"
              value={`${shelter.lat.toFixed(5)}, ${shelter.lng.toFixed(5)}`}
            />
            <Row label="Submitted" value={formatDate(shelter.createdAt)} />

            {showRoute && route ? (
              <View className="mt-3 rounded-xl bg-secondary px-3 py-2.5">
                <Text className="text-foreground text-[12px] font-semibold">
                  {routeState === 'loading'
                    ? 'Finding route…'
                    : `Route ${Math.max(1, Math.round((route.distanceMeters ?? 0) / 100) * 100)} m`}
                </Text>
                <Text className="text-muted-foreground text-[11px] mt-0.5">
                  {route.sourceLabel ?? route.source}
                </Text>
                <Text className="text-muted-foreground text-[10.5px] italic mt-1">
                  Destination is a community-submitted point, not an official shelter.
                </Text>
              </View>
            ) : null}

            <View className="mt-3 flex-row gap-2 flex-wrap">
              <ActionButton
                onPress={() => void routeFromCurrentToCommunity(shelter)}
                icon={<Navigation color="#ffffff" size={14} />}
                label="Navigate"
                tone="primary"
              />
              <ActionButton
                onPress={() => onCopyCoords(shelter.lat, shelter.lng)}
                icon={<Copy className="text-foreground" size={14} />}
                label="Copy coords"
                tone="secondary"
              />
              {isOwn ? (
                <ActionButton
                  onPress={() => {
                    void remove(shelter.id);
                  }}
                  icon={<Trash2 color="#ef4444" size={14} />}
                  label="Delete"
                  tone="danger"
                />
              ) : null}
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Animated.View>
  );
}

function Row({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <View className="mt-2.5">
      <Text className="text-muted-foreground text-[10.5px] uppercase tracking-wider">
        {label}
      </Text>
      <Text
        className="text-foreground text-[13px] mt-0.5"
        numberOfLines={multiline ? undefined : 2}
      >
        {value}
      </Text>
    </View>
  );
}

function Badge({
  tone,
  icon,
  label,
}: {
  tone: 'amber';
  icon: React.ReactNode;
  label: string;
}) {
  void tone;
  return (
    <View className="flex-row items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/40 px-2 py-0.5">
      {icon}
      <Text className="text-amber-300 text-[10.5px] font-semibold">{label}</Text>
    </View>
  );
}

function ActionButton({
  onPress,
  icon,
  label,
  tone,
}: {
  onPress: () => void;
  icon: React.ReactNode;
  label: string;
  tone: 'primary' | 'secondary' | 'danger';
}) {
  const className =
    tone === 'primary'
      ? 'bg-primary'
      : tone === 'danger'
        ? 'bg-destructive/20 border border-destructive/40'
        : 'bg-secondary';
  const textClassName =
    tone === 'primary'
      ? 'text-primary-foreground'
      : tone === 'danger'
        ? 'text-destructive'
        : 'text-foreground';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={cn('flex-row items-center gap-1.5 rounded-full px-3 py-2 min-h-[36px]', className)}
    >
      {icon}
      <Text className={cn('text-[12px] font-semibold', textClassName)}>{label}</Text>
    </Pressable>
  );
}

function useTranslateY(visible: boolean): Animated.Value {
  const value = useTranslateYRef();
  useEffect(() => {
    Animated.spring(value, {
      toValue: visible ? 0 : 500,
      useNativeDriver: true,
      bounciness: 4,
      speed: 16,
    }).start();
  }, [visible, value]);
  return value;
}

// Cached Animated.Value across renders.
let cachedAnim: Animated.Value | null = null;
function useTranslateYRef(): Animated.Value {
  if (!cachedAnim) cachedAnim = new Animated.Value(500);
  return cachedAnim;
}

/**
 * Routes from the user's current location to a community shelter using the
 * SAME OSRM/haversine pipeline as Saved Places (community shelter is treated
 * as a synthetic destination — NEVER as a routing candidate for nearest
 * shelter).
 */
function useRouteFromCurrentToCommunity() {
  const routeFromCurrentLocationToSavedPlace = useSafeRouteStore(
    (s) => s.routeFromCurrentLocationToSavedPlace,
  );
  return (shelter: CommunityShelter) => {
    // Synthesise a UserPlace-shaped object so we can re-use the existing
    // current-location → destination routing primitive without inventing a
    // shelter classification.
    const synthetic = {
      id: `community:${shelter.id}`,
      type: 'other' as const,
      label: shelter.name,
      address: shelter.address ?? 'Community shelter point',
      displayName: shelter.name,
      lat: shelter.lat,
      lng: shelter.lng,
      source: 'manual-pin' as const,
      createdAt: shelter.createdAt,
      updatedAt: shelter.updatedAt,
      isUserSaved: true as const,
    };
    return routeFromCurrentLocationToSavedPlace(synthetic);
  };
}
