/**
 * Colombo sample data, in two layers:
 *  - core: what the app was designed with. The integration tests seed this
 *    before every test and assert on it, so change it with the tests.
 *  - demo: extras for exploring the app locally (hosting, a full activity,
 *    every area and filter, past activities). `bun run db:seed` loads both.
 *
 * Seeding wipes all data first.
 */
import { atLocalTime, daysUntilWeekday, placeLabel } from '@buddy/shared';
import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';

import type { Db } from '../../src/db/client';
import * as s from '../../src/db/schema';
import { stockCover } from '../../src/modules/activities/service';
import { ACTIVITIES, DEMO_ACTIVITIES, type SeedActivity, type When } from './activities';
import { COMMUNITIES, DEMO_COMMUNITIES, DEMO_MEMBERSHIPS } from './communities';
import { DEMO_NAME, PEOPLE, emailOf } from './people';

/** Sign in as this account to explore the seeded data (the code appears in the API log). */
export const DEMO_EMAIL = emailOf(DEMO_NAME);

const MINUTE = 60 * 1000;
const unsplash = (id: string) =>
  `https://images.unsplash.com/photo-${id}?w=800&q=70&auto=format&fit=crop`;
const portrait = (path: string) => `https://randomuser.me/api/portraits/${path}.jpg`;
const sinceToDate = (since: string) => new Date(`1 ${since} 12:00 UTC`);

function startsAt(when: When, now: Date) {
  if ('daysAgo' in when) return atLocalTime(-when.daysAgo, when.time, now);
  if ('inDays' in when) return atLocalTime(when.inDays, when.time, now);
  // Day labels mean the next occurrence, so roll over once the time has passed.
  const { day, time } = when;
  const offset =
    day === 'Tonight' ? 0 : day === 'Tomorrow' ? 1 : daysUntilWeekday(day === 'Sat' ? 6 : 0, now);
  const at = atLocalTime(offset, time, now);
  return at > now ? at : atLocalTime(offset + (offset === 0 ? 1 : 7), time, now);
}

export interface SeedOptions {
  now?: Date;
  /** Add the demo layer on top of the core data. */
  demo?: boolean;
}

