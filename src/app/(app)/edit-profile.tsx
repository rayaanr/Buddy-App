import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';

import { Button, Heading, SectionLabel, TextField } from '@/components/ui';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { useAccount, useSessionStore } from '@/store/session';
import { toast } from '@/store/ui';

/** Bottom sheet over the profile tab. */
export default function EditProfileSheet() {
  const account = useAccount();
  const updateProfile = useSessionStore((s) => s.updateProfile);
  const { bottom } = useScreenInsets();
  const [name, setName] = useState(account.name);
  const [location, setLocation] = useState(account.location);

  const save = () => {
    updateProfile({
      name: name.trim() || account.name,
      location: location.trim() || account.location,
    });
    router.back();
    toast('Profile saved.');
  };

  return (
    <KeyboardAvoidingView className="flex-1 justify-end" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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

          <SectionLabel className="mb-2 mt-4">Area</SectionLabel>
          <TextField value={location} onChangeText={setLocation} tone="inset" size="md" />

          <Pressable
            onPress={() => router.replace('/interests')}
            className="mt-4 h-[50px] flex-row items-center justify-between rounded-2xl border border-outline px-4 active:opacity-80"
          >
            <Text className="font-sans-medium text-[15px] text-ink">
              Interests &amp; availability
            </Text>
            <Text className="font-sans-medium text-[15px] text-lime">Edit →</Text>
          </Pressable>

          <Button label="Save" onPress={save} className="mt-[18px]" />
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}
