import { AwsClient } from 'aws4fetch';

import type { Env } from '../env';

export interface PresignedPut {
  url: string;
  headers: Record<string, string>;
  expiresAt: Date;
}

export interface StoredObject {
  contentType: string;
  size: number;
}

export interface Storage {
  /** A URL the app can PUT exactly one file to, of exactly this type and size. */
  presignPut(key: string, contentType: string, size: number): Promise<PresignedPut>;
  /** What's stored at `key`, or null if nothing was uploaded there. */
  stat(key: string): Promise<StoredObject | null>;
  /** Deletes these objects; missing ones are ignored. */
  remove(keys: string[]): Promise<void>;
}

const UPLOAD_TTL_SECONDS = 5 * 60;

/**
 * Cloudflare R2 through its S3-compatible API. Returns null until every
 * R2_* variable is set, which disables uploads instead of failing at startup.
 */
export function createStorage(env: Env): Storage | null {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL } = env;
  if (
    !R2_ACCOUNT_ID ||
    !R2_ACCESS_KEY_ID ||
    !R2_SECRET_ACCESS_KEY ||
    !R2_BUCKET ||
    !R2_PUBLIC_URL
  ) {
    return null;
  }

  const client = new AwsClient({
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    service: 's3',
    region: 'auto',
  });
  const endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}`;

  return {
    async presignPut(key, contentType, size) {
      const url = new URL(`${endpoint}/${key}`);
      url.searchParams.set('X-Amz-Expires', String(UPLOAD_TTL_SECONDS));
      const headers = { 'content-type': contentType, 'content-length': String(size) };
      const signed = await client.sign(url.toString(), {
        method: 'PUT',
        headers,
        // Sign type and size too (aws4fetch skips them by default), so R2
        // rejects any upload that doesn't match what the API approved.
        aws: { signQuery: true, allHeaders: true },
      });
      return {
        url: signed.url,
        headers,
        expiresAt: new Date(Date.now() + UPLOAD_TTL_SECONDS * 1000),
      };
    },

    async stat(key) {
      const res = await client.fetch(`${endpoint}/${key}`, { method: 'HEAD' });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`R2 HEAD answered ${res.status}`);
      return {
        contentType: res.headers.get('content-type') ?? '',
        size: Number(res.headers.get('content-length') ?? 0),
      };
    },

    async remove(keys) {
      await Promise.all(
        keys.map(async (key) => {
          const res = await client.fetch(`${endpoint}/${key}`, { method: 'DELETE' });
          if (!res.ok && res.status !== 404) throw new Error(`R2 DELETE answered ${res.status}`);
        }),
      );
    },
  };
}
