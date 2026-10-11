import { type ActivityDetail, type RollCallGuest } from '@buddy/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { errorMessage } from '@/api/client';
import { useActivity, useRollCall, useSaveRollCall } from '@/api/queries';
import {
  Avatar,
  Button,
  Chip,
  EmptyState,
  Footer,
  Heading,
  LoadError,
  Loading,
  QueryFallback,
  successHaptic,
} from '@/components/ui';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { whenLong } from '@/lib/activity';
import { toast } from '@/store/ui';
import { spacing } from '@/theme';

/**
 * After an activity, the host marks who came. Private: it keeps "would you
 * go again?" to the people who were there.
 */
export default function RollCallScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const activity = useActivity(id);
  if (!activity.data)
    return <QueryFallback query={activity} notFound="This activity is no longer available." />;
  if (!activity.data.rollCall)
    return (
      <View className="flex-1 justify-center bg-bg px-edge">
        <EmptyState
          card
          title="Roll call isn’t open"
          subtitle="The host can mark who came once the activity has started."
          cta="Back"
          onPress={() => router.back()}
        />
      </View>
    );
  return <RollCall activity={activity.data} />;
}

function RollCall({ activity: a }: { activity: ActivityDetail }) {
  const guests = useRollCall(a.id);
  const save = useSaveRollCall(a.id);
  const { top } = useScreenInsets();
  // Changes on this screen, on top of what's saved.
  const [marks, setMarks] = useState<Record<string, boolean>>({});
  const list = guests.data ?? [];
  const attended = (g: RollCallGuest) => marks[g.id] ?? g.attended;
  const changed = Object.keys(marks).length;
  const came = list.filter((g) => attended(g) === true).length;

  const mark = (g: RollCallGuest, value: boolean) =>
    setMarks((m) => {
      const next = { ...m };
      if (g.attended === value) delete next[g.id];
      else next[g.id] = value;
      return next;
    });
  const everyone = () =>
    setMarks(Object.fromEntries(list.filter((g) => g.attended !== true).map((g) => [g.id, true])));

  const submit = () =>
    save.mutate(
      Object.entries(marks).map(([userId, value]) => ({ userId, attended: value })),
      {
        onSuccess: () => {
          successHaptic();
          router.back();
          toast(`Roll call saved: ${came} of ${list.length} came.`);
        },
        onError: (err) => toast(errorMessage(err)),
      },
    );

  return (
    <View className="flex-1 bg-bg">
      <FlatList
        style={styles.fill}
        data={list}
        keyExtractor={(g) => g.id}
        extraData={marks}
        contentContainerStyle={{
          paddingTop: top(58),
          paddingHorizontal: spacing.edge,
          paddingBottom: 24,
        }}
        ListHeaderComponent={
          <View className="mb-3">
            <Pressable onPress={() => router.back()} hitSlop={8} className="self-start py-1.5">
              <Text className="font-sans text-body text-muted">Cancel</Text>
            </Pressable>
            <Heading size="page" className="mt-4">
              Who came?
            </Heading>
            <Text className="mt-2 font-sans text-subhead leading-subhead text-muted">
              {a.title}, {whenLong(a)}. Only you see this; it keeps “would you go again?” to the
              people who were there.
            </Text>
            {list.length > 1 && came < list.length ? (
              <View className="mt-4 flex-row">
                <Button label="Everyone came" variant="outline" size="sm" onPress={everyone} />
              </View>
            ) : null}
            {guests.isLoading ? <Loading className="py-10" /> : null}
            {guests.error ? (
              <View className="mt-4">
                <LoadError
                  error={guests.error}
                  onRetry={() => void guests.refetch()}
                  stale={!!guests.data}
                />
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          guests.data ? (
            <EmptyState card title="No guests" subtitle="Nobody else joined this one." />
          ) : null
        }
        renderItem={({ item: g }) => {
          const value = attended(g);
          return (
            <View className="flex-row items-center gap-3 border-b border-divider py-3">
              <Avatar uri={g.avatarUrl ?? undefined} name={g.name} size={40} />
              <Text className="flex-1 font-sans-medium text-body text-ink" numberOfLines={1}>
                {g.name}
              </Text>
              <View className="flex-row gap-2" accessibilityRole="radiogroup">
                <Chip
                  label="Came"
                  shape="compact"
                  selected={value === true}
                  accessibilityLabel={`${g.name} came`}
                  onPress={() => mark(g, true)}
                />
                <Chip
                  label="Didn’t"
                  shape="compact"
                  selected={value === false}
                  accessibilityLabel={`${g.name} didn’t come`}
                  onPress={() => mark(g, false)}
                />
              </View>
            </View>
          );
        }}
      />
      {list.length ? (
        <Footer>
          <Button
            label={save.isPending ? 'Saving…' : 'Save roll call'}
            loading={save.isPending}
            inactive={!changed}
            onPress={() => changed && submit()}
          />
        </Footer>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
