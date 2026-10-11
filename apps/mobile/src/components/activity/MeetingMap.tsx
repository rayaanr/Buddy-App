import type { Location } from '@buddy/shared';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MapPinIcon, Menu } from '@/components/ui';
import { MAP_ATTRIBUTION, MAP_BACKGROUND } from '@/config';
import { mapsApps, tilesAround } from '@/lib/maps';
import { toast } from '@/store/ui';
import { colors } from '@/theme';

const HEIGHT = 150;

/** The buttons under the map (Directions, and e.g. Add to calendar beside it). */
export const MAP_ACTION =
  'h-12 flex-row items-center justify-center gap-2 rounded-2xl bg-surface active:opacity-80';
/** Street level: a few blocks around the meeting point. */
const ZOOM = 15;

interface MeetingMapProps {
  location: Location;
  /** The meeting point's name, for the maps app's pin. */
  place: string;
  /** Shown beside "Directions" (give it flex-1 and MAP_ACTION), e.g. "Add to calendar". */
  children?: React.ReactNode;
}

const open = (url: string) => Linking.openURL(url).catch(() => toast('Couldn’t open a maps app.'));

/**
 * A small map of the meeting point with a pin, then "Directions". Built from
 * map tiles (see MAP_TILES in config) rather than a native map, so it looks
 * the same on iPhone and Android and needs no API key. Tapping it opens the
 * phone's maps app.
 */
export function MeetingMap({ location, place, children }: MeetingMapProps) {
  const [width, setWidth] = useState(0);
  const apps = mapsApps(location, place);
  const tiles = width ? tilesAround(location, ZOOM, width, HEIGHT) : [];

  const directions = (
    <View className={MAP_ACTION}>
      <MapPinIcon color={colors.lime} />
      <Text className="font-sans-semibold text-subhead text-ink">Directions</Text>
    </View>
  );

  return (
    <View className="mt-2.5">
      <Pressable
        onPress={() => void open(apps[0]!.url)}
        onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
        accessibilityRole="button"
        accessibilityLabel={`Map of ${place}. Open in ${apps[0]!.label}`}
        style={styles.map}
      >
        {tiles.map((t) => (
          <Image
            key={t.key}
            source={{ uri: t.url }}
            style={{
              position: 'absolute',
              left: t.left,
              top: t.top,
              width: t.size,
              height: t.size,
            }}
            transition={150}
            accessible={false}
          />
        ))}
        <View pointerEvents="none" style={styles.center}>
          <View style={styles.halo} />
          <View style={styles.pin}>
            <View style={styles.dot} />
          </View>
        </View>
        <Text style={styles.credit} numberOfLines={1} accessible={false}>
          {MAP_ATTRIBUTION}
        </Text>
      </Pressable>

      <View className="mt-2.5 flex-row gap-2.5">
        <View className="flex-1">
          {apps.length > 1 ? (
            <Menu
              label="Directions"
              align="start"
              trigger={directions}
              items={apps.map((app) => ({ label: app.label, onPress: () => void open(app.url) }))}
            />
          ) : (
            <Pressable
              onPress={() => void open(apps[0]!.url)}
              accessibilityRole="button"
              className="active:opacity-70"
            >
              {directions}
            </Pressable>
          )}
        </View>
        {children}
      </View>
    </View>
  );
}

const PIN = 22;

const styles = StyleSheet.create({
  map: {
    height: HEIGHT,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: MAP_BACKGROUND,
  },
  center: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors['lime-wash'],
  },
  pin: {
    width: PIN,
    height: PIN,
    borderRadius: PIN / 2,
    backgroundColor: colors.lime,
    borderWidth: 3,
    borderColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.bg },
  credit: {
    position: 'absolute',
    right: 8,
    bottom: 6,
    fontSize: 9.5,
    color: colors['map-credit'],
    backgroundColor: colors['map-credit-bg'],
    paddingHorizontal: 4,
    borderRadius: 4,
    overflow: 'hidden',
  },
});
