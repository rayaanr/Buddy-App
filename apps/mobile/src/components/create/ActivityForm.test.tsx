import { describe, expect, it, jest } from '@jest/globals';

import { draftFrom } from './ActivityForm';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock('@/api/auth-client', () => ({ authClient: {}, sessionCookie: async () => null }));

// Friday 9 Oct 2026, 10:00 in Colombo.
const now = new Date('2026-10-09T04:30:00Z');
const activity = {
  title: 'Padel',
  group: 'Food' as const,
  place: 'Court 2',
  capacity: 8,
  description: 'Bring water.',
};

describe('draftFrom (editing an activity)', () => {
  it('maps a preset day and time back to their chips', () => {
    // Saturday 10 Oct, 18:30 Colombo.
    const draft = draftFrom({ ...activity, startsAt: '2026-10-10T13:00:00.000Z' }, now);
    expect(draft).toMatchObject({
      title: 'Padel',
      type: 'Food & markets',
      day: 'Tmrw',
      customDay: null,
      time: '18:30',
      where: 'Court 2',
      spots: 8,
      notes: 'Bring water.',
    });
  });

  it('uses the calendar day and exact time otherwise', () => {
    // Saturday 14 Nov, 17:45 Colombo.
    const draft = draftFrom({ ...activity, startsAt: '2026-11-14T12:15:00.000Z' }, now);
    expect(draft).toMatchObject({ day: 'custom', customDay: '2026-11-14', time: '17:45' });
  });
});
