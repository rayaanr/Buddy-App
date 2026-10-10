import { ActivityIndicator, Text, View } from 'react-native';

import { Chip, ImagePlusIcon, Photo, PressableScale } from '@/components/ui';
import type { usePickedImage } from '@/hooks/usePickedImage';
import { colors } from '@/theme';

interface CoverFieldProps {
  cover: ReturnType<typeof usePickedImage>;
  /** Shown while the photo loads. */
  hue: string;
  /** "Remove", or e.g. "Use the default" when removing brings back a stock photo. */
  removeLabel: string;
  /** Under "Add a cover photo": what happens without one. */
  hint: string;
}

/** Pick, change or remove a 16:10 cover photo. New activity, Edit activity, communities. */
export function CoverField({ cover, hue, removeLabel, hint }: CoverFieldProps) {
  if (!cover.uri) {
    return (
      <PressableScale
        scale="dim"
        onPress={() => void cover.pick()}
        accessibilityRole="button"
        accessibilityLabel="Add a cover photo"
        className="h-[118px] items-center justify-center gap-1.5 rounded-2xl border border-dashed border-outline px-6"
      >
        <ImagePlusIcon />
        <Text className="font-sans-medium text-[15px] text-ink">Add a cover photo</Text>
        <Text className="text-center font-sans text-[13px] text-muted">{hint}</Text>
      </PressableScale>
    );
  }
  return (
    <View>
      <Photo uri={cover.uri} hue={hue} style={{ aspectRatio: 16 / 10, borderRadius: 16 }}>
        {cover.uploading ? (
          <View className="flex-1 items-center justify-center bg-black/50">
            <ActivityIndicator color={colors.ink} />
          </View>
        ) : null}
      </Photo>
      <View className="mt-2.5 flex-row gap-2">
        <Chip label="Change photo" selected={false} onPress={() => void cover.pick()} />
        <Chip label={removeLabel} selected={false} onPress={cover.remove} />
      </View>
    </View>
  );
}
