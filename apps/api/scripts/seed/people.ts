import type { Area, Availability, Interest } from '@buddy/shared';

export interface SeedPerson {
  name: string;
  /** randomuser.me portrait path, e.g. "men/32". */
  face: string;
  area: Area;
  /** "Member since", as "Mon YYYY". */
  since: string;
  bio: string;
  interests: Interest[];
  availability?: Availability[];
}

/** The demo account. Its email is derived like everyone else's: kavindu@buddy.test. */
export const DEMO_NAME = 'Kavindu Perera';

/** Everyone signs in as `<first name>@buddy.test`. */
export const emailOf = (name: string) => `${name.split(' ')[0]!.toLowerCase()}@buddy.test`;

export const PEOPLE: SeedPerson[] = [
  {
    name: DEMO_NAME,
    face: 'men/32',
    area: 'Colombo 07',
    since: 'Mar 2025',
    bio: '',
    interests: ['Running', 'Climbing', 'Board games'],
  },
  {
    name: 'Nethmi',
    face: 'women/44',
    area: 'Colombo 03',
    since: 'Jan 2025',
    bio: 'Sunset runs on the Green most evenings. Happy to pace beginners.',
    interests: ['Running', 'Yoga', 'Food markets'],
  },
  {
    name: 'Dilan',
    face: 'men/22',
    area: 'Colombo 03',
    since: 'Mar 2025',
    bio: 'Board game collector. If you haven’t played Wingspan yet, I’ll teach you.',
    interests: ['Board games', 'Live music', 'Cooking'],
  },
  {
    name: 'Shehani',
    face: 'women/65',
    area: 'Colombo 05',
    since: 'Jun 2025',
    bio: 'Early padel, late brunch.',
    interests: ['Padel', 'Running', 'Food markets'],
  },
  {
    name: 'Amaya',
    face: 'women/68',
    area: 'Colombo 07',
    since: 'Nov 2024',
    bio: 'Illustrator. Running untutored life drawing at the Lionel Wendt.',
    interests: ['Life drawing', 'Photography', 'Live music'],
  },
  {
    name: 'Ravindu',
    face: 'men/45',
    area: 'Rajagiriya',
    since: 'Feb 2025',
    bio: 'Climbing V4s, mostly falling off V5s.',
    interests: ['Climbing', 'Cycling', 'Running'],
  },
  {
    name: 'Fathima',
    face: 'women/12',
    area: 'Dehiwala',
    since: 'Aug 2025',
    bio: 'Food walks around Pettah and the Fort. Always hungry.',
    interests: ['Food markets', 'Cooking', 'Photography'],
  },
  {
    name: 'Kasun',
    face: 'men/75',
    area: 'Mount Lavinia',
    since: 'Sep 2024',
    bio: 'Sunday beach cricket organiser. All abilities, all ages.',
    interests: ['Cricket', 'Running', 'Live music'],
  },
  {
    name: 'Ishara',
    face: 'women/21',
    area: 'Dehiwala',
    since: 'May 2025',
    bio: 'New to Colombo, saying yes to everything.',
    interests: ['Running', 'Board games', 'Cooking'],
  },
  {
    name: 'Tharindu',
    face: 'men/36',
    area: 'Nugegoda',
    since: 'Apr 2025',
    bio: 'Weekend cyclist and amateur photographer.',
    interests: ['Cycling', 'Photography', 'Cricket'],
  },
  {
    name: 'Sanduni',
    face: 'women/33',
    area: 'Battaramulla',
    since: 'Jul 2025',
    bio: 'Yoga in the mornings, games at night.',
    interests: ['Yoga', 'Board games', 'Life drawing'],
  },
  {
    name: 'Ashan',
    face: 'men/52',
    area: 'Colombo 05',
    since: 'Dec 2024',
    bio: 'Padel and plain tea.',
    interests: ['Padel', 'Cricket', 'Food markets'],
  },
  {
    name: 'Malsha',
    face: 'women/57',
    area: 'Nugegoda',
    since: 'Jul 2025',
    bio: '',
    interests: ['Yoga', 'Running', 'Cooking'],
  },
  {
    name: 'Chamod',
    face: 'men/64',
    area: 'Rajagiriya',
    since: 'Aug 2025',
    bio: '',
    interests: ['Cricket', 'Cycling', 'Climbing'],
  },
  {
    name: 'Dinithi',
    face: 'women/79',
    area: 'Colombo 07',
    since: 'May 2025',
    bio: '',
    interests: ['Life drawing', 'Photography', 'Yoga'],
  },
  {
    name: 'Pasindu',
    face: 'men/85',
    area: 'Battaramulla',
    since: 'Jun 2025',
    bio: '',
    interests: ['Board games', 'Running', 'Padel'],
  },
];
