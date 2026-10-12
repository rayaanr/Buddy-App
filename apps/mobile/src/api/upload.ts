import { IMAGE_TYPES, LIMITS, type ImageType, type UploadKind } from '@buddy/shared';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { api, ApiRequestError, unwrap } from './client';

/** Longest edge kept: covers fill the screen width at 3x; avatars and logos are small. */
const MAX_EDGE: Record<UploadKind, number> = { avatar: 800, cover: 1600, logo: 600, chat: 1280 };
/** JPEG quality: chat photos are seen once on a phone screen, so they can be lighter. */
const QUALITY: Record<UploadKind, number> = { avatar: 0.8, cover: 0.8, logo: 0.8, chat: 0.72 };

/**
 * Phone photos are often 4000px and several MB. Scaled down and re-saved as
 * JPEG they're a few hundred KB: quick to upload on mobile data, always under
 * the size limit, and in a format the API accepts (HEIC and the like included).
 */
async function shrink(kind: UploadKind, image: { uri: string; width?: number; height?: number }) {
  const max = MAX_EDGE[kind];
  const context = ImageManipulator.manipulate(image.uri);
  const { width = 0, height = 0 } = image;
  if (Math.max(width, height) > max) {
    context.resize(width >= height ? { width: max } : { height: max });
  }
  const rendered = await context.renderAsync();
  try {
    const saved = await rendered.saveAsync({ compress: QUALITY[kind], format: SaveFormat.JPEG });
    return { uri: saved.uri, mimeType: 'image/jpeg', width: saved.width, height: saved.height };
  } finally {
    rendered.release();
    context.release();
  }
}

type Picked = { uri: string; mimeType?: string | null; width?: number; height?: number };

/**
 * Uploads a picked image straight to storage (the API hands out a one-file
 * URL) and returns the key to save as avatarKey / coverKey.
 */
export async function uploadImage(kind: UploadKind, picked: Picked) {
  return (await uploadSized(kind, picked)).key;
}

/** Like uploadImage, also returning the uploaded size (chat photos are laid out with it). */
export async function uploadSized(kind: UploadKind, picked: Picked) {
  // If shrinking fails for some reason, try the original: it may still fit.
  const image = await shrink(kind, picked).catch(() => picked);
  // fetch reads local file:// and blob: URIs on every platform. The raw bytes,
  // not a Blob: on phones a Blob detours through React Native's blob store.
  const file = await fetch(image.uri);
  const bytes = await file.arrayBuffer();
  const contentType = (image.mimeType ?? file.headers.get('content-type')) as ImageType;
  if (!IMAGE_TYPES.includes(contentType)) {
    throw new ApiRequestError(400, 'unsupported_image', 'Use a JPEG, PNG or WebP photo.');
  }
  const size = bytes.byteLength;
  if (size > LIMITS.uploadMaxBytes) {
    throw new ApiRequestError(400, 'image_too_big', 'That photo is too big. Try a smaller one.');
  }

  const ticket = await unwrap(api.uploads.$post({ json: { kind, contentType, size } }));
  let res: Response;
  try {
    res = await fetch(ticket.uploadUrl, { method: 'PUT', headers: ticket.headers, body: bytes });
  } catch {
    throw new ApiRequestError(0, 'network_error', 'Can’t reach Buddy. Check your connection.');
  }
  if (!res.ok)
    throw new ApiRequestError(
      res.status,
      'upload_failed',
      'The upload didn’t go through. Try again.',
    );
  return { key: ticket.key, width: image.width ?? 1, height: image.height ?? 1 };
}
