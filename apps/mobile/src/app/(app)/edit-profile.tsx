import {
  avatarArtFor,
  GENDER_LABELS,
  GENDERS,
  LIMITS,
  type Availability,
  type Gender,
  type Interest,
  type Place,
} from '@buddy/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { errorMessage } from '@/api/client';
import { useMe, useUpdateMe } from '@/api/queries';
import {
  BirthYearField,
  birthYearProblem,
  validBirthYear,
} from '@/components/onboarding/BirthYearField';
import { AvailabilityChips, InterestGrid } from '@/components/onboarding/InterestPicker';
import {
  Button,
  Chip,
  CloseIcon,
  Footer,
  KeyboardAwareScrollView,
  KeyboardScreen,
  QueryFallback,
  ScreenHeader,
  SectionLabel,
  TextField,
} from '@/components/ui';
import { PhotoButton } from '@/components/create/PhotoButton';
import { TownField } from '@/components/places/TownField';
import { usePickedImage } from '@/hooks/usePickedImage';
import { toast } from '@/store/ui';
import { colors, spacing } from '@/theme';

/**
 * Profile → Edit profile: photo, name, bio, home town, interests, when you're
 * free, and (private) gender and birth year, saved together.
 */
export default function EditProfileScreen() {
  const me = useMe();
  if (!me.data) return <QueryFallback query={me} />;
  return <EditProfileForm me={me.data} />;
}

interface Saved {
  name: string;
  bio: string;
  avatarUrl: string | null;
  place: Place;
  interests: Interest[];
  hiddenInterests: Interest[];
  availability: Availability[];
  gender: Gender | null;
  birthYear: number | null;
}

function EditProfileForm({ me }: { me: Saved }) {
  const update = useUpdateMe();
  const [name, setName] = useState(me.name);
  const [bio, setBio] = useState(me.bio);
  const photo = usePickedImage('avatar', me.avatarUrl);
  const uploading = photo.uploading;
  const [town, setTown] = useState(me.place);
  const [interests, setInterests] = useState(me.interests);
  // Left out of picks ("Not into"); choosing one as an interest brings it back.
  const [hidden, setHidden] = useState(me.hiddenInterests);
  const stillHidden = hidden.filter((i) => !interests.includes(i));
  const [availability, setAvailability] = useState(me.availability);
  const [gender, setGender] = useState(me.gender);
  const [year, setYear] = useState(me.birthYear ? String(me.birthYear) : '');

  const save = () => {
    if (update.isPending || uploading) return;
    update.mutate(
      {
        name: name.trim() || me.name,
        bio: bio.trim(),
        placeId: town.id,
        interests,
        hiddenInterests: stillHidden,
        availability,
        ...(gender && { gender }),
        ...(validBirthYear(year) && { birthYear: validBirthYear(year)! }),
        ...(photo.key !== undefined && { avatarKey: photo.key }),
      },
      {
        onSuccess: () => {
          // Opened from a link, there's no screen behind it to go back to.
          if (router.canGoBack()) router.back();
          else router.replace('/profile');
          toast('Profile saved.');
        },
        onError: (err) => toast(errorMessage(err)),
      },
    );
  };

  return (
    <KeyboardScreen className="flex-1 bg-bg">
      <ScreenHeader title="Edit profile" />
      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: spacing.edge,
          paddingTop: 12,
          paddingBottom: 24,
        }}
      >
        <PhotoButton
          image={photo}
          name={name || me.name}
          shape="circle"
          size={96}
          noun="photo"
          // The avatars for the gender chosen below.
          art={{ ids: avatarArtFor(gender), label: 'Choose an avatar' }}
        />

        <SectionLabel className="mb-2 mt-6">Name</SectionLabel>
        <TextField
          value={name}
          onChangeText={setName}
          tone="inset"
          size="md"
          autoCapitalize="words"
        />

        <View className="mb-2 mt-6 flex-row items-baseline justify-between">
          <SectionLabel>About you</SectionLabel>
          <Text className="font-mono text-caption text-subtle">
            {bio.length}/{LIMITS.bioMax}
          </Text>
        </View>
        <TextField
          value={bio}
          onChangeText={setBio}
          maxLength={LIMITS.bioMax}
          placeholder="A line or two about you, e.g. new to Colombo, up for an early run."
          multiline
          textAlignVertical="top"
          tone="inset"
          size="md"
          className="h-24 py-3.5 leading-subhead"
        />

        {/* Distances are measured from a known town, so this is a choice, not free text. */}
        <SectionLabel className="mb-2 mt-6">Where you live</SectionLabel>
        <TownField value={town} onChange={setTown} tone="inset" />

        <SectionLabel className="mb-3 mt-6">Into</SectionLabel>
        <InterestGrid value={interests} onChange={setInterests} />

        {stillHidden.length ? (
          <>
            <SectionLabel className="mb-1 mt-6">Not in your picks</SectionLabel>
            <Text className="mb-3 font-sans text-footnote leading-footnote text-muted">
              You said you’re not into these. Tap one to see it in Picked for you again.
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {stillHidden.map((i) => (
                <Chip
                  key={i}
                  label={i}
                  selected={false}
                  icon={<CloseIcon size={14} color={colors.muted} />}
                  accessibilityLabel={`Show ${i} in picks again`}
                  onPress={() => setHidden((list) => list.filter((x) => x !== i))}
                />
              ))}
            </View>
          </>
        ) : null}

        <SectionLabel className="mb-3 mt-6">Usually free</SectionLabel>
        <AvailabilityChips value={availability} onChange={setAvailability} />

        <SectionLabel className="mb-1 mt-8">Just for you</SectionLabel>
        <Text className="mb-3 font-sans text-footnote leading-footnote text-muted">
          Not shown on your profile. Without a photo, your avatar comes from the set for your
          gender.
        </Text>
        <Text className="mb-2 font-sans text-label text-muted">Gender</Text>
        <View className="flex-row flex-wrap gap-2" role="radiogroup" accessibilityLabel="Gender">
          {GENDERS.map((g) => (
            <Chip
              key={g}
              label={GENDER_LABELS[g]}
              selected={gender === g}
              onPress={() => setGender(g)}
            />
          ))}
        </View>
        <Text className="mb-2 mt-4 font-sans text-label text-muted">Birth year</Text>
        <BirthYearField value={year} onChange={setYear} tone="inset" />
      </KeyboardAwareScrollView>

      <Footer>
        <Button
          label={update.isPending ? 'Saving…' : 'Save'}
          loading={update.isPending}
          inactive={update.isPending || uploading || !!birthYearProblem(year)}
          onPress={save}
        />
      </Footer>
    </KeyboardScreen>
  );
}
