import { errorMessage } from '@/api/client';
import { useMe, useUpdateMe } from '@/api/queries';
import { InterestPicker } from '@/components/onboarding/InterestPicker';
import { useAccountStore } from '@/store/account';
import { toast } from '@/store/ui';

export default function OnboardingScreen() {
  const me = useMe();
  const update = useUpdateMe();
  // The town picked on Sign up, if saving it right after the code failed.
  const pending = useAccountStore((s) => s.pendingSignUp);

  return (
    <InterestPicker
      initialInterests={me.data?.interests ?? []}
      initialAvailability={me.data?.availability ?? []}
      submitLabel="Continue"
      busy={update.isPending}
      // Saving interests completes onboarding; the root navigator then opens the app.
      onSubmit={(interests, availability) =>
        update.mutate(
          { interests, availability, ...(pending && { placeId: pending.placeId }) },
          {
            onSuccess: () => useAccountStore.getState().setPendingSignUp(null),
            onError: (err) => toast(errorMessage(err)),
          },
        )
      }
    />
  );
}
