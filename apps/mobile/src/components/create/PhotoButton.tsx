import { ActivityIndicator, Text, View } from 'react-native';

import { Avatar, CameraIcon, Menu, PressableScale } from '@/components/ui';
import type { usePickedImage } from '@/hooks/usePickedImage';
import { cn } from '@/lib/cn';
import { colors } from '@/theme';

interface PhotoButtonProps {
  image: ReturnType<typeof usePickedImage>;
  /** Initials stand in until there's a photo. */
  name: string;
  shape: 'circle' | 'rounded';
  size: number;
  /** e.g. "photo" or "logo". */
  noun: string;
  /** Under the picture when there's none yet, e.g. "Add a logo (optional)". */
  emptyHint?: string;
}

/**
 * A profile photo or community logo you tap to change. With nothing set it
 * opens the photo library straight away; with one, a small menu offers a new
 * one or removing it.
 */
export function PhotoButton({ image, name, shape, size, noun, emptyHint }: PhotoButtonProps) {
  const radius = shape === 'circle' ? 'rounded-full' : 'rounded-[24px]';
  const face = (
    <View>
      <Avatar uri={image.uri ?? undefined} name={name} shape={shape} size={size} />
      {image.uploading ? (
        <View className={cn('absolute inset-0 items-center justify-center bg-black/50', radius)}>
          <ActivityIndicator color={colors.ink} />
        </View>
      ) : null}
      <View className="absolute -bottom-0.5 -right-0.5 h-8 w-8 items-center justify-center rounded-full border-2 border-bg bg-lime">
        <CameraIcon />
      </View>
    </View>
  );

  return (
    <View className="mt-6 items-center">
      {image.uri && !image.uploading ? (
        <Menu
          label={`Change ${noun}`}
          align="start"
          trigger={face}
          items={[
            { label: `Choose a new ${noun}`, onPress: () => void image.pick() },
            { label: `Remove ${noun}`, destructive: true, onPress: image.remove },
          ]}
        />
      ) : (
        <PressableScale
          onPress={() => void image.pick()}
          disabled={image.uploading}
          accessibilityRole="button"
          accessibilityLabel={`Add a ${noun}`}
        >
          {face}
        </PressableScale>
      )}
      <Text className="mt-2.5 text-center font-sans text-[13.5px] text-muted">
        {image.uploading
          ? 'Uploading…'
          : image.uri
            ? `Change ${noun}`
            : (emptyHint ?? `Add a ${noun}`)}
      </Text>
    </View>
  );
}
