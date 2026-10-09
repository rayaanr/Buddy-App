import { registerPushTokenInput, updateMeInput } from '@buddy/shared';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';

import { currentUser, requireUser } from '../../auth/middleware';
import { pushTokens } from '../../db/schema';
import type { AppEnv, Deps } from '../../http/context';
import { validate } from '../../lib/validate';
import { listBlocked } from '../safety/service';
import { deleteAccount, getMe, updateMe } from './service';

export function meRoutes({ db, urls, hub }: Deps) {
  return (
    new Hono<AppEnv>()
      .use(requireUser)

      .get('/', async (c) => c.json(await getMe(db, urls, currentUser(c).id)))

      .patch('/', validate('json', updateMeInput), async (c) => {
        const me = currentUser(c);
        await updateMe(db, me.id, c.req.valid('json'));
        return c.json(await getMe(db, urls, me.id));
      })

      .delete('/', async (c) => {
        const me = currentUser(c);
        await deleteAccount(db, me.id);
        hub.disconnectEverywhere(me.id);
        return c.body(null, 204);
      })

      // People you blocked, so you can unblock them.
      .get('/blocks', async (c) =>
        c.json({ people: await listBlocked(db, urls, currentUser(c).id) }),
      )

      // Expo push tokens. A token moves to whoever registered it last (shared phones).
      .post('/push-tokens', validate('json', registerPushTokenInput), async (c) => {
        const { token } = c.req.valid('json');
        const userId = currentUser(c).id;
        await db
          .insert(pushTokens)
          .values({ token, userId })
          .onConflictDoUpdate({ target: pushTokens.token, set: { userId, updatedAt: new Date() } });
        return c.body(null, 204);
      })

      // Called on sign-out so the phone stops getting this account's notifications.
      .delete('/push-tokens', validate('json', registerPushTokenInput), async (c) => {
        const { token } = c.req.valid('json');
        await db
          .delete(pushTokens)
          .where(and(eq(pushTokens.token, token), eq(pushTokens.userId, currentUser(c).id)));
        return c.body(null, 204);
      })
  );
}
