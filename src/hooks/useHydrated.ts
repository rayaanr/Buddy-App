import { useEffect, useState } from 'react';

import { useActivitiesStore } from '@/store/activities';
import { useSessionStore } from '@/store/session';

const stores = [useSessionStore, useActivitiesStore];

/** True once every persisted store has finished loading from AsyncStorage. */
export function useHydrated() {
  const [hydrated, setHydrated] = useState(() => stores.every((s) => s.persist.hasHydrated()));

  useEffect(() => {
    const check = () => setHydrated(stores.every((s) => s.persist.hasHydrated()));
    const unsubs = stores.map((s) => s.persist.onFinishHydration(check));
    check();
    return () => unsubs.forEach((u) => u());
  }, []);

  return hydrated;
}
