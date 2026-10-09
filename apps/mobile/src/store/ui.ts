import { create } from 'zustand';

const TOAST_MS = 2200;

interface UiState {
  toast: { id: number; message: string } | null;
  /** When true, the app shell opens the "Picked for you" deck on next render. */
  picksPending: boolean;
  /** An activity a link asked for before you were signed in; opened once you are. */
  pendingLink: `/activity/${string}` | null;
  showToast: (message: string) => void;
  requestPicks: () => void;
  consumePicks: () => boolean;
  rememberLink: (path: `/activity/${string}`) => void;
  consumeLink: () => `/activity/${string}` | null;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useUiStore = create<UiState>()((set, get) => ({
  toast: null,
  picksPending: false,
  pendingLink: null,
  showToast: (message) => {
    clearTimeout(toastTimer);
    set({ toast: { id: Date.now(), message } });
    toastTimer = setTimeout(() => set({ toast: null }), TOAST_MS);
  },
  requestPicks: () => set({ picksPending: true }),
  consumePicks: () => {
    const pending = get().picksPending;
    if (pending) set({ picksPending: false });
    return pending;
  },
  rememberLink: (path) => set({ pendingLink: path }),
  consumeLink: () => {
    const path = get().pendingLink;
    if (path) set({ pendingLink: null });
    return path;
  },
}));

/** Imperative helper for use outside React components. */
export const toast = (message: string) => useUiStore.getState().showToast(message);
