/**
 * Builds the load tests' database: buddy_load, migrated and seeded like
 * development, then filled with generated people, communities, activities
 * and chat (sizes below, or LOAD_USERS etc.), so queries meet real volumes.
 * Writes signed-in sessions for k6 to .sessions.json.
 *
 *   bun run --filter @buddy/load prepare
 */
import { spawnSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { INTERESTS } from '@buddy/shared';
import postgres from 'postgres';

import { AUTH_SECRET, DATABASE_URL, SESSIONS_FILE } from './env';

const size = (name: string, fallback: number) => Number(process.env[name] ?? fallback);
const USERS = size('LOAD_USERS', 20_000);
const COMMUNITIES = size('LOAD_COMMUNITIES', 400);
const ACTIVITIES = size('LOAD_ACTIVITIES', 30_000);
/** People k6 signs in as. */
const SESSIONS = size('LOAD_SESSIONS', 2_000);

const api = fileURLToPath(new URL('../apps/api', import.meta.url));
const name = new URL(DATABASE_URL).pathname.slice(1);

const admin = postgres(DATABASE_URL.replace(`/${name}`, '/postgres'), {
  max: 1,
  onnotice: () => {},
});
try {
  await admin.unsafe(`drop database if exists ${name} with (force)`);
  await admin.unsafe(`create database ${name}`);
} finally {
  await admin.end();
}

const run = (args: string[]) => {
  const { status } = spawnSync('bunx', args, {
    cwd: api,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL, NODE_ENV: 'development' },
  });
  if (status !== 0) throw new Error(`${args.join(' ')} failed`);
};
run(['drizzle-kit', 'migrate']);
run(['tsx', 'scripts/seed/run.ts', '--core']);

const sql = postgres(DATABASE_URL, { max: 1, onnotice: () => {} });
const step = async (label: string, query: string) => {
  const started = Date.now();
  const result = await sql.unsafe(query);
  console.log(`${label}: ${result.count} rows in ${Date.now() - started} ms`);
};
const interests = `array[${INTERESTS.map((i) => `'${i}'`).join(',')}]`;

