import type { ActivitySummary } from '@buddy/shared';
import { Platform, Share } from 'react-native';

import { SHARE_URL } from '@/config';
import { toast } from '@/store/ui';
import { whenLong } from './activity';

const activityLink = (id: string) => `${SHARE_URL}/a/${id}`;

/**
 * Opens the share sheet with a link to the activity. The link's preview page
 * shows the details in chat apps and opens the activity in the app.
 */
export async function shareActivity(
  a: Pick<ActivitySummary, 'id' | 'title' | 'startsAt' | 'place'>,
) {
  const url = activityLink(a.id);
  const message = `${a.title}, ${whenLong(a)} at ${a.place}. Join me on Buddy: ${url}`;
  try {
    if (Platform.OS !== 'web') {
      await Share.share({ message });
    } else if (typeof navigator.share === 'function') {
      await navigator.share({ title: a.title, text: message });
    } else {
      await navigator.clipboard.writeText(url);
      toast('Link copied.');
    }
  } catch {
    // Closing the share sheet counts as an error on web; nothing to report.
  }
}
