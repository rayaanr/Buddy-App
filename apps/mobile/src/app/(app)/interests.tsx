import { router } from 'expo-router';

import { errorMessage } from '@/api/client';
import { useMe, useUpdateMe } from '@/api/queries';
import { InterestPicker } from '@/components/onboarding/InterestPicker';
import { toast } from '@/store/ui';

/** Edit interests & availability from the profile. */
export default function EditInterestsScreen() {
  const me = useMe();
  const update = useUpdateMe();
  if (!me.data) return null;

  return (
    <InterestPicker
      initialInterests={me.data.interests}
      initialAvailability={me.data.availability}
      submitLabel="Save"
      busy={update.isPending}
      onSubmit={(interests, availability) =>
        update.mutate(
          { interests, availability },
          {
            onSuccess: () => {
              router.back();
              toast('Interests updated.');
            },
            onError: (err) => toast(errorMessage(err)),
          },
        )
      }
    />
  );
}
