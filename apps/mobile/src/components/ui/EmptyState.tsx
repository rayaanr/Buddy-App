import { Text, View } from 'react-native';

import { cn } from '@/lib/cn';
import { Button } from './Button';

interface EmptyStateProps {
  title: string;
  subtitle: string;
  cta?: string;
  onPress?: () => void;
  /** Card background (Discover) or bare (Activities). */
  card?: boolean;
}

export function EmptyState({ title, subtitle, cta, onPress, card }: EmptyStateProps) {
  return (
    <View className={cn('items-center px-5', card ? 'rounded-panel bg-surface py-12' : 'py-11')}>
      <Text className="font-sans-semibold text-headline text-ink">{title}</Text>
      <Text className="mt-1.5 text-center font-sans text-label leading-5 text-muted">
        {subtitle}
      </Text>
      {cta && onPress ? <Button label={cta} size="sm" onPress={onPress} className="mt-4" /> : null}
    </View>
  );
}
