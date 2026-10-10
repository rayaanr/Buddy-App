import { placeLabel, type Venue } from '@buddy/shared';

import type { Db } from '../db/client';
import type { LatLng } from '../db/geography';
import type { Env } from '../env';
import type { Logger } from '../logger';
import { searchPlaces } from '../modules/profiles/service';

/**
 * Venue search for meeting points. Pick the backend with VENUE_PROVIDER:
 * - `osm` (default): OpenStreetMap through Photon, built for search-as-you-type.
 *   Uses the public photon.komoot.io unless PHOTON_URL points at your own.
 * - `google`: Google Places API (New) Text Search; needs GOOGLE_PLACES_API_KEY.
 * - `towns`: the towns list only (offline; also the fallback when the others fail).
 * Adding another means one more `search` function returning Venue[].
 */
export interface VenueProvider {
  search(query: string, near?: LatLng): Promise<Venue[]>;
  /** Credit the provider's terms require next to its results (null: none needed). */
  attribution: string | null;
}

export interface VenueResults {
  venues: Venue[];
  attribution: string | null;
}

/** Sri Lanka, as [west, south, east, north]. */
const LK_BBOX = [79.5, 5.85, 81.95, 9.9] as const;
const LIMIT = 8;
const TIMEOUT_MS = 4000;

const inSriLanka = ({ lat, lng }: LatLng) =>
  lng >= LK_BBOX[0] && lng <= LK_BBOX[2] && lat >= LK_BBOX[1] && lat <= LK_BBOX[3];

const joinParts = (parts: (string | undefined | null)[]) =>
  [...new Set(parts.filter((p): p is string => !!p && p.trim() !== ''))].join(', ');

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    housenumber?: string;
    street?: string;
    locality?: string;
    district?: string;
    city?: string;
    county?: string;
    countrycode?: string;
  };
}

export function photonProvider(baseUrl: string, fetcher = fetch): VenueProvider {
  return {
    // OpenStreetMap data is ODbL: credit it wherever it's shown.
    attribution: '© OpenStreetMap contributors',
    async search(query, near) {
      const url = new URL('/api', baseUrl);
      url.searchParams.set('q', query);
      url.searchParams.set('limit', String(LIMIT));
      url.searchParams.set('lang', 'en');
      url.searchParams.set('bbox', LK_BBOX.join(','));
      if (near) {
        url.searchParams.set('lat', String(near.lat));
        url.searchParams.set('lon', String(near.lng));
      }
      const res = await fetcher(url, {
        headers: { 'user-agent': 'Buddy (activities app)' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`Photon answered ${res.status}`);
      const { features } = (await res.json()) as { features: PhotonFeature[] };
      return features
        .filter((f) => f.properties.countrycode === 'LK' && f.properties.name)
        .map((f) => {
          const p = f.properties;
          const [lng, lat] = f.geometry.coordinates;
          return {
            name: p.name!,
            address: joinParts([
              joinParts([p.housenumber, p.street]).replace(', ', ' '),
              p.locality ?? p.district,
              p.city ?? p.county,
            ]),
            location: { lat, lng },
          };
        });
    },
  };
}

interface GooglePlace {
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
}

/** Google Places API (New), Text Search. Billed per request beyond Google's free tier. */
export function googleProvider(apiKey: string, fetcher = fetch): VenueProvider {
  return {
    // Google's Places terms require this next to results shown without a Google map.
    attribution: 'Powered by Google',
    async search(query, near) {
      const res = await fetcher('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': apiKey,
          // Only what we show; also keeps it in the cheapest billing tier.
          'x-goog-fieldmask': 'places.displayName,places.formattedAddress,places.location',
        },
        body: JSON.stringify({
          textQuery: query,
          regionCode: 'LK',
          maxResultCount: LIMIT,
          ...(near && {
            locationBias: {
              circle: { center: { latitude: near.lat, longitude: near.lng }, radius: 50_000 },
            },
          }),
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`Google Places answered ${res.status}`);
      const { places = [] } = (await res.json()) as { places?: GooglePlace[] };
      return places
        .filter((p) => p.displayName?.text && p.location)
        .map((p) => ({
          name: p.displayName!.text,
          address: (p.formattedAddress ?? '').replace(/, Sri Lanka$/, ''),
          location: { lat: p.location!.latitude, lng: p.location!.longitude },
        }))
        .filter((v) => inSriLanka(v.location));
    },
  };
}

/** Towns only: no outside service. */
export function townsProvider(db: Db): VenueProvider {
  return {
    attribution: null,
    async search(query) {
      const towns = await searchPlaces(db, query, LIMIT);
      return towns.map((t) => ({
        name: t.name,
        address: joinParts([t.aka, placeLabel(t) === t.name ? t.district : placeLabel(t)]),
        location: t.location,
      }));
    },
  };
}

const CACHE_MS = 10 * 60 * 1000;
const CACHE_SIZE = 500;

/**
 * The configured provider, with a short cache (people retype the same
 * things, and the public Photon server asks for fair use) and the towns list
 * as a fallback when the provider is down or unreachable.
 */
export interface VenueSearch {
  search(query: string, near?: LatLng): Promise<VenueResults>;
}

export function createVenueSearch(env: Env, db: Db, logger: Logger): VenueSearch {
  const towns = townsProvider(db);
  const primary =
    env.VENUE_PROVIDER === 'google'
      ? googleProvider(env.GOOGLE_PLACES_API_KEY!)
      : env.VENUE_PROVIDER === 'osm'
        ? photonProvider(env.PHOTON_URL)
        : towns;
  const cache = new Map<string, { at: number; results: VenueResults }>();

  return {
    async search(query, near) {
      // Round the bias point so nearby searches share a cache entry (~1 km).
      const key = `${query.toLowerCase()}|${near ? `${near.lat.toFixed(2)},${near.lng.toFixed(2)}` : ''}`;
      const hit = cache.get(key);
      if (hit && Date.now() - hit.at < CACHE_MS) return hit.results;

      let results: VenueResults;
      try {
        results = { venues: await primary.search(query, near), attribution: primary.attribution };
      } catch (err) {
        if (primary === towns) throw err;
        logger.warn({ err, provider: env.VENUE_PROVIDER }, 'Venue search failed; using towns');
        return { venues: await towns.search(query, near), attribution: null };
      }
      if (cache.size >= CACHE_SIZE) cache.delete(cache.keys().next().value!);
      cache.set(key, { at: Date.now(), results });
      return results;
    },
  };
}
