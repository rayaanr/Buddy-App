import {
  AREA_NAMES,
  AVAILABILITY,
  INTERESTS,
  LIMITS,
  MIN_INTERESTS,
  type Area,
  type Availability,
  type Interest,
} from '@buddy/shared';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { errorMessage } from '@/api/client';
import { useMe, useUpdateMe } from '@/api/queries';
import { uploadImage } from '@/api/upload';
import { InterestTile, toggle } from '@/components/onboarding/InterestPicker';
import {
  ActionSheet,
  Avatar,
  BackButton,
  Button,
  CameraIcon,
  Chip,
  Footer,
  Heading,
  KeyboardAwareScrollView,
  KeyboardScreen,
  Loading,
  PressableScale,
  SectionLabel,
  TextField,
} from '@/components/ui';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { toast } from '@/store/ui';
import { colors } from '@/theme';

/** Profile → Edit profile: photo, name, bio, area, interests and when you're free, saved together. */
export default function EditProfileScreen() {
  const me = useMe();
  if (!me.data) return <Loading className="flex-1 bg-bg" />;
  return <EditProfileForm me={me.data} />;
}

interface Saved {
  name: string;
  bio: string;
  avatarUrl: string | null;
  area: Area;
  interests: Interest[];
  availability: Availability[];
}

function EditProfileForm({ me }: { me: Saved }) {
  const { top } = useScreenInsets();
  const update = useUpdateMe();
  const [name, setName] = useState(me.name);
  const [bio, setBio] = useState(me.bio);
  // `key` is what Save sends: undefined leaves the photo as is, null removes it.
  const [photo, setPhoto] = useState<{ uri: string | null; key?: string | null }>({
    uri: me.avatarUrl,
  });
  const [uploading, setUploading] = useState(false);
  const [photoMenu, setPhotoMenu] = useState(false);
  const [area, setArea] = useState<Area>(me.area);
  const [interests, setInterests] = useState(me.interests);
  const [availability, setAvailability] = useState(me.availability);
  const need = MIN_INTERESTS - interests.length;

  // Uploads as soon as it's picked, so Save is quick; the photo only changes on Save.
  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      shape: 'oval',
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const before = photo;
    setPhoto({ uri: asset.uri });
    setUploading(true);
    try {
      setPhoto({ uri: asset.uri, key: await uploadImage('avatar', asset) });
    } catch (err) {
      setPhoto(before);
      toast(errorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const save = () => {
    if (need > 0 || update.isPending || uploading) return;
    update.mutate(
      {
        name: name.trim() || me.name,
        bio: bio.trim(),
        area,
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
      <View className="px-[18px]" style={{ paddingTop: top(56) }}>
        <BackButton />
      </View>
      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 24 }}
      >
        <Heading size="page">Edit profile</Heading>

        <PressableScale
          onPress={() => (photo.uri ? setPhotoMenu(true) : void pickPhoto())}
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

        {/* Distances are measured from a known area, so this is a choice, not free text. */}
        <SectionLabel className="mb-2 mt-6">Area</SectionLabel>
        <View className="flex-row flex-wrap gap-2">
          {AREA_NAMES.map((a) => (
            <Chip key={a} label={a} selected={a === area} onPress={() => setArea(a)} />
          ))}
        </View>

        <SectionLabel className="mb-1 mt-6">Into</SectionLabel>
        <Text className="mb-3 font-sans text-[14px] text-muted">Pick at least three.</Text>
        <View className="flex-row flex-wrap justify-between gap-y-[9px]">
          {INTERESTS.map((label) => (
            <InterestTile
              key={label}
              label={label}
              selected={interests.includes(label)}
              onPress={() => setInterests((l) => toggle(l, label))}
            />
          ))}
        </View>

        <SectionLabel className="mb-3 mt-6">Usually free</SectionLabel>
        <View className="flex-row flex-wrap gap-2">
          {AVAILABILITY.map((label) => (
            <Chip
              key={label}
              label={label}
              selected={availability.includes(label)}
              onPress={() => setAvailability((l) => toggle(l, label))}
            />
          ))}
        </View>
      </KeyboardAwareScrollView>

      <Footer>
        <Button
          label={need > 0 ? `Pick ${need} more` : update.isPending ? 'Saving…' : 'Save'}
          inactive={need > 0 || update.isPending || uploading}
          onPress={save}
        />
      </Footer>

      <ActionSheet
        visible={photoMenu}
        onClose={() => setPhotoMenu(false)}
        actions={[
          { label: 'Choose a new photo', onPress: () => void pickPhoto() },
          {
            label: 'Remove photo',
            destructive: true,
            onPress: () => setPhoto({ uri: null, key: null }),
          },
        ]}
      />
    </KeyboardScreen>
  );
}
