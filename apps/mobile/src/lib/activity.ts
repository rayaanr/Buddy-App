import {
  atLocalTime,
  daysUntilWeekday,
  whenLabel as formatWhen,
  whenLong as formatWhenLong,
  type ActivitySummary,
  type MyActivity,
} from '@buddy/shared';

import { GROUP_HUES, type CreateDay } from '@/data/constants';
import { colors } from '@/theme';

type Activity = Pick<ActivitySummary, 'capacity' | 'goingCount' | 'viewer'>;

export const spotsLeft = (a: Activity) => a.capacity - a.goingCount;

export const isParticipating = (a: Pick<ActivitySummary, 'viewer'>) =>
  a.viewer.joined || a.viewer.hosting;

/** "Tonight · 18:30" in Sri Lanka time. */
export const whenLabel = (a: Pick<ActivitySummary, 'startsAt'>) => formatWhen(new Date(a.startsAt));

/** "Tonight, 18:30". */
export const whenLong = (a: Pick<ActivitySummary, 'startsAt'>) =>
  formatWhenLong(new Date(a.startsAt));

export const hueFor = (a: Pick<ActivitySummary, 'group'>) => GROUP_HUES[a.group];

/** "1.2 km" or "nearby". */
export const distanceLabel = (a: Pick<ActivitySummary, 'distanceKm'>) =>
  a.distanceKm === null ? 'nearby' : `${a.distanceKm < 0.1 ? 0.1 : a.distanceKm} km`;

/** Short status on list rows: "Going", "Hosting", "Full" or "3 left". */
export function leftLabel(a: Activity) {
  if (a.viewer.hosting) return 'Hosting';
  if (a.viewer.joined) return 'Going';
  const left = spotsLeft(a);
  return left <= 0 ? 'Full' : `${left} left`;
}

export function spotsLabel(a: Activity) {
  const left = spotsLeft(a);
  if (left <= 0) return 'Full';
  return `${left} spot${left === 1 ? '' : 's'} left`;
}

/** Lime when you're in, muted when full, orange when 3 or fewer spots remain. */
export function availabilityColor(a: Activity) {
  const left = spotsLeft(a);
  if (isParticipating(a)) return colors.lime;
  if (left <= 0) return colors.muted;
  if (left <= 3) return colors.warning;
  return colors.ink;
}

export function lastMessagePreview(a: MyActivity) {
  const m = a.lastMessage;
  if (!m) return 'No messages yet. Say hi.';
  return `${m.mine ? 'You' : (m.senderName ?? 'Someone')}: ${m.body}`;
}

/** Start time for the Create screen's day chip and time chip, in Sri Lanka time. */
export function createStartsAt(day: CreateDay, time: string, now = new Date()) {
  const offset =
    day === 'Today' ? 0 : day === 'Tmrw' ? 1 : daysUntilWeekday(day === 'Sat' ? 6 : 0, now);
  return atLocalTime(offset, time, now);
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/** "Colombo 07, Sri Lanka". */
export const locationLabel = (area: string) => `${area}, Sri Lanka`;

/** "Mar 2025" from an ISO date. */
export const monthYear = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });

/** "28 Sep" from an ISO date. */
export const dayMonth = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
