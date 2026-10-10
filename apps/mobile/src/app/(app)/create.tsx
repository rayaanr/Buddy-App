import { router, useLocalSearchParams } from 'expo-router';

import { errorMessage } from '@/api/client';
import { useCommunities, useCreateActivity, useMe } from '@/api/queries';
import { ActivityForm, newDraft } from '@/components/create/ActivityForm';
import { toast } from '@/store/ui';

export default function CreateActivityScreen() {
  const me = useMe();
  const create = useCreateActivity();
  // From a community's "Host an activity": that community is picked already.
  const { communityId } = useLocalSearchParams<{ communityId?: string }>();
  const joined = useCommunities().data?.filter((c) => c.joined) ?? [];

  return (
    <ActivityForm
      heading="New activity"
      initial={newDraft()}
      submitLabel="Publish activity"
      pendingLabel="Publishing…"
      pending={create.isPending}
      fallbackPlace={me.data?.area ?? 'your home town'}
      autoFocus
      communities={joined}
      initialCommunityId={communityId}
      onSubmit={(v) => {
        create.mutate(
          {
            ...v,
            coverKey: v.coverKey ?? undefined,
            startsAt: v.startsAt.toISOString(),
          },
          {
            onSuccess: () => {
              router.dismissTo({ pathname: '/activities', params: { segment: 'hosting' } });
              toast('Published. It’s live on Discover.');
            },
            onError: (err) => toast(errorMessage(err)),
          },
        );
      }}
    />
  );
}
