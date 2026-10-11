import {
  type AdminReport,
  clockLabel,
  dayMonth,
  firstName,
  REPORT_REASONS,
  type ResolveReportInput,
} from '@buddy/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { errorMessage } from '@/api/client';
import { useAdminReports, useLiftSuspension, useResolveReport } from '@/api/queries';
import {
  ActionSheet,
  Avatar,
  EmptyState,
  LoadError,
  Refresh,
  ScreenHeader,
  SegmentedControl,
  type SheetAction,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { toast } from '@/store/ui';
import { spacing } from '@/theme';

type Status = 'open' | 'resolved';

const RESOLUTIONS: Record<string, string> = {
  dismissed: 'Dismissed',
  removed: 'Content removed',
  suspended: 'Person suspended',
  'removed,suspended': 'Removed and suspended',
};

/** Settings → Moderation (admins only): open reports, and what was done about past ones. */
export default function ModerationScreen() {
  const [status, setStatus] = useState<Status>('open');
  const reports = useAdminReports(status);
  const resolve = useResolveReport();
  const lift = useLiftSuspension();
  const [acting, setActing] = useState<AdminReport | null>(null);

  const act = (report: AdminReport, input: ResolveReportInput, done: string) =>
    resolve.mutate(
      { id: report.id, ...input },
      { onSuccess: () => toast(done), onError: (err) => toast(errorMessage(err)) },
    );

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader title="Moderation" />
      <FlatList
        style={styles.fill}
        data={reports.data ?? []}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{
          paddingHorizontal: spacing.edge,
          paddingTop: 12,
          paddingBottom: 30,
          gap: 12,
        }}
        refreshControl={
          <Refresh refreshing={reports.isRefetching} onRefresh={() => void reports.refetch()} />
        }
        ListHeaderComponent={
          <View className="mb-1">
            <Text className="font-sans text-label leading-label text-muted">
              Act on reports within 24 hours. Tap one for what you can do.
            </Text>
            <SegmentedControl
              className="mt-5"
              segments={[
                { value: 'open', label: 'Open' },
                { value: 'resolved', label: 'Done' },
              ]}
              value={status}
              onChange={setStatus}
            />
            {reports.error ? (
              <View className="mt-4">
                <LoadError
                  error={reports.error}
                  onRetry={() => void reports.refetch()}
                  stale={!!reports.data}
                />
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          reports.data ? (
            <EmptyState
              card
              title={status === 'open' ? 'Nothing to review' : 'Nothing yet'}
              subtitle={
                status === 'open' ? 'New reports show up here.' : 'Reports you act on move here.'
              }
            />
          ) : null
        }
        renderItem={({ item: r }) => (
          <ReportCard
            report={r}
            onPress={status === 'open' || r.person?.suspended ? () => setActing(r) : undefined}
          />
        )}
      />

      <ActionSheet
        visible={!!acting}
        onClose={() => setActing(null)}
        title={acting ? REPORT_REASONS[acting.reason] : undefined}
        message={acting ? describe(acting) : undefined}
        actions={
          acting
            ? actionsFor(acting, act, (id) =>
                lift.mutate(id, {
                  onSuccess: () => toast('Suspension lifted. They can sign in again.'),
                  onError: (err) => toast(errorMessage(err)),
                }),
              )
            : []
        }
      />
    </View>
  );
}

/** What the report is about, in a line. */
function describe(r: AdminReport) {
  if (r.message) return `A message: “${r.message.body}”`;
  if (r.activity) return `The activity “${r.activity.title}”`;
  if (r.community) return `The community “${r.community.name}”`;
  if (r.person) return `${r.person.name}`;
  return 'Something that has since been deleted';
}

function actionsFor(
  r: AdminReport,
  act: (r: AdminReport, input: ResolveReportInput, done: string) => void,
  lift: (userId: string) => void,
): SheetAction[] {
  const actions: SheetAction[] = [];
  const name = r.person ? firstName(r.person.name) : null;
  if (r.status === 'open') {
    const content = r.message
      ? 'message'
      : r.activity && !r.activity.cancelled
        ? 'activity'
        : r.community
          ? 'community'
          : null;
    if (content) {
      actions.push({
        label: `Remove ${content}`,
        destructive: true,
        onPress: () => act(r, { removeContent: true }, `Removed the ${content}.`),
      });
    }
    if (name && !r.person!.suspended) {
      actions.push({
        label: `Suspend ${name}`,
        destructive: true,
        onPress: () => act(r, { suspend: true }, `${name} is suspended.`),
      });
      if (content) {
        actions.push({
          label: `Remove ${content} and suspend ${name}`,
          destructive: true,
          onPress: () =>
            act(r, { removeContent: true, suspend: true }, `Removed, and ${name} is suspended.`),
        });
      }
    }
    actions.push({
      label: 'Dismiss: nothing wrong',
      onPress: () => act(r, {}, 'Report dismissed.'),
    });
  }
  if (r.person?.suspended) {
    actions.push({ label: `Lift ${name}’s suspension`, onPress: () => lift(r.person!.id) });
  }
  return actions;
}

function ReportCard({ report: r, onPress }: { report: AdminReport; onPress?: () => void }) {
  const at = new Date(r.createdAt);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      className="rounded-card bg-surface p-4 active:opacity-80"
    >
      <View className="flex-row items-center justify-between">
        <Text className="font-mono-medium text-caption uppercase tracking-[1.1px] text-lime">
          {REPORT_REASONS[r.reason]}
        </Text>
        <Text className="font-sans text-footnote text-subtle">
          {dayMonth(at)} · {clockLabel(at)}
        </Text>
      </View>

      {r.person ? (
        <Pressable
          onPress={() => router.push(`/user/${r.person!.id}`)}
          className="mt-3 flex-row items-center gap-2.5 self-start active:opacity-70"
        >
          <Avatar uri={r.person.avatarUrl ?? undefined} name={r.person.name} size={30} />
          <Text className="font-sans-medium text-subhead text-ink">{r.person.name}</Text>
          {r.person.suspended ? (
            <Text className="rounded-full bg-danger/15 px-2 py-0.5 font-sans-medium text-caption text-danger">
              Suspended
            </Text>
          ) : null}
        </Pressable>
      ) : null}

      {r.message ? (
        <View className="mt-3 rounded-tile rounded-bl-md bg-bg px-3.5 py-2.5">
          <Text className="font-sans text-subhead leading-label text-ink" numberOfLines={5}>
            {r.message.body}
          </Text>
        </View>
      ) : null}
      {r.activity ? (
        <Link
          label={`Activity: ${r.activity.title}${r.activity.cancelled ? ' (cancelled)' : ''}`}
          onPress={() => router.push(`/activity/${r.activity!.id}`)}
        />
      ) : null}
      {r.community ? (
        <Link
          label={`Community: ${r.community.name}`}
          onPress={() => router.push(`/community/${r.community!.id}`)}
        />
      ) : null}
      {!r.person && !r.message && !r.activity && !r.community ? (
        <Text className="mt-3 font-sans text-label text-muted">Since deleted.</Text>
      ) : null}

      {r.details ? (
        <Text className="mt-3 font-sans text-label italic leading-label text-ink-dim">
          “{r.details}”
        </Text>
      ) : null}
      <Text className="mt-2.5 font-sans text-footnote text-muted">
        Reported by {r.reporter?.name ?? 'a deleted account'}
      </Text>
      {r.resolution ? (
        <Text
          className={cn(
            'mt-1 font-sans-medium text-footnote',
            r.resolution === 'dismissed' ? 'text-muted' : 'text-lime',
          )}
        >
          {RESOLUTIONS[r.resolution] ?? r.resolution}
        </Text>
      ) : null}
    </Pressable>
  );
}

function Link({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="mt-3 self-start active:opacity-70" hitSlop={6}>
      <Text className="font-sans-medium text-subhead text-ink underline" numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
