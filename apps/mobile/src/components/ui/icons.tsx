import type { LucideIcon, LucideProps } from 'lucide-react-native';
// One import per icon keeps the rest of Lucide out of the bundle.
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import ArrowRight from 'lucide-react-native/icons/arrow-right';
import Calendar from 'lucide-react-native/icons/calendar';
import Check from 'lucide-react-native/icons/check';
import CheckCheck from 'lucide-react-native/icons/check-check';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Compass from 'lucide-react-native/icons/compass';
import Ellipsis from 'lucide-react-native/icons/ellipsis';
import Plus from 'lucide-react-native/icons/plus';
import Settings from 'lucide-react-native/icons/settings';
import User from 'lucide-react-native/icons/user';
import Users from 'lucide-react-native/icons/users';
import X from 'lucide-react-native/icons/x';

import { colors } from '@/theme';

export type IconProps = LucideProps;

/**
 * The app's icons are Lucide (https://lucide.dev) with Buddy's defaults for
 * size, colour and stroke. Pick new ones from Lucide and add them here, so
 * every screen draws icons the same way.
 */
function icon(Icon: LucideIcon, defaults: LucideProps, name: string) {
  function AppIcon(props: IconProps) {
    return <Icon {...defaults} {...props} />;
  }
  AppIcon.displayName = name;
  return AppIcon;
}

const tab = { size: 24, color: colors.muted, strokeWidth: 1.7 };

// Tab bar
export const CompassIcon = icon(Compass, tab, 'CompassIcon');
export const CalendarIcon = icon(Calendar, tab, 'CalendarIcon');
export const PeopleIcon = icon(Users, tab, 'PeopleIcon');
export const PersonIcon = icon(User, tab, 'PersonIcon');
export const PlusIcon = icon(Plus, { size: 22, color: colors.bg, strokeWidth: 2.2 }, 'PlusIcon');

// Actions and navigation
export const CheckIcon = icon(Check, { size: 30, color: colors.bg, strokeWidth: 2.4 }, 'CheckIcon');
export const CloseIcon = icon(X, { size: 17, color: colors.ink, strokeWidth: 1.9 }, 'CloseIcon');
export const ArrowLeftIcon = icon(
  ArrowLeft,
  { size: 20, color: colors.ink, strokeWidth: 1.9 },
  'ArrowLeftIcon',
);
export const ArrowRightIcon = icon(
  ArrowRight,
  { size: 15, color: colors.lime, strokeWidth: 2 },
  'ArrowRightIcon',
);
export const ChevronRightIcon = icon(
  ChevronRight,
  { size: 18, color: colors.subtle, strokeWidth: 1.8 },
  'ChevronRightIcon',
);

export const MoreIcon = icon(Ellipsis, { size: 20, color: colors.ink, strokeWidth: 2 }, 'MoreIcon');
export const SettingsIcon = icon(
  Settings,
  { size: 20, color: colors.ink, strokeWidth: 1.8 },
  'SettingsIcon',
);

// Chat receipts: sent ✓ and seen ✓✓
export const TickIcon = icon(Check, { size: 14, color: colors.muted, strokeWidth: 2 }, 'TickIcon');
export const DoubleTickIcon = icon(
  CheckCheck,
  { size: 16, color: colors.lime, strokeWidth: 2 },
  'DoubleTickIcon',
);
