import { LIMITS, REPORT_REASONS, type CreateReportInput, type ReportReason } from '@buddy/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { errorMessage } from '@/api/client';
import { useReport, useSetBlocked } from '@/api/queries';
import {
  Button,
  CheckIcon,
  Footer,
  Heading,
  KeyboardAwareScrollView,
  KeyboardScreen,
  SectionLabel,
  TextField,
} from '@/components/ui';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { firstName } from '@/lib/activity';
import { cn } from '@/lib/cn';
import { toast } from '@/store/ui';

export type ReportTarget = 'user' | 'message' | 'activity';

/**
 * Report a person, a chat message or an activity, optionally blocking the
 * person too. Params: `type` and `id` of what's reported, plus `userId` and
 * `name` of the person behind it, and `excerpt` for a message.
 */
export default function ReportScreen() {
  const { top } = useScreenInsets();
  const p = useLocalSearchParams<{
    type: ReportTarget;
    id: string;
    userId?: string;
    name?: string;
    excerpt?: string;
  }>();
  const report = useReport();
  const setBlocked = useSetBlocked();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(p.type === 'message');

  const who = p.name ? firstName(p.name) : null;
  const title =
    p.type === 'message'
      ? `Report ${who ? `${who}’s` : 'this'} message`
      : p.type === 'activity'
        ? 'Report this activity'
        : `Report ${who ?? 'this person'}`;
  const busy = report.isPending || setBlocked.isPending;

  const submit = async () => {
    if (!reason || busy) return;
    const target: Pick<CreateReportInput, 'userId' | 'messageId' | 'activityId'> =
      p.type === 'message'
        ? { messageId: p.id }
        : p.type === 'activity'
          ? { activityId: p.id }
          : { userId: p.id };
    try {
      await report.mutateAsync({ reason, details: details.trim() || undefined, ...target });
      if (alsoBlock && p.userId) await setBlocked.mutateAsync({ userId: p.userId, blocked: true });
      router.back();
      toast(
        alsoBlock && who
          ? `Reported and blocked ${who}. We’ll review it within 24 hours.`
          : 'Thanks. We’ll review it within 24 hours.',
      );
    } catch (err) {
      toast(errorMessage(err));
    }
  };

  return (
    <KeyboardScreen className="flex-1 bg-bg">
      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: top(58), paddingHorizontal: 22, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => router.back()} hitSlop={8} className="self-start py-1.5">
          <Text className="font-sans text-[16px] text-muted">Cancel</Text>
        </Pressable>
        <Heading size="page" className="mt-4">
          {title}
        </Heading>
        <Text className="mt-2 font-sans text-[15px] leading-[22px] text-muted">
          Reports are private. {who ?? 'They'} won’t know you reported them.
        </Text>
        {p.excerpt ? (
          <View className="mt-4 rounded-[18px] rounded-bl-md bg-surface px-4 py-3">
            <Text className="font-sans text-[15px] leading-[21px] text-ink" numberOfLines={4}>
              {p.excerpt}
            </Text>
          </View>
        ) : null}

        <SectionLabel className="mb-2.5 mt-6">What’s wrong?</SectionLabel>
        <View role="radiogroup" className="gap-2">
          {(Object.entries(REPORT_REASONS) as [ReportReason, string][]).map(([key, label]) => {
            const selected = reason === key;
            return (
              <Pressable
                key={key}
                onPress={() => setReason(key)}
                role="radio"
                aria-checked={selected}
                className={cn(
                  'h-[52px] flex-row items-center justify-between rounded-2xl border px-4 active:opacity-80',
                  selected ? 'border-lime bg-lime-panel' : 'border-field bg-surface-sunken',
                )}
              >
                <Text className="font-sans-medium text-[15.5px] text-ink">{label}</Text>
                <View
                  className={cn(
                    'h-5 w-5 items-center justify-center rounded-full border-2',
                    selected ? 'border-lime' : 'border-outline',
                  )}
                >
                  {selected ? <View className="h-2.5 w-2.5 rounded-full bg-lime" /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        <SectionLabel className="mb-2.5 mt-6">Anything else? (optional)</SectionLabel>
        <TextField
          value={details}
          onChangeText={setDetails}
          placeholder="Tell us what happened"
          multiline
          maxLength={LIMITS.reportDetailsMax}
          size="md"
          className="min-h-[96px] py-3.5"
          textAlignVertical="top"
        />

        {p.userId && who ? (
          <Pressable
            onPress={() => setAlsoBlock((b) => !b)}
            role="checkbox"
            aria-checked={alsoBlock}
            className="mt-5 flex-row items-center gap-3 active:opacity-80"
          >
            <View
              className={cn(
                'h-[22px] w-[22px] items-center justify-center rounded-md border-2',
                alsoBlock ? 'border-lime bg-lime' : 'border-outline',
              )}
            >
              {alsoBlock ? <CheckIcon size={14} strokeWidth={3} /> : null}
            </View>
            <View className="flex-1">
              <Text className="font-sans-medium text-[15.5px] text-ink">Also block {who}</Text>
              <Text className="mt-0.5 font-sans text-[13.5px] text-muted">
                You won’t see each other’s activities or messages.
              </Text>
            </View>
          </Pressable>
        ) : null}
      </KeyboardAwareScrollView>

      <Footer>
        <Button
          label={busy ? 'Sending…' : 'Send report'}
          inactive={!reason || busy}
          onPress={submit}
        />
      </Footer>
    </KeyboardScreen>
  );
}
