import { useLocalSearchParams } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';

import { useCommunity, useCommunityActivities } from '@/api/queries';
import { ActivityRow } from '@/components/activity/ActivityCards';
import { EmptyState, LoadError, Loading, Refresh, ScreenHeader } from '@/components/ui';
import { spacing } from '@/theme';

/** Community → See all: everything coming up, soonest first. */
export default function CommunityActivitiesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const community = useCommunity(id);
  const list = useCommunityActivities(id);
  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader title={community.data?.name ?? 'Coming up'} />
      <FlatList
        style={styles.fill}
        data={list.data ?? []}
        keyExtractor={(a) => a.id}
        renderItem={({ item }) => <ActivityRow activity={item} thumb={72} />}
        contentContainerStyle={{
          paddingHorizontal: spacing.edge,
          paddingTop: 12,
          paddingBottom: 30,
          gap: 10,
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
            <EmptyState card title="Nothing coming up" subtitle="New activities show up here." />
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
