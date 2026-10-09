import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { colors } from '@/theme';

interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function CompassIcon({ size = 24, color = colors.muted, strokeWidth = 1.7 }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
    >
      <Circle cx={12} cy={12} r={9} />
      <Path d="M15.5 8.5l-2 5-5 2 2-5z" />
    </Svg>
  );
}

export function CalendarIcon({ size = 24, color = colors.muted, strokeWidth = 1.7 }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    >
      <Rect x={3.5} y={5} width={17} height={15} rx={3} />
      <Path d="M3.5 10h17M8 3v4M16 3v4" />
    </Svg>
  );
}

export function PeopleIcon({ size = 24, color = colors.muted, strokeWidth = 1.7 }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    >
      <Circle cx={9} cy={8.5} r={3.5} />
      <Circle cx={16.5} cy={9.5} r={2.8} />
      <Path d="M3 19c.6-3.2 3-5 6-5s5.4 1.8 6 5M15.5 14.2c2.8-.3 4.9 1.4 5.5 4.3" />
    </Svg>
  );
}

export function PersonIcon({ size = 24, color = colors.muted, strokeWidth = 1.7 }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    >
      <Circle cx={12} cy={8} r={4} />
      <Path d="M4.5 20c.8-3.8 3.7-6 7.5-6s6.7 2.2 7.5 6" />
    </Svg>
  );
}

export function PlusIcon({ size = 22, color = colors.bg, strokeWidth = 2.2 }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    >
      <Path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function CheckIcon({ size = 30, color = colors.bg, strokeWidth = 2.4 }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M5 12.5l4.5 4.5L19 7.5" />
    </Svg>
  );
}

export function TickIcon({
  width = 14,
  height = 10,
  color = colors.muted,
  strokeWidth = 1.6,
}: {
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
}) {
  return (
    <Svg
      width={width}
      height={height}
      viewBox="0 0 14 10"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M1.5 5.2l3 3L11 1.8" />
    </Svg>
  );
}

export function DoubleTickIcon({ color = colors.lime }: { color?: string }) {
  return (
    <Svg
      width={18}
      height={10}
      viewBox="0 0 18 10"
      fill="none"
      stroke={color}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M1.5 5.2l3 3L11 1.8M8.5 7.6l.6.6L15.5 1.8" />
    </Svg>
  );
}

export function ArrowLeftIcon({ size = 20, color = colors.ink }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M19 12H5M11 6l-6 6 6 6" />
    </Svg>
  );
}

export function CloseIcon({ size = 17, color = colors.ink, strokeWidth = 1.9 }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    >
      <Path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  );
}
