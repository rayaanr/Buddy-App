import type { Me, UploadTicket } from '@buddy/shared';
import { describe, expect, it } from 'vitest';

import { loadEnv } from '../src/env';
import { createStorage } from '../src/lib/storage';
import { memoryStorage, useTestApp } from './harness';

describe('R2 presigned uploads', () => {
  const env = loadEnv({
    NODE_ENV: 'test',
    DATABASE_URL: 'postgres://localhost/unused',
    BETTER_AUTH_URL: 'http://localhost:7400',
    BETTER_AUTH_SECRET: 'test-secret-test-secret-test-secret-123',
    R2_ACCOUNT_ID: 'acct123',
    R2_ACCESS_KEY_ID: 'AKIDEXAMPLE',
    R2_SECRET_ACCESS_KEY: 'secret',
    R2_BUCKET: 'buddy-media',
    R2_PUBLIC_URL: 'https://media.example.com',
  });

  it('is disabled until every R2 setting is present', () => {
    expect(createStorage({ ...env, R2_BUCKET: undefined })).toBeNull();
    expect(createStorage(env)).not.toBeNull();
  });

  it('signs the content type and exact size into a short-lived URL', async () => {
    const put = await createStorage(env)!.presignPut('avatars/u1/a.jpg', 'image/jpeg', 1234);
    const url = new URL(put.url);
    expect(url.host).toBe('acct123.r2.cloudflarestorage.com');
    expect(url.pathname).toBe('/buddy-media/avatars/u1/a.jpg');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('300');
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe('content-length;content-type;host');
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
    expect(put.headers).toEqual({ 'content-type': 'image/jpeg', 'content-length': '1234' });
  });
});

describe('POST /v1/uploads without R2', () => {
  const t = useTestApp({ storage: null });

  it('answers 503 so the app can hide photo pickers', async () => {
    const { headers } = await t.signIn();
    const res = await t.call('/v1/uploads', {
      method: 'POST',
      headers,
      body: { kind: 'avatar', contentType: 'image/jpeg', size: 1000 },
    });
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ error: { code: 'uploads_disabled' } });
  });
});

describe('POST /v1/uploads with storage', () => {
  const r2 = memoryStorage();
  const t = useTestApp({
    storage: r2.storage,
    env: { R2_PUBLIC_URL: 'https://media.example.com' },
  });
  const ticket = async (headers: Record<string, string>, contentType = 'image/png') =>
    t.call<UploadTicket>('/v1/uploads', {
      method: 'POST',
      headers,
      body: { kind: 'avatar', contentType, size: 2048 },
    });

  it('issues a per-user key that can then be set as the avatar', async () => {
    const { headers, userId } = await t.signIn();
    const res = await ticket(headers);
    expect(res.status).toBe(201);
    expect(res.body.key).toMatch(new RegExp(`^avatars/${userId}/[0-9a-f-]{36}\\.png$`));
    r2.upload(res.body.key, 'image/png');

    const me = await t.call<Me>('/v1/me', {
      method: 'PATCH',
      headers,
      body: { avatarKey: res.body.key },
    });
    expect(me.body.avatarUrl).toBe(`https://media.example.com/${res.body.key}`);
  });

  it('refuses a key whose upload never happened', async () => {
    const { headers } = await t.signIn();
    const res = await ticket(headers);
    const me = await t.call('/v1/me', {
      method: 'PATCH',
      headers,
      body: { avatarKey: res.body.key },
    });
    expect(me.status).toBe(400);
  });

  it('refuses a key where something other than an image was stored', async () => {
    const { headers } = await t.signIn();
    const res = await ticket(headers);
    r2.upload(res.body.key, 'text/html');
    const me = await t.call('/v1/me', {
      method: 'PATCH',
      headers,
      body: { avatarKey: res.body.key },
    });
    expect(me.status).toBe(400);
  });

  it('rejects oversized files and non-image types', async () => {
    const { headers } = await t.signIn();
    const big = await t.call('/v1/uploads', {
      method: 'POST',
      headers,
      body: { kind: 'cover', contentType: 'image/jpeg', size: 6 * 1024 * 1024 },
    });
    expect(big.status).toBe(400);
    const gif = await t.call('/v1/uploads', {
      method: 'POST',
      headers,
      body: { kind: 'cover', contentType: 'image/gif', size: 1000 },
    });
    expect(gif.status).toBe(400);
  });
});
