import { placeSearchQuery, pointQuery, venueSearchQuery } from '@buddy/shared';
import { Hono } from 'hono';

import { currentUser, requireUser } from '../../auth/middleware';
import type { AppEnv, Deps } from '../../http/context';
import { validate } from '../../lib/validate';
import { homePlace, nearestPlace, searchPlaces } from '../profiles/service';

/** Towns across Sri Lanka. Public: sign-up asks for a home town before there's an account. */
export function placeRoutes({ db }: Deps) {
  return (
    new Hono<AppEnv>()
      // "Kan…" → Kandy, Kantale, …; close spellings and other names match too.
      .get('/search', validate('query', placeSearchQuery), async (c) =>
        c.json({ places: await searchPlaces(db, c.req.valid('query').q) }),
      )
      // "Use my current location": the town nearest the phone.
      .get('/nearest', validate('query', pointQuery), async (c) =>
        c.json(await nearestPlace(db, c.req.valid('query'))),
      )
  );
}

/**
 * Meeting points for activities, from the configured provider (OpenStreetMap
 * or Google; see lib/venues.ts). Signed-in only, to protect the provider's quota.
 */
export function venueRoutes({ db, venues }: Deps) {
  return new Hono<AppEnv>()
    .use(requireUser)
    .get('/search', validate('query', venueSearchQuery), async (c) => {
      const { q, lat, lng } = c.req.valid('query');
      const near =
        lat !== undefined && lng !== undefined
          ? { lat, lng }
          : (await homePlace(db, currentUser(c).id)).location;
      return c.json(await venues.search(q, near));
    });
}
