import { ScrollView, Text, View } from 'react-native';

import { CommunityCard } from '@/components/community/CommunityCard';
import { Heading } from '@/components/ui';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { useActivitiesStore } from '@/store/activities';

export default function CommunitiesScreen() {
  const { top } = useScreenInsets();
  const communities = useActivitiesStore((s) => s.communities);

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerStyle={{ paddingTop: top(62), paddingHorizontal: 22, paddingBottom: 24 }}
    >
      <Heading>Communities</Heading>
      <Text className="mt-1.5 font-sans text-[14.5px] text-muted">
        Groups in Colombo that meet regularly.
      </Text>
      <View className="mt-4 gap-3.5">
        {communities.map((c) => (
          <CommunityCard key={c.id} community={c} />
        ))}
      </View>
    </ScrollView>
  );
}
