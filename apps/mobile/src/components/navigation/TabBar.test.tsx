import { describe, expect, it, jest } from '@jest/globals';
import type { BottomTabBarProps } from 'expo-router/tabs';

import { render, screen } from '@/test/native';
import { TabBar } from './TabBar';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
// The UI barrel reaches the API client; the tab bar never calls it.
jest.mock('@/api/auth-client', () => ({ authClient: {}, sessionCookie: async () => null }));

const props = {
  state: {
    index: 0,
    routes: ['index', 'activities', 'communities', 'profile'].map((name) => ({
      key: name,
      name,
    })),
  },
  navigation: { emit: () => ({ defaultPrevented: false }), navigate: jest.fn() },
} as unknown as BottomTabBarProps;

describe('TabBar', () => {
  it('keeps every label on one line, shrinking rather than wrapping', async () => {
    await render(<TabBar {...props} />);
    for (const label of ['Discover', 'Activities', 'Communities', 'Profile']) {
      const text = screen.getByText(label);
      expect(text.props).toMatchObject({ numberOfLines: 1, adjustsFontSizeToFit: true });
    }
  });
});
