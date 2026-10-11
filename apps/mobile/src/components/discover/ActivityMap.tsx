import type { ActivitySummary, Location } from '@buddy/shared';
import { Image } from 'expo-image';
import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { ActivityRow } from '@/components/activity/ActivityCards';
import { IconButton, MaximizeIcon } from '@/components/ui';
import { MAP_ATTRIBUTION, MAP_BACKGROUND, MAP_SHADE } from '@/config';
import { availabilityColor } from '@/lib/activity';
import { project } from '@/lib/gestures';
import { fitPoints, fromWorldPixel, tilesAround, worldPixel } from '@/lib/maps';
import { colors, shadows } from '@/theme';
import { ease } from '@/theme/motion';

const MIN_ZOOM = 7;
const MAX_ZOOM = 17;
/** Tiles drawn beyond each edge, so dragging doesn't show blank strips. */
const MARGIN = 256;
const PIN = 30;
/** After a fling the map glides on and slows down, about this long. */
const GLIDE_MS = 450;
/** Maps stop sooner than lists: a fling moves it a screen or so, not a country. */
const MAP_DECELERATION = 0.995;

interface ActivityMapProps {
  activities: ActivitySummary[];
  /** Where to look when there's nothing to show (e.g. the home town). */
  fallback: Location;
  height: number;
  /** Fills the screen: no rounded corners, the picked activity floats over the map. */
  fullScreen?: boolean;
  /** Space taken by the status bar and home indicator, in full screen. */
  insets?: { top: number; bottom: number };
  /** Shows a button to open the map full screen. */
  onExpand?: () => void;
}

/**
 * Discover as a map: a pin per activity. Drag to look around; pinch,
 * double-tap or + / − to zoom.
 * Drawn from map tiles like the activity page's map (the same on iPhone,
 * Android and web, no API key). Tapping a pin shows the activity below.
 */
