import type { ActivityDetail } from '@buddy/shared';
import { createEventInCalendarAsync } from 'expo-calendar/legacy';
import { Platform } from 'react-native';

import { errorMessage } from '@/api/client';
import { SHARE_URL } from '@/config';
import { toast } from '@/store/ui';

/** Activities have no end time; two hours covers most. */
const LENGTH_MS = 2 * 60 * 60 * 1000;

/** The phone's own calendar app does the adding; browsers have nothing to open. */
export const canAddToCalendar = Platform.OS !== 'web';

/**
 * Opens the phone's "new event" screen filled in with the activity, so the
 * person picks the calendar and taps Add. No calendar access is asked for.
 */
export async function addToCalendar(
  a: Pick<ActivityDetail, 'id' | 'title' | 'startsAt' | 'place' | 'area' | 'description'>,
) {
  const start = new Date(a.startsAt);
  const link = `${SHARE_URL}/a/${a.id}`;
  try {
    await createEventInCalendarAsync({
      title: a.title,
      startDate: start,
      endDate: new Date(start.getTime() + LENGTH_MS),
      timeZone: 'Asia/Colombo',
      location: `${a.place}, ${a.area}`,
      notes: [a.description, `On Buddy: ${link}`].filter(Boolean).join('\n\n'),
      url: link,
    });
  } catch (err) {
    toast(errorMessage(err));
  }
}
