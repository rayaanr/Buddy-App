const ACTIVITY =
  /^(?:activity|a)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i;

/**
 * The activity screen a link points at, or null for anything else. Reads
 * app links ("buddy://activity/<id>") and web links, including the share
 * page ("https://…/a/<id>").
 */
export function activityPathFrom(url: string | null): `/activity/${string}` | null {
  const match = url?.match(/^([a-z][a-z0-9+.-]*):\/\/([^?#]*)/i);
  if (!match) return null;
  const [, scheme, rest] = match;
  // Web links start with a host; in app links the first part is the path.
  const path = /^https?$/i.test(scheme!) ? rest!.replace(/^[^/]*\/?/, '') : rest!;
  const id = path.match(ACTIVITY)?.[1];
  return id ? `/activity/${id}` : null;
}
