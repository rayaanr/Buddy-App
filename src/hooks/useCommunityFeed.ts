import { useMemo } from 'react';

import { isParticipating } from '@/lib/activity';
import { useActivitiesStore } from '@/store/activities';
import type { Activity } from '@/types/models';

export interface CommunityFeedItem {
  activity: Activity;
  communityName: string;
}

/** Activities from communities you've joined that you aren't already part of. */
export function useCommunityFeed(): CommunityFeedItem[] {
  const activities = useActivitiesStore((s) => s.activities);
  const communities = useActivitiesStore((s) => s.communities);

  return useMemo(() => {
    const joined = new Map(communities.filter((c) => c.joined).map((c) => [c.id, c.name]));
    return activities
      .filter((a) => a.communityId && joined.has(a.communityId) && !isParticipating(a))
      .map((activity) => ({ activity, communityName: joined.get(activity.communityId!)! }));
  }, [activities, communities]);
}
