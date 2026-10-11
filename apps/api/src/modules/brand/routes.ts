import { logoTileSvg, LOGO_TONES } from '@buddy/shared';
import { Hono } from 'hono';

import { EMAIL_LOGO } from '../../brand/email-logo';
import { FALLBACK_ART } from '../../brand/fallback-art';
import type { AppEnv } from '../../http/context';

const favicon = logoTileSvg(64, {
  fraction: 0.74,
  background: LOGO_TONES.dark.background,
  radius: 14,
});
const emailLogo = Buffer.from(EMAIL_LOGO.base64, 'base64');
const DAY = 'public, max-age=86400';
// Phones keep them for a week; a redesign ships under the same ids, so not forever.
const WEEK = 'public, max-age=604800';

/**
 * The favicon for the public pages, the logo image emails link to, and the
 * pictures for anything without a photo (see lib/fallbacks.ts).
 */
export function brandRoutes() {
  return new Hono<AppEnv>()
    .get('/favicon.svg', (c) =>
      c.body(favicon, 200, { 'content-type': 'image/svg+xml', 'cache-control': DAY }),
    )
    .get('/brand/email-logo.png', (c) =>
      c.body(emailLogo, 200, { 'content-type': 'image/png', 'cache-control': DAY }),
    )
    .get('/fallbacks/:file{[a-z0-9-]+\\.svg}', (c) => {
      const svg = FALLBACK_ART[c.req.param('file').slice(0, -'.svg'.length)];
      if (!svg) return c.notFound();
      return c.body(svg, 200, { 'content-type': 'image/svg+xml', 'cache-control': WEEK });
    });
}
