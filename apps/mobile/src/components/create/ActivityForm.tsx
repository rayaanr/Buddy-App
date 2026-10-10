import {
  type ActivityGroup,
  atLocalDay,
  clockLabel,
  LIMITS,
  localDay,
  weekdayName,
} from '@buddy/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { CoverField } from '@/components/create/CoverField';
import { DatePickerSheet } from '@/components/create/DatePickerSheet';
import { TimePickerSheet } from '@/components/create/TimePickerSheet';
import {
  Button,
  CalendarIcon,
  Chip,
  ClockIcon,
  Footer,
  KeyboardAwareScrollView,
  KeyboardScreen,
  SectionLabel,
  TextField,
  Toggle,
} from '@/components/ui';
import {
  ACTIVITY_TYPES,
  CREATE_DAYS,
  CREATE_TIMES,
  GROUP_HUES,
  type CreateDay,
} from '@/data/constants';
import { useNow } from '@/hooks/useNow';
import { usePickedImage } from '@/hooks/usePickedImage';
import { VenueField, type Pin } from './VenueField';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { presetDay, shortDay } from '@/lib/activity';
import { colors } from '@/theme';

export interface Draft {
  title: string;
  type: string;
  /** A preset chip, or 'custom' for a day picked on the calendar. */
  day: CreateDay | 'custom';
  customDay: string | null;
  time: string;
  where: string;
  /** The exact meeting point, from venue search or the phone's location. */
  pin: Pin | null;
  spots: number;
  notes: string;
  /** Post a new one each week. */
  repeat: boolean;
}

export const newDraft = (): Draft => ({
  title: '',
  type: 'Social',
  day: 'Today',
  customDay: null,
  time: '18:30',
  where: '',
  pin: null,
  spots: 6,
  notes: '',
  repeat: false,
});

/** A draft holding an existing activity, for editing. */
export function draftFrom(
  a: {
    title: string;
    group: ActivityGroup;
    startsAt: string;
    place: string;
    capacity: number;
    description: string;
    repeatsWeekly: boolean;
    location: { lat: number; lng: number };
    area: string;
  },
  now = new Date(),
): Draft {
  const at = new Date(a.startsAt);
  const day = localDay(at);
  const preset = CREATE_DAYS.find((d) => presetDay(d, now) === day);
  return {
    title: a.title,
    type: ACTIVITY_TYPES.find((t) => t.group === a.group)?.label ?? 'Social',
    day: preset ?? 'custom',
    customDay: preset ? null : day,
    time: clockLabel(at),
    where: a.place,
    pin: { ...a.location, label: a.area },
    spots: a.capacity,
    notes: a.description,
    repeat: a.repeatsWeekly,
  };
}

interface ActivityValues {
  /** undefined: unchanged; null: back to the stock photo; string: a new upload. */
  coverKey?: string | null;
  title: string;
  group: ActivityGroup;
  startsAt: Date;
  place: string;
  /** Only when a meeting point is pinned. */
  location?: { lat: number; lng: number };
  capacity: number;
  description: string;
  repeatsWeekly: boolean;
  /** Posted in this community (New activity only). */
  communityId?: string;
}

interface ActivityFormProps {
  heading: string;
  initial: Draft;
  submitLabel: string;
  pendingLabel: string;
  pending: boolean;
  /** Spots can't go below this (people already going). */
  minSpots?: number;
  /** The current cover, when editing. */
  initialCover?: string | null;
  /** Where it goes without a pin, e.g. "Colombo 7" (the host's home town). */
  fallbackPlace?: string;
  autoFocus?: boolean;
  /** Communities you can post in; the choice only shows when there are some. */
  communities?: { id: string; name: string }[];
  initialCommunityId?: string;
  onSubmit: (values: ActivityValues) => void;
}

