import type { UpdateCommunityInput } from '@buddy/shared';
import { router, useLocalSearchParams } from 'expo-router';

import { errorMessage } from '@/api/client';
import { useCommunity, useUpdateCommunity } from '@/api/queries';
import { CommunityForm } from '@/components/community/CommunityForm';
import { QueryFallback } from '@/components/ui';
import { toast } from '@/store/ui';

/** Community → ⋯ → Edit community (whoever started it). Only what changed is sent. */
export default function EditCommunityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const community = useCommunity(id);
  const update = useUpdateCommunity(id);
  const c = community.data;
  if (!c) return <QueryFallback query={community} notFound="This community no longer exists." />;

  return (
    <CommunityForm
      heading="Edit community"
      initial={c}
      submitLabel="Save changes"
      pendingLabel="Saving…"
      pending={update.isPending}
      onSubmit={(v) => {
        const patch: UpdateCommunityInput = {
          ...(v.name !== c.name && { name: v.name }),
          ...(v.about !== c.about && { about: v.about }),
          ...(v.rules.join('\n') !== c.rules.join('\n') && { rules: v.rules }),
          ...(v.coverKey !== undefined && { coverKey: v.coverKey }),
        };
        update.mutate(patch, {
          onSuccess: () => {
            router.back();
            toast('Saved.');
          },
          onError: (err) => toast(errorMessage(err)),
        });
      }}
    />
  );
}
