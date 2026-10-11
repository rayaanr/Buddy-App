import type { AdminReport, ReportReason, ResolveReportInput } from '@buddy/shared';
import { firstName } from '@buddy/shared';
import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import type { Db } from '../../db/client';
import {
  activities,
  communities,
  messages,
  profiles,
  reports,
  session,
  user,
} from '../../db/schema';
import { badRequest, notFound } from '../../lib/errors';
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
}

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

    const out: Resolved = { cancelled: [], removedMessage: null, removedPhotos: [] };
    const done: string[] = [];

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
        const [row] = await tx
          .select()
          .from(activities)
          .where(eq(activities.id, report.activityId))
          .for('update');
        if (row && !row.cancelledAt) {
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
      } else if (report.communityId) {
        const chatPhotos = await communityChatPhotos(tx, report.communityId);
        const [gone] = await tx
          .delete(communities)
          .where(eq(communities.id, report.communityId))
          .returning({ coverUrl: communities.coverUrl, logoUrl: communities.logoUrl });
        out.removedPhotos = [gone?.coverUrl, gone?.logoUrl, ...chatPhotos].filter(
          (u): u is string => !!u,
        );
      } else {
        throw badRequest('This report is about a person; suspend them instead');
      }
      done.push('removed');
    }

    if (input.suspend) {
      const personId = report.targetUserId;
      if (!personId) throw badRequest('Nobody to suspend: the account no longer exists');
      const [who] = await tx.select({ name: user.name }).from(user).where(eq(user.id, personId));
      await tx
        .update(profiles)
        .set({ suspendedAt: new Date() })
        .where(and(eq(profiles.userId, personId), isNull(profiles.suspendedAt)));
      // Signed out everywhere; signing back in is refused (see auth.ts).
      await tx.delete(session).where(eq(session.userId, personId));
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
      const host = firstName(who?.name ?? 'The host');
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
      done.push('suspended');
    }

    // Close this report, and any other open ones the action settled.
    const settled = [
      eq(reports.id, report.id),
      input.removeContent && report.messageId ? eq(reports.messageId, report.messageId) : null,
      input.removeContent && report.activityId && !report.messageId
        ? and(eq(reports.activityId, report.activityId), isNull(reports.messageId))
        : null,
      input.removeContent && report.communityId
        ? eq(reports.communityId, report.communityId)
        : null,
      input.suspend && report.targetUserId ? eq(reports.targetUserId, report.targetUserId) : null,
    ].filter((c) => c !== null);
    await tx
      .update(reports)
      .set({
        status: 'resolved',
        resolution: done.length ? done.join(',') : 'dismissed',
        resolvedBy: moderatorId,
        resolvedAt: new Date(),
      })
      .where(and(eq(reports.status, 'open'), or(...settled)));

    return out;
  });
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
