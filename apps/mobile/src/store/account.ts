import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { persistStorage } from './storage';

/** What the sign-in screen shows while signed out (the server can't personalise it then). */
export interface PicksPreview {
  count: number;
  cards: { coverUrl: string | null; group: string; title: string; startsAt: string }[];
}

interface RememberedAccount {
  email: string;
  name: string;
  /** Home town as shown, e.g. "Peradeniya, Kandy". */
  area: string;
  picks?: PicksPreview;
}

interface AccountState {
  /** The last account used on this device, for "Continue as Kavindu". */
  remembered: RememberedAccount | null;
  /** The email just entered on Sign up, so the code screen knows it's a new account. */
  pendingSignUp: { email: string } | null;

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
      // pendingSignUp too: the app may restart while the person fetches their code.
      partialize: ({ remembered, pendingSignUp }) => ({ remembered, pendingSignUp }),
      // Version 1 stored the whole mock session; start fresh.
      migrate: () => ({ remembered: null, pendingSignUp: null }),
    },
  ),
);
