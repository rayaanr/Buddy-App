import { notificationsQuery } from '@buddy/shared';
import { and, desc, eq, isNull, lt, sql } from 'drizzle-orm';
import { Hono } from 'hono';

import { currentUser, requireUser } from '../../auth/middleware';
import { notifications } from '../../db/schema';
import type { AppEnv, Deps } from '../../http/context';
import { validate } from '../../lib/validate';

/** Kept this long, then cleared out as people open the list. */
const KEEP_DAYS = 60;

/** The bell on Discover: recent notifications, and how many are unread. */
export function notificationRoutes({ db }: Deps) {
  const unread = async (userId: string) => {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
    return row?.n ?? 0;
  };

  return (
    new Hono<AppEnv>()
      .use(requireUser)
      .get('/', validate('query', notificationsQuery), async (c) => {
        const me = currentUser(c);
        const { before, limit } = c.req.valid('query');
        await db
          .delete(notifications)
          .where(
            and(
              eq(notifications.userId, me.id),
              sql`${notifications.createdAt} < now() - make_interval(days => ${KEEP_DAYS})`,
            ),
          );
        const rows = await db
          .select()
          .from(notifications)
          .where(
            and(
              eq(notifications.userId, me.id),
              before ? lt(notifications.createdAt, new Date(before)) : undefined,
            ),
          )
          .orderBy(desc(notifications.createdAt))
          .limit(limit);
        return c.json({
          notifications: rows.map((n) => ({
            id: n.id,
            kind: n.kind,
            title: n.title,
            body: n.body,
            data: n.data,
            read: n.readAt !== null,
            createdAt: n.createdAt.toISOString(),
          })),
          unread: await unread(me.id),
        });
      })
      .get('/unread', async (c) => c.json({ unread: await unread(currentUser(c).id) }))
      // Opening the list marks everything read.
      .post('/read', async (c) => {
        await db
          .update(notifications)
          .set({ readAt: sql`now()` })
          .where(and(eq(notifications.userId, currentUser(c).id), isNull(notifications.readAt)));
        return c.json({ unread: 0 });
      })
  );
}
