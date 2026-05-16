/*
 * SafeRoute Varjumine — About / data-transparency modal.
 * Surfaces the "this is a prototype with hardcoded official-data snapshot"
 * disclaimer.
 */

import { ShieldAlert, X } from 'lucide-react-native';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { shelterDataSource } from '@/src/data/officialShelters';

export function InfoModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center' }}>
        <Pressable
          onPress={onClose}
          style={{ position: 'absolute', inset: 0 }}
          accessibilityLabel="Dismiss info"
        />
        <SafeAreaView style={{ backgroundColor: 'transparent' }}>
          <View className="mx-4 rounded-3xl bg-card border border-border overflow-hidden">
            <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
              <View className="flex-row items-center gap-2">
                <View className="h-9 w-9 rounded-full bg-amber-500/20 items-center justify-center">
                  <ShieldAlert color="#f59e0b" size={20} />
                </View>
                <Text className="text-foreground text-[16px] font-semibold">
                  About SafeRoute Varjumine
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close about"
                className="h-9 w-9 items-center justify-center rounded-full bg-secondary"
              >
                <X className="text-foreground" size={18} />
              </Pressable>
            </View>
            <ScrollView className="px-5 pb-5" showsVerticalScrollIndicator={false}>
              <Text className="text-foreground text-[13px] leading-[19px]">
                SafeRoute is a civilian preparedness assistant. It helps you find nearby
                shelter options and plan fallback locations in advance.
              </Text>
              <Text className="text-foreground text-[13px] leading-[19px] mt-2 font-semibold">
                It is not an official emergency system. Always follow official instructions.
              </Text>

              <View className="mt-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 px-3 py-2.5">
                <Text className="text-emerald-300 text-[12px] font-semibold">
                  Päästeamet data snapshot
                </Text>
                <Text className="text-emerald-200/90 text-[11.5px] mt-1 leading-[16px]">
                  Shelter locations are hardcoded from a Päästeamet open-data
                  snapshot imported on {shelterDataSource.importedAt}. Data may
                  change on the official source. The app does not fetch shelter
                  data live at runtime.
                </Text>
                <Text className="text-emerald-200/80 text-[10.5px] mt-1.5 leading-[14px]">
                  Source · {shelterDataSource.sourceName}
                  {'\n'}
                  {shelterDataSource.sourcePageUrl}
                  {'\n'}
                  {shelterDataSource.licenseNote}
                </Text>
              </View>

              <View className="mt-3 rounded-xl bg-amber-500/15 border border-amber-500/40 px-3 py-2.5">
                <Text className="text-amber-300 text-[12px] font-semibold">
                  Demo prototype
                </Text>
                <Text className="text-amber-200/90 text-[11.5px] mt-1 leading-[16px]">
                  Map tiles load from OpenFreeMap (OSM-based, no API key) when
                  online. Live walking routes use the public OSRM demo endpoint
                  (router.project-osrm.org). When OSRM is unavailable the app
                  falls back to a straight-line distance estimate, clearly
                  labelled. The hardcoded danger zone is visual only.
                </Text>
              </View>

              <Text className="text-muted-foreground text-[11px] uppercase tracking-wider mt-3 mb-1">
                Shelter levels
              </Text>
              <View className="gap-1.5">
                <View className="flex-row items-center gap-2">
                  <View style={{ backgroundColor: '#F5C518' }} className="h-3 w-3 rounded-full" />
                  <Text className="text-foreground text-[12.5px]">
                    SA1 — Temporary cover (not in this dataset)
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <View style={{ backgroundColor: '#2F80ED' }} className="h-3 w-3 rounded-full" />
                  <Text className="text-foreground text-[12.5px]">
                    SA2 — Stronger shelter (not in this dataset)
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <View style={{ backgroundColor: '#21C45D' }} className="h-3 w-3 rounded-full" />
                  <Text className="text-foreground text-[12.5px]">
                    SA3 — Official public shelter (Päästeamet)
                  </Text>
                </View>
              </View>

              <View className="mt-3 rounded-xl bg-purple-500/15 border border-purple-500/40 px-3 py-2.5">
                <Text className="text-purple-300 text-[12px] font-semibold">
                  Saved places (private)
                </Text>
                <Text className="text-purple-200/90 text-[11.5px] mt-1 leading-[16px]">
                  Official shelters come from a hardcoded Päästeamet data
                  snapshot. Saved places (home, work, school, family, other)
                  are private user-created locations stored locally on this
                  device. SafeRoute does not send them to any backend, does
                  not log in, and does not sync.
                </Text>
              </View>

              <Text className="text-[11px] text-muted-foreground mt-3 italic">
                No login, no backend. Shelter data, the danger zone, and the
                offline fallback graph are bundled with the app and remain on
                this device.
              </Text>
            </ScrollView>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
