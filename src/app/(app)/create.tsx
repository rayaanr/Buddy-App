import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Button, Chip, Footer, SectionLabel, TextField } from '@/components/ui';
import { ACTIVITY_TYPES, CREATE_DAYS, CREATE_TIMES, SPOTS_MAX, SPOTS_MIN } from '@/data/constants';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { useActivitiesStore, type ActivityDraft } from '@/store/activities';
import { useAccount } from '@/store/session';
import { toast } from '@/store/ui';
import { colors } from '@/theme';

const newDraft = (): ActivityDraft => ({
  title: '',
  type: 'Social',
  day: 'Today',
  time: '18:30',
  where: '',
  spots: 6,
  notes: '',
});

export default function CreateActivityScreen() {
  const { top } = useScreenInsets();
  const account = useAccount();
  const publish = useActivitiesStore((s) => s.publish);
  const [draft, setDraft] = useState(newDraft);
  const set = (patch: Partial<ActivityDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const ready = !!draft.title.trim() && !!draft.where.trim();

  const onPublish = () => {
    if (!ready) return;
    publish(draft, account);
    router.dismissTo({ pathname: '/activities', params: { segment: 'hosting' } });
    toast('Published. It’s live on Discover.');
  };

  return (
    <KeyboardAvoidingView className="flex-1 bg-bg" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: top(58), paddingHorizontal: 22, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-row items-center">
          <Pressable onPress={() => router.back()} hitSlop={8} className="flex-1 py-1.5">
            <Text className="font-sans text-[16px] text-muted">Cancel</Text>
          </Pressable>
          <Text className="font-sans-semibold text-[16px] text-ink">New activity</Text>
          <View className="flex-1" />
        </View>

        <TextInput
          value={draft.title}
          onChangeText={(title) => set({ title })}
          placeholder="What are you doing?"
          placeholderTextColor={colors.subtle}
          selectionColor={colors.lime}
          autoFocus
          className="mt-4 p-0 font-display text-[29px] tracking-[-0.87px] text-ink"
        />

        <SectionLabel className="mb-2.5 mt-[22px]">Type</SectionLabel>
        <View className="flex-row flex-wrap gap-2">
          {ACTIVITY_TYPES.map((t) => (
            <Chip
              key={t.label}
              label={t.label}
              selected={draft.type === t.label}
              onPress={() => set({ type: t.label })}
            />
          ))}
        </View>

        <SectionLabel className="mb-2.5 mt-[22px]">When</SectionLabel>
        <View className="flex-row gap-2">
          {CREATE_DAYS.map((d) => (
            <Chip
              key={d}
              label={d}
              shape="tile"
              selected={draft.day === d}
              onPress={() => set({ day: d })}
            />
          ))}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="-mx-[22px] mt-2"
          contentContainerStyle={{ gap: 8, paddingHorizontal: 22 }}
        >
          {CREATE_TIMES.map((t) => (
            <Chip
              key={t}
              label={t}
              mono
              selected={draft.time === t}
              onPress={() => set({ time: t })}
              className="px-[15px]"
            />
          ))}
        </ScrollView>

        <SectionLabel className="mb-2.5 mt-[22px]">Where</SectionLabel>
        <TextField
          value={draft.where}
          onChangeText={(where) => set({ where })}
          placeholder="Venue, park or address"
          size="md"
        />

        <View className="mt-3 flex-row items-center justify-between rounded-2xl bg-surface py-3 pl-4 pr-3">
          <View>
            <Text className="font-sans-semibold text-[15.5px] text-ink">Spots</Text>
            <Text className="mt-0.5 font-sans text-[13px] text-muted">Including you</Text>
          </View>
          <View className="flex-row items-center gap-3.5">
            <Stepper
              label="−"
              accessibilityLabel="Fewer"
              onPress={() => set({ spots: Math.max(SPOTS_MIN, draft.spots - 1) })}
            />
            <Text className="w-[26px] text-center font-mono-medium text-[19px] text-ink">
              {draft.spots}
            </Text>
            <Stepper
              label="+"
              accessibilityLabel="More"
              onPress={() => set({ spots: Math.min(SPOTS_MAX, draft.spots + 1) })}
            />
          </View>
        </View>

        <TextField
          value={draft.notes}
          onChangeText={(notes) => set({ notes })}
          placeholder="Anything people should know? Level, what to bring, where to meet."
          multiline
          textAlignVertical="top"
          size="md"
          className="mt-3 h-24 py-3.5 leading-[22px]"
        />
      </ScrollView>

      <Footer>
        <Button label="Publish activity" inactive={!ready} onPress={onPublish} />
      </Footer>
    </KeyboardAvoidingView>
  );
}

function Stepper({
  label,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className="h-11 w-11 items-center justify-center rounded-full border border-outline active:opacity-70"
    >
      <Text className="font-sans text-[18px] text-ink">{label}</Text>
    </Pressable>
  );
}
