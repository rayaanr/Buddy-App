import { randomUUID } from 'node:crypto';

import { sql } from 'drizzle-orm';

import type { Db, Tx } from '../../db/client';
import { messages } from '../../db/schema';

/** Adds a system line such as "Kavindu joined" to an activity's chat. */
export async function insertSystemMessage(db: Db | Tx, activityId: string, body: string) {
  const [row] = await db
    .insert(messages)
    // The real clock, not now(): one transaction can add several lines
    // ("Ashan left", "Kavindu joined from the waitlist") that must stay in order.
    .values({
      id: randomUUID(),
      activityId,
      senderId: null,
      kind: 'system',
      body,
      createdAt: sql`clock_timestamp()`,
    })
    .returning();
  return row!;
}
