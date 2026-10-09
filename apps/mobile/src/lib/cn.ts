/** Joins class names, skipping falsy values. */
export const cn = (...parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(' ');

/** Darkens a #rrggbb colour, equivalent to color-mix(in oklab, c x%, black) closely enough for stripes. */
export function shade(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift: number) => Math.round(((n >> shift) & 0xff) * amount);
  return `#${[ch(16), ch(8), ch(0)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
