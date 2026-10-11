export interface SeedCommunity {
  key: string;
  name: string;
  /** Unsplash photo id; without one the app shows a plain tile. */
  cover?: string;
  about: string;
  /** Town it meets in (a name from the places table). */
  area: string;
  rules: string[];
  /** Member names; see people.ts. */
  people: string[];
}

/** The communities the tests rely on. */
export const COMMUNITIES: SeedCommunity[] = [
  {
    key: 'runners',
    name: 'Colombo Runners',
    area: 'Colombo 7',
    cover: '1476480862126-209bfaa8edc8',
    about:
      'Free group runs around Colombo, four times a week. Galle Face at sunset, Viharamahadevi Park on weekend mornings. Every pace is welcome and nobody gets left behind.',
    rules: [
      'Wait at every turn for the back of the group.',
      'Cancel in the app if you can’t make it.',
      'No pressure to race. It’s a social run.',
    ],
    people: ['Nethmi', 'Ishara', 'Ashan', 'Shehani', 'Tharindu', 'Ravindu'],
  },
  {
    key: 'gamers',
    name: 'Colombo Board Gamers',
    area: 'Colombo 3',
    cover: '1543269865-cbf427effbad',
    about:
      'Weekly games nights in cafés around Colombo 03 and 07. Bring a game or learn a new one.',
    rules: [
      'Teach the rules before you start.',
      'Buy something from the café.',
      'Look after shared games.',
    ],
    people: ['Dilan', 'Sanduni', 'Ishara', 'Ashan', 'Amaya', 'Kasun', 'Kavindu Perera'],
  },
  {
    key: 'climb',
    name: 'Climb Lanka',
    area: 'Colombo 5',
    cover: '1522163182402-834f871fd851',
    about: 'Bouldering sessions at Climb Colombo and weekend trips to the crags near Kandy.',
    rules: [
      'Spot each other on high problems.',
      'Brush holds when you finish.',
      'Beginners pair with an experienced climber.',
    ],
    people: ['Ravindu', 'Tharindu', 'Shehani', 'Ashan', 'Nethmi', 'Kasun'],
  },
  {
    key: 'sketch',
    name: 'Colombo Sketch Club',
    area: 'Colombo 7',
    cover: '1460661419201-fd4cecdf8a8b',
    about:
      'Urban sketching and life drawing around Colombo. Temples, markets, the Fort and the odd studio session.',
    rules: [
      'Any skill level, any materials.',
      'Ask before sketching people up close.',
      'Share your page at the end if you like.',
    ],
    people: ['Amaya', 'Sanduni', 'Fathima', 'Tharindu', 'Ishara', 'Dilan'],
  },
];

/** Extra communities for exploring the app locally. */
export const DEMO_COMMUNITIES: SeedCommunity[] = [
  {
    key: 'food',
    name: 'Colombo Food Walkers',
    area: 'Colombo 11',
    cover: '1488459716781-31db52582fe9',
    about:
      'Street food crawls, market mornings and the occasional cook-along. We eat our way across a different neighbourhood every month.',
    rules: [
      'Bring cash for the stalls.',
      'Tell the host about allergies before the walk.',
      'Share the good finds in the chat.',
    ],
    people: ['Fathima', 'Malsha', 'Nethmi', 'Shehani', 'Dilan', 'Ishara', 'Ashan'],
  },
  {
    key: 'cycle',
    name: 'Sunday Spinners',
    area: 'Kandy',
    about:
      'Easy weekend rides around Diyawanna and out towards the paddy fields. Road bikes, hybrids and borrowed bikes all welcome.',
    rules: ['Helmets on, always.', 'Regroup at every stop.', 'Lights if we ride before sunrise.'],
    people: ['Chamod', 'Tharindu', 'Ravindu', 'Pasindu'],
  },
];

/** Communities the demo user joins on top of the core set: [community key, person]. */
export const DEMO_MEMBERSHIPS: [string, string][] = [
  ['climb', 'Kavindu Perera'],
  ['food', 'Kavindu Perera'],
];
