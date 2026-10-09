import { updateMeInput } from '@buddy/shared';
import { Hono } from 'hono';

import { currentUser, requireUser } from '../../auth/middleware';
import type { AppEnv, Deps } from '../../http/context';
import { validate } from '../../lib/validate';
import { deleteAccount, getMe, updateMe } from './service';

export function meRoutes({ db, urls }: Deps) {
  return new Hono<AppEnv>()
    .use(requireUser)

    .get('/', async (c) => c.json(await getMe(db, urls, currentUser(c).id)))

    .patch('/', validate('json', updateMeInput), async (c) => {
      const me = currentUser(c);
      await updateMe(db, me.id, c.req.valid('json'));
      return c.json(await getMe(db, urls, me.id));
    })

    .delete('/', async (c) => {
      await deleteAccount(db, currentUser(c).id);
      return c.body(null, 204);
    });
}
