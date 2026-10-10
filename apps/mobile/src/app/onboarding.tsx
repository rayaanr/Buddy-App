import {
  LIMITS,
  placeLabel,
  type Availability,
  type Interest,
  type Me,
  type Place,
  type UpdateMeInput,
} from '@buddy/shared';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { errorMessage } from '@/api/client';
import { useMe, useUpdateMe } from '@/api/queries';
import { AvailabilityChips, InterestGrid } from '@/components/onboarding/InterestPicker';
import { TownField } from '@/components/places/TownField';
import {
  AnimatedView,
  BackButton,
  Button,
  Footer,
  Heading,
  KeyboardAwareScrollView,
  KeyboardScreen,
  Loading,
  SectionLabel,
  TextField,
  useEnterOnChange,
} from '@/components/ui';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { cn } from '@/lib/cn';
import { toast } from '@/store/ui';

const STEPS = 3;

/**
 * First run, right after the emailed code: name, home town, then interests.
 * Every step can be skipped; finishing or skipping the last one opens the app.
 */
export default function OnboardingScreen() {
  const me = useMe();
  if (!me.data) return <Loading className="flex-1 bg-bg" />;
  return <Steps me={me.data} />;
}

function Steps({ me }: { me: Me }) {
  const { top } = useScreenInsets();
  const update = useUpdateMe();
  const [step, setStep] = useState(0);
  // Starts as a name made from the email, so skipping still leaves something to show.
  const [name, setName] = useState(me.name);
  const [town, setTown] = useState<Place>(me.place);
  const [interests, setInterests] = useState<Interest[]>(me.interests);
  const [availability, setAvailability] = useState<Availability[]>(me.availability);
  const enter = useEnterOnChange(step);

  const last = step === STEPS - 1;
  // Saves what this step changed (nothing, when skipped), then moves on.
  // Finishing the last step flips `onboarded` and the root navigator opens the app.
  const next = (patch: UpdateMeInput) => {
    if (update.isPending) return;
    const body = last ? { ...patch, onboarded: true as const } : patch;
    if (!Object.keys(body).length) return setStep(step + 1);
    update.mutate(body, {
      onSuccess: () => !last && setStep(step + 1),
      onError: (err) => toast(errorMessage(err)),
    });
  };

  const trimmed = name.trim();
  const saveName = (): UpdateMeInput => (trimmed !== me.name ? { name: trimmed } : {});
  const steps = [
    {
      title: 'What should we call you?',
      hint: 'This is how you’ll appear to people you meet.',
      canContinue: !!trimmed,
      save: saveName,
      body: (
        <>
          <SectionLabel className="mb-2 mt-7">Your name</SectionLabel>
          <TextField
            value={name}
            onChangeText={setName}
            placeholder="First and last name"
            autoComplete="name"
            textContentType="name"
            autoCapitalize="words"
            maxLength={LIMITS.nameMax}
            autoFocus
            returnKeyType="next"
            onSubmitEditing={() => trimmed && next(saveName())}
          />
        </>
      ),
    },
    {
      title: 'Where do you live?',
      hint: 'Anywhere in Sri Lanka. We show activities near here; only your town is shown to others.',
      canContinue: true,
      save: (): UpdateMeInput => (town.id !== me.place.id ? { placeId: town.id } : {}),
      body: (
        <>
          <SectionLabel className="mb-2 mt-7">Home town</SectionLabel>
          <TownField value={town} onChange={setTown} />
          <Text className="mt-2 font-sans text-[13.5px] leading-[19px] text-muted">
            Skip and we’ll start you in {placeLabel(me.place)}. You can change it any time.
          </Text>
        </>
      ),
    },
    {
      title: 'What are you into?',
      hint: 'Pick a few and we’ll show you things happening nearby.',
      canContinue: interests.length > 0,
      save: (): UpdateMeInput => ({ interests, availability }),
      body: (
        <>
          <View className="mt-[22px]">
            <InterestGrid value={interests} onChange={setInterests} />
          </View>
          <SectionLabel className="mb-3 mt-[26px]">Usually free</SectionLabel>
          <AvailabilityChips value={availability} onChange={setAvailability} />
        </>
      ),
    },
  ];
  const current = steps[step]!;

  return (
    <KeyboardScreen className="flex-1 bg-bg">
      <View className="flex-row items-center gap-4 px-[18px]" style={{ paddingTop: top(56) }}>
        <BackButton
          onPress={() => setStep(step - 1)}
          disabled={step === 0}
          className={step === 0 ? 'opacity-0' : undefined}
        />
        <View
          className="flex-1 flex-row gap-1.5 pr-[44px]"
          accessibilityLabel={`Step ${step + 1} of ${STEPS}`}
        >
          {steps.map((_, i) => (
            <View
              key={i}
              className={cn('h-1 flex-1 rounded-full', i <= step ? 'bg-lime' : 'bg-surface')}
            />
          ))}
        </View>
      </View>

      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 20, paddingBottom: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        <AnimatedView style={enter}>
          <Text className="font-mono-medium text-[12px] tracking-[1.2px] text-subtle">
            STEP {step + 1} OF {STEPS}
          </Text>
          <Heading size="hero" className="mt-2.5">
            {current.title}
          </Heading>
          <Text className="mt-3 font-sans text-[16px] leading-[23px] text-muted">
            {current.hint}
          </Text>
          {current.body}
        </AnimatedView>
      </KeyboardAwareScrollView>

      <Footer>
        <Button
          label={update.isPending ? 'Saving…' : last ? 'Start exploring' : 'Continue'}
          inactive={!current.canContinue || update.isPending}
          onPress={() => current.canContinue && next(current.save())}
        />
        {/* Not a primary action: skipping is fine, but continuing is the nudge. */}
        <Button
          label="Skip for now"
          variant="ghost"
          size="md"
          weight="medium"
          disabled={update.isPending}
          onPress={() => next({})}
          className="mt-2.5"
        />
      </Footer>
    </KeyboardScreen>
  );
}
