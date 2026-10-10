import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { persistStorage } from './storage';

/** What the sign-in screen shows while signed out (the server can't personalise it then). */
export interface PicksPreview {
  count: number;
  cards: { coverUrl: string | null; group: string; title: string; startsAt: string }[];
}

export interface RememberedAccount {
  email: string;
  name: string;
  /** Home town as shown, e.g. "Peradeniya, Kandy". */
  area: string;
  picks?: PicksPreview;
}

interface AccountState {
  /** The last account used on this device, for "Continue as Kavindu". */
  remembered: RememberedAccount | null;
  /** Details typed on Sign up, applied once the emailed code is confirmed. */
  pendingSignUp: { name: string; email: string; placeId: number; area: string } | null;

  remember: (account: Omit<RememberedAccount, 'picks'>) => void;
  rememberPicks: (picks: PicksPreview) => void;
  forget: () => void;
  setPendingSignUp: (details: AccountState['pendingSignUp']) => void;
}

export const useAccountStore = create<AccountState>()(
  persist(
    (set) => ({
      remembered: null,
      pendingSignUp: null,
      remember: (account) =>
        set((s) => ({
          remembered: {
            ...account,
            picks: s.remembered?.email === account.email ? s.remembered.picks : undefined,
          },
        })),
      rememberPicks: (picks) =>
        set((s) => (s.remembered ? { remembered: { ...s.remembered, picks } } : {})),
      forget: () => set({ remembered: null, pendingSignUp: null }),
      setPendingSignUp: (pendingSignUp) => set({ pendingSignUp }),
    }),
    {
      name: 'buddy-account',
      version: 2,
      storage: persistStorage,
      partialize: ({ remembered }) => ({ remembered }),
      // Version 1 stored the whole mock session; start fresh.
      migrate: () => ({ remembered: null }),
    },
  ),
);
