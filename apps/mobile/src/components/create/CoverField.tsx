import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Chip, ImagePlusIcon, Photo, PressableScale } from '@/components/ui';
import type { usePickedImage } from '@/hooks/usePickedImage';
import { colors } from '@/theme';
import { ArtPicker } from './ArtPicker';

interface CoverFieldProps {
  cover: ReturnType<typeof usePickedImage>;
  /** Shown while the photo loads. */
  hue: string;
  /** Under "Add a cover photo": what happens without one. */
  hint: string;
  /** Buddy's own pictures to pick from instead, and their width over height. */
  art: { ids: readonly string[]; aspect: number };
}

/**
 * Pick, change or remove a 16:10 cover photo, or choose one of Buddy's
 * pictures instead (in a drawer). New activity, Edit activity, communities.
 */
export function CoverField({ cover, hue, hint, art }: CoverFieldProps) {
  const [picking, setPicking] = useState(false);
  const picker = (
    <ArtPicker
      open={picking}
      onClose={() => setPicking(false)}
      title="Choose a picture"
      ids={art.ids}
      shape="cover"
      aspect={art.aspect}
      current={cover.uri}
      onPick={cover.choose}
    />
  );
  const choose = (
    <Chip label="Choose a picture" selected={false} onPress={() => setPicking(true)} />
  );

  if (!cover.uri) {
    return (
      <View>
        <PressableScale
          scale="dim"
          onPress={() => void cover.pick()}
          accessibilityRole="button"
          accessibilityLabel="Add a cover photo"
          className="h-[118px] items-center justify-center gap-1.5 rounded-2xl border border-dashed border-outline px-6"
        >
          <ImagePlusIcon />
          <Text className="font-sans-medium text-subhead text-ink">Add a cover photo</Text>
          <Text className="text-center font-sans text-footnote text-muted">{hint}</Text>
        </PressableScale>
        <View className="mt-2.5 flex-row">{choose}</View>
        {picker}
      </View>
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
      <View className="mt-2.5 flex-row flex-wrap gap-2">
        <Chip
          label={cover.isArt ? 'Upload a photo' : 'Change photo'}
          selected={false}
          onPress={() => void cover.pick()}
        />
        {choose}
        {/* Removing an uploaded photo brings back one of Buddy's pictures. */}
        {cover.isArt ? null : <Chip label="Remove" selected={false} onPress={cover.remove} />}
      </View>
      {picker}
    </View>
  );
}
