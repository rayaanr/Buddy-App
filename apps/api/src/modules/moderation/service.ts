import type { AdminPerson, AdminReport, ReportReason, ResolveReportInput } from '@buddy/shared';
import { firstName } from '@buddy/shared';
import { and, desc, eq, isNull, or, type SQL, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import type { Db } from '../../db/client';
import {
  activities,
  communities,
  communityMembers,
  messages,
  profiles,
  pushTokens,
  reports,
  session,
  user,
} from '../../db/schema';
import { badRequest, HttpError, notFound } from '../../lib/errors';
import type { Urls } from '../../lib/urls';
import type { ChangeResult } from '../activities/announce';
import { cancelLocked } from '../activities/service';
import { communityChatPhotos } from '../chat/service';

const LIST_MAX = 100;

/** Reports for moderators, newest first, with what each is about. */
export async function listReports(
  db: Db,
  urls: Urls,
  status: 'open' | 'resolved',
): Promise<AdminReport[]> {
  const reporter = alias(user, 'reporter');
  const reporterProfile = alias(profiles, 'reporter_profile');
  const person = alias(user, 'person');
  const personProfile = alias(profiles, 'person_profile');
  const rows = await db
    .select({
      report: reports,
      reporter: { id: reporter.id, name: reporter.name },
      reporterAvatar: { key: reporterProfile.avatarKey, url: reporterProfile.avatarUrl },
      person: { id: person.id, name: person.name },
      personProfile: {
        key: personProfile.avatarKey,
        url: personProfile.avatarUrl,
        suspendedAt: personProfile.suspendedAt,
      },
      message: { id: messages.id, body: messages.body },
      activity: { id: activities.id, title: activities.title, cancelledAt: activities.cancelledAt },
      community: { id: communities.id, name: communities.name },
    })
    .from(reports)
    .leftJoin(reporter, eq(reporter.id, reports.reporterId))
    .leftJoin(reporterProfile, eq(reporterProfile.userId, reports.reporterId))
    .leftJoin(person, eq(person.id, reports.targetUserId))
    .leftJoin(personProfile, eq(personProfile.userId, reports.targetUserId))
    .leftJoin(messages, eq(messages.id, reports.messageId))
    .leftJoin(activities, eq(activities.id, reports.activityId))
    .leftJoin(communities, eq(communities.id, reports.communityId))
    .where(eq(reports.status, status))
    .orderBy(desc(reports.createdAt))
    .limit(LIST_MAX);

  return rows.map((r) => ({
    id: r.report.id,
    reason: r.report.reason as ReportReason,
    details: r.report.details,
    createdAt: r.report.createdAt.toISOString(),
    status: r.report.status as 'open' | 'resolved',
    resolution: r.report.resolution,
    reporter: r.reporter
      ? {
          ...r.reporter,
          avatarUrl: urls.avatar(r.reporterAvatar?.key, r.reporterAvatar?.url),
        }
      : null,
    person: r.person
      ? {
          ...r.person,
          avatarUrl: urls.avatar(r.personProfile?.key, r.personProfile?.url),
          suspended: !!r.personProfile?.suspendedAt,
        }
      : null,
    // A message report also carries its activity; show the message, not both.
    message: r.message,
    activity:
      r.activity && !r.message
        ? { id: r.activity.id, title: r.activity.title, cancelled: !!r.activity.cancelledAt }
        : null,
    community: r.community,
  }));
}

interface Resolved {
  /** Activities cancelled along the way, for the caller to announce. */
  cancelled: { id: string; result: ChangeResult }[];
  /** A removed chat message, for the caller to take out of open chats. */
  removedMessage: {
    id: string;
    activityId: string | null;
    communityId: string | null;
    imageKey: string | null;
  } | null;
  /** A removed community's photos, for the caller to clean up. */
  removedPhotos: string[];
  /** A removed community, for the caller to tell its members. */
  removedCommunity: { name: string; memberIds: string[] } | null;
  /** Someone suspended, for the caller to close their live connections. */
  suspendedId: string | null;
}

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/** Calls off an activity for breaking the rules (and stops it repeating). */
async function cancelForRules(tx: Tx, activityId: string, out: Resolved) {
  const [row] = await tx
    .select()
    .from(activities)
    .where(eq(activities.id, activityId))
    .for('update');
  if (!row) throw notFound('Activity');
  if (row.cancelledAt) return;
  out.cancelled.push({
    id: row.id,
    result: await cancelLocked(tx, row, {
      stopRepeating: true,
      line: 'Buddy removed this activity for breaking the community rules',
      notice: {
        title: `Cancelled: ${row.title}`,
        body: 'Buddy removed it for breaking the community rules.',
      },
    }),
  });
}

/** Deletes a community with its chat; its photos are left for the caller to clean up. */
async function deleteCommunity(tx: Tx, communityId: string, out: Resolved) {
  const chatPhotos = await communityChatPhotos(tx, communityId);
  const members = await tx
    .select({ userId: communityMembers.userId })
    .from(communityMembers)
    .where(eq(communityMembers.communityId, communityId));
  const [gone] = await tx.delete(communities).where(eq(communities.id, communityId)).returning({
    name: communities.name,
    coverUrl: communities.coverUrl,
    logoUrl: communities.logoUrl,
  });
  if (!gone) throw notFound('Community');
  out.removedCommunity = { name: gone.name, memberIds: members.map((m) => m.userId) };
  out.removedPhotos.push(
    ...[gone.coverUrl, gone.logoUrl, ...chatPhotos].filter((u): u is string => !!u),
  );
}

/** Signs someone out everywhere, keeps them out, and calls off what they host. */
async function suspendLocked(tx: Tx, personId: string, out: Resolved) {
  const [who] = await tx.select({ name: user.name }).from(user).where(eq(user.id, personId));
  if (!who) throw notFound('Person');
  await tx
    .update(profiles)
    .set({ suspendedAt: new Date() })
    .where(and(eq(profiles.userId, personId), isNull(profiles.suspendedAt)));
  // Signed out everywhere; signing back in is refused (see auth.ts). No more
  // notifications on their phone either (signing in again registers it anew).
  await tx.delete(session).where(eq(session.userId, personId));
  await tx.delete(pushTokens).where(eq(pushTokens.userId, personId));
  // Weekly activities they host stop repeating, including a series whose
  // latest week has already started (so isn't cancelled below).
  await tx
    .update(activities)
    .set({ repeatsWeekly: false })
    .where(and(eq(activities.hostId, personId), eq(activities.repeatsWeekly, true)));
  out.suspendedId = personId;
  // What they host can't go ahead.
  const hosted = await tx
    .select()
    .from(activities)
    .where(
      and(
        eq(activities.hostId, personId),
        isNull(activities.cancelledAt),
        sql`${activities.startsAt} > now()`,
      ),
    )
    .for('update');
  const host = firstName(who.name);
  for (const row of hosted) {
    out.cancelled.push({
      id: row.id,
      result: await cancelLocked(tx, row, {
        stopRepeating: true,
        line: `${host} can’t host on Buddy any more, so this activity is off`,
        notice: { title: `Cancelled: ${row.title}`, body: `${host} can’t host it any more.` },
      }),
    });
  }
}

/** Marks open reports as dealt with. */
async function closeReports(
  tx: Tx,
  moderatorId: string,
  resolution: string,
  which: (SQL | undefined)[],
) {
  await tx
    .update(reports)
    .set({ status: 'resolved', resolution, resolvedBy: moderatorId, resolvedAt: new Date() })
    .where(and(eq(reports.status, 'open'), or(...which)));
}

const nothingYet = (): Resolved => ({
  cancelled: [],
  removedMessage: null,
  removedPhotos: [],
  removedCommunity: null,
  suspendedId: null,
});

/**
 * Acts on a report: removes the content and/or suspends the person, or just
 * dismisses it. Other open reports about the same content or person are
 * closed with it.
 */
export async function resolveReport(
  db: Db,
  reportId: string,
  moderatorId: string,
  input: Required<ResolveReportInput>,
): Promise<Resolved> {
  return db.transaction(async (tx) => {
    const [report] = await tx.select().from(reports).where(eq(reports.id, reportId)).for('update');
    if (!report) throw notFound('Report');

    const out = nothingYet();
    if (input.removeContent && !report.messageId && !report.activityId && !report.communityId) {
      throw badRequest('This report is about a person; suspend them instead');
    }
    if (input.suspend && !report.targetUserId) {
      throw badRequest('Nobody to suspend: the account no longer exists');
    }

    // Close this report and any other open ones the action settles. First:
    // deleting a message or community clears the reports' link to it.
    const done = [input.removeContent && 'removed', input.suspend && 'suspended'].filter(Boolean);
    await closeReports(tx, moderatorId, done.length ? done.join(',') : 'dismissed', [
      eq(reports.id, report.id),
      input.removeContent && report.messageId ? eq(reports.messageId, report.messageId) : undefined,
      input.removeContent && report.activityId && !report.messageId
        ? and(eq(reports.activityId, report.activityId), isNull(reports.messageId))
        : undefined,
      input.removeContent && report.communityId
        ? eq(reports.communityId, report.communityId)
        : undefined,
      input.suspend && report.targetUserId
        ? eq(reports.targetUserId, report.targetUserId)
        : undefined,
    ]);

    if (input.removeContent) {
      if (report.messageId) {
        const [message] = await tx
          .delete(messages)
          .where(eq(messages.id, report.messageId))
          .returning({
            id: messages.id,
            activityId: messages.activityId,
            communityId: messages.communityId,
            imageKey: messages.imageKey,
          });
        out.removedMessage = message ?? null;
      } else if (report.activityId) {
        await cancelForRules(tx, report.activityId, out).catch(ignoreGone);
      } else if (report.communityId) {
        await deleteCommunity(tx, report.communityId, out).catch(ignoreGone);
      }
    }
    if (input.suspend && report.targetUserId) await suspendLocked(tx, report.targetUserId, out);

    return out;
  });
}

/** Reported content that's already gone counts as removed. */
const ignoreGone = (err: unknown) => {
  if (!(err instanceof HttpError && err.status === 404)) throw err;
};

/** Suspends someone without a report (Admin → People). Open reports about them close too. */
export async function suspendPerson(db: Db, moderatorId: string, personId: string) {
  return db.transaction(async (tx) => {
    const out = nothingYet();
    await suspendLocked(tx, personId, out);
    await closeReports(tx, moderatorId, 'suspended', [eq(reports.targetUserId, personId)]);
    return out;
  });
}

/** Removes an activity for breaking the rules, reported or not. */
export async function removeActivity(db: Db, moderatorId: string, activityId: string) {
  return db.transaction(async (tx) => {
    const out = nothingYet();
    await cancelForRules(tx, activityId, out);
    await closeReports(tx, moderatorId, 'removed', [
      and(eq(reports.activityId, activityId), isNull(reports.messageId)),
    ]);
    return out;
  });
}

/** Deletes a community for breaking the rules, reported or not. */
export async function removeCommunity(db: Db, moderatorId: string, communityId: string) {
  return db.transaction(async (tx) => {
    const out = nothingYet();
    // First: deleting it clears the reports' link to it.
    await closeReports(tx, moderatorId, 'removed', [eq(reports.communityId, communityId)]);
    await deleteCommunity(tx, communityId, out);
    return out;
  });
}

/** Admin → People: anyone, by name or email (suspended people too). */
export async function findPeople(db: Db, urls: Urls, q: string): Promise<AdminPerson[]> {
  const like = `%${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
  const rows = await db
    .select({ user, profile: profiles })
    .from(user)
    .leftJoin(profiles, eq(profiles.userId, user.id))
    .where(or(sql`${user.name} ilike ${like}`, sql`${user.email} ilike ${like}`))
    .orderBy(user.name)
    .limit(30);
  return rows.map(({ user: u, profile: p }) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    avatarUrl: urls.avatar(p?.avatarKey, p?.avatarUrl),
    joinedAt: u.createdAt.toISOString(),
    suspended: !!p?.suspendedAt,
  }));
}

/** Lets a suspended person back in (their cancelled activities stay cancelled). */
export async function liftSuspension(db: Db, userId: string) {
  const updated = await db
    .update(profiles)
    .set({ suspendedAt: null })
    .where(eq(profiles.userId, userId))
    .returning({ userId: profiles.userId });
  if (!updated.length) throw notFound('Person');
}

/** Sign-in checks this before starting a session. */
export async function isSuspended(db: Db, userId: string) {
  const [row] = await db
    .select({ suspendedAt: profiles.suspendedAt })
    .from(profiles)
    .where(eq(profiles.userId, userId));
  return !!row?.suspendedAt;
}
