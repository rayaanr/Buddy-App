import { logoTileSvg, LOGO_TONES } from '@buddy/shared';
import { Hono } from 'hono';

import { EMAIL_LOGO } from '../../brand/email-logo';
import type { AppEnv } from '../../http/context';

const favicon = logoTileSvg(64, {
  fraction: 0.74,
  background: LOGO_TONES.dark.background,
  radius: 14,
});
const emailLogo = Buffer.from(EMAIL_LOGO.base64, 'base64');
const DAY = 'public, max-age=86400';

/** The favicon for the public pages, and the logo image emails link to. */
export function brandRoutes() {
  return new Hono<AppEnv>()
    .get('/favicon.svg', (c) =>
      c.body(favicon, 200, { 'content-type': 'image/svg+xml', 'cache-control': DAY }),
    )
    .get('/brand/email-logo.png', (c) =>
      c.body(emailLogo, 200, { 'content-type': 'image/png', 'cache-control': DAY }),
    );
}
