/**
 * People using the app: open it (profile, badges, chats), browse Discover
 * around their town, open activities, read a chat and now and then send a
 * message. Each virtual user signs in as a different generated person.
 *
 *   k6 run load/k6/app.js                      ramps to 200 people
 *   k6 run -e PEOPLE=500 -e MINUTES=3 load/k6/app.js
 *   k6 run -e API=https://api-buddy.example.com load/k6/app.js   (not production!)
 */
import { check, group, sleep } from 'k6';
import http from 'k6/http';
import { SharedArray } from 'k6/data';

const API = __ENV.API || 'http://localhost:7420';
const PEOPLE = Number(__ENV.PEOPLE || 200);
const MINUTES = Number(__ENV.MINUTES || 2);

const cookies = new SharedArray('sessions', () => JSON.parse(open('../.sessions.json')));

/** Towns people browse from (Colombo mostly, like the generated data). */
const TOWNS = [
  { lat: 6.9101, lng: 79.8637 }, // Colombo 7
  { lat: 6.8649, lng: 79.8997 }, // Nugegoda
  { lat: 6.9271, lng: 79.8612 }, // Colombo
  { lat: 7.2906, lng: 80.6337 }, // Kandy
  { lat: 6.0535, lng: 80.221 }, // Galle
];
const FILTERS = ['All', 'All', 'All', 'Tonight', 'Weekend', 'Sports', 'Social'];
const SEARCHES = ['run', 'padel', 'board', 'yoga', 'colombo', 'cook'];

export const options = {
  scenarios: {
    app: {
      executor: 'ramping-vus',
      stages: [
        { duration: '30s', target: PEOPLE },
        { duration: `${MINUTES}m`, target: PEOPLE },
        { duration: '15s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{kind:read}': ['p(95)<300'],
    'http_req_duration{kind:write}': ['p(95)<500'],
  },
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

/** Every request name used below, so the summary can list each one. */
const NAMES = [
  'me',
  'unread',
  'chats',
  'discover',
  'picks',
  'from communities',
  'activity',
  'members',
  'search',
  'search communities',
  'mine',
  'communities',
  'notifications',
  'messages',
  'send',
  'read',
];
for (const name of NAMES) options.thresholds[`http_req_duration{name:${name}}`] = ['max>=0'];

/** A table per endpoint (k6 prints its own summary too). */
export function handleSummary(data) {
  const rows = NAMES.map((name) => {
    const m = data.metrics[`http_req_duration{name:${name}}`];
    if (!m || !m.values.max) return null;
    const v = m.values;
    const ms = (x) => `${Math.round(x)} ms`.padStart(8);
    return `${name.padEnd(20)} ${ms(v.med)} ${ms(v['p(95)'])} ${ms(v.max)}`;
  }).filter(Boolean);
  const reqs = data.metrics.http_reqs.values;
  const failed = data.metrics.http_req_failed.values.rate;
  return {
    stdout:
      `\n${'endpoint'.padEnd(20)} ${'median'.padStart(8)} ${'p95'.padStart(8)} ${'max'.padStart(8)}\n` +
      `${rows.join('\n')}\n\n` +
      `${Math.round(reqs.rate)} requests/s, ${reqs.count} in all, ${(failed * 100).toFixed(2)}% failed\n`,
  };
}

const pick = (list) => list[Math.floor(Math.random() * list.length)];

function get(path, name) {
  const res = http.get(`${API}${path}`, {
    headers: { cookie: cookies[(__VU - 1) % cookies.length] },
    tags: { name, kind: 'read' },
  });
  check(res, { [`${name} 200`]: (r) => r.status === 200 });
  return res.status === 200 ? res.json() : null;
}

function post(path, body, name) {
  const res = http.post(`${API}${path}`, JSON.stringify(body), {
    headers: { cookie: cookies[(__VU - 1) % cookies.length], 'content-type': 'application/json' },
    tags: { name, kind: 'write' },
  });
  check(res, { [`${name} ok`]: (r) => r.status < 300 });
  return res;
}

/** A person between taps. */
const pause = () => sleep(0.5 + Math.random() * 2);

export default function () {
  let chats = [];
  group('open the app', () => {
    get('/v1/me', 'me');
    get('/v1/notifications/unread', 'unread');
    chats = get('/v1/chats', 'chats')?.chats ?? [];
  });
  pause();

  let feed = [];
  group('discover', () => {
    const town = pick(TOWNS);
    feed =
      get(`/v1/activities?lat=${town.lat}&lng=${town.lng}&filter=${pick(FILTERS)}`, 'discover')
        ?.activities ?? [];
    get('/v1/activities/picks', 'picks');
    get('/v1/activities/from-communities', 'from communities');
  });
  pause();

  if (feed.length) {
    group('an activity', () => {
      const a = pick(feed);
      get(`/v1/activities/${a.id}`, 'activity');
      get(`/v1/activities/${a.id}/members`, 'members');
    });
    pause();
  }

  if (Math.random() < 0.3) {
    group('search', () => {
      get(`/v1/activities?q=${pick(SEARCHES)}`, 'search');
      get(`/v1/communities?q=${pick(SEARCHES)}`, 'search communities');
    });
    pause();
  }

  if (Math.random() < 0.4) {
    get('/v1/activities/mine', 'mine');
    get('/v1/communities', 'communities');
    get('/v1/notifications', 'notifications');
    pause();
  }

  if (chats.length) {
    group('chat', () => {
      const chat = pick(chats);
      const base = `/v1/${chat.kind === 'activity' ? 'activities' : 'communities'}/${chat.id}/chat`;
      const page = get(`${base}/messages`, 'messages');
      if (Math.random() < 0.2) {
        post(`${base}/messages`, { id: crypto.randomUUID(), body: 'Load test message' }, 'send');
      }
      const last = page?.messages?.at(-1);
      if (last) post(`${base}/read`, { messageId: last.id }, 'read');
    });
    pause();
  }
}
