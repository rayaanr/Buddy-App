/**
 * Calendar helpers in Sri Lanka time.
 *
 * Sri Lanka has used a fixed UTC+05:30 offset with no daylight saving since
 * 2006, so a constant offset is exact. This avoids depending on time-zone data,
 * which is incomplete in some mobile JavaScript engines.
 */
const OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
/** From this hour, an activity later today reads as "Tonight". */
const EVENING_HOUR = 17;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;
export const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** Wall-clock parts of an instant in Sri Lanka time. */
function local(date: Date) {
  const shifted = new Date(date.getTime() + OFFSET_MS);
  return {
    dayIndex: Math.floor(shifted.getTime() / DAY_MS),
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
    hours: shifted.getUTCHours(),
    minutes: shifted.getUTCMinutes(),
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "18:30" in Sri Lanka time. */
export function clockLabel(date: Date) {
  const { hours, minutes } = local(date);
  return `${pad(hours)}:${pad(minutes)}`;
}

/** "Today", "Tonight", "Tomorrow", or a weekday like "Sat". */
export function dayLabel(date: Date, now: Date = new Date()) {
  const t = local(date);
  const diff = t.dayIndex - local(now).dayIndex;
  if (diff === 0) return t.hours >= EVENING_HOUR ? 'Tonight' : 'Today';
  if (diff === 1) return 'Tomorrow';
  return WEEKDAYS[t.weekday]!;
}

/** "Tonight · 18:30" — used on cards. */
export const whenLabel = (date: Date, now?: Date) => `${dayLabel(date, now)} · ${clockLabel(date)}`;

/** "Tonight, 18:30" — used on the details page. */
export const whenLong = (date: Date, now?: Date) => `${dayLabel(date, now)}, ${clockLabel(date)}`;

/** "Saturday": the day of the week in Sri Lanka time. */
export const weekdayName = (date: Date) => WEEKDAY_NAMES[local(date).weekday]!;

/** "Mar 2025" in Sri Lanka time (member since). */
export function monthYear(date: Date) {
  const { month, year } = local(date);
  return `${MONTHS_SHORT[month]} ${year}`;
}

/** "28 Sep" in Sri Lanka time. */
export function dayMonth(date: Date) {
  const { day, month } = local(date);
  return `${day} ${MONTHS_SHORT[month]}`;
}

/**
 * Builds an instant from a Sri Lanka calendar day offset and a "HH:MM" time.
 * `daysFromToday` 0 is today. Used by the Create screen and the seed script.
 */
export function atLocalTime(daysFromToday: number, time: string, now: Date = new Date()) {
  const [h, m] = time.split(':').map(Number);
  const startOfToday = local(now).dayIndex * DAY_MS - OFFSET_MS;
  return new Date(startOfToday + daysFromToday * DAY_MS + ((h ?? 0) * 60 + (m ?? 0)) * 60 * 1000);
}

/** Days from today until the next given weekday (0 = Sunday). Today counts as 0. */
export function daysUntilWeekday(weekday: number, now: Date = new Date()) {
  return (weekday - local(now).weekday + 7) % 7;
}

/** A Sri Lanka calendar day as "YYYY-MM-DD" (`daysFromToday` 0 is today). */
export function localDay(now: Date = new Date(), daysFromToday = 0) {
  const shifted = new Date(now.getTime() + OFFSET_MS + daysFromToday * DAY_MS);
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

/** The instant for a Sri Lanka calendar day ("YYYY-MM-DD") at "HH:MM". */
export function atLocalDay(day: string, time: string) {
  const [y = 1970, mo = 1, d = 1] = day.split('-').map(Number);
  const [h = 0, m = 0] = time.split(':').map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h, m) - OFFSET_MS);
}
