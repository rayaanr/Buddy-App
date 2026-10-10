import { IMAGE_TYPES, LIMITS, type ImageType } from '@buddy/shared';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { api, ApiRequestError, unwrap } from './client';

/** Longest edge kept: covers fill the screen width at 3x; avatars are small circles. */
const MAX_EDGE = { avatar: 800, cover: 1600 };

/**
 * Phone photos are often 4000px and several MB. Scaled down and re-saved as
 * JPEG they're a few hundred KB: quick to upload on mobile data, always under
 * the size limit, and in a format the API accepts (HEIC and the like included).
 */
async function shrink(
  kind: 'avatar' | 'cover',
  image: { uri: string; width?: number; height?: number },
) {
  const max = MAX_EDGE[kind];
  const context = ImageManipulator.manipulate(image.uri);
  const { width = 0, height = 0 } = image;
  if (Math.max(width, height) > max) {
    context.resize(width >= height ? { width: max } : { height: max });
  }
  const rendered = await context.renderAsync();
  try {
    const saved = await rendered.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
    return { uri: saved.uri, mimeType: 'image/jpeg' };
  } finally {
    rendered.release();
    context.release();
  }
}

/**
 * Uploads a picked image straight to storage (the API hands out a one-file
 * URL) and returns the key to save as avatarKey / coverKey.
 */
export async function uploadImage(
  kind: 'avatar' | 'cover',
  picked: { uri: string; mimeType?: string | null; width?: number; height?: number },
) {
  // If shrinking fails for some reason, try the original: it may still fit.
  const image = await shrink(kind, picked).catch(() => picked);
  // fetch reads local file:// and blob: URIs on every platform.
  const blob = await (await fetch(image.uri)).blob();
  const contentType = (image.mimeType ?? blob.type) as ImageType;
  if (!IMAGE_TYPES.includes(contentType)) {
    throw new ApiRequestError(400, 'unsupported_image', 'Use a JPEG, PNG or WebP photo.');
  }
  if (blob.size > LIMITS.uploadMaxBytes) {
    throw new ApiRequestError(400, 'image_too_big', 'That photo is too big. Try a smaller one.');
  }

  const ticket = await unwrap(api.uploads.$post({ json: { kind, contentType, size: blob.size } }));
  let res: Response;
  try {
    res = await fetch(ticket.uploadUrl, { method: 'PUT', headers: ticket.headers, body: blob });
  } catch {
    throw new ApiRequestError(0, 'network_error', 'Can’t reach Buddy. Check your connection.');
  }
  if (!res.ok)
    throw new ApiRequestError(
      res.status,
      'upload_failed',
      'The upload didn’t go through. Try again.',
    );
  return ticket.key;
}
