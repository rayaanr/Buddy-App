import { router } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { useCommunities } from '@/api/queries';
import { CommunityCard, CommunityCardSkeleton } from '@/components/community/CommunityCard';
import {
  AnimatedView,
  Button,
  Heading,
  IconButton,
  LoadError,
  PlusIcon,
  Refresh,
} from '@/components/ui';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { colors } from '@/theme';
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
      <View className="flex-row items-center justify-between">
        <Heading>Communities</Heading>
        <IconButton
          icon={<PlusIcon color={colors.ink} size={20} />}
          label="Start a community"
          onPress={() => router.push('/community/new')}
        />
      </View>
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
      {communities.data ? (
        <View className="mt-6 items-center rounded-[18px] border border-dashed border-outline p-5">
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
    </ScrollView>
  );
}
