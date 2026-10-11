import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Avatar, CameraIcon, Menu } from '@/components/ui';
import type { usePickedImage } from '@/hooks/usePickedImage';
import { cn } from '@/lib/cn';
import { colors } from '@/theme';
import { ArtPicker } from './ArtPicker';

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
  /** Buddy's own pictures to pick from instead, e.g. the avatars for your gender. */
  art: { ids: readonly string[]; label: string };
}

/**
 * A profile photo or community logo you tap to change: a menu offers a photo
 * from the library, one of Buddy's pictures (in a drawer), or removing an
 * uploaded photo (which brings back one of ours).
 */
export function PhotoButton({ image, name, shape, size, noun, emptyHint, art }: PhotoButtonProps) {
  const [picking, setPicking] = useState(false);
  const radius = shape === 'circle' ? 'rounded-full' : 'rounded-hero';
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
      {image.uploading ? (
        face
      ) : (
        <Menu
          label={image.uri ? `Change ${noun}` : `Add a ${noun}`}
          align="start"
          trigger={face}
          items={[
            { label: `Upload a ${noun}`, onPress: () => void image.pick() },
            { label: art.label, onPress: () => setPicking(true) },
            ...(image.uri && !image.isArt
              ? [{ label: `Remove ${noun}`, destructive: true, onPress: image.remove }]
              : []),
          ]}
        />
      )}
      <Text className="mt-2.5 text-center font-sans text-label text-muted">
        {image.uploading
          ? 'Uploading…'
          : image.uri
            ? `Change ${noun}`
            : (emptyHint ?? `Add a ${noun}`)}
      </Text>
      <ArtPicker
        open={picking}
        onClose={() => setPicking(false)}
        title={art.label}
        ids={art.ids}
        shape={shape === 'circle' ? 'circle' : 'square'}
        current={image.uri}
        onPick={image.choose}
      />
    </View>
  );
}
