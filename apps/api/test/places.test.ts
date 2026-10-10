import type { Place, Venue } from '@buddy/shared';
import { describe, expect, it, vi } from 'vitest';

import { loadEnv } from '../src/env';
import { createVenueSearch, googleProvider, photonProvider } from '../src/lib/venues';
import { useTestApp } from './harness';

const searched: { q: string; near?: { lat: number; lng: number } }[] = [];
const t = useTestApp({
  venues: {
    async search(q, near) {
      searched.push({ q, near });
      return {
        venues: [{ name: 'Barefoot Café', address: 'Galle Road, Colombo 3', location: near! }],
        attribution: '© OpenStreetMap contributors',
      };
    },
  },
});

async function search(q: string) {
  const res = await t.app.request(`/v1/places/search?q=${encodeURIComponent(q)}`);
  const body = (await res.json()) as { places: Place[] };
  return { status: res.status, names: body.places.map((p) => p.name) };
}

describe('towns', () => {
  it('searches without signing in: prefixes first, close spellings, other names', async () => {
    const kan = await search('kan');
    expect(kan.status).toBe(200);
    expect(kan.names[0]).toMatch(/^Kan/);
    expect(kan.names).toContain('Kandy');
    expect((await search('nugegda')).names[0]).toBe('Nugegoda');
    expect((await search('Cinnamon Gardens')).names[0]).toBe('Colombo 7');
    expect((await search('jaff')).names[0]).toBe('Jaffna');
  });

  it('finds the town nearest a point', async () => {
    const res = await t.app.request('/v1/places/nearest?lat=7.2906&lng=80.6337');
    expect(await res.json()).toMatchObject({ name: 'Kandy', district: 'Kandy' });
  });
});

describe('venues', () => {
  it('needs signing in, and biases towards your home town unless given a point', async () => {
    expect((await t.app.request('/v1/venues/search?q=cafe')).status).toBe(401);
    searched.length = 0;
    const { headers } = await t.signIn(); // Kavindu lives in Colombo 7
    const home = await t.call<{ venues: Venue[]; attribution: string }>(
      '/v1/venues/search?q=barefoot',
      { headers },
    );
    expect(home.body).toMatchObject({
      venues: [{ name: 'Barefoot Café' }],
      attribution: '© OpenStreetMap contributors',
    });
    await t.call('/v1/venues/search?q=barefoot&lat=7.29&lng=80.63', { headers });
    expect(searched[0]!.near!.lat).toBeCloseTo(6.9117, 3);
    expect(searched[1]!.near).toEqual({ lat: 7.29, lng: 80.63 });
  });
});

describe('venue providers', () => {
  const json = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body)));

  it('reads OpenStreetMap (Photon) results and keeps Sri Lanka only', async () => {
    const fetcher = vi.fn((_url: URL | string, _init?: RequestInit) =>
      json({
        features: [
          {
            geometry: { coordinates: [79.8555, 6.8985] },
            properties: {
              name: 'Barefoot Café',
              housenumber: '704',
              street: 'Galle Road',
              locality: 'Kollupitiya',
              city: 'Colombo',
              countrycode: 'LK',
            },
          },
          {
            geometry: { coordinates: [77.6, 12.9] },
            properties: { name: 'Elsewhere', countrycode: 'IN' },
          },
        ],
      }),
    );
    const venues = await photonProvider('https://photon.example', fetcher as typeof fetch).search(
      'barefoot',
      { lat: 6.9, lng: 79.86 },
    );
    expect(venues).toEqual([
      {
        name: 'Barefoot Café',
        address: '704 Galle Road, Kollupitiya, Colombo',
        location: { lat: 6.8985, lng: 79.8555 },
      },
    ]);
    const url = new URL(String(fetcher.mock.calls[0]![0]));
    expect(url.origin + url.pathname).toBe('https://photon.example/api');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      q: 'barefoot',
      lat: '6.9',
      lon: '79.86',
    });
  });

  it('reads Google Places results, with the key and a cheap field mask', async () => {
    const fetcher = vi.fn((_url: URL | string, _init?: RequestInit) =>
      json({
        places: [
          {
            displayName: { text: 'Barefoot Café' },
            formattedAddress: '704 Galle Rd, Colombo 00300, Sri Lanka',
            location: { latitude: 6.8985, longitude: 79.8555 },
          },
        ],
      }),
    );
    const venues = await googleProvider('key-123', fetcher as typeof fetch).search('barefoot');
    expect(venues).toEqual([
      {
        name: 'Barefoot Café',
        address: '704 Galle Rd, Colombo 00300',
        location: { lat: 6.8985, lng: 79.8555 },
      },
    ]);
    const init = fetcher.mock.calls[0]![1]!;
    expect(init.headers).toMatchObject({
      'x-goog-api-key': 'key-123',
      'x-goog-fieldmask': 'places.displayName,places.formattedAddress,places.location',
    });
    expect(JSON.parse(String(init.body))).toMatchObject({
      textQuery: 'barefoot',
      regionCode: 'LK',
    });
  });

  it('falls back to towns when the provider is down', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline'))),
    );
    try {
      const env = loadEnv({
        DATABASE_URL: 'postgres://unused',
        BETTER_AUTH_URL: 'http://localhost:7400',
        BETTER_AUTH_SECRET: 'test-secret-test-secret-test-secret-123',
        VENUE_PROVIDER: 'osm',
      });
      const results = await createVenueSearch(env, t.deps.db, t.deps.logger).search('kandy');
      expect(results.venues[0]).toMatchObject({ name: 'Kandy' });
      expect(results.attribution).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('needs a Google key when Google is chosen', () => {
    expect(() =>
      loadEnv({
        DATABASE_URL: 'postgres://unused',
        BETTER_AUTH_URL: 'http://localhost:7400',
        BETTER_AUTH_SECRET: 'test-secret-test-secret-test-secret-123',
        VENUE_PROVIDER: 'google',
      }),
    ).toThrow(/GOOGLE_PLACES_API_KEY/);
  });
});
