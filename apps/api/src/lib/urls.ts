import type { Env } from '../env';
import { createFallbacks } from './fallbacks';

/**
 * Turns stored image references into public URLs. The database never holds
 * our own hosts: uploads are stored as R2 keys (`covers/<user>/<id>.jpg`),
 * Buddy's pictures as paths (`/fallbacks/man-03.svg`), and only images we
 * don't host (e.g. a Google profile photo) as full URLs. Moving storage or
 * the API means changing R2_PUBLIC_URL or BETTER_AUTH_URL, nothing else.
 */
export function createUrls(env: Pick<Env, 'R2_PUBLIC_URL' | 'BETTER_AUTH_URL'>) {
  const apiUrl = env.BETTER_AUTH_URL.replace(/\/$/, '');
  const image = (ref: string | null | undefined) => {
    if (!ref) return null;
    if (/^https?:\/\//.test(ref)) return ref;
    if (ref.startsWith('/')) return `${apiUrl}${ref}`;
    return env.R2_PUBLIC_URL ? `${env.R2_PUBLIC_URL}/${ref}` : null;
  };

  return {
    image,
    /** Buddy's own pictures, for anything without a photo (as stored paths). */
    art: createFallbacks(),
    /** An uploaded avatar wins over any other picture. */
    avatar: (key: string | null | undefined, other: string | null | undefined) =>
      image(key) ?? image(other),
  };
}

export type Urls = ReturnType<typeof createUrls>;
