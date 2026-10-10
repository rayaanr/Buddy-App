import { createCommunityInput, updateCommunityInput } from '@buddy/shared';
import { Hono } from 'hono';
import { z } from 'zod';

import { currentUser, requireUser } from '../../auth/middleware';
import type { AppEnv, Deps } from '../../http/context';
import { DAY, limits } from '../../lib/rate-limit';
import { idParam, validate } from '../../lib/validate';
import {
  createCommunity,
  deleteCommunity,
  getCommunity,
  joinCommunity,
  leaveCommunity,
  listCommunities,
  listCommunityMembers,
  removeCommunityMember,
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
    )
    .delete('/:id', idParam(), async (c) => {
      await deleteCommunity(db, c.req.param('id'), currentUser(c).id);
      return c.json({ ok: true });
    })
    .get('/:id/members', idParam(), async (c) =>
      c.json({
        members: await listCommunityMembers(db, urls, c.req.param('id'), currentUser(c).id),
      }),
    )
    .delete(
      '/:id/members/:userId',
      validate('param', z.object({ id: z.uuid(), userId: z.uuid() })),
      async (c) => {
        const { id, userId } = c.req.valid('param');
        await removeCommunityMember(db, id, currentUser(c).id, userId);
        return c.json({ ok: true });
      },
    );
}
