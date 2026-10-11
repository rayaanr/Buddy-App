import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { useCommunities, useMe } from '@/api/queries';
import { CommunityCard, CommunityCardSkeleton } from '@/components/community/CommunityCard';
import {
  Button,
  Heading,
  IconButton,
  LoadError,
  PlusIcon,
  Refresh,
  SearchField,
} from '@/components/ui';
import { useDebounced } from '@/hooks/useDebounced';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { colors } from '@/theme';
import { layoutItem } from '@/theme/motion';

export default function CommunitiesScreen() {
  const { top } = useScreenInsets();
  const me = useMe();
  const [search, setSearch] = useState('');
  const searching = useDebounced(search.trim(), 300);
  const isSearch = searching.length >= 2;
  const communities = useCommunities(isSearch ? searching : '');

  return (
    // Virtualised; cards glide into place when the list changes.
    <Animated.FlatList
      style={styles.screen}
      data={communities.data ?? []}
      keyExtractor={(c) => c.id}
      renderItem={({ item }) => <CommunityCard community={item} />}
      itemLayoutAnimation={layoutItem}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        paddingTop: top(62),
        paddingHorizontal: 22,
        paddingBottom: 24,
        gap: 14,
      }}
      refreshControl={
        <Refresh
          refreshing={communities.isRefetching}
          onRefresh={() => void communities.refetch()}
        />
      }
      ListHeaderComponent={
        <View className="mb-0.5">
          <View className="flex-row items-center justify-between">
            <Heading>Communities</Heading>
            <IconButton
              icon={<PlusIcon color={colors.ink} size={20} />}
              label="Start a community"
              onPress={() => router.push('/community/new')}
            />
          </View>
          <Text className="mt-1.5 font-sans text-[14.5px] text-muted">
            Groups around Sri Lanka that meet regularly
            {me.data ? `, nearest to ${me.data.area} first.` : '.'}
          </Text>
          <View className="mt-4">
            <SearchField
              value={search}
              onChangeText={setSearch}
              placeholder="Search runners, Kandy, sketching…"
              label="Search communities"
            />
          </View>
          {communities.isLoading ? (
            <View className="mt-4 gap-3.5">
              <CommunityCardSkeleton />
              <CommunityCardSkeleton />
            </View>
          ) : null}
          {communities.error ? (
            <View className="mt-4">
              <LoadError
                error={communities.error}
                onRetry={() => void communities.refetch()}
                stale={!!communities.data}
              />
            </View>
          ) : null}
        </View>
      }
      ListFooterComponent={
        <>
          {isSearch && communities.data?.length === 0 ? (
            <Text className="font-sans text-[14.5px] text-muted">
              No communities match “{searching}”.
            </Text>
          ) : null}
          {communities.data ? (
            <View className="mt-3 items-center rounded-[18px] border border-dashed border-outline p-5">
              <Text className="font-sans-medium text-[15.5px] text-ink">Don’t see your crowd?</Text>
              <Text className="mt-1 text-center font-sans text-[13.5px] leading-[19px] text-muted">
                Start a community for the people you run, play or make things with.
              </Text>
              <Button
                label="Start a community"
                variant="outline"
                size="md"
                onPress={() => router.push('/community/new')}
                className="mt-4 self-stretch"
              />
            </View>
          ) : null}
        </>
      }
    />
  );
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.bg } });
