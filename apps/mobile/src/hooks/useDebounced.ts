import { useEffect, useState } from 'react';

/** `value`, once it has stopped changing for `ms` (e.g. search-as-you-type). */
export function useDebounced<T>(value: T, ms = 300) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
}
