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

/** setTimeout fires at once beyond this (~24.8 days), so long waits go in steps. */
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

/**
 * True once `iso` is in the past. Re-renders exactly once, when that moment
 * arrives, instead of ticking every few seconds like useNow.
 */
export function useHasPassed(iso: string) {
  const at = new Date(iso).getTime();
  const [passedAt, setPassedAt] = useState<number | null>(() => (Date.now() >= at ? at : null));
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const wait = () => {
      const left = at - Date.now();
      if (left <= 0) setPassedAt(at);
      else timer = setTimeout(wait, Math.min(left, MAX_TIMEOUT_MS));
    };
    // Always from a timer (0 if it's already past), never during the effect.
    timer = setTimeout(wait, Math.max(0, Math.min(at - Date.now(), MAX_TIMEOUT_MS)));
    return () => clearTimeout(timer);
  }, [at]);
  return passedAt === at;
}
