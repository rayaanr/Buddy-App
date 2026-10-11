import type { Env } from '../env';
import { createFallbacks } from './fallbacks';

/** Turns stored image references into public URLs. */
export function createUrls(env: Pick<Env, 'R2_PUBLIC_URL' | 'BETTER_AUTH_URL'>) {
  const fromKey = (key: string | null | undefined) =>
    key && env.R2_PUBLIC_URL ? `${env.R2_PUBLIC_URL}/${key}` : null;

  return {
    fromKey,
    /** Buddy's own pictures, for anything without a photo. */
    art: createFallbacks(env.BETTER_AUTH_URL.replace(/\/$/, '')),
    /** An uploaded avatar wins over an external one (seed data). */
    avatar: (key: string | null | undefined, external: string | null | undefined) =>
      fromKey(key) ?? external ?? null,
  };
}

export type Urls = ReturnType<typeof createUrls>;