/** The New activity form, also used by hosts to edit an activity. */
export function ActivityForm({
  heading,
  initial,
  submitLabel,
  pendingLabel,
  pending,
  minSpots = LIMITS.capacityMin,
  initialCover = null,
  fallbackPlace = 'your home town',
  autoFocus,
  communities = [],
  initialCommunityId,
  onSubmit,
}: ActivityFormProps) {
  const [picked, setCommunityId] = useState(initialCommunityId);
  // Only one you can post in (the list may still be loading, or you left it).
  const communityId = communities.some((c) => c.id === picked) ? picked : undefined;
  const { top } = useScreenInsets();
  const [draft, setDraft] = useState(initial);
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const cover = usePickedImage('cover', initialCover);
  const group = ACTIVITY_TYPES.find((t) => t.label === draft.type)?.group ?? 'Social';
  const now = useNow();
  const day =
    draft.day === 'custom' && draft.customDay
      ? draft.customDay
      : presetDay(draft.day === 'custom' ? 'Today' : draft.day, now);
  const startsAt = atLocalDay(day, draft.time);
  const customTime = !(CREATE_TIMES as readonly string[]).includes(draft.time);
  // A new key per opening resets the picker to the current choice.
  const [picker, setPicker] = useState<{ kind: 'date' | 'time' | null; key: number }>({
    kind: null,
    key: 0,
  });
  const openPicker = (kind: 'date' | 'time') => setPicker((p) => ({ kind, key: p.key + 1 }));
  const closePicker = () => setPicker((p) => ({ ...p, kind: null }));
  const inPast = startsAt <= now;
  const ready =
    !!draft.title.trim() && !!draft.where.trim() && !inPast && !pending && !cover.uploading;

  const submit = () => {
    if (!ready) return;
    onSubmit({
      coverKey: cover.key,
      title: draft.title.trim(),
      group,
      startsAt,
      place: draft.where.trim(),
      location: draft.pin ? { lat: draft.pin.lat, lng: draft.pin.lng } : undefined,
      capacity: draft.spots,
      description: draft.notes.trim(),
      repeatsWeekly: draft.repeat,
      communityId,
    });
  };

  return (
    <KeyboardScreen className="flex-1 bg-bg">
      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: top(58), paddingHorizontal: 22, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-row items-center">
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            accessibilityRole="button"
            className="flex-1 py-1.5"
          >
            <Text className="font-sans text-[16px] text-muted">Cancel</Text>
          </Pressable>
          <Text className="font-sans-semibold text-[16px] text-ink">{heading}</Text>
          <View className="flex-1" />
        </View>

        <TextInput
          value={draft.title}
          onChangeText={(title) => set({ title })}
          placeholder="What are you doing?"
          placeholderTextColor={colors.subtle}
          selectionColor={colors.lime}
          autoFocus={autoFocus}
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
          <Chip
            label={draft.day === 'custom' && draft.customDay ? shortDay(draft.customDay) : ''}
            icon={draft.day === 'custom' ? null : <CalendarIcon size={18} color={colors.ink} />}
            accessibilityLabel={
              draft.day === 'custom' && draft.customDay
                ? `${shortDay(draft.customDay)}, change date`
                : 'Pick a date'
            }
            shape="tile"
            selected={draft.day === 'custom'}
            onPress={() => openPicker('date')}
          />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="-mx-[22px] mt-2"
          contentContainerStyle={{ gap: 8, paddingHorizontal: 22 }}
        >
          <Chip
            label={customTime ? draft.time : 'Other'}
            icon={<ClockIcon color={customTime ? colors.bg : colors.ink} />}
            accessibilityLabel={customTime ? `${draft.time}, change time` : 'Pick another time'}
            mono={customTime}
            selected={customTime}
            onPress={() => openPicker('time')}
            className="px-[15px]"
          />
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
        <VenueField
          where={draft.where}
          pin={draft.pin}
          onChange={(where, pin) => set({ where, pin })}
          fallback={fallbackPlace}
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
              onPress={() => set({ spots: Math.max(minSpots, draft.spots - 1) })}
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

        <View className="mt-3 flex-row items-center gap-4 rounded-2xl bg-surface py-3 pl-4 pr-3">
          <View className="flex-1">
            <Text className="font-sans-semibold text-[15.5px] text-ink">
              Repeat every {weekdayName(startsAt)}
            </Text>
            <Text className="mt-0.5 font-sans text-[13px] leading-[18px] text-muted">
              Next week’s goes up once this one starts, and this group hears about it.
            </Text>
          </View>
          <Toggle
            value={draft.repeat}
            onValueChange={(repeat) => set({ repeat })}
            label="Repeat every week"
          />
        </View>

        {communities.length ? (
          <>
            <SectionLabel className="mb-1 mt-[22px]">Post in a community</SectionLabel>
            <Text className="mb-2.5 font-sans text-[13px] leading-[18px] text-muted">
              Optional. Its members see it on the community’s page.
            </Text>
            <View className="flex-row flex-wrap gap-2">
              <Chip
                label="No community"
                selected={!communityId}
                onPress={() => setCommunityId(undefined)}
              />
              {communities.map((c) => (
                <Chip
                  key={c.id}
                  label={c.name}
                  selected={communityId === c.id}
                  onPress={() => setCommunityId(c.id)}
                />
              ))}
            </View>
          </>
        ) : null}

        <SectionLabel className="mb-2.5 mt-[22px]">Cover photo</SectionLabel>
        <CoverField
          cover={cover}
          hue={GROUP_HUES[group]}
          removeLabel={initialCover ? 'Use the default' : 'Remove'}
          hint="Optional. Otherwise it gets a photo for its type."
        />
      </KeyboardAwareScrollView>

      <DatePickerSheet
        key={`date-${picker.key}`}
        open={picker.kind === 'date'}
        onClose={closePicker}
        value={day}
        min={localDay(now)}
        max={localDay(now, LIMITS.maxDaysAhead)}
        onChange={(picked) => set({ day: 'custom', customDay: picked })}
      />
      <TimePickerSheet
        key={`time-${picker.key}`}
        open={picker.kind === 'time'}
        onClose={closePicker}
        value={draft.time}
        onChange={(time) => set({ time })}
      />

      <Footer>
        {inPast ? (
          <Text className="mb-2.5 text-center font-sans text-[13.5px] text-warning">
            That time has passed. Pick a later time or another day.
          </Text>
        ) : null}
        <Button label={pending ? pendingLabel : submitLabel} inactive={!ready} onPress={submit} />
      </Footer>
    </KeyboardScreen>
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
