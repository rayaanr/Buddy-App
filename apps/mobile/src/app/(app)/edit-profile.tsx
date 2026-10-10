import { LIMITS, type Place, type Availability, type Interest } from '@buddy/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { errorMessage } from '@/api/client';
import { useMe, useUpdateMe } from '@/api/queries';
import { AvailabilityChips, InterestGrid } from '@/components/onboarding/InterestPicker';
import {
  ActionSheet,
  Avatar,
  Button,
  CameraIcon,
  Footer,
  Heading,
  KeyboardAwareScrollView,
  KeyboardScreen,
  PressableScale,
  QueryFallback,
  ScreenHeader,
  SectionLabel,
  TextField,
} from '@/components/ui';
import { TownField } from '@/components/places/TownField';
import { usePickedImage } from '@/hooks/usePickedImage';
import { toast } from '@/store/ui';
import { colors } from '@/theme';

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
  const [photoMenu, setPhotoMenu] = useState(false);
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

        <PressableScale
          onPress={() => (photo.uri ? setPhotoMenu(true) : void photo.pick())}
          disabled={uploading}
          accessibilityRole="button"
          accessibilityLabel={photo.uri ? 'Change photo' : 'Add a photo'}
          className="mt-6 self-center"
        >
          <Avatar uri={photo.uri ?? undefined} size={96} fallback={colors.me} />
          {uploading ? (
            <View className="absolute inset-0 items-center justify-center rounded-full bg-black/50">
              <ActivityIndicator color={colors.ink} />
            </View>
          ) : null}
          <View className="absolute bottom-0 right-0 h-8 w-8 items-center justify-center rounded-full border-2 border-bg bg-lime">
            <CameraIcon />
          </View>
        </PressableScale>
        <Text className="mt-2 text-center font-sans text-[13.5px] text-muted">
          {uploading ? 'Uploading…' : photo.uri ? 'Change photo' : 'Add a photo'}
        </Text>

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

      <ActionSheet
        visible={photoMenu}
        onClose={() => setPhotoMenu(false)}
        actions={[
          { label: 'Choose a new photo', onPress: () => void photo.pick() },
          {
            label: 'Remove photo',
            destructive: true,
            onPress: photo.remove,
          },
        ]}
      />
    </KeyboardScreen>
  );
}
