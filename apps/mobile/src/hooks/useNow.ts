import { useEffect, useState } from 'react';

/** The current time, refreshed every `intervalMs` (render-safe, unlike calling Date.now()). */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
