import type { ActivityGroup } from './constants';

/**
 * Buddy's own pictures for anything without a photo (design/fallbacks),
 * served by the API at /fallbacks/<id>.svg. People can also pick one
 * instead of uploading: pass `art:<id>` where a photo key goes.
 */

const numbered = (prefix: string, n: number) =>
  Array.from({ length: n }, (_, i) => `${prefix}-${String(i + 1).padStart(2, '0')}`);

export const FALLBACK_ART = {
  /** Avatars: men, women, and animals for everyone else. */
  man: numbered('man', 8),
  woman: numbered('woman', 8),
  other: numbered('other', 8),
  communityLogo: numbered('community', 13),
  communityCover: numbered('cover', 13),
  /** Group chats whose activity or community has no photo of its own. */
  groupChat: numbered('group', 8),
  activityCover: {
    Running: numbered('activity-running', 7),
    Sports: numbered('activity-sports', 7),
    Social: numbered('activity-social', 7),
    Creative: numbered('activity-creative', 7),
    Food: numbered('activity-food', 7),
  } satisfies Record<ActivityGroup, string[]>,
};

/** The same one of `list` for the same id, every time (FNV-1a hash). */
export function pickById<T>(id: string, list: readonly T[]): T {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return list[h % list.length]!;
}

/** The picture for a group chat whose activity or community has no photo of its own. */
export const groupChatArt = (chatId: string) => pickById(chatId, FALLBACK_ART.groupChat);

/** The avatars someone can pick from: the set for their gender. */
export const avatarArtFor = (gender: string | null | undefined) =>
  gender === 'man'
    ? FALLBACK_ART.man
    : gender === 'woman'
      ? FALLBACK_ART.woman
      : FALLBACK_ART.other;

export const ALL_ACTIVITY_ART = Object.values(FALLBACK_ART.activityCover).flat();

const ART_PREFIX = 'art:';
/** A picked picture, passed where an uploaded photo's key goes. */
export const artKey = (id: string) => `${ART_PREFIX}${id}`;
/** The picture id in an `art:` key, or null for an uploaded photo's key. */
export const artFromKey = (key: string | null | undefined) =>
  key?.startsWith(ART_PREFIX) ? key.slice(ART_PREFIX.length) : null;

export const fallbackPath = (id: string) => `/fallbacks/${id}.svg`;
/** One of Buddy's pictures (as opposed to a photo someone uploaded). */
export const isFallbackUrl = (url: string | null | undefined) => !!url?.includes('/fallbacks/');
/** The picture id in one of our URLs. */
export const artFromUrl = (url: string | null | undefined) =>
  /\/fallbacks\/([a-z0-9-]+)\.svg$/.exec(url ?? '')?.[1] ?? null;
