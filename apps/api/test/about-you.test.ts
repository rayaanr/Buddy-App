import type { Me, PublicProfile } from '@buddy/shared';
import { latestBirthYear } from '@buddy/shared';
import { describe, expect, it } from 'vitest';

import { useTestApp } from './harness';

const t = useTestApp();

const patchMe = (headers: Record<string, string>, body: object) =>
  t.call<Me>('/v1/me', { method: 'PATCH', headers, body });

describe('gender and birth year', () => {
  it('saves them privately, and only for adults', async () => {
    const me = await t.signIn('new@buddy.test', 'Nimal');
    const res = await patchMe(me.headers, { gender: 'woman', birthYear: 1996 });
    expect(res.body).toMatchObject({ gender: 'woman', birthYear: 1996 });

    const tooYoung = await patchMe(me.headers, { birthYear: latestBirthYear() + 1 });
    expect(tooYoung.status).toBe(400);
    expect((await patchMe(me.headers, { gender: 'other' })).status).toBe(400);

    // Never on the public profile.
    const other = await t.signIn('other@buddy.test', 'Ashan');
    const profile = await t.call<PublicProfile>(`/v1/users/${me.userId}`, {
      headers: other.headers,
    });
    expect(profile.body).not.toHaveProperty('gender');
    expect(profile.body).not.toHaveProperty('birthYear');
  });
});
