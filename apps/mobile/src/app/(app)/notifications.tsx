import { type AppNotification, clockLabel, dayMonth, localDay } from '@buddy/shared';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { useMarkNotificationsRead, useNotifications } from '@/api/queries';
import {
  CalendarIcon,
  EmptyState,
  LoadError,
  Loading,
  PeopleIcon,
  Refresh,
  ScreenHeader,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { colors, spacing } from '@/theme';

/** Discover → bell: reminders, changes and community news, newest first. */
export default function NotificationsScreen() {
  const list = useNotifications();
  const markRead = useMarkNotificationsRead();
  const unread = list.data?.unread ?? 0;

  // Seen now. The rows keep their "new" look for this visit.
  useEffect(() => {
    if (unread > 0) markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per load
  }, [unread]);

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader title="Notifications" />
      <FlatList
        style={styles.fill}
        data={list.data?.notifications ?? []}
        keyExtractor={(n) => n.id}
        renderItem={({ item }) => <Row notification={item} />}
        contentContainerStyle={{
          paddingHorizontal: spacing.edge,
          paddingTop: 12,
          paddingBottom: 30,
        }}
        refreshControl={
          <Refresh refreshing={list.isRefetching} onRefresh={() => void list.refetch()} />
        }
        ListHeaderComponent={
          <>
            {list.isLoading ? <Loading className="py-10" /> : null}
            {list.error ? (
              <LoadError
                error={list.error}
                onRetry={() => void list.refetch()}
                stale={!!list.data}
              />
            ) : null}
          </>
        }
        ListEmptyComponent={
          list.data ? (
            <EmptyState
              card
              title="Nothing yet"
              subtitle="Reminders, changes to activities you’re in, and new activities in your communities show up here."
            />
          ) : null
        }
      />
    </View>
  );
}

/** "14:20" today, "18 Oct" before that. */
function when(iso: string) {
  const at = new Date(iso);
  return localDay(at) === localDay() ? clockLabel(at) : dayMonth(at);
}

function open(n: AppNotification) {
  const { activityId, communityId, screen } = n.data;
  if (activityId && screen === 'roll-call') router.push(`/activity/${activityId}/roll-call`);
  else if (activityId)
    router.push(screen === 'chat' ? `/activity/${activityId}/chat` : `/activity/${activityId}`);
  else if (communityId)
    router.push(screen === 'chat' ? `/community/${communityId}/chat` : `/community/${communityId}`);
}

function Row({ notification: n }: { notification: AppNotification }) {
  const tappable = !!(n.data.activityId || n.data.communityId);
  return (
    <Pressable
      onPress={tappable ? () => open(n) : undefined}
      disabled={!tappable}
      accessibilityRole={tappable ? 'button' : undefined}
      accessibilityLabel={`${n.read ? '' : 'New. '}${n.title}. ${n.body}`}
      className={cn(
        '-mx-3 flex-row gap-3 rounded-2xl px-3 py-3.5 active:opacity-80',
        !n.read && 'bg-lime-panel',
      )}
    >
      <View className="h-10 w-10 items-center justify-center rounded-full bg-surface">
        {n.kind === 'communities' ? (
          <PeopleIcon size={19} color={colors.ink} />
        ) : (
          <CalendarIcon size={19} color={colors.ink} />
        )}
      </View>
      <View className="flex-1">
        <View className="flex-row items-baseline justify-between gap-2">
          <Text className="flex-1 font-sans-semibold text-subhead text-ink" numberOfLines={1}>
            {n.title}
          </Text>
          <Text className="font-sans text-footnote text-subtle">{when(n.createdAt)}</Text>
        </View>
        <Text className="mt-0.5 font-sans text-label leading-label text-muted" numberOfLines={3}>
          {n.body}
        </Text>
      </View>
      {!n.read ? <View className="mt-1.5 h-2 w-2 rounded-full bg-lime" /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
