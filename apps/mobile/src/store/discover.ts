import { DEFAULT_RADIUS_KM } from '@buddy/shared';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { Point } from '@/lib/location';
import { persistStorage } from './storage';

/** Where Discover measures from. */
type DiscoverOrigin =
  | { kind: 'home' }
  /** Where the phone is now (needs location permission). */
  | { kind: 'here' }
  /** A town you're looking at, e.g. before a trip. */
  | { kind: 'town'; id: number; label: string };

interface DiscoverState {
  origin: DiscoverOrigin;
  radiusKm: number;
  /** The phone's last known position (this session only), for `here`. */
  here: Point | null;
  setOrigin: (origin: DiscoverOrigin) => void;
  setRadius: (km: number) => void;
  setHere: (point: Point | null) => void;
}

/** Discover's location and distance; remembered on this device. */
export const useDiscoverStore = create<DiscoverState>()(
  persist(
    (set) => ({
      origin: { kind: 'home' },
      radiusKm: DEFAULT_RADIUS_KM,
      here: null,
      setOrigin: (origin) => set({ origin }),
      setRadius: (radiusKm) => set({ radiusKm }),
      setHere: (here) => set({ here }),
    }),
    {
      name: 'buddy-discover',
      version: 1,
      storage: persistStorage,
      partialize: ({ origin, radiusKm }) => ({ origin, radiusKm }),
    },
  ),
);
