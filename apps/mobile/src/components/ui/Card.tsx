import { View, type ViewProps } from 'react-native';

import { cn } from '@/lib/cn';

/** Literal classes, so Tailwind generates them. */
const RADIUS = {
  tile: 'rounded-tile',
  card: 'rounded-card',
  hero: 'rounded-hero',
} as const;

/**
 * The raised surface that groups things: an info tile, a form row, a list
 * of options. Bring your own padding and layout through `className`.
 */
export function Card({
  radius = 'card',
  className,
  ...props
}: ViewProps & { className?: string; radius?: keyof typeof RADIUS }) {
  return <View className={cn(RADIUS[radius], 'bg-surface', className)} {...props} />;
}
