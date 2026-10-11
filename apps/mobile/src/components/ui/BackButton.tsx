import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { useScreenInsets } from '@/hooks/useScreenInsets';
import { ArrowLeftIcon } from './icons';
import { IconButton, type IconButtonProps } from './IconButton';

type HeaderButtonProps = Omit<IconButtonProps, 'icon' | 'label' | 'onPress'> & {
  onPress?: () => void;
};

export function BackButton({ onPress, ...rest }: HeaderButtonProps) {
  return (
    <IconButton
      icon={<ArrowLeftIcon />}
      label="Back"
      onPress={onPress ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
      {...rest}
    />
  );
}

/**
 * The plain screen header, one row: Back, the screen's title, and an optional
 * button on the right.
 */
export function ScreenHeader({ title, right }: { title?: string; right?: ReactNode }) {
  const { top } = useScreenInsets();
  return (
    <View className="flex-row items-center gap-3 px-header" style={{ paddingTop: top(56) }}>
      <BackButton />
      <Text
        accessibilityRole="header"
        numberOfLines={1}
        className="flex-1 font-display text-title1 leading-title1 tracking-[-0.5px] text-ink"
      >
        {title ?? ''}
      </Text>
      {right}
    </View>
  );
}
