import { useSyncExternalStore } from 'react';

import { useAccountStore } from '@/store/account';

const subscribe = (onChange: () => void) => useAccountStore.persist.onFinishHydration(onChange);
const getSnapshot = () => useAccountStore.persist.hasHydrated();

/** True once the remembered account has loaded from device storage. */
export function useHydrated() {
  return useSyncExternalStore(subscribe, getSnapshot);
}
