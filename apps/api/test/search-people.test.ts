import type { PersonResult } from '@buddy/shared';
import { describe, expect, it } from 'vitest';

import { useTestApp } from './harness';

const t = useTestApp();

describe('people search', () => {
  it('finds people you share a community or activity with, not strangers or blocked people', async () => {
    const { headers } = await t.signIn();
    const search = async (q: string) =>
      (
        await t.call<{ people: PersonResult[] }>(`/v1/users/search?q=${encodeURIComponent(q)}`, {
          headers,
        })
      ).body.people;

    // Kavindu is in Colombo Board Gamers with Dilan.
    const dilan = await search('dil');
    expect(dilan.map((p) => p.name)).toContain('Dilan');
    expect(dilan[0]).toMatchObject({ area: expect.any(String) });

    // A brand-new account shares nothing with anyone.
    const stranger = await t.signIn('stranger@buddy.test', 'Zara Stranger');
    expect((await search('Zara')).length).toBe(0);
    expect(
      (
        await t.call<{ people: PersonResult[] }>('/v1/users/search?q=Dilan', {
          headers: stranger.headers,
        })
      ).body.people,
    ).toEqual([]);

    // Blocking hides them.
    await t.call(`/v1/users/${dilan[0]!.id}/block`, { method: 'POST', headers });
    expect((await search('dil')).map((p) => p.name)).not.toContain('Dilan');
    await t.call(`/v1/users/${dilan[0]!.id}/block`, { method: 'DELETE', headers });

    // Too short, and wildcards are literal.
    expect((await t.call('/v1/users/search?q=a', { headers })).status).toBe(400);
    expect(await search('%%')).toEqual([]);
  });
});
