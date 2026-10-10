import { Image } from 'expo-image';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '@/theme';

interface AvatarProps {
  uri?: string;
  size: number;
  fallback?: string;
  /** Ring colour, used to separate overlapping avatars from the background. */
  ring?: string;
  ringWidth?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
  /** Keeps layout space but hides the face (used for grouped chat messages). */
  hidden?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Small avatars still get a 44 pt touch area. */
const MIN_TOUCH = 44;

export function Avatar({
  uri,
  size,
  fallback = colors['avatar-fallback'],
  ring,
  ringWidth = 2,
  onPress,
  accessibilityLabel,
  hidden,
  style,
}: AvatarProps) {
  const body = (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: fallback,
          overflow: 'hidden',
          opacity: hidden ? 0 : 1,
        },
        ring ? { borderWidth: ringWidth, borderColor: ring } : null,
        style,
      ]}
    >
      {uri ? (
        <Image source={{ uri }} style={{ flex: 1 }} contentFit="cover" transition={150} />
      ) : null}
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      disabled={hidden}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={Math.max(4, (MIN_TOUCH - size) / 2)}
    >
      {body}
    </Pressable>
  );
}
