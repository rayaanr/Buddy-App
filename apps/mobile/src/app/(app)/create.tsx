import { router } from 'expo-router';

import { errorMessage } from '@/api/client';
import { useCreateActivity, useMe } from '@/api/queries';
import { ActivityForm, newDraft } from '@/components/create/ActivityForm';
import { toast } from '@/store/ui';

export default function CreateActivityScreen() {
  const me = useMe();
  const create = useCreateActivity();

  return (
    <ActivityForm
      heading="New activity"
      initial={newDraft()}
      submitLabel="Publish activity"
      pendingLabel="Publishing…"
      pending={create.isPending}
      fallbackPlace={me.data?.area ?? 'your home town'}
      autoFocus
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
