import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { DEFAULT_ACCOUNT, DEFAULT_INTERESTS } from '@/data/constants';
import type { Account } from '@/types/models';
import { persistStorage } from './storage';
import { useUiStore } from './ui';

interface SessionState {
  account: Account | null;
  onboarded: boolean;
  signedIn: boolean;
  interests: string[];
  availability: string[];

  createAccount: (name: string, area: string) => void;
  /** "Already on Buddy? Sign in" — with no backend, restore the demo account. */
  restoreAccount: () => void;
  completeOnboarding: (interests: string[], availability: string[]) => void;
  updatePreferences: (interests: string[], availability: string[]) => void;
  updateProfile: (patch: Partial<Account>) => void;
  signIn: () => void;
  signOut: () => void;
  startOver: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      account: null,
      onboarded: false,
      signedIn: false,
      interests: [],
      availability: [],

      createAccount: (name, area) =>
        set({
          account: { name: name.trim(), location: `${area}, Sri Lanka` },
          onboarded: false,
          signedIn: false,
          interests: [],
          availability: [],
        }),
      restoreAccount: () =>
        set((s) => ({
          account: s.account ?? DEFAULT_ACCOUNT,
          onboarded: true,
          signedIn: false,
          interests: s.interests.length ? s.interests : DEFAULT_INTERESTS,
          availability: s.availability.length ? s.availability : ['Weekday evenings'],
        })),
      // First visit lands on Discover; the swipe deck is for returning users only.
      completeOnboarding: (interests, availability) =>
        set({ interests, availability, onboarded: true, signedIn: true }),
      updatePreferences: (interests, availability) => set({ interests, availability }),
      updateProfile: (patch) =>
        set((s) => (s.account ? { account: { ...s.account, ...patch } } : {})),
      signIn: () => {
        set({ signedIn: true });
        useUiStore.getState().requestPicks();
      },
      signOut: () => set({ signedIn: false }),
      startOver: () =>
        set({ account: null, onboarded: false, signedIn: false, interests: [], availability: [] }),
    }),
    {
      name: 'buddy-session',
      version: 1,
      storage: persistStorage,
      partialize: ({ account, onboarded, signedIn, interests, availability }) => ({
        account,
        onboarded,
        signedIn,
        interests,
        availability,
      }),
    },
  ),
);

/** Convenience selector for the signed-in account; screens behind the auth guard can rely on it. */
export const useAccount = () => useSessionStore((s) => s.account ?? DEFAULT_ACCOUNT);
