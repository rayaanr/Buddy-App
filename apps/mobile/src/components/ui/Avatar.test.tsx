import { describe, expect, it } from '@jest/globals';

import { initials } from './Avatar';

describe('initials', () => {
  it('takes the first and last word’s first letters', () => {
    expect(initials('Kavindu Perera')).toBe('KP');
    expect(initials('colombo night riders')).toBe('CR');
    expect(initials('  Amaya   Silva  ')).toBe('AS');
  });

  it('uses two letters of a single word, and copes with the rest', () => {
    expect(initials('Nimal')).toBe('Ni');
    expect(initials('X')).toBe('X');
    expect(initials('')).toBe('?');
    expect(initials('ශානි පෙරේරා')).toBe('ශප');
  });
});
