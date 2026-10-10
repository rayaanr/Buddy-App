import { firstName, UUID_RE } from '@buddy/shared';
import type { ActivitySummary } from '@buddy/shared';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';

import { activities } from '../../db/schema';
import type { AppEnv, Deps } from '../../http/context';
import { escapeHtml as escape, page, pageHeaders } from '../../lib/html';
import { findActivitySummaries, upcoming } from '../activities/queries';
import { whenText } from '../activities/service';

/**
 * Public page behind shared links (`/a/:id`). Chat apps read its Open Graph
 * tags for the link preview; people who tap it get a button into the app.
 * Signed-out, so it shows only what Discover would: no cancelled activities,
 * and the host's first name only.
 */
export function shareRoutes({ db, urls, env }: Deps) {
  return new Hono<AppEnv>().get('/a/:id', pageHeaders, async (c) => {
    const id = c.req.param('id');
    // Upcoming only: past activities stop being public.
    const [a] = UUID_RE.test(id)
      ? await findActivitySummaries(db, urls, {
          viewerId: null,
          where: [eq(activities.id, id), upcoming()],
        })
      : [];
    c.header('cache-control', 'public, max-age=300');
    if (!a) return c.html(page(notFoundBody(), {}), 404);
    const appLink = `${env.APP_SCHEME}://activity/${a.id}`;
    // From config, not the request's Host header (cached pages can't be poisoned).
    const url = new URL(`/a/${a.id}`, env.BETTER_AUTH_URL).href;
    return c.html(page(activityBody(a, appLink), meta(a, url)));
  });
}

function meta(a: ActivitySummary, url: string) {
  return {
    title: a.title,
    description: `${whenText(new Date(a.startsAt))} · ${a.place}, ${a.area}. ${a.goingCount} of ${a.capacity} going. Join on Buddy.`,
    image: a.coverUrl ?? undefined,
    url,
  };
}

function activityBody(a: ActivitySummary, appLink: string) {
  const left = a.capacity - a.goingCount;
  return `
    ${a.coverUrl ? `<img class="cover" src="${escape(a.coverUrl)}" alt="">` : ''}
    <main>
      <p class="eyebrow">${escape(a.category)}</p>
      <h1>${escape(a.title)}</h1>
      <p class="when">${escape(whenText(new Date(a.startsAt)))}</p>
      <p class="where">${escape(a.place)} · ${escape(a.area)}</p>
      <p class="going">${a.goingCount} of ${a.capacity} going${left > 0 ? ` · ${left} ${left === 1 ? 'spot' : 'spots'} left` : ' · full'}</p>
      <p class="host">Hosted by ${escape(firstName(a.host.name))}</p>
      <a class="button" href="${escape(appLink)}">Open in Buddy</a>
      <p class="hint">Opens the activity in the Buddy app.</p>
    </main>`;
}

const notFoundBody = () => `
    <main>
      <h1>This activity isn’t available</h1>
      <p class="where">It may have been cancelled or already happened.</p>
    </main>`;
