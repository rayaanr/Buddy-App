import type { ActivityGroup } from '@/types/models';
import { unsplash } from './images';

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

export const AVAILABILITY = [
  'Weekday evenings',
  'Weekend mornings',
  'Weekend afternoons',
  'Lunch breaks',
] as const;

export const MIN_INTERESTS = 3;

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

export const SIGNUP_AREAS = [
  'Colombo 03',
  'Colombo 05',
  'Colombo 07',
  'Dehiwala',
  'Nugegoda',
  'Rajagiriya',
  'Mount Lavinia',
  'Battaramulla',
] as const;
export const DEFAULT_AREA = 'Colombo 07';

export interface ActivityType {
  label: string;
  group: ActivityGroup;
  category: string;
  hue: string;
  image: string;
}

export const ACTIVITY_TYPES: ActivityType[] = [
  {
    label: 'Social',
    group: 'Social',
    category: 'SOCIAL',
    hue: '#5a2a2a',
    image: unsplash('1543269865-cbf427effbad'),
  },
  {
    label: 'Sports',
    group: 'Sports',
    category: 'SPORTS',
    hue: '#0f4550',
    image: unsplash('1574629810360-7efbbe195018'),
  },
  {
    label: 'Running',
    group: 'Running',
    category: 'RUNNING',
    hue: '#5a3420',
    image: unsplash('1552674605-db6ffd4facb5'),
  },
  {
    label: 'Creative',
    group: 'Creative',
    category: 'CREATIVE',
    hue: '#45345a',
    image: unsplash('1460661419201-fd4cecdf8a8b'),
  },
  {
    label: 'Food & markets',
    group: 'Food',
    category: 'FOOD & MARKETS',
    hue: '#5a4818',
    image: unsplash('1488459716781-31db52582fe9'),
  },
];

export const CREATE_DAYS = ['Today', 'Tmrw', 'Sat', 'Sun'] as const;
export type CreateDay = (typeof CREATE_DAYS)[number];

export const CREATE_TIMES = ['07:30', '10:00', '12:30', '18:30', '19:30', '20:00'] as const;

export const SPOTS_MIN = 2;
export const SPOTS_MAX = 30;

export const AUTO_REPLIES = [
  'Nice, see you there!',
  'Welcome 👋',
  'Great, the more the merrier.',
  'Perfect. I’ll be near the entrance.',
  'Brilliant, see you soon.',
];

/** People who reply in chats for activities you host. */
export const GUEST_REPLIERS = ['Ishara', 'Tharindu', 'Sanduni', 'Ashan'];

export const RECENT_ACTIVITY = [
  { title: 'Viharamahadevi Park 10K', date: '28 Sep' },
  { title: 'Catan at Barefoot Café', date: '21 Sep' },
  { title: 'Beach cricket, Mount Lavinia', date: '14 Sep' },
];

export const DEFAULT_ACCOUNT = { name: 'Kavindu Perera', location: 'Colombo 07, Sri Lanka' };
export const DEFAULT_INTERESTS = ['Running', 'Climbing', 'Board games'];
