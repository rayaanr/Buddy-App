/**
 * Loads the Colombo sample data the app was designed with.
 * Wipes all data first, so it refuses to run in production.
 *
 *   npm run db:seed -w @buddy/api
 */
import { atLocalTime, daysUntilWeekday, type ActivityGroup, type Area } from '@buddy/shared';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';

import { createDb, type Db } from '../src/db/client';
import * as s from '../src/db/schema';
import { areaCentre } from '../src/modules/profiles/service';

const unsplash = (id: string) =>
  `https://images.unsplash.com/photo-${id}?w=800&q=70&auto=format&fit=crop`;
const portrait = (path: string) => `https://randomuser.me/api/portraits/${path}.jpg`;

/** Sign in as this account to explore the seeded data (code appears in the API log). */
export const DEMO_EMAIL = 'kavindu@buddy.test';

const PEOPLE = [
  [
    'Kavindu Perera',
    'men/32',
    'Colombo 07',
    'Mar 2025',
    '',
    ['Running', 'Climbing', 'Board games'],
  ],
  [
    'Nethmi',
    'women/44',
    'Colombo 03',
    'Jan 2025',
    'Sunset runs on the Green most evenings. Happy to pace beginners.',
    ['Running', 'Yoga', 'Food markets'],
  ],
  [
    'Dilan',
    'men/22',
    'Colombo 03',
    'Mar 2025',
    'Board game collector. If you haven’t played Wingspan yet, I’ll teach you.',
    ['Board games', 'Live music', 'Cooking'],
  ],
  [
    'Shehani',
    'women/65',
    'Colombo 05',
    'Jun 2025',
    'Early padel, late brunch.',
    ['Padel', 'Running', 'Food markets'],
  ],
  [
    'Amaya',
    'women/68',
    'Colombo 07',
    'Nov 2024',
    'Illustrator. Running untutored life drawing at the Lionel Wendt.',
    ['Life drawing', 'Photography', 'Live music'],
  ],
  [
    'Ravindu',
    'men/45',
    'Rajagiriya',
    'Feb 2025',
    'Climbing V4s, mostly falling off V5s.',
    ['Climbing', 'Cycling', 'Running'],
  ],
  [
    'Fathima',
    'women/12',
    'Dehiwala',
    'Aug 2025',
    'Food walks around Pettah and the Fort. Always hungry.',
    ['Food markets', 'Cooking', 'Photography'],
  ],
  [
    'Kasun',
    'men/75',
    'Mount Lavinia',
    'Sep 2024',
    'Sunday beach cricket organiser. All abilities, all ages.',
    ['Cricket', 'Running', 'Live music'],
  ],
  [
    'Ishara',
    'women/21',
    'Dehiwala',
    'May 2025',
    'New to Colombo, saying yes to everything.',
    ['Running', 'Board games', 'Cooking'],
  ],
  [
    'Tharindu',
    'men/36',
    'Nugegoda',
    'Apr 2025',
    'Weekend cyclist and amateur photographer.',
    ['Cycling', 'Photography', 'Cricket'],
  ],
  [
    'Sanduni',
    'women/33',
    'Battaramulla',
    'Jul 2025',
    'Yoga in the mornings, games at night.',
    ['Yoga', 'Board games', 'Life drawing'],
  ],
  [
    'Ashan',
    'men/52',
    'Colombo 05',
    'Dec 2024',
    'Padel and plain tea.',
    ['Padel', 'Cricket', 'Food markets'],
  ],
  ['Malsha', 'women/57', 'Nugegoda', 'Jul 2025', '', ['Yoga', 'Running', 'Cooking']],
  ['Chamod', 'men/64', 'Rajagiriya', 'Aug 2025', '', ['Cricket', 'Cycling', 'Climbing']],
  ['Dinithi', 'women/79', 'Colombo 07', 'May 2025', '', ['Life drawing', 'Photography', 'Yoga']],
  ['Pasindu', 'men/85', 'Battaramulla', 'Jun 2025', '', ['Board games', 'Running', 'Padel']],
] as const;

