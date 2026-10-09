import { InterestPicker } from '@/components/onboarding/InterestPicker';
import { useSessionStore } from '@/store/session';

export default function OnboardingScreen() {
  const interests = useSessionStore((s) => s.interests);
  const availability = useSessionStore((s) => s.availability);
  const completeOnboarding = useSessionStore((s) => s.completeOnboarding);

  return (
    <InterestPicker
      initialInterests={interests}
      initialAvailability={availability}
      submitLabel="Continue"
      onSubmit={completeOnboarding}
    />
  );
}
