/*
 * SafeRoute Varjumine — Account / Auth sheet (Supabase email + 6-digit OTP).
 *
 * Online-only flow. The community shelter dataset itself works offline once
 * it has been fetched at least once (see lib/communityShelterStore.ts).
 */

import { ArrowRight, LogIn, ShieldCheck, UserPlus, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
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
import { cn } from '@/lib/utils';

type Mode = 'sign-in' | 'sign-up' | 'verify';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function AuthSheet({ visible, onClose }: Props) {
  const {
    status,
    pendingSignup,
    lastError,
    signUp,
    verifySignupOtp,
    resendSignupOtp,
    signIn,
    clearError,
  } = useAuthStore();

  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendBanner, setResendBanner] = useState<string | null>(null);

  // If the auth store flips into awaiting-otp, mirror it.
  useEffect(() => {
    if (status === 'awaiting-otp') {
      setMode('verify');
      if (pendingSignup?.email) setEmail(pendingSignup.email);
    } else if (status === 'signed-in' && visible) {
      onClose();
    }
  }, [status, pendingSignup, visible, onClose]);

  useEffect(() => {
    if (!visible) {
      // Reset transient inputs when the sheet closes.
      setPassword('');
      setOtp('');
      setResendBanner(null);
      clearError();
    }
  }, [visible, clearError]);

  const handleSignUp = async () => {
    if (busy) return;
    if (!email.trim() || !password.trim() || !displayName.trim()) return;
    setBusy(true);
    try {
      await signUp({
        email: email.trim().toLowerCase(),
        password,
        displayName: displayName.trim(),
      });
    } catch {
      // error captured by store
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async () => {
    if (busy) return;
    const token = otp.trim();
    if (token.length < 6) return;
    setBusy(true);
    try {
      await verifySignupOtp({ email: email.trim().toLowerCase(), token });
    } catch {
      // error captured by store
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    if (resending) return;
    setResending(true);
    setResendBanner(null);
    try {
      await resendSignupOtp(email.trim().toLowerCase());
      setResendBanner('New code sent. Check your inbox.');
    } catch {
      setResendBanner('Could not resend code. Try again.');
    } finally {
      setResending(false);
    }
  };

  const handleSignIn = async () => {
    if (busy) return;
    if (!email.trim() || !password.trim()) return;
    setBusy(true);
    try {
      await signIn({ email: email.trim().toLowerCase(), password });
    } catch {
      // error captured by store
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }}>
        <Pressable
          onPress={onClose}
          accessibilityLabel="Dismiss"
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
        />
        <SafeAreaView edges={['bottom']} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
          >
            <View
              className="bg-card border-t border-x border-border rounded-t-3xl overflow-hidden"
              style={{ maxHeight: '92%' }}
            >
              <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
                <View className="flex-row items-center gap-2">
                  <View className="h-9 w-9 rounded-full bg-amber-500/20 items-center justify-center">
                    <ShieldCheck color="#f59e0b" size={20} />
                  </View>
                  <View>
                    <Text className="text-foreground text-[16px] font-semibold">
                      {mode === 'verify' ? 'Verify your email' : 'Community account'}
                    </Text>
                    <Text className="text-muted-foreground text-[11px]">
                      Online · for sharing public shelter points
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={onClose}
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
                {mode !== 'verify' ? (
                  <View className="mt-2 flex-row rounded-full bg-secondary p-1">
                    <Pressable
                      onPress={() => {
                        setMode('sign-in');
                        clearError();
                      }}
                      className={cn(
                        'flex-1 rounded-full py-2 items-center',
                        mode === 'sign-in' ? 'bg-primary' : '',
                      )}
                    >
                      <Text
                        className={cn(
                          'text-[12px] font-semibold',
                          mode === 'sign-in' ? 'text-primary-foreground' : 'text-foreground',
                        )}
                      >
                        Sign in
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setMode('sign-up');
                        clearError();
                      }}
                      className={cn(
                        'flex-1 rounded-full py-2 items-center',
                        mode === 'sign-up' ? 'bg-primary' : '',
                      )}
                    >
                      <Text
                        className={cn(
                          'text-[12px] font-semibold',
                          mode === 'sign-up' ? 'text-primary-foreground' : 'text-foreground',
                        )}
                      >
                        Create account
                      </Text>
                    </Pressable>
                  </View>
                ) : null}

                <Text className="text-muted-foreground text-[12px] mt-3 leading-[17px]">
                  Accounts are only needed to share shelter points with other users.
                  The rest of SafeRoute works without an account. Account creation,
                  sign-in and your email use Supabase Auth (online). Your home/work/
                  school saved places stay private and are never sent to the backend.
                </Text>

                {mode === 'sign-up' ? (
                  <View className="mt-4 gap-2.5">
                    <Field label="Display name (shown on your submissions)">
                      <TextInput
                        value={displayName}
                        onChangeText={setDisplayName}
                        placeholder="e.g. Mari from Tallinn"
                        placeholderTextColor="#6b7280"
                        autoCapitalize="words"
                        maxLength={60}
                        className="bg-secondary rounded-xl px-3 py-3 text-foreground text-[14px]"
                      />
                    </Field>
                    <Field label="Email">
                      <TextInput
                        value={email}
                        onChangeText={setEmail}
                        placeholder="you@example.com"
                        placeholderTextColor="#6b7280"
                        autoCapitalize="none"
                        keyboardType="email-address"
                        autoComplete="email"
                        className="bg-secondary rounded-xl px-3 py-3 text-foreground text-[14px]"
                      />
                    </Field>
                    <Field label="Password (min 6 chars)">
                      <TextInput
                        value={password}
                        onChangeText={setPassword}
                        placeholder="••••••••"
                        placeholderTextColor="#6b7280"
                        secureTextEntry
                        autoComplete="password-new"
                        className="bg-secondary rounded-xl px-3 py-3 text-foreground text-[14px]"
                      />
                    </Field>
                    {lastError ? <ErrorRow message={lastError.message} /> : null}
                    <PrimaryButton
                      onPress={handleSignUp}
                      label={busy ? 'Sending code…' : 'Send 6-digit code'}
                      busy={busy}
                      icon={<UserPlus color="#ffffff" size={16} />}
                      disabled={
                        !email.trim() ||
                        password.length < 6 ||
                        !displayName.trim()
                      }
                    />
                    <Text className="text-muted-foreground text-[11px] leading-[16px] mt-1">
                      We&apos;ll email you a 6-digit code. Come back to this
                      screen and type the code — don&apos;t click the
                      confirmation link in the email.
                    </Text>
                  </View>
                ) : null}

                {mode === 'sign-in' ? (
                  <View className="mt-4 gap-2.5">
                    <Field label="Email">
                      <TextInput
                        value={email}
                        onChangeText={setEmail}
                        placeholder="you@example.com"
                        placeholderTextColor="#6b7280"
                        autoCapitalize="none"
                        keyboardType="email-address"
                        autoComplete="email"
                        className="bg-secondary rounded-xl px-3 py-3 text-foreground text-[14px]"
                      />
                    </Field>
                    <Field label="Password">
                      <TextInput
                        value={password}
                        onChangeText={setPassword}
                        placeholder="••••••••"
                        placeholderTextColor="#6b7280"
                        secureTextEntry
                        autoComplete="password"
                        className="bg-secondary rounded-xl px-3 py-3 text-foreground text-[14px]"
                      />
                    </Field>
                    {lastError ? <ErrorRow message={lastError.message} /> : null}
                    <PrimaryButton
                      onPress={handleSignIn}
                      label={busy ? 'Signing in…' : 'Sign in'}
                      busy={busy}
                      icon={<LogIn color="#ffffff" size={16} />}
                      disabled={!email.trim() || !password.trim()}
                    />
                  </View>
                ) : null}

                {mode === 'verify' ? (
                  <View className="mt-4 gap-2.5">
                    <Text className="text-foreground text-[13px] leading-[19px]">
                      Enter the 6-digit code we sent to{' '}
                      <Text className="text-foreground font-semibold">{email}</Text>.
                    </Text>
                    <View className="rounded-xl bg-amber-500/15 border border-amber-500/40 px-3 py-2">
                      <Text className="text-amber-200 text-[12px] font-semibold leading-[17px]">
                        Type the 6-digit code from the email here.
                      </Text>
                      <Text className="text-amber-100/90 text-[11.5px] leading-[16px] mt-1">
                        Do NOT click the &quot;Confirm your mail&quot; link in
                        the email — that link redirects to a generic Supabase
                        page and will not finish sign-up inside this app. The
                        code is the 6-digit number in the same email.
                      </Text>
                    </View>
                    <Field label="6-digit code">
                      <TextInput
                        value={otp}
                        onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))}
                        placeholder="123456"
                        placeholderTextColor="#6b7280"
                        keyboardType="number-pad"
                        maxLength={6}
                        className="bg-secondary rounded-xl px-3 py-3 text-foreground text-[16px] tracking-[6px] text-center"
                      />
                    </Field>
                    {lastError ? <ErrorRow message={lastError.message} /> : null}
                    {resendBanner ? (
                      <Text className="text-emerald-300 text-[12px]">{resendBanner}</Text>
                    ) : null}
                    <PrimaryButton
                      onPress={handleVerify}
                      label={busy ? 'Verifying…' : 'Verify & continue'}
                      busy={busy}
                      icon={<ArrowRight color="#ffffff" size={16} />}
                      disabled={otp.length < 6}
                    />
                    <View className="flex-row items-center justify-between mt-1">
                      <Pressable
                        onPress={handleResend}
                        accessibilityRole="button"
                        accessibilityLabel="Resend the code"
                      >
                        <Text className="text-primary text-[12px] font-semibold">
                          {resending ? 'Sending…' : 'Resend code'}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          setMode('sign-in');
                          clearError();
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Back to sign in"
                      >
                        <Text className="text-muted-foreground text-[12px]">
                          Cancel
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}

                <Text className="text-[10.5px] text-muted-foreground mt-4 italic leading-[14px]">
                  Authentication and the community shelter dataset run on
                  Supabase. SafeRoute does not sync home/work/school saved places —
                  those remain on this device only.
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
    <View>
      <Text className="text-muted-foreground text-[11px] mb-1 uppercase tracking-wider">
        {label}
      </Text>
      {children}
    </View>
  );
}

function ErrorRow({ message }: { message: string }) {
  return (
    <View className="rounded-xl bg-destructive/15 border border-destructive/40 px-3 py-2">
      <Text className="text-destructive text-[12px] font-semibold">{message}</Text>
    </View>
  );
}

function PrimaryButton({
  onPress,
  label,
  busy,
  disabled,
  icon,
}: {
  onPress: () => void;
  label: string;
  busy?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      className={cn(
        'mt-1 h-12 rounded-full flex-row items-center justify-center gap-2',
        disabled || busy ? 'bg-primary/50' : 'bg-primary',
      )}
    >
      {busy ? <ActivityIndicator color="#ffffff" /> : icon}
      <Text className="text-primary-foreground text-[14px] font-semibold">{label}</Text>
    </Pressable>
  );
}
