import {
  communitiesQuery,
  createCommunityInput,
  muteInput,
  updateCommunityInput,
} from '@buddy/shared';
import { Hono } from 'hono';
import { z } from 'zod';

import { currentUser, requireUser } from '../../auth/middleware';
import type { AppEnv, Deps } from '../../http/context';
import { DAY, limits } from '../../lib/rate-limit';
import { forgetPhotos } from '../../lib/photos';
import { idParam, validate } from '../../lib/validate';
import {
  createCommunity,
  deleteCommunity,
  getCommunity,
  joinCommunity,
  leaveCommunity,
  listCommunities,
  listCommunityMembers,
  muteCommunityChat,
  removeCommunityMember,
  updateCommunity,
  communityActivities,
} from './service';

export function communityRoutes(deps: Deps) {
  const { db, urls, storage, hub } = deps;
  // Starting communities is rare; a burst of them is spam.
  const starting = limits(deps)({ name: 'communities', limit: 5, windowMs: DAY, by: 'user' });
  return (
    new Hono<AppEnv>()
      .use(requireUser)
      .get('/', validate('query', communitiesQuery), async (c) =>
        c.json({
          communities: await listCommunities(db, urls, currentUser(c).id, c.req.valid('query').q),
        }),
      )
      .post('/', starting, validate('json', createCommunityInput), async (c) =>
        c.json(
          await createCommunity(db, { urls, storage }, currentUser(c).id, c.req.valid('json')),
          201,
        ),
      )
      .patch('/:id', idParam(), validate('json', updateCommunityInput), async (c) => {
        const { community, replacedPhotos } = await updateCommunity(
          db,
          { urls, storage },
          c.req.param('id'),
          currentUser(c).id,
          c.req.valid('json'),
        );
        await forgetPhotos(deps, replacedPhotos);
        return c.json(community);
      })
      // Community → See all: everything coming up, soonest first.
      .get('/:id/activities', idParam(), async (c) =>
        c.json({
          activities: await communityActivities(db, urls, c.req.param('id'), currentUser(c).id),
        }),
      )
      .get('/:id', idParam(), async (c) =>
        c.json(await getCommunity(db, urls, c.req.param('id'), currentUser(c).id)),
      )
      .post('/:id/membership', idParam(), async (c) =>
        c.json(await joinCommunity(db, urls, c.req.param('id'), currentUser(c).id)),
      )
      .delete('/:id/membership', idParam(), async (c) => {
        const result = await leaveCommunity(db, urls, c.req.param('id'), currentUser(c).id);
        // Out of its group chat too.
        hub.disconnect(c.req.param('id'), currentUser(c).id);
        return c.json(result);
      })
      // Mute or unmute its group chat notifications.
      .post('/:id/mute', idParam(), validate('json', muteInput), async (c) => {
        const me = currentUser(c);
        const id = c.req.param('id');
        await muteCommunityChat(db, id, me.id, c.req.valid('json').muted);
        return c.json(await getCommunity(db, urls, id, me.id));
      })
      .delete('/:id', idParam(), async (c) => {
        await forgetPhotos(deps, await deleteCommunity(db, c.req.param('id'), currentUser(c).id));
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
          hub.disconnect(id, userId);
          return c.json({ ok: true });
        },
      )
  );
}
