import { describe, expect, it } from 'vitest';

import { createActivityInput } from './activity';
import { sendMessageInput } from './chat';
import { updateMeInput } from './user';

const validActivity = {
  title: '  Sunset 5K  ',
  group: 'Running',
  startsAt: '2026-10-09T12:30:00.000Z',
  place: 'Galle Face Green',
  area: 'Colombo 03',
  capacity: 15,
};

describe('createActivityInput', () => {
  it('trims text and fills defaults', () => {
    const parsed = createActivityInput.parse(validActivity);
    expect(parsed.title).toBe('Sunset 5K');
    expect(parsed.description).toBe('');
  });

  it('rejects capacities outside 2–30 and unknown areas', () => {
    expect(createActivityInput.safeParse({ ...validActivity, capacity: 1 }).success).toBe(false);
    expect(createActivityInput.safeParse({ ...validActivity, capacity: 31 }).success).toBe(false);
    expect(createActivityInput.safeParse({ ...validActivity, area: 'Kandy' }).success).toBe(false);
  });
});

describe('updateMeInput', () => {
  it('requires at least three distinct interests when interests are sent', () => {
    expect(updateMeInput.safeParse({ interests: ['Running', 'Yoga'] }).success).toBe(false);
    expect(updateMeInput.safeParse({ interests: ['Running', 'Running', 'Yoga'] }).success).toBe(
      false,
    );
    expect(updateMeInput.safeParse({ interests: ['Running', 'Yoga', 'Cricket'] }).success).toBe(
      true,
    );
  });

  it('allows partial updates', () => {
    expect(updateMeInput.parse({ bio: 'Hi' })).toEqual({ bio: 'Hi' });
  });
});

describe('sendMessageInput', () => {
  it('rejects blank messages after trimming', () => {
    const id = '0b6f1d4e-6f7a-4f8e-9a3b-2c1d0e9f8a7b';
    expect(sendMessageInput.safeParse({ id, body: '   ' }).success).toBe(false);
    expect(sendMessageInput.parse({ id, body: ' hi ' }).body).toBe('hi');
  });
});
