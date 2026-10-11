import type { Invitee } from '@buddy/shared';
import { and, eq, sql } from 'drizzle-orm';

import type { Db } from '../../db/client';
import { activities, activityInvites, activityMembers } from '../../db/schema';
import { conflict, forbidden, notFound } from '../../lib/errors';
import type { Urls } from '../../lib/urls';

const MAX_PEOPLE = 100;

/**
 * Only people going can invite, and only before it starts. Returns what the
 * invite notification says.
 */
async function requireInviter(db: Db, activityId: string, userId: string) {
  const [row] = await db
    .select({
      title: activities.title,
      startsAt: activities.startsAt,
      place: activities.place,
      hostId: activities.hostId,
      cancelledAt: activities.cancelledAt,
      role: activityMembers.role,
    })
    .from(activities)
    .leftJoin(
      activityMembers,
      and(eq(activityMembers.activityId, activities.id), eq(activityMembers.userId, userId)),
    )
    .where(eq(activities.id, activityId));
  if (!row) throw notFound('Activity');
  if (!row.role) throw forbidden('Join this activity to invite people');
  if (row.cancelledAt) throw conflict('This activity was cancelled');
  if (row.startsAt <= new Date()) throw conflict('This activity has already started');
  return row;
}

/**
 * People you could invite: everyone you've been at an activity with (one that
 * has started), most recent first. Left out: people already going or waiting,
 * people removed from this one, anyone on either side of a block with you or
 * the host, and suspended accounts. Invites only reach people you've met, so
 * they can't be used to message strangers.
 */
export async function findInvitees(
  db: Db,
  urls: Urls,
  activityId: string,
  viewerId: string,
): Promise<Invitee[]> {
  const { hostId } = await requireInviter(db, activityId, viewerId);
  const rows = await db.execute<{
    id: string;
    name: string;
    avatar_key: string | null;
    avatar_url: string | null;
    met: string;
    invited: boolean;
  }>(sql`
    with met as (
      select other.user_id,
             max(a.starts_at) as last_at,
             (array_agg(a.title order by a.starts_at desc))[1] as title
      from activity_members mine
      join activity_members other
        on other.activity_id = mine.activity_id and other.user_id <> mine.user_id
      join activities a on a.id = mine.activity_id
      where mine.user_id = ${viewerId}
        and a.starts_at < now()
        and a.cancelled_at is null
        -- Really met: both signed up before it started, or the host marked
        -- them there. Joining a started activity doesn't make everyone in
        -- it invitable.
        and (mine.joined_at < a.starts_at or mine.attended)
        and (other.joined_at < a.starts_at or other.attended)
      group by other.user_id
    )
    select u.id, u.name, p.avatar_key, p.avatar_url, met.title as met,
           exists (
             select 1 from activity_invites i
             where i.activity_id = ${activityId} and i.invitee_id = u.id
           ) as invited
    from met
    join "user" u on u.id = met.user_id
    join profiles p on p.user_id = u.id
    where p.suspended_at is null
      and not exists (select 1 from activity_members m
                      where m.activity_id = ${activityId} and m.user_id = u.id)
      and not exists (select 1 from activity_waitlist w
                      where w.activity_id = ${activityId} and w.user_id = u.id)
      and not exists (select 1 from activity_removals r
                      where r.activity_id = ${activityId} and r.user_id = u.id)
      and not exists (select 1 from blocks b
                      where (b.blocker_id = u.id and b.blocked_id in (${viewerId}, ${hostId ?? viewerId}))
                         or (b.blocked_id = u.id and b.blocker_id in (${viewerId}, ${hostId ?? viewerId})))
    order by met.last_at desc, u.name
    limit ${MAX_PEOPLE}`);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    avatarUrl: urls.avatar(r.avatar_key, r.avatar_url),
    met: r.met,
    invited: r.invited,
  }));
}

/**
 * Invites people to an activity. Anyone not on the viewer's invite list (see
 * findInvitees) is skipped, as is anyone already invited. Returns who's newly
 * invited, and the activity for the notification.
 */
export async function invite(
  db: Db,
  urls: Urls,
  activityId: string,
  viewerId: string,
  userIds: string[],
) {
  const activity = await requireInviter(db, activityId, viewerId);
  const allowed = new Set(
    (await findInvitees(db, urls, activityId, viewerId)).filter((p) => !p.invited).map((p) => p.id),
  );
  const wanted = [...new Set(userIds)].filter((id) => allowed.has(id));
  if (!wanted.length) return { invited: [] as string[], activity };
  const rows = await db
    .insert(activityInvites)
    .values(wanted.map((inviteeId) => ({ activityId, inviteeId, inviterId: viewerId })))
    .onConflictDoNothing()
    .returning({ id: activityInvites.inviteeId });
  return { invited: rows.map((r) => r.id), activity };
}
