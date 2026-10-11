import { Text, View } from 'react-native';

import { cn } from '@/lib/cn';

/** A lime count, e.g. unread messages: "3", or "99+". Nothing for 0. Grey when muted. */
export function CountBadge({
  count,
  muted,
  className,
}: {
  count: number;
  muted?: boolean;
  className?: string;
}) {
  if (count <= 0) return null;
  return (
    <View
      pointerEvents="none"
      className={cn(
        'h-[20px] min-w-[20px] items-center justify-center rounded-full px-1.5',
        muted ? 'bg-surface-raised' : 'bg-lime',
        className,
      )}
    >
      <Text
        allowFontScaling={false}
        className={cn('font-sans-semibold text-caption', muted ? 'text-muted' : 'text-bg')}
      >
        {count > 99 ? '99+' : count}
      </Text>
    </View>
  );
}
