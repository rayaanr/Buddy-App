/**
 * The Buddy logo, in one place. The app, the API's pages and emails, the
 * landing page and the app icons are all drawn from this file.
 *
 * To change the logo: edit MARK below (and WORDMARK_FONT in scripts/brand.mjs
 * if the lettering changes), then run `bun run brand` to regenerate the
 * wordmark outline, the app icons and the landing page's copy.
 */
import { WORDMARK } from './brand-wordmark';

/** Colourways. "dark" sits on the app's near-black, "light" on white, "mono" is one colour. */
export const LOGO_TONES = {
  dark: { primary: '#c9f53f', secondary: '#f1f2ee', text: '#f1f2ee', background: '#0b0c0b' },
  light: { primary: '#3a6b35', secondary: '#12140f', text: '#12140f', background: '#ffffff' },
  mono: { primary: '#ffffff', secondary: '#ffffff', text: '#ffffff', background: '#000000' },
} as const;
export type LogoTone = keyof typeof LOGO_TONES;
type Colours = { primary: string; secondary: string };

/**
 * "Meet": two people meeting. One is already in (the filled circle), one is
 * joining (the outline). Where they overlap is cut out, so the mark works on
 * any background.
 */
const MARK = {
  width: 74,
  height: 48,
  body: ({ primary, secondary }: Colours, id: string) =>
    `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="74" height="48">` +
    `<rect width="74" height="48" fill="#fff"/>` +
    `<path d="M37 7.6a22 22 0 0 1 0 32.8a20 20 0 0 1 0-32.8z" fill="#000"/>` +
    `</mask>` +
    `<g mask="url(#${id})">` +
    `<circle cx="24" cy="24" r="22" fill="${primary}"/>` +
    `<circle cx="50" cy="24" r="20" fill="none" stroke="${secondary}" stroke-width="4"/>` +
    `</g>`,
};

/** Space between the mark and the wordmark, in mark units. */
const GAP = 16;

export interface LogoOptions {
  tone?: LogoTone;
  /** "mark" is the symbol alone (icons, small spaces); "full" adds the wordmark. */
  variant?: 'mark' | 'full';
  /** Rendered height in px; omit to size it with CSS. Width follows the aspect ratio. */
  height?: number;
  /** Override single colours, e.g. for a tinted mark. */
  colours?: Partial<Colours & { text: string }>;
  /** Accessible name; defaults to "Buddy". Pass "" for a decorative logo. */
  title?: string;
  /** Unique per page when several logos with different colours share one HTML document. */
  id?: string;
}

/** The logo's box in its own units, for laying it out. */
export function logoBox(variant: 'mark' | 'full' = 'full') {
  if (variant === 'mark') return { x: 0, y: 0, width: MARK.width, height: MARK.height };
  const top = Math.min(0, WORDMARK.top);
  const bottom = Math.max(MARK.height, WORDMARK.bottom);
  return { x: 0, y: top, width: MARK.width + GAP + WORDMARK.width, height: bottom - top };
}

/** The logo as a standalone SVG document. */
export function logoSvg({
  tone = 'dark',
  variant = 'full',
  height,
  colours,
  title = 'Buddy',
  id = `buddy-logo-${tone}`,
}: LogoOptions = {}) {
  const c = { ...LOGO_TONES[tone], ...colours };
  const box = logoBox(variant);
  const size =
    height === undefined
      ? ''
      : ` width="${round((height * box.width) / box.height)}" height="${height}"`;
  const label = title
    ? ` role="img" aria-label="${title}"><title>${title}</title>`
    : ` aria-hidden="true">`;
  const wordmark =
    variant === 'full'
      ? `<path transform="translate(${MARK.width + GAP} 0)" d="${WORDMARK.d}" fill="${c.text}"/>`
      : '';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.x} ${box.y} ${box.width} ${box.height}"${size}${label}` +
    MARK.body(c, id) +
    wordmark +
    `</svg>`
  );
}

/**
 * The mark centred on a square: app icons, favicons. `fraction` is how much of
 * the width it fills; `background` and `radius` draw the tile behind it.
 */
export function logoTileSvg(
  size: number,
  {
    fraction,
    tone = 'dark',
    background,
    radius = 0,
  }: { fraction: number; tone?: LogoTone; background?: string; radius?: number },
) {
  const w = size * fraction;
  const h = (w * MARK.height) / MARK.width;
  const tile = background
    ? `<rect width="${size}" height="${size}" rx="${radius}" fill="${background}"/>`
    : '';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    tile +
    `<svg x="${round((size - w) / 2)}" y="${round((size - h) / 2)}" width="${round(w)}" height="${round(h)}" viewBox="0 0 ${MARK.width} ${MARK.height}">` +
    MARK.body(LOGO_TONES[tone], `buddy-tile-${tone}`) +
    `</svg></svg>`
  );
}

const round = (n: number) => Math.round(n * 100) / 100;
