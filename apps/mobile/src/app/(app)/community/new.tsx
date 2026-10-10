import { router } from 'expo-router';

import { errorMessage } from '@/api/client';
import { useCreateCommunity } from '@/api/queries';
import { CommunityForm } from '@/components/community/CommunityForm';
import { toast } from '@/store/ui';

/** Communities → +: start a community. You join it and can edit it later. */
export default function NewCommunityScreen() {
  const create = useCreateCommunity();
  return (
    <CommunityForm
      heading="Start a community"
      submitLabel="Create community"
      pendingLabel="Creating…"
      pending={create.isPending}
      onSubmit={(v) =>
        create.mutate(
          { ...v, coverKey: v.coverKey ?? undefined, logoKey: v.logoKey ?? undefined },
          {
            onSuccess: (c) => {
              router.replace(`/community/${c.id}`);
              toast('Your community is live. Host its first activity.');
            },
            onError: (err) => toast(errorMessage(err)),
          },
        )
      }
    />
  );
}
