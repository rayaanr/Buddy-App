import { describe, expect, it } from 'vitest';

import { createActivityInput } from './activity';
import { sendMessageInput } from './chat';
import { placeLabel } from './place';
import { updateMeInput } from './user';

const validActivity = {
  title: '  Sunset 5K  ',
  group: 'Running',
  startsAt: '2026-10-09T12:30:00.000Z',
  place: 'Galle Face Green',
  capacity: 15,
};

describe('createActivityInput', () => {
  it('trims text and fills defaults', () => {
    const parsed = createActivityInput.parse(validActivity);
    expect(parsed.title).toBe('Sunset 5K');
    expect(parsed.description).toBe('');
  });

  it('rejects capacities outside 2–30', () => {
    expect(createActivityInput.safeParse({ ...validActivity, capacity: 1 }).success).toBe(false);
    expect(createActivityInput.safeParse({ ...validActivity, capacity: 31 }).success).toBe(false);
  });

  it('takes a meeting point anywhere, and leaves the town to the server', () => {
    const at = { lat: 7.2797, lng: 80.6202 };
    expect(createActivityInput.safeParse({ ...validActivity, location: at }).success).toBe(true);
  });
});

describe('placeLabel', () => {
  it('adds the district unless the name already says it', () => {
    expect(placeLabel({ name: 'Peradeniya', district: 'Kandy' })).toBe('Peradeniya, Kandy');
    expect(placeLabel({ name: 'Kandy', district: 'Kandy' })).toBe('Kandy');
    expect(placeLabel({ name: 'Colombo 7', district: 'Colombo' })).toBe('Colombo 7');
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