export async function seed(db: Db, { now = new Date(), demo = false }: SeedOptions = {}) {
  const communities = demo ? [...COMMUNITIES, ...DEMO_COMMUNITIES] : COMMUNITIES;
  const activities = demo ? [...ACTIVITIES, ...DEMO_ACTIVITIES] : ACTIVITIES;

  await db.execute(sql`
    truncate table reports, blocks, push_tokens, chat_reads, messages, activity_members,
      activities, community_members, communities, profiles, verification, account, session, "user"
    restart identity cascade`);

  // Towns are loaded by a migration; seed data names them.
  const towns = new Map<string, typeof s.places.$inferSelect>();
  const town = async (name: string) => {
    if (!towns.has(name)) {
      const [row] = await db.select().from(s.places).where(eq(s.places.name, name));
      if (!row) throw new Error(`Seed names an unknown town: ${name}`);
      towns.set(name, row);
    }
    return towns.get(name)!;
  };

  // People
  const ids = new Map<string, string>();
  for (const p of PEOPLE) {
    const id = randomUUID();
    ids.set(p.name, id);
    await db.insert(s.user).values({
      id,
      name: p.name,
      email: emailOf(p.name),
      emailVerified: true,
      createdAt: sinceToDate(p.since),
      updatedAt: now,
    });
    await db.insert(s.profiles).values({
      userId: id,
      placeId: (await town(p.area)).id,
      bio: p.bio,
      interests: p.interests,
      availability: p.availability ?? ['Weekday evenings'],
      avatarUrl: portrait(p.face),
      createdAt: sinceToDate(p.since),
    });
  }
  const idOf = (name: string) => {
    const id = ids.get(name);
    if (!id) throw new Error(`Seed refers to unknown person "${name}"`);
    return id;
  };

  // Communities
  const communityIds = new Map<string, string>();
  for (const c of communities) {
    const [row] = await db
      .insert(s.communities)
      .values({
        name: c.name,
        about: c.about,
        rules: c.rules,
        coverUrl: c.cover ? unsplash(c.cover) : null,
      })
      .returning({ id: s.communities.id });
    communityIds.set(c.key, row!.id);
    await db
      .insert(s.communityMembers)
      .values(c.people.map((p) => ({ communityId: row!.id, userId: idOf(p) })));
  }
  if (demo) {
    await db.insert(s.communityMembers).values(
      DEMO_MEMBERSHIPS.map(([key, p]) => ({
        communityId: communityIds.get(key)!,
        userId: idOf(p),
      })),
    );
  }
  const communityOf = (key: string) => {
    const id = communityIds.get(key);
    if (!id) throw new Error(`Seed refers to unknown community "${key}"`);
    return id;
  };

  // Activities. Guests are the people who chat, then others to make up the
  // count; never the demo user unless `demoJoined`, so their picks stay open.
  const pool = PEOPLE.map((p) => p.name).filter((n) => n !== DEMO_NAME);
  for (const [i, a] of activities.entries()) {
    const start = startsAt(a.when, now);
    const [row] = await db
      .insert(s.activities)
      .values({
        hostId: idOf(a.host),
        communityId: a.community ? communityOf(a.community) : null,
        title: a.title,
        category: a.category,
        group: a.group,
        interest: a.interest ?? null,
        startsAt: start,
        place: a.place,
        area: placeLabel(await town(a.area)),
        placeId: (await town(a.area)).id,
        location: a.at ?? (await town(a.area)).location,
        capacity: a.capacity,
        description: a.description,
        coverUrl: a.cover ? unsplash(a.cover) : stockCover(a.group),
        createdAt: new Date(Math.min(now.getTime(), start.getTime()) - 2 * 24 * 60 * MINUTE),
      })
      .returning({ id: s.activities.id });
    const activityId = row!.id;

    const members = guestsFor(a, pool, i).map((name) => ({
      activityId,
      userId: idOf(name),
      role: name === a.host ? 'host' : 'guest',
    }));
    if (members.length !== a.going) {
      throw new Error(`"${a.title}" needs ${a.going} going but has ${members.length}`);
    }
    if (a.going > a.capacity) throw new Error(`"${a.title}" is over capacity`);
    await db.insert(s.activityMembers).values(members);

    // A minute apart, ending an hour before now or the start, whichever is earlier.
    const end = Math.min(now.getTime(), start.getTime()) - 60 * MINUTE;
    const lines = a.messages.map(([from, text], k) => ({
      id: randomUUID(),
      activityId,
      senderId: from === 'system' ? null : idOf(from),
      kind: from === 'system' ? 'system' : 'user',
      body: text,
      createdAt: new Date(end - (a.messages.length - k) * MINUTE),
    }));
    if (lines.length) await db.insert(s.messages).values(lines);

    // Demo: everyone has read up to their own last message, which drives "Seen".
    const readUpTo = new Map<string, Date>();
    if (demo) for (const m of lines) if (m.senderId) readUpTo.set(m.senderId, m.createdAt);
    if (readUpTo.size) {
      await db
        .insert(s.chatReads)
        .values([...readUpTo].map(([userId, lastReadAt]) => ({ activityId, userId, lastReadAt })));
    }
  }

  return {
    users: PEOPLE.length,
    communities: communities.length,
    activities: activities.length,
  };
}

/** Host first, then whoever chats, then people from the pool; the demo user last if joined. */
function guestsFor(a: SeedActivity, pool: string[], index: number) {
  const going = new Set([a.host]);
  for (const [from] of a.messages) {
    if (from !== 'system' && from !== DEMO_NAME) going.add(from);
  }
  const wanted = a.going - (a.demoJoined ? 1 : 0);
  // Core activities keep the original fill order; demo ones rotate it for variety.
  const offset = index < ACTIVITIES.length ? 0 : (index * 5) % pool.length;
  const rotated = [...pool.slice(offset), ...pool.slice(0, offset)];
  for (const name of rotated) {
    if (going.size >= wanted) break;
    going.add(name);
  }
  if (a.demoJoined) going.add(DEMO_NAME);
  return [...going];
}
