import { create } from 'zustand';

const TOAST_MS = 2200;

interface Typing {
  activityId: string;
  from: string;
}

interface UiState {
  toast: { id: number; message: string } | null;
  typing: Typing | null;
  /** When true, the app shell opens the "Picked for you" deck on next render. */
  picksPending: boolean;
  showToast: (message: string) => void;
  setTyping: (typing: Typing | null) => void;
  requestPicks: () => void;
  consumePicks: () => boolean;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useUiStore = create<UiState>()((set, get) => ({
  toast: null,
  typing: null,
  picksPending: false,
  showToast: (message) => {
    clearTimeout(toastTimer);
    set({ toast: { id: Date.now(), message } });
    toastTimer = setTimeout(() => set({ toast: null }), TOAST_MS);
  },
  setTyping: (typing) => set({ typing }),
  requestPicks: () => set({ picksPending: true }),
  consumePicks: () => {
    const pending = get().picksPending;
    if (pending) set({ picksPending: false });
    return pending;
  },
}));

/** Imperative helper for use outside React components. */
export const toast = (message: string) => useUiStore.getState().showToast(message);
