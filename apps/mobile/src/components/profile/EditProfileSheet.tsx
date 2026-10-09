import { AREA_NAMES, type Area } from '@buddy/shared';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { errorMessage } from '@/api/client';
import { useMe, useUpdateMe } from '@/api/queries';
import {
  ArrowRightIcon,
  Button,
  Chip,
  Heading,
  PressableScale,
  SectionLabel,
  Sheet,
  TextField,
} from '@/components/ui';
import { toast } from '@/store/ui';

interface EditProfileSheetProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Profile → Edit profile drawer. Mount it with a new `key` each time it
 * opens so the fields start from the saved profile.
 */
export function EditProfileSheet({ open, onClose }: EditProfileSheetProps) {
  const me = useMe();
  const update = useUpdateMe();
  const [name, setName] = useState(me.data?.name ?? '');
  const [area, setArea] = useState<Area>(me.data?.area ?? 'Colombo 07');
  // Screens opened from the drawer wait until it has slid away.
  const after = useRef<(() => void) | null>(null);

  const save = () => {
    if (!me.data) return;
    update.mutate(
      { name: name.trim() || me.data.name, area },
      {
        onSuccess: () => {
          onClose();
          toast('Profile saved.');
        },
        onError: (err) => toast(errorMessage(err)),
      },
    );
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      onClosed={() => {
        after.current?.();
        after.current = null;
      }}
    >
      <View className="px-[22px]">
        <Heading size="sheet">Edit profile</Heading>

        <SectionLabel className="mb-2 mt-[18px]">Name</SectionLabel>
        <TextField
          value={name}
          onChangeText={setName}
          tone="inset"
          size="md"
          autoCapitalize="words"
        />

        {/* Distances are measured from a known area, so this is a choice, not free text. */}
        <SectionLabel className="mb-2 mt-4">Area</SectionLabel>
        <View className="flex-row flex-wrap gap-2">
          {AREA_NAMES.map((a) => (
            <Chip key={a} label={a} selected={a === area} onPress={() => setArea(a)} />
          ))}
        </View>

        <PressableScale
          onPress={() => {
            after.current = () => router.push('/interests');
            onClose();
          }}
          className="mt-4 h-[50px] flex-row items-center justify-between rounded-2xl border border-outline px-4"
        >
          <Text className="font-sans-medium text-[15px] text-ink">
            Interests &amp; availability
          </Text>
          <View className="flex-row items-center gap-1">
            <Text className="font-sans-medium text-[15px] text-lime">Edit</Text>
            <ArrowRightIcon />
          </View>
        </PressableScale>

        <Button
          label={update.isPending ? 'Saving…' : 'Save'}
          inactive={update.isPending}
          onPress={save}
          className="mt-[18px]"
        />
      </View>
    </Sheet>
  );
}
