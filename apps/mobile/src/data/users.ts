import type { UserProfile } from '@/types/models';
import { portrait } from './images';

const user = (
  name: string,
  face: string,
  p: Omit<UserProfile, 'name' | 'avatar'>,
): UserProfile => ({
  name,
  avatar: portrait(face),
  ...p,
});

export const USERS: Record<string, UserProfile> = Object.fromEntries(
  [
    user('Nethmi', 'women/44', {
      area: 'Colombo 03',
      since: 'Jan 2025',
      bio: 'Sunset runs on the Green most evenings. Happy to pace beginners.',
      tags: ['Running', 'Yoga', 'Food markets'],
      hosted: 14,
      joined: 22,
    }),
    user('Dilan', 'men/22', {
      area: 'Kollupitiya',
      since: 'Mar 2025',
      bio: 'Board game collector. If you haven’t played Wingspan yet, I’ll teach you.',
      tags: ['Board games', 'Live music', 'Cooking'],
      hosted: 11,
      joined: 9,
    }),
    user('Shehani', 'women/65', {
      area: 'Havelock Town',
      since: 'Jun 2025',
      bio: 'Early padel, late brunch.',
      tags: ['Padel', 'Running', 'Food markets'],
      hosted: 6,
      joined: 18,
    }),
    user('Amaya', 'women/68', {
      area: 'Colombo 07',
      since: 'Nov 2024',
      bio: 'Illustrator. Running untutored life drawing at the Lionel Wendt.',
      tags: ['Life drawing', 'Photography', 'Live music'],
      hosted: 9,
      joined: 12,
    }),
    user('Ravindu', 'men/45', {
      area: 'Rajagiriya',
      since: 'Feb 2025',
      bio: 'Climbing V4s, mostly falling off V5s.',
      tags: ['Climbing', 'Cycling', 'Running'],
      hosted: 5,
      joined: 15,
    }),
    user('Fathima', 'women/12', {
      area: 'Wellawatte',
      since: 'Aug 2025',
      bio: 'Food walks around Pettah and the Fort. Always hungry.',
      tags: ['Food markets', 'Cooking', 'Photography'],
      hosted: 3,
      joined: 7,
    }),
    user('Kasun', 'men/75', {
      area: 'Mount Lavinia',
      since: 'Sep 2024',
      bio: 'Sunday beach cricket organiser. All abilities, all ages.',
      tags: ['Cricket', 'Running', 'Live music'],
      hosted: 21,
      joined: 30,
    }),
    user('Ishara', 'women/21', {
      area: 'Dehiwala',
      since: 'May 2025',
      bio: 'New to Colombo, saying yes to everything.',
      tags: ['Running', 'Board games', 'Cooking'],
      hosted: 0,
      joined: 6,
    }),
    user('Tharindu', 'men/36', {
      area: 'Nugegoda',
      since: 'Apr 2025',
      bio: 'Weekend cyclist and amateur photographer.',
      tags: ['Cycling', 'Photography', 'Cricket'],
      hosted: 2,
      joined: 11,
    }),
    user('Sanduni', 'women/33', {
      area: 'Battaramulla',
      since: 'Jul 2025',
      bio: 'Yoga in the mornings, games at night.',
      tags: ['Yoga', 'Board games', 'Life drawing'],
      hosted: 1,
      joined: 8,
    }),
    user('Ashan', 'men/52', {
      area: 'Colombo 05',
      since: 'Dec 2024',
      bio: 'Padel and plain tea.',
      tags: ['Padel', 'Cricket', 'Food markets'],
      hosted: 4,
      joined: 13,
    }),
  ].map((u) => [u.name, u]),
);

/** Faces used for the "going" avatar stack on activity details. */
export const ATTENDEE_FACES = [
  'men/11',
  'women/21',
  'men/36',
  'women/33',
  'men/52',
  'women/57',
  'men/64',
  'women/79',
  'men/85',
  'women/90',
  'men/18',
  'women/29',
  'men/41',
  'women/50',
  'men/60',
].map(portrait);

export const getUser = (name: string): UserProfile =>
  USERS[name] ?? {
    name,
    area: 'Colombo',
    since: '2025',
    bio: '',
    tags: [],
    hosted: 0,
    joined: 0,
    avatar: '',
  };
