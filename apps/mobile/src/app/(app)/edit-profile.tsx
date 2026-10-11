import { LIMITS, type Place, type Availability, type Interest } from '@buddy/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { errorMessage } from '@/api/client';
import { useMe, useUpdateMe } from '@/api/queries';
import { AvailabilityChips, InterestGrid } from '@/components/onboarding/InterestPicker';
import {
  Button,
  Footer,
  Heading,
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

/** Profile → Edit profile: photo, name, bio, home town, interests and when you're free, saved together. */
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
  availability: Availability[];
}

function EditProfileForm({ me }: { me: Saved }) {
  const update = useUpdateMe();
  const [name, setName] = useState(me.name);
  const [bio, setBio] = useState(me.bio);
  const photo = usePickedImage('avatar', me.avatarUrl);
  const uploading = photo.uploading;
  const [town, setTown] = useState(me.place);
  const [interests, setInterests] = useState(me.interests);
  const [availability, setAvailability] = useState(me.availability);

  const save = () => {
    if (update.isPending || uploading) return;
    update.mutate(
      {
        name: name.trim() || me.name,
        bio: bio.trim(),
        placeId: town.id,
        interests,
        availability,
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
      <ScreenHeader />
      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 24 }}
      >
        <Heading size="page">Edit profile</Heading>

        <PhotoButton image={photo} name={name || me.name} shape="circle" size={96} noun="photo" />

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
          <Text className="font-mono text-[12px] text-subtle">
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
          className="h-24 py-3.5 leading-[22px]"
        />

        {/* Distances are measured from a known town, so this is a choice, not free text. */}
        <SectionLabel className="mb-2 mt-6">Where you live</SectionLabel>
        <TownField value={town} onChange={setTown} tone="inset" />

        <SectionLabel className="mb-3 mt-6">Into</SectionLabel>
        <InterestGrid value={interests} onChange={setInterests} />

        <SectionLabel className="mb-3 mt-6">Usually free</SectionLabel>
        <AvailabilityChips value={availability} onChange={setAvailability} />
      </KeyboardAwareScrollView>

      <Footer>
        <Button
          label={update.isPending ? 'Saving…' : 'Save'}
          inactive={update.isPending || uploading}
          onPress={save}
        />
      </Footer>
    </KeyboardScreen>
  );
}
