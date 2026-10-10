import type { Place } from '@buddy/shared';
import { eq, sql } from 'drizzle-orm';

import type { Db, Tx } from '../../db/client';
import type { LatLng } from '../../db/geography';
import { DEFAULT_PLACE_ID, places, profiles } from '../../db/schema';
import { badRequest } from '../../lib/errors';

const columns = {
  id: places.id,
  name: places.name,
  aka: places.aka,
  district: places.district,
  province: places.province,
  location: places.location,
};

/** A places row as the API shows it. */
export const toPlace = (p: typeof places.$inferSelect): Place => ({
  id: p.id,
  name: p.name,
  aka: p.aka,
  district: p.district,
  province: p.province,
  location: p.location,
});

export async function findPlace(db: Db | Tx, id: number): Promise<Place | null> {
  const [row] = await db.select(columns).from(places).where(eq(places.id, id));
  return row ?? null;
}

/** A town id someone sent; 400 if it isn't one. */
export async function requirePlace(db: Db | Tx, id: number) {
  const found = await findPlace(db, id);
  if (!found) throw badRequest('Pick a town from the list');
  return found;
}

/**
 * Towns matching what someone typed, best first: names that start with it,
 * then close spellings ("nugegda" finds Nugegoda), then the shorter name.
 * Also matches other names (Cinnamon Gardens → Colombo 7).
 */
export async function searchPlaces(db: Db | Tx, query: string, limit = 10): Promise<Place[]> {
  const q = query.trim().toLowerCase();
  const name = sql`lower(${places.name})`;
  const aka = sql`lower(coalesce(${places.aka}, ''))`;
  const like = `%${q.replace(/[%_\\]/g, '\\$&')}%`;
  const prefix = `${q.replace(/[%_\\]/g, '\\$&')}%`;
  return db
    .select(columns)
    .from(places)
    .where(sql`${name} like ${like} or ${aka} like ${like} or ${name} % ${q} or ${aka} % ${q}`)
    .orderBy(
      sql`(${name} like ${prefix} or ${aka} like ${prefix}) desc`,
      sql`greatest(similarity(${name}, ${q}), similarity(${aka}, ${q})) desc`,
      sql`length(${places.name})`,
    )
    .limit(limit);
}

/** How far a well-known town can be and still be preferred over a closer village. */
const MAIN_TOWN_M = 5000;

/**
 * The town to name a point by (your phone's location, a venue): the nearest
 * town with a main post office within 5 km, so people see names they know,
 * else the nearest place with reliable coordinates.
 */
export async function nearestPlace(db: Db | Tx, at: LatLng): Promise<Place> {
  const point = sql`ST_SetSRID(ST_MakePoint(${at.lng}, ${at.lat}), 4326)::geography`;
  const [row] = await db
    .select(columns)
    .from(places)
    .where(eq(places.approximate, false))
    .orderBy(
      sql`(${places.main} and ST_DWithin(${places.location}, ${point}, ${MAIN_TOWN_M})) desc`,
      sql`${places.location} <-> ${point}`,
    )
    .limit(1);
  return row!;
}

/** Someone's home town. */
export async function homePlace(db: Db | Tx, userId: string): Promise<Place> {
  const [row] = await db
    .select(columns)
    .from(profiles)
    .innerJoin(places, eq(places.id, profiles.placeId))
    .where(eq(profiles.userId, userId));
  return row ?? (await findPlace(db, DEFAULT_PLACE_ID))!;
}

/**
 * Where to measure distances from: an explicit point (where you are now),
 * else a town you're browsing, else your home town's centre.
 */
export async function originFor(
  db: Db | Tx,
  userId: string,
  explicit?: Partial<LatLng> & { placeId?: number },
): Promise<LatLng> {
  if (explicit?.lat !== undefined && explicit.lng !== undefined) {
    return { lat: explicit.lat, lng: explicit.lng };
  }
  if (explicit?.placeId !== undefined) return (await requirePlace(db, explicit.placeId)).location;
  return (await homePlace(db, userId)).location;
}
