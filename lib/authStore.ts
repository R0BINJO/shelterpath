/*
 * SafeRoute Varjumine — Auth store (Supabase email + 6-digit OTP).
 *
 * Supabase Auth uses 6-digit email codes (NOT magic-link redirects).
 *
 * Flow:
 *   1. signUp({ email, password, displayName }) → sends a 'signup' OTP code.
 *   2. verifySignupOtp({ email, token }) → confirms; creates a profile row.
 *   3. signIn({ email, password }) → standard email/password login.
 *   4. signOut() → clears the local session.
 *
 * Session is persisted to AsyncStorage by the Supabase client (configured in
 * lib/supabase.ts). On startup, authStore reloads it via getSession() and
 * subscribes to onAuthStateChange so the UI tracks live status.
 */

import { create } from 'zustand';

import { supabase, type ProfileRow } from './supabase';

export type AuthStatus =
  | 'loading'          // initial getSession()
  | 'signed-out'
  | 'awaiting-otp'     // signUp returned; user must enter the email code
  | 'signed-in';

export type AuthError =
  | { code: 'network'; message: string }
  | { code: 'invalid'; message: string }
  | { code: 'duplicate'; message: string }
  | { code: 'unknown'; message: string };

type AuthState = {
  status: AuthStatus;
  userId: string | null;
  email: string | null;
  displayName: string | null;
  pendingSignup: { email: string; displayName: string; password: string } | null;
  lastError: AuthError | null;

  init: () => Promise<void>;
  signUp: (input: { email: string; password: string; displayName: string }) => Promise<void>;
  verifySignupOtp: (input: { email: string; token: string }) => Promise<void>;
  resendSignupOtp: (email: string) => Promise<void>;
  signIn: (input: { email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  clearError: () => void;
};

let authSubscriptionAttached = false;

function toAuthError(e: unknown): AuthError {
  const msg = e instanceof Error ? e.message : String(e);
  const lower = msg.toLowerCase();
  if (lower.includes('network') || lower.includes('failed to fetch')) {
    return { code: 'network', message: 'No internet. Account features need a connection.' };
  }
  if (lower.includes('already') || lower.includes('registered')) {
    return { code: 'duplicate', message: 'That email is already registered.' };
  }
  if (
    lower.includes('invalid') ||
    lower.includes('token') ||
    lower.includes('expired') ||
    lower.includes('credentials')
  ) {
    return { code: 'invalid', message: msg };
  }
  return { code: 'unknown', message: msg };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'loading',
  userId: null,
  email: null,
  displayName: null,
  pendingSignup: null,
  lastError: null,

  init: async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (session?.user) {
        set({
          status: 'signed-in',
          userId: session.user.id,
          email: session.user.email ?? null,
        });
        await get().refreshProfile();
      } else {
        set({ status: 'signed-out' });
      }
    } catch {
      set({ status: 'signed-out' });
    }

    if (!authSubscriptionAttached) {
      authSubscriptionAttached = true;
      supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          set({
            status: 'signed-in',
            userId: session.user.id,
            email: session.user.email ?? null,
            lastError: null,
          });
          void get().refreshProfile();
        } else {
          set({
            status: 'signed-out',
            userId: null,
            email: null,
            displayName: null,
          });
        }
      });
    }
  },

  signUp: async ({ email, password, displayName }) => {
    set({ lastError: null });
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      set({
        status: 'awaiting-otp',
        pendingSignup: { email, password, displayName },
      });
    } catch (e) {
      set({ lastError: toAuthError(e) });
      throw e;
    }
  },

  verifySignupOtp: async ({ email, token }) => {
    set({ lastError: null });
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'signup',
      });
      if (error) throw error;
      const user = data.user;
      if (!user) throw new Error('Verification did not return a user.');

      const pending = get().pendingSignup;
      const displayName = pending?.displayName ?? (user.email ?? 'SafeRoute user').split('@')[0];

      // Best-effort profile insert. RLS allows insert only as self.
      try {
        await supabase.from('profiles').upsert(
          { id: user.id, display_name: displayName },
          { onConflict: 'id' },
        );
      } catch {
        // Profile insert is non-fatal — submissions still work, the row just
        // doesn't have a display name yet (community sheet falls back to "Community member").
      }

      set({
        status: 'signed-in',
        userId: user.id,
        email: user.email ?? null,
        displayName,
        pendingSignup: null,
      });
    } catch (e) {
      set({ lastError: toAuthError(e) });
      throw e;
    }
  },

  resendSignupOtp: async (email) => {
    set({ lastError: null });
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email });
      if (error) throw error;
    } catch (e) {
      set({ lastError: toAuthError(e) });
      throw e;
    }
  },

  signIn: async ({ email, password }) => {
    set({ lastError: null });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const user = data.user;
      if (!user) throw new Error('Sign-in did not return a user.');
      set({
        status: 'signed-in',
        userId: user.id,
        email: user.email ?? null,
        pendingSignup: null,
      });
      await get().refreshProfile();
    } catch (e) {
      set({ lastError: toAuthError(e) });
      throw e;
    }
  },

  signOut: async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore: status will reset regardless via onAuthStateChange or below
    }
    set({
      status: 'signed-out',
      userId: null,
      email: null,
      displayName: null,
      pendingSignup: null,
      lastError: null,
    });
  },

  refreshProfile: async () => {
    const { userId } = get();
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, created_at')
        .eq('id', userId)
        .maybeSingle<ProfileRow>();
      if (error) return;
      if (data) {
        set({ displayName: data.display_name });
      }
    } catch {
      // ignore — display name falls back to "Community member"
    }
  },

  clearError: () => set({ lastError: null }),
}));
