import { create } from 'zustand';

const TOAST_MS = 2200;

interface UiState {
  toast: { id: number; message: string } | null;
  /** When true, the app shell opens the "Picked for you" deck on next render. */
  picksPending: boolean;
  showToast: (message: string) => void;
  requestPicks: () => void;
  consumePicks: () => boolean;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useUiStore = create<UiState>()((set, get) => ({
  toast: null,
  picksPending: false,
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
}));

/** Imperative helper for use outside React components. */
export const toast = (message: string) => useUiStore.getState().showToast(message);
