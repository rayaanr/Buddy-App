import type { ActivityDetail } from '@buddy/shared';
import { atLocalTime } from '@buddy/shared';
import { describe, expect, it } from 'vitest';

import { useTestApp } from './harness';

const t = useTestApp();

async function host(title: string) {
  const { headers } = await t.signIn();
  const res = await t.call<ActivityDetail>('/v1/activities', {
    method: 'POST',
    headers,
    body: {
      title,
      group: 'Social',
      startsAt: atLocalTime(1, '18:30').toISOString(),
      place: 'Barefoot Café',
      location: { lat: 6.8985, lng: 79.8555 },
      capacity: 6,
    },
  });
  return { id: res.body.id, headers };
}

describe('share pages', () => {
  it('shows a signed-out preview with Open Graph tags and a link into the app', async () => {
    const { id } = await host('Chess & <b>chai</b>');
    const res = await t.app.request(`/a/${id}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain(
      '<meta property="og:title" content="Chess &amp; &lt;b&gt;chai&lt;/b&gt;">',
    );
    expect(html).toMatch(
      /og:description" content="\w{3} \d+ \w{3}, 18:30 · Barefoot Café, Colombo 3\. 1 of 6 going/,
    );
    expect(html).toContain('og:image');
    expect(html).toContain(`href="buddy://activity/${id}"`);
    expect(html).toContain('Hosted by Kavindu<');
    expect(html).not.toContain('<b>chai');
  });

  it('is a plain 404 for cancelled, unknown or malformed ids', async () => {
    const { id, headers } = await host('Called off');
    await t.call(`/v1/activities/${id}/cancel`, { method: 'POST', headers });
    for (const path of [`/a/${id}`, '/a/00000000-0000-0000-0000-000000000000', '/a/nope']) {
      const res = await t.app.request(path);
      expect(res.status).toBe(404);
      expect(await res.text()).toContain('isn’t available');
    }
  });
});

describe('privacy policy and terms', () => {
  it('are public pages with the contact address', async () => {
    for (const [path, heading] of [
      ['/privacy', 'Privacy policy'],
      ['/terms', 'Terms of use'],
    ] as const) {
      const res = await t.app.request(path);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain(`<h1>${heading}</h1>`);
      expect(html).toContain('mailto:hello@example.com');
      expect(res.headers.get('content-security-policy')).toContain("default-src 'none'");
    }
  });
});