try {
  // Where people and activities are: most in and around Colombo, the rest
  // in towns across the island.
  await sql.unsafe(`
    create function pg_temp.pick(a int[]) returns int language sql volatile
      as $$ select a[1 + floor(random() * array_length(a, 1))::int] $$;
    create temp table pool as
      select
        array_agg(id) filter (where ST_DWithin(location,
          (select location from places where id = 1841), 20000)) as colombo,
        array_agg(id) filter (where main) as towns
      from places;
  `);
  const town = `case when random() < 0.6 then pg_temp.pick(p.colombo) else pg_temp.pick(p.towns) end`;

  await step(
    'people',
    `insert into "user" (name, email, email_verified)
     select 'Load ' || i, 'load' || i || '@load.test', true from generate_series(1, ${USERS}) i`,
  );
  await step(
    'profiles',
    `insert into profiles (user_id, place_id, interests, onboarded_at, gender, birth_year, avatar_url)
     select u.id, ${town},
       array(select x from unnest(${interests}) x where random() < 0.25 and u.id is not null),
       now(), (array['man', 'woman'])[1 + floor(random() * 2)::int],
       1975 + floor(random() * 30)::int, '/fallbacks/man-01.svg'
     from "user" u, pool p where u.email like '%@load.test'`,
  );
  await sql.unsafe(`
    create temp table people as
      select id, row_number() over (order by email) as n from "user" where email like '%@load.test';
    create unique index on people (n);
  `);

  await step(
    'communities',
    `insert into communities (name, about, place_id, logo_url, cover_url)
     select 'Load community ' || i, 'Generated for load tests.', ${town},
       '/fallbacks/community-01.svg', '/fallbacks/cover-01.svg'
     from generate_series(1, ${COMMUNITIES}) i, pool p`,
  );
  await sql.unsafe(`
    create temp table groups as
      select id, row_number() over (order by name) as n from communities where name like 'Load community %';
    create unique index on groups (n);
  `);
  await step(
    'community members',
    `insert into community_members (community_id, user_id)
     select g.id, p.id
     from (select n, 1 + floor(random() * ${COMMUNITIES})::int as g
           from people, generate_series(1, 2)) pick
     join people p on p.n = pick.n join groups g on g.n = pick.g
     on conflict do nothing`,
  );

  // A month either side of now, so about half are still to come.
  await step(
    'activities',
    `insert into activities (host_id, community_id, title, category, "group", interest,
       starts_at, place, area, place_id, location, capacity, description, cover_url)
     select h.id, g.id, b.interest || ' meetup ' || b.i, upper(b.interest), b.grp, b.interest,
       b.starts_at, 'Somewhere in ' || pl.name, pl.name, pl.id,
       ST_SetSRID(ST_MakePoint(ST_X(pl.location::geometry) + (random() - 0.5) * 0.03,
         ST_Y(pl.location::geometry) + (random() - 0.5) * 0.03), 4326)::geography,
       b.capacity, 'Generated for load tests.', '/fallbacks/activity-social-01.svg'
     from (
       select i,
         (array['Social', 'Sports', 'Running', 'Creative', 'Food'])[1 + floor(random() * 5)::int] as grp,
         (${interests})[1 + floor(random() * ${INTERESTS.length})::int] as interest,
         ${town} as place_id,
         1 + floor(random() * ${USERS})::int as host,
         case when random() < 0.2 then 1 + floor(random() * ${COMMUNITIES})::int end as grp_n,
         now() + (random() * 60 - 30) * interval '1 day' as starts_at,
         4 + floor(random() * 17)::int as capacity
       from generate_series(1, ${ACTIVITIES}) i, pool p
     ) b
     join people h on h.n = b.host
     join places pl on pl.id = b.place_id
     left join groups g on g.n = b.grp_n`,
  );
  await step(
    'hosts going',
    `insert into activity_members (activity_id, user_id, role, joined_at)
     select id, host_id, 'host', created_at from activities where host_id is not null
     on conflict do nothing`,
  );
  await step(
    'guests going',
    `insert into activity_members (activity_id, user_id, role)
     select pick.activity_id, p.id, 'guest'
     from (select a.id as activity_id, 1 + floor(random() * ${USERS})::int as n
           from activities a, generate_series(1, (random() * (a.capacity - 1) * 0.8)::int)) pick
     join people p on p.n = pick.n
     on conflict do nothing`,
  );
  await step(
    'activity chat',
    `insert into messages (id, activity_id, sender_id, body, created_at)
     select gen_random_uuid(), m.activity_id, m.user_id, 'Message ' || g,
       least(now(), a.starts_at) - random() * interval '5 days'
     from activity_members m join activities a on a.id = m.activity_id,
       generate_series(1, floor(random() * 4)::int) g`,
  );
  await step(
    'community chat',
    `insert into messages (id, community_id, sender_id, body, created_at)
     select gen_random_uuid(), m.community_id, m.user_id, 'Message ' || g,
       now() - random() * interval '20 days'
     from community_members m, generate_series(1, floor(random() * 3)::int) g`,
  );
  await step(
    'read up to',
    `insert into chat_reads (activity_id, user_id, last_read_at)
     select activity_id, user_id, now() - random() * interval '3 days'
     from activity_members where random() < 0.7`,
  );
  await step(
    'notifications',
    `insert into notifications (user_id, kind, title, body, created_at, read_at)
     select p.id, 'reminders', 'Coming up', 'Generated for load tests.',
       now() - random() * interval '30 days', case when random() < 0.8 then now() end
     from people p, generate_series(1, 10)`,
  );

  // Sessions as Better Auth makes them: a random token, and a cookie that
  // carries it signed with the secret.
  const tokens = await sql.unsafe<{ token: string }[]>(
    `insert into session (token, user_id, expires_at, updated_at)
     select md5(random()::text) || md5(random()::text), id, now() + interval '30 days', now()
     from people where n <= ${SESSIONS}
     returning token`,
  );
  const sign = (token: string) =>
    encodeURIComponent(
      `${token}.${createHmac('sha256', AUTH_SECRET).update(token).digest('base64')}`,
    );
  writeFileSync(
    SESSIONS_FILE,
    JSON.stringify(tokens.map((t) => `better-auth.session_token=${sign(t.token)}`)),
  );
  console.log(`sessions: ${tokens.length} → ${fileURLToPath(SESSIONS_FILE)}`);

  await sql.unsafe('vacuum analyze');
} finally {
  await sql.end();
}
