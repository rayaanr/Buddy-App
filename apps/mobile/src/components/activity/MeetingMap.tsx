import type { Location } from '@buddy/shared';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MapPinIcon, Menu } from '@/components/ui';
import { MAP_ATTRIBUTION } from '@/config';
import { mapsApps, tilesAround } from '@/lib/maps';
import { toast } from '@/store/ui';
import { colors } from '@/theme';

const HEIGHT = 150;
/** Street level: a few blocks around the meeting point. */
const ZOOM = 15;

interface MeetingMapProps {
  location: Location;
  /** The meeting point's name, for the maps app's pin. */
  place: string;
  /** Shown beside "Directions", e.g. "Add to calendar". */
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
    <View className="flex-row items-center gap-2">
      <MapPinIcon color={colors.lime} />
      <Text className="font-sans-medium text-[14px] text-lime">Directions</Text>
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

      <View className="mt-3 flex-row items-center gap-6">
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
            hitSlop={8}
            className="active:opacity-70"
          >
            {directions}
          </Pressable>
        )}
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
    backgroundColor: colors.surface,
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
    backgroundColor: 'rgba(201,245,63,0.18)',
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
    color: 'rgba(255,255,255,0.55)',
  },
});
