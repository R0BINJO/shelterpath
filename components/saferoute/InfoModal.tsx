/*
 * SafeRoute Varjumine — About / data-transparency modal.
 * Surfaces the "this is a prototype with demo data" disclaimer.
 */

import { ShieldAlert, X } from 'lucide-react-native';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';

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

              <View className="mt-3 rounded-xl bg-amber-500/15 border border-amber-500/40 px-3 py-2.5">
                <Text className="text-amber-300 text-[12px] font-semibold">
                  Demo prototype
                </Text>
                <Text className="text-amber-200/90 text-[11.5px] mt-1 leading-[16px]">
                  This prototype uses hardcoded demo shelters, demo routes, demo map data
                  and demo danger zones. It does not provide official emergency information.
                </Text>
              </View>

              <Text className="text-muted-foreground text-[11px] uppercase tracking-wider mt-3 mb-1">
                Shelter levels
              </Text>
              <View className="gap-1.5">
                <View className="flex-row items-center gap-2">
                  <View style={{ backgroundColor: '#F5C518' }} className="h-3 w-3 rounded-full" />
                  <Text className="text-foreground text-[12.5px]">
                    SA1 — Temporary cover (minutes)
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <View style={{ backgroundColor: '#2F80ED' }} className="h-3 w-3 rounded-full" />
                  <Text className="text-foreground text-[12.5px]">
                    SA2 — Stronger shelter (short / medium)
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <View style={{ backgroundColor: '#21C45D' }} className="h-3 w-3 rounded-full" />
                  <Text className="text-foreground text-[12.5px]">
                    SA3 — Long-term / official shelter
                  </Text>
                </View>
              </View>

              <Text className="text-[11px] text-muted-foreground mt-3 italic">
                No login, no backend, no live routing. All data is on this device.
              </Text>
            </ScrollView>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
