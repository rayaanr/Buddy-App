import {
  AREA_NAMES,
  AVAILABILITY,
  INTERESTS,
  MIN_INTERESTS,
  type Area,
  type Availability,
  type Interest,
} from '@buddy/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { errorMessage } from '@/api/client';
import { useMe, useUpdateMe } from '@/api/queries';
import { InterestTile, toggle } from '@/components/onboarding/InterestPicker';
import {
  BackButton,
  Button,
  Chip,
  Footer,
  Heading,
  KeyboardAwareScrollView,
  KeyboardScreen,
  Loading,
  SectionLabel,
  TextField,
} from '@/components/ui';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { toast } from '@/store/ui';

/** Profile → Edit profile: name, area, interests and when you're free, saved together. */
export default function EditProfileScreen() {
  const me = useMe();
  if (!me.data) return <Loading className="flex-1 bg-bg" />;
  return <EditProfileForm me={me.data} />;
}

interface Saved {
  name: string;
  area: Area;
  interests: Interest[];
  availability: Availability[];
}

function EditProfileForm({ me }: { me: Saved }) {
  const { top } = useScreenInsets();
  const update = useUpdateMe();
  const [name, setName] = useState(me.name);
  const [area, setArea] = useState<Area>(me.area);
  const [interests, setInterests] = useState(me.interests);
  const [availability, setAvailability] = useState(me.availability);
  const need = MIN_INTERESTS - interests.length;

  const save = () => {
    if (need > 0 || update.isPending) return;
    update.mutate(
      { name: name.trim() || me.name, area, interests, availability },
      {
        onSuccess: () => {
          router.back();
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

        <SectionLabel className="mb-2 mt-6">Name</SectionLabel>
        <TextField
          value={name}
          onChangeText={setName}
          tone="inset"
          size="md"
          autoCapitalize="words"
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
          inactive={need > 0 || update.isPending}
          onPress={save}
        />
      </Footer>
    </KeyboardScreen>
  );
}
