import { ScrollView, Text, View } from 'react-native';

import { useCommunities } from '@/api/queries';
import { CommunityCard, CommunityCardSkeleton } from '@/components/community/CommunityCard';
import { AnimatedView, Heading, LoadError, Refresh } from '@/components/ui';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { enterItem, layoutItem } from '@/theme/motion';

export default function CommunitiesScreen() {
  const { top } = useScreenInsets();
  const communities = useCommunities();

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerStyle={{ paddingTop: top(62), paddingHorizontal: 22, paddingBottom: 24 }}
      refreshControl={
        <Refresh
          refreshing={communities.isRefetching}
          onRefresh={() => void communities.refetch()}
        />
      }
    >
      <Heading>Communities</Heading>
      <Text className="mt-1.5 font-sans text-[14.5px] text-muted">
        Groups around Sri Lanka that meet regularly.
      </Text>
      <View className="mt-4 gap-3.5">
        {communities.isLoading ? (
          <>
            <CommunityCardSkeleton />
            <CommunityCardSkeleton />
          </>
        ) : null}
        {communities.error ? (
          <LoadError error={communities.error} onRetry={() => void communities.refetch()} />
        ) : null}
        {communities.data?.map((c, i) => (
          <AnimatedView key={c.id} entering={enterItem(i)} layout={layoutItem}>
            <CommunityCard community={c} />
          </AnimatedView>
        ))}
      </View>
    </ScrollView>
  );
}
