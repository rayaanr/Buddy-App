import { randomUUID } from 'node:crypto';

/** Where uploads go in R2: `avatars/<user id>/<uuid>.<ext>` or `covers/<user id>/<uuid>.<ext>`. */
export type UploadKind = 'avatar' | 'cover';

const FOLDER: Record<UploadKind, string> = { avatar: 'avatars', cover: 'covers' };
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

export const newUploadKey = (kind: UploadKind, userId: string, extension: string) =>
  `${FOLDER[kind]}/${userId}/${randomUUID()}.${extension}`;

/**
 * True only for a key this user could have been given, matched exactly
 * (a prefix check would let `covers/<me>/../avatars/<you>/…` through).
 */
export const isOwnUpload = (key: string, kind: UploadKind, userId: string) =>
  new RegExp(`^${FOLDER[kind]}/${userId}/${UUID}\\.(jpg|png|webp)$`).test(key);
