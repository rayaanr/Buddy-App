import {
  type ActivitySummary,
  daysUntilWeekday,
  localDay,
  MONTHS_SHORT,
  type MyActivity,
  whenLabel as formatWhen,
  whenLong as formatWhenLong,
} from '@buddy/shared';

import { GROUP_HUES, type CreateDay } from '@/data/constants';
import { colors } from '@/theme';

type Activity = Pick<ActivitySummary, 'capacity' | 'goingCount' | 'waitingCount' | 'viewer'>;

export const spotsLeft = (a: Activity) => a.capacity - a.goingCount;

const isParticipating = (a: Pick<ActivitySummary, 'viewer'>) => a.viewer.joined || a.viewer.hosting;

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
  if (left <= 0) return a.waitingCount > 0 ? `Full · ${a.waitingCount} waiting` : 'Full';
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

/** The Sri Lanka calendar day ("YYYY-MM-DD") a Create-screen day chip stands for. */
export function presetDay(day: CreateDay, now = new Date()) {
  const offset =
    day === 'Today' ? 0 : day === 'Tmrw' ? 1 : daysUntilWeekday(day === 'Sat' ? 6 : 0, now);
  return localDay(now, offset);
}

/** "16 Oct" from "YYYY-MM-DD". */
export function shortDay(day: string) {
  const [, m, d] = day.split('-').map(Number);
  return `${d} ${MONTHS_SHORT[(m ?? 1) - 1]}`;
}

/** 1st, 2nd, 3rd, 4th… (waitlist places). */
export function ordinal(n: number) {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

/** "Colombo 07, Sri Lanka". */
export const locationLabel = (area: string) => `${area}, Sri Lanka`;
