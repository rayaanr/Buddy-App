import { Image } from 'expo-image';
import { type GestureResponderEvent, Pressable } from 'react-native';

const WIDTH = 240;

/** Height for a photo shown WIDTH wide: its own shape, within sensible bounds. */
const photoHeight = ({ width, height }: { width: number; height: number }) =>
  Math.round(Math.min(320, Math.max(140, (WIDTH * height) / Math.max(1, width))));

/** A photo in a chat bubble; tapping it opens it full screen. */
export function ChatPhoto({
  image,
  onOpen,
  onLongPress,
}: {
  image: { url: string; width: number; height: number };
  onOpen: (url: string) => void;
  /** The message's actions (the photo takes the touch, so it passes this on). */
  onLongPress?: (e: GestureResponderEvent) => void;
}) {
  return (
    <Pressable
      onPress={() => onOpen(image.url)}
      onLongPress={onLongPress}
      delayLongPress={350}
      accessibilityRole="imagebutton"
      accessibilityLabel="Photo. Open full screen"
    >
      <Image
        source={{ uri: image.url }}
        style={{ width: WIDTH, height: photoHeight(image) }}
        contentFit="cover"
        transition={150}
      />
    </Pressable>
  );
}
