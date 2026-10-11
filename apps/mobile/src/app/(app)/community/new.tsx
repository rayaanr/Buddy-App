import { router } from 'expo-router';

import { errorMessage } from '@/api/client';
import { useCreateCommunity, useMe } from '@/api/queries';
import { CommunityForm } from '@/components/community/CommunityForm';
import { Loading } from '@/components/ui';
import { toast } from '@/store/ui';

/** Communities → +: start a community. You join it and can edit it later. */
export default function NewCommunityScreen() {
  const create = useCreateCommunity();
  const me = useMe();
  // Starts on your home town; wait for it so the form opens with it filled in.
  if (!me.data) return <Loading className="flex-1 bg-bg" />;
  return (
    <CommunityForm
      initial={{
        name: '',
        about: '',
        rules: [],
        coverUrl: null,
        logoUrl: null,
        place: me.data.place,
      }}
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
