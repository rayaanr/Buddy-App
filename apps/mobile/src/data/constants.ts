import type { ActivityGroup } from '@buddy/shared';

/** Activity types on the Create screen, mapped to the API's groups. */
export const ACTIVITY_TYPES: { label: string; group: ActivityGroup }[] = [
  { label: 'Social', group: 'Social' },
  { label: 'Sports', group: 'Sports' },
  { label: 'Running', group: 'Running' },
  { label: 'Creative', group: 'Creative' },
  { label: 'Food & markets', group: 'Food' },
];

/** Placeholder stripe colour per group, shown while photos load or offline. */
export const GROUP_HUES: Record<ActivityGroup, string> = {
  Social: '#5a2a2a',
  Sports: '#0f4550',
  Running: '#5a3420',
  Creative: '#45345a',
  Food: '#5a4818',
};
export const COMMUNITY_HUE = '#2f3a2a';

export const CREATE_DAYS = ['Today', 'Tmrw', 'Sat', 'Sun'] as const;
export type CreateDay = (typeof CREATE_DAYS)[number];

export const CREATE_TIMES = ['07:30', '10:00', '12:30', '18:30', '19:30', '20:00'] as const;
