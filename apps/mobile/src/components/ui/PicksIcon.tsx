import Svg, { Path, Rect } from 'react-native-svg';

import { colors } from '@/theme';

/**
 * Buddy's own icon for "Picked for you": two fanned cards, as in the swipe
 * deck, with a lime tick on the front one. Drawn on Lucide's 24-unit grid and
 * stroke so it sits with the app's other icons.
 */
export function PicksIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Rect
        x={3.6}
        y={4.6}
        width={10}
        height={14}
        rx={2.4}
        transform="rotate(-13 8.6 11.6)"
        stroke={colors.muted}
      />
      <Rect
        x={9.4}
        y={4.4}
        width={11}
        height={15.2}
        rx={2.6}
        transform="rotate(7 14.9 12)"
        fill={colors.bg}
        stroke={colors.ink}
      />
      <Path d="M12.6 12.4l1.9 1.9 3.4-3.7" transform="rotate(7 14.9 12)" stroke={colors.lime} />
    </Svg>
  );
}
