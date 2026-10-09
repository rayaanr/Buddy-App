import { describe, expect, it } from 'vitest';

import {
  atLocalTime,
  clockLabel,
  dayLabel,
  daysUntilWeekday,
  isToday,
  isWeekend,
  whenLabel,
} from './time';

// Friday 9 October 2026, 11:30 in Sri Lanka (06:00 UTC).
const now = new Date('2026-10-09T06:00:00Z');

describe('dayLabel', () => {
  it('labels an evening slot today as Tonight', () => {
    expect(dayLabel(new Date('2026-10-09T12:30:00Z'), now)).toBe('Tonight'); // 18:00 local
  });

  it('labels a morning slot today as Today', () => {
    expect(dayLabel(new Date('2026-10-09T04:30:00Z'), now)).toBe('Today'); // 10:00 local
  });

  it('rolls over at local midnight, not UTC midnight', () => {
    expect(dayLabel(new Date('2026-10-09T18:29:00Z'), now)).toBe('Tonight'); // 23:59 Fri
    expect(dayLabel(new Date('2026-10-09T18:30:00Z'), now)).toBe('Tomorrow'); // 00:00 Sat
  });

  it('uses the weekday name further out', () => {
    expect(dayLabel(new Date('2026-10-11T10:00:00Z'), now)).toBe('Sun');
  });
});

describe('clockLabel and whenLabel', () => {
  it('formats local wall-clock time', () => {
    expect(clockLabel(new Date('2026-10-09T12:30:00Z'))).toBe('18:00');
    expect(whenLabel(new Date('2026-10-09T14:00:00Z'), now)).toBe('Tonight · 19:30');
  });
});

describe('calendar checks', () => {
  it('detects today and weekends in local time', () => {
    expect(isToday(new Date('2026-10-09T18:29:00Z'), now)).toBe(true);
    expect(isToday(new Date('2026-10-09T18:30:00Z'), now)).toBe(false);
    expect(isWeekend(new Date('2026-10-09T12:00:00Z'))).toBe(false); // Friday
    expect(isWeekend(new Date('2026-10-09T18:30:00Z'))).toBe(true); // Saturday 00:00 local
  });
});

describe('atLocalTime', () => {
  it('builds an instant from a local day offset and time', () => {
    expect(atLocalTime(1, '06:30', now).toISOString()).toBe('2026-10-10T01:00:00.000Z');
    expect(atLocalTime(0, '18:00', now).toISOString()).toBe('2026-10-09T12:30:00.000Z');
  });

  it('counts days to the next weekday', () => {
    expect(daysUntilWeekday(6, now)).toBe(1); // Saturday
    expect(daysUntilWeekday(5, now)).toBe(0); // Friday is today
    expect(daysUntilWeekday(0, now)).toBe(2); // Sunday
  });
});
