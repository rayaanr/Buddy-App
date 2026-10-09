import { AREA_NAMES, type Area } from '@buddy/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';

import { errorMessage } from '@/api/client';
import { useMe, useUpdateMe } from '@/api/queries';
import { Button, Chip, Heading, SectionLabel, TextField } from '@/components/ui';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { toast } from '@/store/ui';

/** Bottom sheet over the profile tab. */
export default function EditProfileSheet() {
  const me = useMe();
  const update = useUpdateMe();
  const { bottom } = useScreenInsets();
  const [name, setName] = useState(me.data?.name ?? '');
  const [area, setArea] = useState<Area>(me.data?.area ?? 'Colombo 07');

  const save = () => {
    if (!me.data) return;
    update.mutate(
      { name: name.trim() || me.data.name, area },
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
    <KeyboardAvoidingView
      className="flex-1 justify-end"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Reanimated views carry the motion only; NativeWind classes go on plain Views. */}
      <Animated.View entering={FadeIn.duration(200)} style={StyleSheet.absoluteFill}>
        <Pressable
          className="flex-1 bg-black/60"
          onPress={() => router.back()}
          accessibilityLabel="Close"
        />
      </Animated.View>

      <Animated.View entering={SlideInDown.duration(300)}>
        <View
          className="rounded-t-[28px] bg-surface-sunken px-[22px] pt-2.5"
          style={{ paddingBottom: bottom(32) }}
        >
          <View className="mx-auto mb-[18px] h-[5px] w-10 rounded-[3px] bg-outline" />
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

          <Pressable
            onPress={() => router.replace('/interests')}
            className="mt-4 h-[50px] flex-row items-center justify-between rounded-2xl border border-outline px-4 active:opacity-80"
          >
            <Text className="font-sans-medium text-[15px] text-ink">
              Interests &amp; availability
            </Text>
            <Text className="font-sans-medium text-[15px] text-lime">Edit →</Text>
          </Pressable>

          <Button
            label={update.isPending ? 'Saving…' : 'Save'}
            inactive={update.isPending}
            onPress={save}
            className="mt-[18px]"
          />
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}
