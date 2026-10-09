import type { Env } from '../env';

/** Turns stored image references into public URLs. */
export function createUrls(env: Pick<Env, 'R2_PUBLIC_URL'>) {
  const fromKey = (key: string | null | undefined) =>
    key && env.R2_PUBLIC_URL ? `${env.R2_PUBLIC_URL}/${key}` : null;

  return {
    fromKey,
    /** An uploaded avatar wins over an external one (seed data). */
    avatar: (key: string | null | undefined, external: string | null | undefined) =>
      fromKey(key) ?? external ?? null,
  };
}

export type Urls = ReturnType<typeof createUrls>;
