import { Image } from 'expo-image';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';

interface AvatarProps {
  uri?: string;
  size: number;
  /** Whose it is: without a photo, their initials show on a colour of their own. */
  name?: string;
  /** People are circles; communities are rounded squares. */
  shape?: 'circle' | 'rounded';
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

/**
 * Background and letter colours for initials: deep tones that sit well on
 * the dark app, each with a light tint of itself for the letters.
 */
const TONES = [
  ['#2f4a2b', '#c9f53f'],
  ['#4a2f45', '#f3b8e6'],
  ['#2b3f55', '#a9d2ff'],
  ['#55392a', '#ffc7a3'],
  ['#284a47', '#9ff0e4'],
  ['#4b4626', '#f1e39a'],
  ['#3b2f55', '#cfc0ff'],
  ['#552a33', '#ffb3c0'],
] as const;

/** "Kavindu Perera" → "KP", "Nimal" → "Ni", "colombo runners" → "CR". */
export function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) {
    const [a = '', b = ''] = [...words[0]!];
    return a.toUpperCase() + b.toLowerCase();
  }
  return ([...words[0]!][0]! + [...words[words.length - 1]!][0]!).toUpperCase();
}

/** The same name always gets the same colours. */
function toneFor(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.codePointAt(0)!) | 0;
  return TONES[Math.abs(hash) % TONES.length]!;
}

export function Avatar({
  uri,
  size,
  name,
  shape = 'circle',
  ring,
  ringWidth = 2,
  onPress,
  accessibilityLabel,
  hidden,
  style,
}: AvatarProps) {
  const [background, letters] = name ? toneFor(name) : ['#3a3d39', '#9a9d97'];
  const body = (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: shape === 'circle' ? size / 2 : Math.round(size * 0.28),
          backgroundColor: background,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: hidden ? 0 : 1,
        },
        ring ? { borderWidth: ringWidth, borderColor: ring } : null,
        style,
      ]}
    >
      {/* Initials sit underneath: they show while a photo loads, or if it can't. */}
      {name ? (
        <Text
          allowFontScaling={false}
          style={{
            color: letters,
            fontFamily: 'SchibstedGrotesk_700Bold',
            fontSize: Math.round(size * 0.38),
            letterSpacing: -0.3,
          }}
        >
          {initials(name)}
        </Text>
      ) : null}
      {uri ? (
        <Image
          source={{ uri }}
          style={{ position: 'absolute', inset: 0 }}
          contentFit="cover"
          transition={150}
        />
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
