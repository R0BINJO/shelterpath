/*
 * SafeRoute Varjumine — Account chip (top-right).
 *
 * - Signed-out: "Sign in" pill that opens the AuthSheet.
 * - Signed-in:  Display name + "Sign out" menu pill.
 */

import { LogIn, LogOut, UserCircle2 } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useAuthStore } from '@/lib/authStore';

type Props = {
  onOpenAuth: () => void;
};

export function AccountChip({ onOpenAuth }: Props) {
  const status = useAuthStore((s) => s.status);
  const displayName = useAuthStore((s) => s.displayName);
  const email = useAuthStore((s) => s.email);
  const signOut = useAuthStore((s) => s.signOut);
  const [menuOpen, setMenuOpen] = useState(false);

  if (status === 'signed-in') {
    return (
      <>
        <Pressable
          onPress={() => setMenuOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Account menu"
          className="flex-row items-center gap-1.5 rounded-full bg-card/85 border border-border px-2.5 py-1.5 min-h-[36px]"
        >
          <UserCircle2 className="text-primary" size={16} />
          <Text className="text-foreground text-[12px] font-semibold" numberOfLines={1}>
            {displayName ?? 'You'}
          </Text>
        </Pressable>

        <Modal
          visible={menuOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setMenuOpen(false)}
        >
          <Pressable
            onPress={() => setMenuOpen(false)}
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
          >
            <View
              style={{
                position: 'absolute',
                top: 96,
                right: 12,
                width: 220,
              }}
            >
              <View className="rounded-2xl bg-card border border-border overflow-hidden">
                <View className="px-3 py-2.5 border-b border-border">
                  <Text className="text-foreground text-[13px] font-semibold" numberOfLines={1}>
                    {displayName ?? 'Signed in'}
                  </Text>
                  {email ? (
                    <Text
                      className="text-muted-foreground text-[10.5px] mt-0.5"
                      numberOfLines={1}
                    >
                      {email}
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  onPress={() => {
                    setMenuOpen(false);
                    void signOut();
                  }}
                  className="flex-row items-center gap-2 px-3 py-3 active:bg-secondary"
                  accessibilityRole="button"
                  accessibilityLabel="Sign out"
                >
                  <LogOut className="text-destructive" size={16} />
                  <Text className="text-destructive text-[13px] font-semibold">
                    Sign out
                  </Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Modal>
      </>
    );
  }

  return (
    <Pressable
      onPress={onOpenAuth}
      accessibilityRole="button"
      accessibilityLabel="Sign in or create an account"
      className="flex-row items-center gap-1.5 rounded-full bg-card/85 border border-border px-2.5 py-1.5 min-h-[36px]"
    >
      <LogIn className="text-foreground" size={16} />
      <Text className="text-foreground text-[12px] font-semibold">Sign in</Text>
    </Pressable>
  );
}
