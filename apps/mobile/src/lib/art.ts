import { fallbackPath, groupChatArt, isFallbackUrl } from '@buddy/shared';

import { API_URL } from '@/config';

/** Where one of Buddy's own pictures is served (see FALLBACK_ART in @buddy/shared). */
export const artUri = (id: string) => `${API_URL}${fallbackPath(id)}`;

/**
 * A group chat's picture: its activity's or community's own photo, or else a
 * group picture (the same one the Chats list shows).
 */
export const chatImage = (chatId: string, photo: string | null | undefined) =>
  photo && !isFallbackUrl(photo) ? photo : artUri(groupChatArt(chatId));
