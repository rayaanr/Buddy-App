import { router } from 'expo-router';

import { InterestPicker } from '@/components/onboarding/InterestPicker';
import { useSessionStore } from '@/store/session';
import { toast } from '@/store/ui';

/** Edit interests & availability from the profile. */
export default function EditInterestsScreen() {
  const interests = useSessionStore((s) => s.interests);
  const availability = useSessionStore((s) => s.availability);
  const updatePreferences = useSessionStore((s) => s.updatePreferences);

  return (
    <InterestPicker
      initialInterests={interests}
      initialAvailability={availability}
      submitLabel="Save"
      onSubmit={(i, a) => {
        updatePreferences(i, a);
        router.back();
        toast('Interests updated.');
      }}
    />
  );
}
