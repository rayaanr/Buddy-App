import { describe, expect, it, jest } from '@jest/globals';

import { addToCalendar } from './calendar';

// jest.mock calls are hoisted above the imports; "mock…" names may be used in them.
const mockCreated: unknown[] = [];
jest.mock('expo-calendar/legacy', () => ({
  createEventInCalendarAsync: async (event: unknown) => {
    mockCreated.push(event);
    return { action: 'saved' };
  },
}));
jest.mock('@/api/auth-client', () => ({ authClient: {}, sessionCookie: async () => null }));

describe('addToCalendar', () => {
  it('fills in the phone’s new-event screen with the activity', async () => {
    await addToCalendar({
      id: 'a1',
      title: 'Sunset 5K',
      startsAt: '2026-10-18T12:30:00.000Z',
      place: 'Galle Face Green',
      area: 'Colombo 3',
      description: 'Easy pace, all welcome.',
    });
    expect(mockCreated).toHaveLength(1);
    const event = mockCreated[0] as Record<string, unknown>;
    expect(event).toMatchObject({
      title: 'Sunset 5K',
      timeZone: 'Asia/Colombo',
      location: 'Galle Face Green, Colombo 3',
      url: expect.stringMatching(/\/a\/a1$/),
    });
    expect((event.startDate as Date).toISOString()).toBe('2026-10-18T12:30:00.000Z');
    expect((event.endDate as Date).toISOString()).toBe('2026-10-18T14:30:00.000Z');
    expect(event.notes).toMatch(/^Easy pace, all welcome\.\n\nOn Buddy: .*\/a\/a1$/);
  });
});
