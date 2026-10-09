import { AREAS, DEFAULT_AREA, type Area } from '@buddy/shared';
import { eq } from 'drizzle-orm';

import type { Db, Tx } from '../../db/client';
import type { LatLng } from '../../db/geography';
import { profiles } from '../../db/schema';

export const areaCentre = (area: string): LatLng =>
  area in AREAS ? AREAS[area as Area] : AREAS[DEFAULT_AREA];

/** Where to measure distances from: the explicit point, else the user's home area. */
export async function originFor(db: Db | Tx, userId: string, explicit?: Partial<LatLng>) {
  if (explicit?.lat !== undefined && explicit.lng !== undefined) {
    return { lat: explicit.lat, lng: explicit.lng };
  }
  const [row] = await db
    .select({ area: profiles.area })
    .from(profiles)
    .where(eq(profiles.userId, userId));
  return areaCentre(row?.area ?? DEFAULT_AREA);
}
