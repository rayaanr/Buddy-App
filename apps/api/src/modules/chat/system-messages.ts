import { randomUUID } from 'node:crypto';

import type { Db, Tx } from '../../db/client';
import { messages } from '../../db/schema';

export const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

/** Adds a system line such as "Kavindu joined" to an activity's chat. */
export async function insertSystemMessage(db: Db | Tx, activityId: string, body: string) {
  const [row] = await db
    .insert(messages)
    .values({ id: randomUUID(), activityId, senderId: null, kind: 'system', body })
    .returning();
  return row!;
}
