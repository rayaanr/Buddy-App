import { Hono } from 'hono';

import { currentUser, requireUser } from '../../auth/middleware';
import type { AppEnv, Deps } from '../../http/context';
import { idParam } from '../../lib/validate';
import { getCommunity, joinCommunity, leaveCommunity, listCommunities } from './service';

export function communityRoutes({ db, urls }: Deps) {
  return new Hono<AppEnv>()
    .use(requireUser)
    .get('/', async (c) => c.json({ communities: await listCommunities(db, currentUser(c).id) }))
    .get('/:id', idParam(), async (c) =>
      c.json(await getCommunity(db, urls, c.req.param('id'), currentUser(c).id)),
    )
    .post('/:id/membership', idParam(), async (c) =>
      c.json(await joinCommunity(db, c.req.param('id'), currentUser(c).id)),
    )
    .delete('/:id/membership', idParam(), async (c) =>
      c.json(await leaveCommunity(db, c.req.param('id'), currentUser(c).id)),
    );
}
