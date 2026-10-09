import { LIMITS } from '@buddy/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { errorMessage } from '@/api/client';
import { useCreateActivity, useMe } from '@/api/queries';
import { Button, Chip, Footer, SectionLabel, TextField } from '@/components/ui';
import { ACTIVITY_TYPES, CREATE_DAYS, CREATE_TIMES, type CreateDay } from '@/data/constants';
import { useNow } from '@/hooks/useNow';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { createStartsAt } from '@/lib/activity';
import { toast } from '@/store/ui';
import { colors } from '@/theme';

interface Draft {
  title: string;
  type: string;
  day: CreateDay;
  time: string;
  where: string;
  spots: number;
  notes: string;
}

const newDraft = (): Draft => ({
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
  const me = useMe();
  const create = useCreateActivity();
  const [draft, setDraft] = useState(newDraft);
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const now = useNow();
  const startsAt = createStartsAt(draft.day, draft.time, now);
  const inPast = startsAt <= now;
  const ready = !!draft.title.trim() && !!draft.where.trim() && !inPast && !create.isPending;

  const onPublish = () => {
    if (!ready || !me.data) return;
    const group = ACTIVITY_TYPES.find((t) => t.label === draft.type)?.group ?? 'Social';
    create.mutate(
      {
        title: draft.title.trim(),
        group,
        startsAt: startsAt.toISOString(),
        place: draft.where.trim(),
        area: me.data.area,
        capacity: draft.spots,
        description: draft.notes.trim(),
      },
      {
        onSuccess: () => {
          router.dismissTo({ pathname: '/activities', params: { segment: 'hosting' } });
          toast('Published. It’s live on Discover.');
        },
        onError: (err) => toast(errorMessage(err)),
      },
    );
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-bg"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
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
              onPress={() => set({ spots: Math.max(LIMITS.capacityMin, draft.spots - 1) })}
            />
            <Text className="w-[26px] text-center font-mono-medium text-[19px] text-ink">
              {draft.spots}
            </Text>
            <Stepper
              label="+"
              accessibilityLabel="More"
              onPress={() => set({ spots: Math.min(LIMITS.capacityMax, draft.spots + 1) })}
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
        {inPast ? (
          <Text className="mb-2.5 text-center font-sans text-[13.5px] text-warning">
            That time has passed. Pick a later time or another day.
          </Text>
        ) : null}
        <Button
          label={create.isPending ? 'Publishing…' : 'Publish activity'}
          inactive={!ready}
          onPress={onPublish}
        />
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
