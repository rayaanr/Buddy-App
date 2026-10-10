import { REPORT_REASONS, type CreateReportInput, type UserSummary } from '@buddy/shared';
import { and, desc, eq, sql } from 'drizzle-orm';

import type { Db } from '../../db/client';
import { activities, blocks, messages, profiles, reports, user } from '../../db/schema';
import type { Env } from '../../env';
import { badRequest, notFound } from '../../lib/errors';
import type { Mailer } from '../../lib/mailer';
import type { Urls } from '../../lib/urls';
import type { Logger } from '../../logger';
import { visibleTo } from '../activities/queries';
import { requireMember } from '../chat/service';

async function userExists(db: Db, id: string) {
  const [row] = await db.select({ id: user.id }).from(user).where(eq(user.id, id));
  return !!row;
}

/** Blocks someone. Blocking twice is a no-op. */
export async function blockUser(db: Db, blockerId: string, blockedId: string) {
  if (blockerId === blockedId) throw badRequest('You can’t block yourself');
  if (!(await userExists(db, blockedId))) throw notFound('Person');
  await db.insert(blocks).values({ blockerId, blockedId }).onConflictDoNothing();
}

export async function unblockUser(db: Db, blockerId: string, blockedId: string) {
  await db
    .delete(blocks)
    .where(and(eq(blocks.blockerId, blockerId), eq(blocks.blockedId, blockedId)));
}

/** People you blocked, most recent first (Settings → Blocked people). */
export async function listBlocked(db: Db, urls: Urls, blockerId: string): Promise<UserSummary[]> {
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      avatarKey: profiles.avatarKey,
      avatarUrl: profiles.avatarUrl,
    })
    .from(blocks)
    .innerJoin(user, eq(user.id, blocks.blockedId))
    .leftJoin(profiles, eq(profiles.userId, blocks.blockedId))
    .where(eq(blocks.blockerId, blockerId))
    .orderBy(desc(blocks.createdAt));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    avatarUrl: urls.avatar(r.avatarKey, r.avatarUrl),
  }));
}

/**
 * Files a report about a person, a chat message or an activity. Only things
 * the reporter can see are reportable; anything else reads as not found.
 */
export async function createReport(db: Db, reporterId: string, input: CreateReportInput) {
  let targetUserId: string;
  let activityId: string | null = null;
  let messageId: string | null = null;

  if (input.messageId) {
    const [msg] = await db
      .select({ activityId: messages.activityId, senderId: messages.senderId })
      .from(messages)
      .where(eq(messages.id, input.messageId));
    if (!msg) throw notFound('Message');
    await requireMember(db, msg.activityId, reporterId).catch(() => {
      throw notFound('Message');
    });
    if (!msg.senderId) throw badRequest('System messages can’t be reported');
    targetUserId = msg.senderId;
    activityId = msg.activityId;
    messageId = input.messageId;
  } else if (input.activityId) {
    // Only what you can see (so this can't confirm hidden activities exist).
    const [activity] = await db
      .select({ hostId: activities.hostId })
      .from(activities)
      .where(and(eq(activities.id, input.activityId), visibleTo(reporterId)));
    if (!activity) throw notFound('Activity');
    targetUserId = activity.hostId;
    activityId = input.activityId;
  } else {
    if (!(await userExists(db, input.userId!))) throw notFound('Person');
    targetUserId = input.userId!;
  }
  if (targetUserId === reporterId) throw badRequest('You can’t report yourself');

  // Reporting the same person again within a day is saved but doesn't email
  // the moderators again (no inbox flooding).
  const [recent] = await db
    .select({ id: reports.id })
    .from(reports)
    .where(
      and(
        eq(reports.reporterId, reporterId),
        eq(reports.targetUserId, targetUserId),
        sql`${reports.createdAt} > now() - interval '1 day'`,
      ),
    )
    .limit(1);

  const [row] = await db
    .insert(reports)
    .values({
      reporterId,
      targetUserId,
      activityId,
      messageId,
      reason: input.reason,
      details: input.details || null,
    })
    .returning();
  return { report: row!, repeat: !!recent };
}

/**
 * Tells whoever moderates Buddy about a new report. App Review expects reports
 * to be acted on within 24 hours, so set MODERATION_EMAIL in production.
 */
export async function notifyModerators(
  deps: { db: Db; env: Env; mailer: Mailer; logger: Logger },
  report: typeof reports.$inferSelect,
) {
  const { db, env, mailer, logger } = deps;
  logger.warn(
    { reportId: report.id, reason: report.reason, targetUserId: report.targetUserId },
    'New report',
  );
  if (!env.MODERATION_EMAIL) return;

  try {
    const [target] = await db
      .select({ name: user.name, email: user.email })
      .from(user)
      .where(eq(user.id, report.targetUserId!));
    const [message] = report.messageId
      ? await db
          .select({ body: messages.body })
          .from(messages)
          .where(eq(messages.id, report.messageId))
      : [];
    const lines = [
      `Reason: ${REPORT_REASONS[report.reason as keyof typeof REPORT_REASONS] ?? report.reason}`,
      `Reported: ${target?.name ?? 'unknown'} <${target?.email ?? '?'}> (${report.targetUserId})`,
      report.activityId ? `Activity: ${report.activityId}` : null,
      message ? `Message: “${message.body}”` : null,
      report.details ? `Reporter’s note: ${report.details}` : null,
      `Reporter: ${report.reporterId}`,
      `Report ID: ${report.id}`,
    ].filter((l): l is string => !!l);
    const text = lines.join('\n');
    await mailer.send({
      to: env.MODERATION_EMAIL,
      subject: `Buddy report: ${report.reason}`,
      text,
      html: `<pre style="font:14px/1.5 sans-serif;white-space:pre-wrap">${escapeHtml(text)}</pre>`,
    });
  } catch (err) {
    logger.error({ err, reportId: report.id }, 'Could not email moderators about a report');
  }
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
