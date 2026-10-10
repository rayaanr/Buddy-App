import { Hono } from 'hono';

import type { AppEnv, Deps } from '../../http/context';
import { escapeHtml, page, pageHeaders } from '../../lib/html';
import { PRIVACY_UPDATED, privacyHtml } from '../../legal/privacy';
import { TERMS_UPDATED, termsHtml } from '../../legal/terms';

/** Privacy policy and terms: public, linked from Settings and Sign up (store requirement). */
export function legalRoutes({ env }: Deps) {
  const contact = escapeHtml(env.CONTACT_EMAIL);
  const render = (title: string, updated: string, body: string) =>
    page(
      `
    <main>
      <h1>${title}</h1>
      <p class="hint">${escapeHtml(updated)}</p>
      ${body}
    </main>`,
      { title },
    );
  const privacy = render('Privacy policy', PRIVACY_UPDATED, privacyHtml(contact));
  const terms = render('Terms of use', TERMS_UPDATED, termsHtml(contact));

  return new Hono<AppEnv>()
    .use(pageHeaders)
    .use(async (c, next) => {
      await next();
      c.header('cache-control', 'public, max-age=3600');
    })
    .get('/privacy', (c) => c.html(privacy))
    .get('/terms', (c) => c.html(terms));
}
