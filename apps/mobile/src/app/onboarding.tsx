import { errorMessage } from '@/api/client';
import { useMe, useUpdateMe } from '@/api/queries';
import { InterestPicker } from '@/components/onboarding/InterestPicker';
import { toast } from '@/store/ui';

export default function OnboardingScreen() {
  const me = useMe();
  const update = useUpdateMe();

  return (
    <InterestPicker
      initialInterests={me.data?.interests ?? []}
      initialAvailability={me.data?.availability ?? []}
      submitLabel="Continue"
      busy={update.isPending}
      // Saving interests completes onboarding; the root navigator then opens the app.
      onSubmit={(interests, availability) =>
        update.mutate({ interests, availability }, { onError: (err) => toast(errorMessage(err)) })
      }
    />
  );
}
