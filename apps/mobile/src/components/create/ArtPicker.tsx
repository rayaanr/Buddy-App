import { artFromUrl } from '@buddy/shared';
import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import { Drawer, PressableScale } from '@/components/ui';
import { artUri } from '@/lib/art';
import { cn } from '@/lib/cn';

interface ArtPickerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** The pictures to choose from (ids from FALLBACK_ART). */
  ids: readonly string[];
  /** Avatars are round; covers are wide, at the picture's own proportions. */
  shape: 'circle' | 'square' | 'cover';
  /** Width over height, for covers. */
  aspect?: number;
  /** What's showing now, to mark it. */
  current?: string | null;
  onPick: (id: string) => void;
}

/** A drawer of Buddy's own pictures, for anyone who'd rather not upload a photo. */
export function ArtPicker({
  open,
  onClose,
  title,
  ids,
  shape,
  aspect = 4 / 3,
  current,
  onPick,
}: ArtPickerProps) {
  const selected = artFromUrl(current);
  const wide = shape === 'cover';
  return (
    <Drawer open={open} onClose={onClose}>
      <View className="px-edge">
        <Text className="mb-4 font-sans-semibold text-title3 text-ink">{title}</Text>
        <View className="flex-row flex-wrap" style={{ marginHorizontal: -5 }}>
          {ids.map((id) => {
            const on = id === selected;
            return (
              <View key={id} style={{ width: wide ? '50%' : '25%', padding: 5 }}>
                <PressableScale
                  onPress={() => {
                    onPick(id);
                    onClose();
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`Picture ${id.replace(/-/g, ' ')}`}
                  className={cn(
                    'overflow-hidden border-2',
                    shape === 'circle' ? 'rounded-full' : 'rounded-tile',
                    on ? 'border-lime' : 'border-transparent',
                  )}
                >
                  <Image
                    source={{ uri: artUri(id) }}
                    style={{ width: '100%', aspectRatio: wide ? aspect : 1 }}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    accessible={false}
                  />
                </PressableScale>
              </View>
            );
          })}
        </View>
      </View>
    </Drawer>
  );
}
