import { DISCOVER_FILTERS, type DiscoverFilter } from '@buddy/shared';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { useFeed, useMe } from '@/api/queries';
import { ActivityMap } from '@/components/discover/ActivityMap';
import { BackButton, Loading } from '@/components/ui';
import { useScreenInsets } from '@/hooks/useScreenInsets';

/** Discover's map, filling the screen: same filter and search as the list. */
export default function MapScreen() {
  const params = useLocalSearchParams<{ filter?: string; q?: string }>();
  const filter = (DISCOVER_FILTERS as readonly string[]).includes(params.filter ?? '')
    ? (params.filter as DiscoverFilter)
    : 'All';
  const { insets } = useScreenInsets();
  const { height } = useWindowDimensions();
  const me = useMe();
  const feed = useFeed(filter, params.q ?? '');

  return (
    <View className="flex-1 bg-bg">
      {feed.data ? (
        <ActivityMap
          activities={feed.data.activities}
          fallback={me.data?.place.location ?? { lat: 6.9271, lng: 79.8612 }}
          height={height}
          fullScreen
          insets={{ top: insets.top, bottom: Math.max(insets.bottom, 12) }}
        />
      ) : (
        <Loading className="flex-1" />
      )}
      <View style={[styles.back, { top: insets.top + 12 }]}>
        <BackButton tone="glass" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  back: { position: 'absolute', left: 12 },
});
