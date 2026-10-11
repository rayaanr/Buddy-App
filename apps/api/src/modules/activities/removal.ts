import type { RemovalReason } from '@buddy/shared';
import { and, eq, gt, isNull, or, sql } from 'drizzle-orm';

import { activities, activityMembers, activityWaitlist } from '../../db/schema';
import type { Deps } from '../../http/context';
import { HttpError } from '../../lib/errors';
import { createAnnouncer } from './announce';
import { removeGuest } from './service';

/**
 * Takes a guest (going or waiting) out of an activity and keeps them out,
 * then does what follows: chat lines and spots for the waitlist, their chat
 * closed, and a notification telling them.
 */
export function createRemover(deps: Pick<Deps, 'db' | 'hub' | 'push' | 'urls' | 'logger'>) {
  const { db, hub, push } = deps;
  const announce = createAnnouncer(deps as Deps);
  return async (
    host: { id: string; name: string },
    activityId: string,
    userId: string,
    reason: RemovalReason,
  ) => {
    const result = await removeGuest(db, host, activityId, userId, reason);
    if (result.wasGoing) hub.disconnect(activityId, userId);
    await announce(activityId, host.id, result);
    for (const week of result.laterWeeks) {
      if (week.wasGoing) hub.disconnect(week.id, userId);
      await announce(week.id, host.id, week);
    }
    void push.notifyUsers([userId], {
      title: `You’re no longer going to ${result.title}`,
      body: 'The host removed you from this activity.',
      data: {},
      channelId: 'reminders',
    });
    return result;
  };
}

/**
 * Blocking someone takes them out of the upcoming activities you host (going
 * or waiting), as if you'd removed them: you shouldn't have to do both.
 */
export async function removeBlockedFromHosted(
  deps: Parameters<typeof createRemover>[0],
  host: { id: string; name: string },
  blockedId: string,
) {
  const rows = await deps.db
    .select({ id: activities.id })
    .from(activities)
    .where(
      and(
        eq(activities.hostId, host.id),
        isNull(activities.cancelledAt),
        gt(activities.startsAt, sql`now()`),
        or(
          sql`exists (select 1 from ${activityMembers} m where m.activity_id = ${activities.id} and m.user_id = ${blockedId})`,
          sql`exists (select 1 from ${activityWaitlist} w where w.activity_id = ${activities.id} and w.user_id = ${blockedId})`,
        ),
      ),
    );
  const remove = createRemover(deps);
  for (const { id } of rows) {
    try {
      await remove(host, id, blockedId, 'other');
    } catch (err) {
      // Already out (a later week the first removal reached): nothing to do.
      if (err instanceof HttpError && err.status === 404) continue;
      deps.logger.error({ err, activityId: id }, 'Could not remove a blocked guest');
    }
  }
}
