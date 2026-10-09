import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useId, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';

import { shade } from '@/lib/cn';

interface PhotoProps {
  uri?: string;
  /** Base colour for the striped placeholder shown while loading or offline. */
  hue: string;
  className?: string;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

/** Stock photo over a striped hue placeholder, matching the prototype's fallback. */
export function Photo({ uri, hue, className, style, children }: PhotoProps) {
  return (
    <View className={className} style={[styles.base, { backgroundColor: hue }, style]}>
      <Stripes hue={hue} />
      {uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
        />
      ) : null}
      {children}
    </View>
  );
}

function Stripes({ hue }: { hue: string }) {
  const id = `stripe-${useId().replace(/:/g, '')}`;
  return (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <Pattern
          id={id}
          width={44}
          height={44}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <Rect x={0} y={0} width={22} height={44} fill={hue} />
          <Rect x={22} y={0} width={22} height={44} fill={shade(hue, 0.8)} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

interface ScrimProps {
  /** Where the fade starts, 0–1 from the top. */
  from: number;
  /** Opacity of the bottom colour. */
  opacity?: number;
  /** Optional opacity at the top edge (for scrims that tint the whole image). */
  topOpacity?: number;
  color?: string;
}

/** Bottom-up darkening gradient so text stays legible over photos. */
export function Scrim({ from, opacity = 0.9, topOpacity = 0, color = '11,12,11' }: ScrimProps) {
  return (
    <LinearGradient
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      colors={[
        `rgba(${color},${topOpacity})`,
        `rgba(${color},${topOpacity})`,
        `rgba(${color},${opacity})`,
      ]}
      locations={[0, from, 1]}
    />
  );
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden' },
});
