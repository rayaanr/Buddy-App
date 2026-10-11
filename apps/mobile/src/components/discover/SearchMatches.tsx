import type { CommunitySummary, PersonResult } from '@buddy/shared';
import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Avatar, PressableScale, SectionLabel } from '@/components/ui';

/** How many communities and people show before "Activities". */
const MAX = 3;

/**
 * Search on Discover, beyond activities: matching communities and people
 * (only people you share a community or an activity with).
 */
export function SearchMatches({
  communities,
  people,
}: {
  communities: CommunitySummary[];
  people: PersonResult[];
}) {
  return (
    <>
      {communities.length ? (
        <View>
          <SectionLabel className="mb-1">Communities</SectionLabel>
          {communities.slice(0, MAX).map((c) => (
            <Row
              key={c.id}
              image={c.logoUrl}
              name={c.name}
              sub={`${c.area} · ${c.memberCount} ${c.memberCount === 1 ? 'member' : 'members'}`}
              shape="rounded"
              onPress={() => router.push(`/community/${c.id}`)}
            />
          ))}
        </View>
      ) : null}
      {people.length ? (
        <View>
          <SectionLabel className="mb-1">People</SectionLabel>
          {people.slice(0, MAX).map((p) => (
            <Row
              key={p.id}
              image={p.avatarUrl}
              name={p.name}
              sub={p.area}
              onPress={() => router.push(`/user/${p.id}`)}
            />
          ))}
        </View>
      ) : null}
      {communities.length || people.length ? <SectionLabel>Activities</SectionLabel> : null}
    </>
  );
}

function Row({
  image,
  name,
  sub,
  shape,
  onPress,
}: {
  image: string | null;
  name: string;
  sub: string;
  shape?: 'rounded';
  onPress: () => void;
}) {
  return (
    <PressableScale
      scale="dim"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${sub}`}
      className="flex-row items-center gap-3 border-b border-divider py-3"
    >
      <Avatar uri={image ?? undefined} name={name} size={42} shape={shape} />
      <View className="min-w-0 flex-1">
        <Text className="font-sans-semibold text-body text-ink" numberOfLines={1}>
          {name}
        </Text>
        <Text className="mt-0.5 font-sans text-label text-muted" numberOfLines={1}>
          {sub}
        </Text>
      </View>
    </PressableScale>
  );
}
