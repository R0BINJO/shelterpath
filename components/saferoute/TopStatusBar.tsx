/*
 * SafeRoute Varjumine — top status bar.
 * Compact pills shown over the map: app name, crisis mode, offline ready, demo data.
 */

import { CircleAlert, CloudOff, Info, WifiOff } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

type Props = {
  crisisMode: boolean;
  offlineMode: boolean;
  onToggleCrisis: () => void;
  onToggleOffline: () => void;
  onOpenInfo: () => void;
  rightSlot?: React.ReactNode;
};

function Pill({
  active,
  onPress,
  children,
  tone = 'default',
  accessibilityLabel,
}: {
  active: boolean;
  onPress: () => void;
  children: React.ReactNode;
  tone?: 'default' | 'danger' | 'demo';
  accessibilityLabel: string;
}) {
  const base =
    'flex-row items-center gap-1.5 rounded-full px-3 py-1.5 border min-h-[36px]';
  const styles = active
    ? tone === 'danger'
      ? 'bg-destructive border-destructive'
      : 'bg-primary border-primary'
    : 'bg-card/85 border-border';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className={cn(base, styles)}
    >
      {children}
    </Pressable>
  );
}

export function TopStatusBar({
  crisisMode,
  offlineMode,
  onToggleCrisis,
  onToggleOffline,
  onOpenInfo,
  rightSlot,
}: Props) {
  return (
    <SafeAreaView
      edges={['top']}
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 20,
      }}
    >
      <View pointerEvents="box-none" className="px-3 pt-2">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <View className="h-9 w-9 items-center justify-center rounded-full bg-primary">
              <CircleAlert color="#ffffff" size={20} />
            </View>
            <View>
              <Text className="text-foreground text-[15px] font-semibold leading-[18px]">
                SafeRoute
              </Text>
              <Text className="text-muted-foreground text-[11px] leading-[13px]">
                Varjumine · demo
              </Text>
            </View>
          </View>

          <Pressable
            onPress={onOpenInfo}
            accessibilityRole="button"
            accessibilityLabel="About SafeRoute"
            className="h-10 w-10 items-center justify-center rounded-full bg-card/85 border border-border"
          >
            <Info className="text-foreground" size={20} />
          </Pressable>
        </View>

        {rightSlot ? (
          <View className="absolute right-3 top-12 z-10">{rightSlot}</View>
        ) : null}

        <View className="mt-2 flex-row flex-wrap gap-2">
          <Pill
            active={crisisMode}
            onPress={onToggleCrisis}
            tone="danger"
            accessibilityLabel="Toggle crisis mode"
          >
            <CircleAlert color={crisisMode ? '#ffffff' : '#dc2626'} size={14} />
            <Text
              className={cn(
                'text-[12px] font-semibold',
                crisisMode ? 'text-destructive-foreground' : 'text-foreground',
              )}
            >
              Crisis mode {crisisMode ? 'on' : 'off'}
            </Text>
          </Pill>

          <Pill
            active={offlineMode}
            onPress={onToggleOffline}
            accessibilityLabel="Toggle offline mode"
          >
            {offlineMode ? (
              <WifiOff color="#ffffff" size={14} />
            ) : (
              <CloudOff className="text-foreground" size={14} />
            )}
            <Text
              className={cn(
                'text-[12px] font-semibold',
                offlineMode ? 'text-primary-foreground' : 'text-foreground',
              )}
            >
              Offline ready
            </Text>
          </Pill>

        </View>
      </View>
    </SafeAreaView>
  );
}
