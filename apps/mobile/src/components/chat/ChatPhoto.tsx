import { Image } from 'expo-image';
import { Pressable } from 'react-native';

const WIDTH = 240;

/** Height for a photo shown WIDTH wide: its own shape, within sensible bounds. */
const photoHeight = ({ width, height }: { width: number; height: number }) =>
  Math.round(Math.min(320, Math.max(140, (WIDTH * height) / Math.max(1, width))));

/** A photo in a chat bubble; tapping it opens it full screen. */
export function ChatPhoto({
  image,
  onOpen,
}: {
  image: { url: string; width: number; height: number };
  onOpen: (url: string) => void;
}) {
  return (
    <Pressable
      onPress={() => onOpen(image.url)}
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