const COMMUNITIES = [
  {
    key: 'c1',
    name: 'Colombo Runners',
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
    key: 'c2',
    name: 'Colombo Board Gamers',
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
    key: 'c3',
    name: 'Climb Lanka',
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
    key: 'c4',
    name: 'Colombo Sketch Club',
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
] as const;

type Day = 'Tonight' | 'Tomorrow' | 'Sat' | 'Sun';
interface SeedActivity {
  title: string;
  category: string;
  group: ActivityGroup;
  interest: string;
  day: Day;
  time: string;
  place: string;
  area: Area;
  at: { lat: number; lng: number };
  capacity: number;
  going: number;
  host: string;
  community?: string;
  cover: string;
  description: string;
  messages: ([from: string, text: string] | ['system', string])[];
  /** Kavindu is already in this one. */
  demoJoined?: boolean;
}

const ACTIVITIES: SeedActivity[] = [
  {
    title: 'Sunset 5K at Galle Face',
    category: 'RUNNING',
    group: 'Running',
    interest: 'Running',
    day: 'Tonight',
    time: '18:00',
    place: 'Galle Face Green',
    area: 'Colombo 03',
    at: { lat: 6.9271, lng: 79.845 },
    capacity: 15,
    going: 9,
    host: 'Nethmi',
    community: 'c1',
    cover: '1552674605-db6ffd4facb5',
    description:
      'Easy conversational pace along the promenade, around 6 min/km. We finish near the lighthouse and grab king coconut after.',
    messages: [['Nethmi', 'Hi all, meeting by the flag post at the Kollupitiya end.']],
  },
  {
    title: 'Board games night',
    category: 'SOCIAL',
    group: 'Social',
    interest: 'Board games',
    day: 'Tonight',
    time: '19:30',
    place: 'The Commons',
    area: 'Colombo 03',
    at: { lat: 6.91, lng: 79.852 },
    capacity: 8,
    going: 6,
    host: 'Dilan',
    community: 'c2',
    cover: '1529156069898-49953e39b3ac',
    description: 'Bringing Catan and Codenames. Beginners very welcome.',
    messages: [['Dilan', 'Table booked upstairs under Dilan. See you at 7.30.']],
  },
  {
    title: 'Padel doubles, need one more',
    category: 'PADEL',
    group: 'Sports',
    interest: 'Padel',
    day: 'Tomorrow',
    time: '06:30',
    place: 'Padel Lanka',
    area: 'Colombo 05',
    at: { lat: 6.885, lng: 79.866 },
    capacity: 4,
    going: 4,
    host: 'Shehani',
    cover: '1554068865-24cecd4e34b8',
    description:
      'Intermediate level. Early slot before the heat. Court is split four ways, about Rs 2,500 each.',
    messages: [
      ['Shehani', 'Court 2 booked for 06:30.'],
      ['system', 'Kavindu joined'],
      ['Shehani', 'Perfect. Meet at reception at 06:20.'],
    ],
    demoJoined: true,
  },
  {
    title: 'Life drawing, untutored session',
    category: 'LIFE DRAWING',
    group: 'Creative',
    interest: 'Life drawing',
    day: 'Sat',
    time: '10:00',
    place: 'Lionel Wendt Art Centre',
    area: 'Colombo 07',
    at: { lat: 6.9045, lng: 79.862 },
    capacity: 12,
    going: 5,
    host: 'Amaya',
    community: 'c4',
    cover: '1513364776144-60967b0f800f',
    description:
      'Two hours with a model, short and long poses. Paper provided, bring your own pencils.',
    messages: [['Amaya', 'Doors open 9.45. Studio is at the back of the gallery.']],
  },
  {
    title: 'Bouldering social',
    category: 'CLIMBING',
    group: 'Sports',
    interest: 'Climbing',
    day: 'Sat',
    time: '16:00',
    place: 'Climb Colombo',
    area: 'Rajagiriya',
    at: { lat: 6.91, lng: 79.896 },
    capacity: 10,
    going: 3,
    host: 'Ravindu',
    community: 'c3',
    cover: '1522163182402-834f871fd851',
    description: 'All grades. Shoe hire available at the desk.',
    messages: [['Ravindu', 'I’ll be by the lockers in a blue t-shirt.']],
  },
  {
    title: 'Pettah market food walk',
    category: 'FOOD MARKETS',
    group: 'Food',
    interest: 'Food markets',
    day: 'Sun',
    time: '08:30',
    place: 'Pettah Floating Market',
    area: 'Colombo 03',
    at: { lat: 6.9335, lng: 79.853 },
    capacity: 8,
    going: 4,
    host: 'Fathima',
    cover: '1488459716781-31db52582fe9',
    description:
      'Slow wander through the stalls. Kiribath and plain tea first, then short eats along the way.',
    messages: [['Fathima', 'Meet at the main entrance near Bastian Mawatha.']],
  },
  {
    title: 'Beach cricket, softball',
    category: 'CRICKET',
    group: 'Sports',
    interest: 'Cricket',
    day: 'Sun',
    time: '16:30',
    place: 'Mount Lavinia Beach',
    area: 'Mount Lavinia',
    at: { lat: 6.838, lng: 79.862 },
    capacity: 12,
    going: 8,
    host: 'Kasun',
    cover: '1531415074968-036ba1b575da',
    description: 'Friendly tape-ball game, mixed ability. Bring water and a hat.',
    messages: [['Kasun', 'Bat and stumps sorted. Meet near the hotel steps.']],
  },
  {
    title: 'Saturday 10K, Viharamahadevi Park',
    category: 'RUNNING',
    group: 'Running',
    interest: 'Running',
    day: 'Sat',
    time: '06:00',
    place: 'Viharamahadevi Park',
    area: 'Colombo 07',
    at: { lat: 6.913, lng: 79.861 },
    capacity: 20,
    going: 11,
    host: 'Nethmi',
    community: 'c1',
    cover: '1476480862126-209bfaa8edc8',
    description: 'Two loops of the park before it gets hot. Two pace groups, 5:30 and 6:30 min/km.',
    messages: [['Nethmi', 'Meeting at the Town Hall entrance.']],
  },
  {
    title: 'Sketching at Gangaramaya',
    category: 'SKETCHING',
    group: 'Creative',
    interest: 'Life drawing',
    day: 'Sun',
    time: '15:00',
    place: 'Gangaramaya Temple',
    area: 'Colombo 03',
    at: { lat: 6.9165, lng: 79.8565 },
    capacity: 10,
    going: 4,
    host: 'Amaya',
    community: 'c4',
    cover: '1460661419201-fd4cecdf8a8b',
    description: 'Urban sketching around the temple and Seema Malaka. Any materials.',
    messages: [['Amaya', 'Dress respectfully for the temple grounds.']],
  },
];

/** The next occurrence of the mock's day label, never in the past. */
function startsAt(day: Day, time: string, now: Date) {
  const offset =
    day === 'Tonight' ? 0 : day === 'Tomorrow' ? 1 : daysUntilWeekday(day === 'Sat' ? 6 : 0, now);
  const at = atLocalTime(offset, time, now);
  if (at > now) return at;
  return atLocalTime(offset + (offset === 0 ? 1 : 7), time, now);
}

const sinceToDate = (since: string) => new Date(`1 ${since} 12:00 UTC`);

export async function seed(db: Db, now = new Date()) {
  await db.execute(sql`
    truncate table reports, blocks, push_tokens, chat_reads, messages, activity_members,
      activities, community_members, communities, profiles, verification, account, session, "user"
    restart identity cascade`);

  const ids = new Map<string, string>();
  for (const [name, face, area, since, bio, interests] of PEOPLE) {
    const id = randomUUID();
    ids.set(name, id);
    const email = `${name.split(' ')[0]!.toLowerCase()}@buddy.test`;
    await db.insert(s.user).values({
      id,
      name,
      email,
      emailVerified: true,
      createdAt: sinceToDate(since),
      updatedAt: now,
    });
    await db.insert(s.profiles).values({
      userId: id,
      area,
      bio,
      interests: [...interests],
      availability: ['Weekday evenings'],
      avatarUrl: portrait(face),
      createdAt: sinceToDate(since),
    });
  }
  const idOf = (name: string) => {
    const id = ids.get(name);
    if (!id) throw new Error(`Seed refers to unknown person ${name}`);
    return id;
  };
  const demo = idOf('Kavindu Perera');

  const communityIds = new Map<string, string>();
  for (const c of COMMUNITIES) {
    const [row] = await db
      .insert(s.communities)
      .values({ name: c.name, about: c.about, rules: [...c.rules], coverUrl: unsplash(c.cover) })
      .returning({ id: s.communities.id });
    communityIds.set(c.key, row!.id);
    await db
      .insert(s.communityMembers)
      .values(c.people.map((p) => ({ communityId: row!.id, userId: idOf(p) })));
  }

  // People who fill "going" counts; never the demo user, so their picks stay open.
  const pool = PEOPLE.map(([name]) => name).filter((n) => n !== 'Kavindu Perera');

  for (const a of ACTIVITIES) {
    const start = startsAt(a.day, a.time, now);
    const [row] = await db
      .insert(s.activities)
      .values({
        hostId: idOf(a.host),
        communityId: a.community ? communityIds.get(a.community)! : null,
        title: a.title,
        category: a.category,
        group: a.group,
        interest: a.interest,
        startsAt: start,
        place: a.place,
        area: a.area,
        location: a.at ?? areaCentre(a.area),
        capacity: a.capacity,
        description: a.description,
        coverUrl: unsplash(a.cover),
      })
      .returning({ id: s.activities.id });
    const activityId = row!.id;

    const guests = pool.filter((n) => n !== a.host).slice(0, a.going - 1 - (a.demoJoined ? 1 : 0));
    const members = [
      { activityId, userId: idOf(a.host), role: 'host' },
      ...guests.map((n) => ({ activityId, userId: idOf(n), role: 'guest' })),
      ...(a.demoJoined ? [{ activityId, userId: demo, role: 'guest' }] : []),
    ];
    await db.insert(s.activityMembers).values(members);

    // Space messages a minute apart, ending an hour ago, so ordering is stable.
    const base = now.getTime() - 60 * 60 * 1000 - a.messages.length * 60 * 1000;
    await db.insert(s.messages).values(
      a.messages.map(([from, text], i) => ({
        id: randomUUID(),
        activityId,
        senderId: from === 'system' ? null : idOf(from),
        kind: from === 'system' ? 'system' : 'user',
        body: text,
        createdAt: new Date(base + i * 60 * 1000),
      })),
    );
  }

  return { users: PEOPLE.length, communities: COMMUNITIES.length, activities: ACTIVITIES.length };
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to seed a production database: seeding deletes all data.');
    process.exit(1);
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }
  const { db, close } = createDb(url, { max: 1 });
  seed(db)
    .then((counts) => console.log('Seeded', counts, `— sign in as ${DEMO_EMAIL}`))
    .finally(() => close());
}
