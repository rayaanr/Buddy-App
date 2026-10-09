import { eq, or, sql, type AnyColumn, type SQL } from 'drizzle-orm';

import type { Db, Tx } from '../../db/client';
import { blocks } from '../../db/schema';

/**
 * Blocking hides people from each other in both directions: neither sees the
 * other's messages, activities or profile. These helpers keep that rule in
 * one place.
 */

/** SQL: true when `viewerId` and the person in `other` have blocked each other (either way). */
export const blockedBetween = (viewerId: string, other: AnyColumn | SQL) =>
  sql`exists (select 1 from blocks b where (b.blocker_id = ${viewerId} and b.blocked_id = ${other}) or (b.blocker_id = ${other} and b.blocked_id = ${viewerId}))`;

export const notBlockedBetween = (viewerId: string, other: AnyColumn | SQL) =>
  sql`not ${blockedBetween(viewerId, other)}`;

/** Everyone `userId` has blocked or been blocked by. */
export async function blockedIds(db: Db | Tx, userId: string) {
  const rows = await db
    .select({ blockerId: blocks.blockerId, blockedId: blocks.blockedId })
    .from(blocks)
    .where(or(eq(blocks.blockerId, userId), eq(blocks.blockedId, userId)));
  return new Set(rows.map((r) => (r.blockerId === userId ? r.blockedId : r.blockerId)));
}
