import { createCommunityInput, updateCommunityInput } from '@buddy/shared';
import { Hono } from 'hono';

import { currentUser, requireUser } from '../../auth/middleware';
import type { AppEnv, Deps } from '../../http/context';
import { DAY, limits } from '../../lib/rate-limit';
import { idParam, validate } from '../../lib/validate';
import {
  createCommunity,
  getCommunity,
  joinCommunity,
  leaveCommunity,
  listCommunities,
  updateCommunity,
} from './service';

export function communityRoutes(deps: Deps) {
  const { db, urls, storage } = deps;
  // Starting communities is rare; a burst of them is spam.
  const starting = limits(deps)({ name: 'communities', limit: 5, windowMs: DAY, by: 'user' });
  return new Hono<AppEnv>()
    .use(requireUser)
    .get('/', async (c) => c.json({ communities: await listCommunities(db, currentUser(c).id) }))
    .post('/', starting, validate('json', createCommunityInput), async (c) =>
      c.json(
        await createCommunity(db, { urls, storage }, currentUser(c).id, c.req.valid('json')),
        201,
      ),
    )
    .patch('/:id', idParam(), validate('json', updateCommunityInput), async (c) =>
      c.json(
        await updateCommunity(
          db,
          { urls, storage },
          c.req.param('id'),
          currentUser(c).id,
          c.req.valid('json'),
        ),
      ),
    )
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
