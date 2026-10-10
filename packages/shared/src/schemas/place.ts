import { z } from 'zod';

import { location } from './common';

/** A town in Sri Lanka (home towns, browsing, where an activity is). */
export const place = z.object({
  id: z.number().int(),
  name: z.string(),
  /** Another name it goes by, e.g. Colombo 7 is Cinnamon Gardens. */
  aka: z.string().nullable(),
  district: z.string(),
  province: z.string(),
  location,
});
export type Place = z.infer<typeof place>;

/** "Peradeniya, Kandy"; just "Kandy" or "Colombo 7" when the district would repeat it. */
export const placeLabel = (p: Pick<Place, 'name' | 'district'>) =>
  p.name.startsWith(p.district) ? p.name : `${p.name}, ${p.district}`;

export const placeSearchQuery = z.object({ q: z.string().trim().min(1).max(60) });

/** Query-string coordinates (strings, hence coerce). */
export const pointQuery = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

/** A spot to meet at, from venue search (OpenStreetMap, Google, or a town). */
export const venue = z.object({
  name: z.string(),
  /** Street, area and town, as the provider gives it. */
  address: z.string(),
  location,
});
export type Venue = z.infer<typeof venue>;

export const venueSearchQuery = z.object({
  q: z.string().trim().min(2).max(80),
  /** Bias results towards here (e.g. the host's location or home town). */
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});
