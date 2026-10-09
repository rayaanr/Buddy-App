import type { Community } from '@/types/models';
import { unsplash } from './images';

export const SEED_COMMUNITIES: Community[] = [
  {
    id: 'c1',
    name: 'Colombo Runners',
    members: '2.4k',
    weekly: 4,
    hue: '#5a3420',
    image: unsplash('1476480862126-209bfaa8edc8'),
    joined: false,
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
    id: 'c2',
    name: 'Colombo Board Gamers',
    members: '860',
    weekly: 3,
    hue: '#5a2a2a',
    image: unsplash('1543269865-cbf427effbad'),
    joined: true,
    about:
      'Weekly games nights in cafés around Colombo 03 and 07. Bring a game or learn a new one.',
    rules: [
      'Teach the rules before you start.',
      'Buy something from the café.',
      'Look after shared games.',
    ],
    people: ['Dilan', 'Sanduni', 'Ishara', 'Ashan', 'Amaya', 'Kasun'],
  },
  {
    id: 'c3',
    name: 'Climb Lanka',
    members: '1.1k',
    weekly: 2,
    hue: '#24452c',
    image: unsplash('1522163182402-834f871fd851'),
    joined: false,
    about: 'Bouldering sessions at Climb Colombo and weekend trips to the crags near Kandy.',
    rules: [
      'Spot each other on high problems.',
      'Brush holds when you finish.',
      'Beginners pair with an experienced climber.',
    ],
    people: ['Ravindu', 'Tharindu', 'Shehani', 'Ashan', 'Nethmi', 'Kasun'],
  },
  {
    id: 'c4',
    name: 'Colombo Sketch Club',
    members: '540',
    weekly: 2,
    hue: '#45345a',
    image: unsplash('1460661419201-fd4cecdf8a8b'),
    joined: false,
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