export function ActivityMap({
  activities,
  fallback,
  height,
  fullScreen,
  insets = { top: 0, bottom: 0 },
  onExpand,
}: ActivityMapProps) {
  const [width, setWidth] = useState(0);
  const [view, setView] = useState<{ center: Location; zoom: number } | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const mapHeight = fullScreen ? height : height - 116;

  // Fit everything in once the map knows its size (and when the list changes).
  const [fittedFor, setFittedFor] = useState('');
  const key = `${width}:${activities.map((a) => a.id).join(',')}`;
  if (width && fittedFor !== key) {
    setFittedFor(key);
    const fit = fitPoints(
      activities.map((a) => a.location),
      width,
      mapHeight,
    );
    setView(fit ?? { center: fallback, zoom: 13 });
    setPicked(activities[0]?.id ?? null);
  }

  // Dragging moves the drawn map; letting go re-centres on where it was dragged to.
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  // Pinching scales the drawn map; letting go snaps to the nearest zoom level.
  const scale = useSharedValue(1);
  const moved = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.get() }, { translateY: ty.get() }, { scale: scale.get() }],
  }));
  const settle = useCallback(
    (dx: number, dy: number) =>
      setView((v) => {
        if (!v) return v;
        const c = worldPixel(v.center, v.zoom);
        return { ...v, center: fromWorldPixel({ x: c.x - dx, y: c.y - dy }, v.zoom) };
      }),
    [],
  );
  // The new centre is drawn now: drop the drag offset in the same frame.
  useLayoutEffect(() => {
    tx.set(0);
    ty.set(0);
    scale.set(1);
  }, [view, tx, ty, scale]);

  // From the latest view (a drag may have moved it in the same instant).
  const zoomBy = useCallback(
    (step: number) =>
      setView((v) => {
        const zoom = v && Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom + step));
        // Already as far as it goes: just undo the pinch.
        if (!v || zoom === v.zoom) {
          scale.set(withTiming(1, { duration: 150, easing: ease.out }));
          return v;
        }
        return { ...v, zoom: zoom! };
      }),
    [scale],
  );

  // Where the drag started, so catching the map mid-glide picks it up there.
  const fromX = useSharedValue(0);
  const fromY = useSharedValue(0);
  const gestures = useMemo(() => {
    const pan = Gesture.Pan()
      .minDistance(4)
      .onStart(() => {
        fromX.set(tx.get());
        fromY.set(ty.get());
      })
      .onUpdate((e) => {
        tx.set(fromX.get() + e.translationX);
        ty.set(fromY.get() + e.translationY);
      })
      .onEnd((e) => {
        // Keep going the way it was flung, slowing down, then re-centre there.
        const x = tx.get() + project(e.velocityX, MAP_DECELERATION);
        const y = ty.get() + project(e.velocityY, MAP_DECELERATION);
        const glide = { duration: GLIDE_MS, easing: ease.out };
        ty.set(withTiming(y, glide));
        tx.set(
          withTiming(x, glide, (done) => {
            if (done) scheduleOnRN(settle, x, y);
          }),
        );
      });
    const pinch = Gesture.Pinch()
      .onUpdate((e) => {
        scale.set(e.scale);
      })
      .onEnd((e) => {
        scheduleOnRN(zoomBy, Math.round(Math.log2(Math.max(0.01, e.scale))));
      });
    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .onEnd(() => {
        scheduleOnRN(zoomBy, 1);
      });
    return Gesture.Simultaneous(pan, pinch, doubleTap);
  }, [tx, ty, fromX, fromY, scale, settle, zoomBy]);

  const selected = activities.find((a) => a.id === picked) ?? null;

  if (!view || !width) {
    return (
      <View
        style={[styles.map, fullScreen && styles.full, { height: mapHeight }]}
        onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
      />
    );
  }

  const origin = worldPixel(view.center, view.zoom);
  const tiles = tilesAround(view.center, view.zoom, width + MARGIN * 2, mapHeight + MARGIN * 2);
  const pins = activities
    .map((a) => {
      const p = worldPixel(a.location, view.zoom);
      return { a, x: p.x - origin.x + width / 2, y: p.y - origin.y + mapHeight / 2 };
    })
    // The picked one on top.
    .sort((p, q) => Number(p.a.id === picked) - Number(q.a.id === picked));

  return (
    <View>
      <View
        style={[styles.map, fullScreen && styles.full, { height: mapHeight }]}
        onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
      >
        <GestureDetector gesture={gestures}>
          <Animated.View style={[StyleSheet.absoluteFill, moved]}>
            {tiles.map((t) => (
              <Image
                key={t.key}
                source={{ uri: t.url }}
                style={{
                  position: 'absolute',
                  left: t.left - MARGIN,
                  top: t.top - MARGIN,
                  width: t.size,
                  height: t.size,
                }}
                accessible={false}
              />
            ))}
            {/* Moves with the tiles, so it reaches as far as they do while dragging. */}
            <View pointerEvents="none" style={styles.shade} />
            {pins.map(({ a, x, y }) => {
              const on = a.id === picked;
              return (
                <Pressable
                  key={a.id}
                  onPress={() => setPicked(a.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${a.title}, ${a.place}`}
                  hitSlop={8}
                  style={[
                    styles.pin,
                    {
                      left: x - PIN / 2,
                      top: y - PIN / 2,
                      backgroundColor: on ? colors.lime : availabilityColor(a),
                      // The picked one: bigger, with a light ring.
                      borderColor: on ? colors.ink : colors.bg,
                      transform: [{ scale: on ? 1.3 : 1 }],
                    },
                  ]}
                >
                  <View style={styles.pinDot} />
                </Pressable>
              );
            })}
          </Animated.View>
        </GestureDetector>
        {onExpand ? (
          <View style={styles.expand}>
            <IconButton
              tone="glass"
              icon={<MaximizeIcon />}
              label="Full-screen map"
              onPress={onExpand}
            />
          </View>
        ) : null}
        <View style={[styles.zoom, { top: insets.top + 12 }]}>
          <IconButton
            tone="glass"
            icon={<Text style={styles.zoomText}>+</Text>}
            label="Zoom in"
            onPress={() => zoomBy(1)}
            disabled={view.zoom >= MAX_ZOOM}
          />
          <IconButton
            tone="glass"
            icon={<Text style={styles.zoomText}>−</Text>}
            label="Zoom out"
            onPress={() => zoomBy(-1)}
            disabled={view.zoom <= MIN_ZOOM}
          />
        </View>
        <Text
          style={[styles.credit, fullScreen && { bottom: insets.bottom + 6 }]}
          numberOfLines={1}
          accessible={false}
        >
          {MAP_ATTRIBUTION}
        </Text>
        {!activities.length ? (
          <View pointerEvents="none" style={styles.empty}>
            <Text className="font-sans-medium text-label text-ink">Nothing on the map here</Text>
          </View>
        ) : null}
      </View>
      {fullScreen ? (
        selected ? (
          <View style={[styles.floating, { bottom: insets.bottom + 22 }]}>
            <ActivityRow activity={selected} />
          </View>
        ) : null
      ) : (
        <View className="mt-3" style={{ minHeight: 104 }}>
          {selected ? <ActivityRow activity={selected} /> : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: MAP_BACKGROUND,
  },
  shade: { position: 'absolute', inset: -MARGIN, backgroundColor: MAP_SHADE },
  pin: {
    position: 'absolute',
    width: PIN,
    height: PIN,
    borderRadius: PIN / 2,
    borderWidth: 3,
    borderColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: shadows.float,
  },
  pinDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.bg },
  full: { borderRadius: 0 },
  zoom: { position: 'absolute', right: 12, gap: 8 },
  expand: { position: 'absolute', left: 12, top: 12 },
  floating: { position: 'absolute', left: 14, right: 14 },
  zoomText: { color: colors.ink, fontSize: 22, lineHeight: 24 },
  credit: {
    position: 'absolute',
    left: 10,
    bottom: 6,
    fontSize: 9.5,
    color: colors['map-credit'],
    backgroundColor: colors['map-credit-bg'],
    paddingHorizontal: 4,
    borderRadius: 4,
    overflow: 'hidden',
  },
  empty: {
    position: 'absolute',
    alignSelf: 'center',
    top: '45%',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: colors['glass-strong'],
  },
});
