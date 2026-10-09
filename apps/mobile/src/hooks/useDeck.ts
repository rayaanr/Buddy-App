import { useMemo } from 'react';

import { buildDeck } from '@/lib/activity';
import { useActivitiesStore } from '@/store/activities';
import { useSessionStore } from '@/store/session';

/** Activity ids for the "Picked for you" deck, ranked for the current user. */
export function useDeckIds() {
  const activities = useActivitiesStore((s) => s.activities);
  const communities = useActivitiesStore((s) => s.communities);
  const interests = useSessionStore((s) => s.interests);
  return useMemo(
    () => buildDeck(activities, interests, communities),
    [activities, interests, communities],
  );
}
