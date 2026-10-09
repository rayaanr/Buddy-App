import type { CommunitySummary } from '@buddy/shared';

import { errorMessage } from '@/api/client';
import { useToggleCommunity } from '@/api/queries';
import { toast } from '@/store/ui';

/** Join or leave a community, with the toasts from the design. */
export function useCommunityToggle() {
  const mutation = useToggleCommunity();
  return {
    pending: mutation.isPending,
    toggle: (c: Pick<CommunitySummary, 'id' | 'name' | 'joined'>) =>
      mutation.mutate(c, {
        onSuccess: () =>
          toast(c.joined ? `Left ${c.name}` : `Joined. ${c.name} activities now show first.`),
        onError: (err) => toast(errorMessage(err)),
      }),
  };
}
