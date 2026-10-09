import { Hono } from 'hono';

import { currentUser, requireUser } from '../../auth/middleware';
import type { AppEnv, Deps } from '../../http/context';
import { getCommunity, joinCommunity, leaveCommunity, listCommunities } from './service';

const UUID = '{[0-9a-f-]{36}}';

export function communityRoutes({ db, urls }: Deps) {
  return new Hono<AppEnv>()
    .use(requireUser)
    .get('/', async (c) => c.json({ communities: await listCommunities(db, currentUser(c).id) }))
    .get(`/:id${UUID}`, async (c) =>
      c.json(await getCommunity(db, urls, c.req.param('id'), currentUser(c).id)),
    )
    .post(`/:id${UUID}/membership`, async (c) =>
      c.json(await joinCommunity(db, c.req.param('id'), currentUser(c).id)),
    )
    .delete(`/:id${UUID}/membership`, async (c) =>
      c.json(await leaveCommunity(db, c.req.param('id'), currentUser(c).id)),
    );
}
