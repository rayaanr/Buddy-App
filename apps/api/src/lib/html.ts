import { logoSvg } from '@buddy/shared';
import { secureHeaders } from 'hono/secure-headers';

/** Escapes text for HTML element content and quoted attributes. */
export const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!,
  );

/** No scripts at all; inline styles and https images only. */
export const pageHeaders = secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'none'"],
    styleSrc: ["'unsafe-inline'"],
    imgSrc: ["'self'", 'https:'],
    baseUri: ["'none'"],
    formAction: ["'none'"],
    frameAncestors: ["'none'"],
  },
});

const LOGO = logoSvg({ height: 26 });

export interface PageMeta {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
}

/** The public pages' shell (share links, privacy, terms), in the app's colours. */
export function page(body: string, m: PageMeta) {
  const tags = [
    m.title && `<meta property="og:title" content="${escapeHtml(m.title)}">`,
    m.description && `<meta property="og:description" content="${escapeHtml(m.description)}">`,
    m.description && `<meta name="description" content="${escapeHtml(m.description)}">`,
    m.image && `<meta property="og:image" content="${escapeHtml(m.image)}">`,
    m.url && `<meta property="og:url" content="${escapeHtml(m.url)}">`,
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
    <title>${escapeHtml(m.title ? `${m.title} · Buddy` : 'Buddy')}</title>
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    ${tags}
    <style>
      body { margin: 0; background: #0b0c0b; color: #f1f2ee; font: 16px/1.45 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
      .cover { display: block; background: #161816; width: 100%; max-width: 560px; margin: 0 auto; aspect-ratio: 16 / 10; object-fit: cover; }
      main { max-width: 560px; margin: 0 auto; padding: 22px; }
      .eyebrow { margin: 0; color: #c9f53f; font: 600 12px/1 ui-monospace, monospace; letter-spacing: .12em; }
      h1 { margin: 10px 0 14px; font-size: 30px; line-height: 1.1; letter-spacing: -.02em; }
      h2 { margin: 28px 0 8px; font-size: 19px; }
      p { margin: 4px 0; }
      ul { margin: 6px 0; padding-left: 20px; }
      li { margin: 6px 0; color: #c9cbc5; }
      a { color: #c9f53f; }
      .when { font-weight: 600; }
      .where, .going, .host, .hint { color: #8b8e88; }
      .button { display: block; margin: 26px 0 12px; padding: 17px; border-radius: 18px; background: #c9f53f; color: #0b0c0b; text-align: center; font-weight: 600; text-decoration: none; }
      .hint { font-size: 14px; }
      .brand { display: block; max-width: 560px; margin: 0 auto; padding: 18px 22px 14px; line-height: 0; }
    </style>
  </head>
  <body>
    <header class="brand">${LOGO}</header>${body}
  </body>
</html>`;
}
