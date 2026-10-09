import type { ActivitySummary } from '@buddy/shared';
import { Hono } from 'hono';

import type { AppEnv, Deps } from '../../http/context';
import { findActivitySummary } from '../activities/queries';
import { whenText } from '../activities/service';
import { firstName } from '../chat/system-messages';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!,
  );

/**
 * Public page behind shared links (`/a/:id`). Chat apps read its Open Graph
 * tags for the link preview; people who tap it get a button into the app.
 * Signed-out, so it shows only what Discover would: no cancelled activities,
 * and the host's first name only.
 */
export function shareRoutes({ db, urls, env }: Deps) {
  return new Hono<AppEnv>().get('/a/:id', async (c) => {
    const id = c.req.param('id');
    const a = UUID.test(id) ? await findActivitySummary(db, urls, id, null) : null;
    c.header('cache-control', 'public, max-age=300');
    if (!a) return c.html(page(notFoundBody(), {}), 404);
    const appLink = `${env.APP_SCHEME}://activity/${a.id}`;
    return c.html(page(activityBody(a, appLink), meta(a, new URL(c.req.url).href)));
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
    ${a.coverUrl ? `<img class="cover" src="${escape(a.coverUrl)}" alt="" onerror="this.remove()">` : ''}
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

function page(
  body: string,
  m: { title?: string; description?: string; image?: string; url?: string },
) {
  const tags = [
    m.title && `<meta property="og:title" content="${escape(m.title)}">`,
    m.description && `<meta property="og:description" content="${escape(m.description)}">`,
    m.description && `<meta name="description" content="${escape(m.description)}">`,
    m.image && `<meta property="og:image" content="${escape(m.image)}">`,
    m.url && `<meta property="og:url" content="${escape(m.url)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="Buddy">`,
    `<meta name="twitter:card" content="${m.image ? 'summary_large_image' : 'summary'}">`,
  ]
    .filter(Boolean)
    .join('\n    ');
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escape(m.title ? `${m.title} · Buddy` : 'Buddy')}</title>
    ${tags}
    <style>
      body { margin: 0; background: #0b0c0b; color: #f1f2ee; font: 16px/1.45 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
      .cover { display: block; background: #161816; width: 100%; max-width: 560px; margin: 0 auto; aspect-ratio: 16 / 10; object-fit: cover; }
      main { max-width: 560px; margin: 0 auto; padding: 22px; }
      .eyebrow { margin: 0; color: #c9f53f; font: 600 12px/1 ui-monospace, monospace; letter-spacing: .12em; }
      h1 { margin: 10px 0 14px; font-size: 30px; line-height: 1.1; letter-spacing: -.02em; }
      p { margin: 4px 0; }
      .when { font-weight: 600; }
      .where, .going, .host, .hint { color: #8b8e88; }
      .button { display: block; margin: 26px 0 12px; padding: 17px; border-radius: 18px; background: #c9f53f; color: #0b0c0b; text-align: center; font-weight: 600; text-decoration: none; }
      .hint { font-size: 14px; }
    </style>
  </head>
  <body>${body}
  </body>
</html>`;
}
