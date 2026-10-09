import { useActivitiesStore } from '@/store/activities';
import { toast } from '@/store/ui';
import type { Community } from '@/types/models';

export function useCommunityActions() {
  const toggleCommunity = useActivitiesStore((s) => s.toggleCommunity);
  return {
    toggle: (c: Community) => {
      toggleCommunity(c.id);
      toast(c.joined ? `Left ${c.name}` : `Joined. ${c.name} activities now show first.`);
    },
  };
}
