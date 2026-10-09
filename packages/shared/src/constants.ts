/** Domain constants shared by the app and the API. */

export const INTERESTS = [
  'Running',
  'Climbing',
  'Padel',
  'Cycling',
  'Board games',
  'Live music',
  'Life drawing',
  'Cooking',
  'Yoga',
  'Cricket',
  'Photography',
  'Food markets',
] as const;
export type Interest = (typeof INTERESTS)[number];

export const MIN_INTERESTS = 3;

export const AVAILABILITY = [
  'Weekday evenings',
  'Weekend mornings',
  'Weekend afternoons',
  'Lunch breaks',
] as const;
export type Availability = (typeof AVAILABILITY)[number];

/** Broad grouping used by Discover filters and the Create screen's "Type". */
export const ACTIVITY_GROUPS = ['Social', 'Sports', 'Running', 'Creative', 'Food'] as const;
export type ActivityGroup = (typeof ACTIVITY_GROUPS)[number];

export const DISCOVER_FILTERS = [
  'All',
  'Tonight',
  'Weekend',
  'Sports',
  'Social',
  'Creative',
  'Food',
] as const;
export type DiscoverFilter = (typeof DISCOVER_FILTERS)[number];

/**
 * Areas users pick at sign-up. Coordinates are approximate area centres and
 * stand in for an activity's location until the Create screen gets a map picker.
 */
export const AREAS = {
  'Colombo 03': { lat: 6.911, lng: 79.851 },
  'Colombo 05': { lat: 6.889, lng: 79.865 },
  'Colombo 07': { lat: 6.906, lng: 79.864 },
  Dehiwala: { lat: 6.851, lng: 79.865 },
  Nugegoda: { lat: 6.872, lng: 79.889 },
  Rajagiriya: { lat: 6.909, lng: 79.894 },
  'Mount Lavinia': { lat: 6.839, lng: 79.863 },
  Battaramulla: { lat: 6.899, lng: 79.918 },
} as const;
export type Area = keyof typeof AREAS;
export const AREA_NAMES = Object.keys(AREAS) as [Area, ...Area[]];
export const DEFAULT_AREA: Area = 'Colombo 07';

export const LIMITS = {
  /** People who can wait for a spot on a full activity. */
  waitlistMax: 10,
  nameMax: 60,
  bioMax: 280,
  titleMin: 3,
  titleMax: 80,
  placeMax: 120,
  descriptionMax: 1000,
  capacityMin: 2,
  capacityMax: 30,
  /** Furthest ahead an activity can be scheduled. */
  maxDaysAhead: 90,
  messageMax: 2000,
  reportDetailsMax: 1000,
  /** Largest image the app may upload, in bytes. */
  uploadMaxBytes: 5 * 1024 * 1024,
} as const;

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type ImageType = (typeof IMAGE_TYPES)[number];
