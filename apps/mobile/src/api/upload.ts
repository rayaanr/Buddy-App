import { IMAGE_TYPES, LIMITS, type ImageType } from '@buddy/shared';

import { api, ApiRequestError, unwrap } from './client';

/**
 * Uploads a picked image straight to storage (the API hands out a one-file
 * URL) and returns the key to save as avatarKey / coverKey.
 */
export async function uploadImage(
  kind: 'avatar' | 'cover',
  image: { uri: string; mimeType?: string | null },
) {
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
