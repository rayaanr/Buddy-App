import type { LucideIcon, LucideProps } from 'lucide-react-native';
// One import per icon keeps the rest of Lucide out of the bundle.
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import ArrowDown from 'lucide-react-native/icons/arrow-down';
import ArrowRight from 'lucide-react-native/icons/arrow-right';
import Bell from 'lucide-react-native/icons/bell';
import Calendar from 'lucide-react-native/icons/calendar';
import Camera from 'lucide-react-native/icons/camera';
import Check from 'lucide-react-native/icons/check';
import CheckCheck from 'lucide-react-native/icons/check-check';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Clock from 'lucide-react-native/icons/clock';
import ImagePlus from 'lucide-react-native/icons/image-plus';
import Images from 'lucide-react-native/icons/images';
import ChartBar from 'lucide-react-native/icons/chart-bar';
import List from 'lucide-react-native/icons/list';
import LocateFixed from 'lucide-react-native/icons/locate-fixed';
import MapIconSvg from 'lucide-react-native/icons/map';
import MapPin from 'lucide-react-native/icons/map-pin';
import Maximize from 'lucide-react-native/icons/maximize-2';
import MessageCircle from 'lucide-react-native/icons/message-circle';
import Compass from 'lucide-react-native/icons/compass';
import Copy from 'lucide-react-native/icons/copy';
import Ellipsis from 'lucide-react-native/icons/ellipsis';
import Pencil from 'lucide-react-native/icons/pencil';
import Plus from 'lucide-react-native/icons/plus';
import Reply from 'lucide-react-native/icons/reply';
import Search from 'lucide-react-native/icons/search';
import Settings from 'lucide-react-native/icons/settings';
import Share2 from 'lucide-react-native/icons/share-2';
import Trash from 'lucide-react-native/icons/trash';
import User from 'lucide-react-native/icons/user';
import Users from 'lucide-react-native/icons/users';
import X from 'lucide-react-native/icons/x';
import Volume2 from 'lucide-react-native/icons/volume-2';
import VolumeOff from 'lucide-react-native/icons/volume-off';

import { colors } from '@/theme';

type IconProps = LucideProps;

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

export const ChevronLeftIcon = icon(
  ChevronLeft,
  { size: 20, color: colors.ink, strokeWidth: 1.9 },
  'ChevronLeftIcon',
);
export const CameraIcon = icon(
  Camera,
  { size: 16, color: colors.bg, strokeWidth: 2 },
  'CameraIcon',
);
export const ImagePlusIcon = icon(
  ImagePlus,
  { size: 22, color: colors.muted, strokeWidth: 1.8 },
  'ImagePlusIcon',
);
export const LocateIcon = icon(
  LocateFixed,
  { size: 18, color: colors.lime, strokeWidth: 2 },
  'LocateIcon',
);
export const MapPinIcon = icon(
  MapPin,
  { size: 16, color: colors.muted, strokeWidth: 2 },
  'MapPinIcon',
);
export const ChevronDownIcon = icon(
  ChevronDown,
  { size: 16, color: colors.muted, strokeWidth: 2 },
  'ChevronDownIcon',
);
export const ClockIcon = icon(
  Clock,
  { size: 17, color: colors.ink, strokeWidth: 1.8 },
  'ClockIcon',
);

export const MoreIcon = icon(Ellipsis, { size: 20, color: colors.ink, strokeWidth: 2 }, 'MoreIcon');
export const ShareIcon = icon(
  Share2,
  { size: 19, color: colors.ink, strokeWidth: 1.9 },
  'ShareIcon',
);
export const BellIcon = icon(Bell, { size: 20, color: colors.ink, strokeWidth: 1.8 }, 'BellIcon');
export const ReplyIcon = icon(Reply, { size: 20, color: colors.ink, strokeWidth: 2 }, 'ReplyIcon');
export const CopyIcon = icon(Copy, { size: 19, color: colors.ink, strokeWidth: 1.9 }, 'CopyIcon');
export const TrashIcon = icon(
  Trash,
  { size: 19, color: colors.ink, strokeWidth: 1.9 },
  'TrashIcon',
);
export const ArrowDownIcon = icon(
  ArrowDown,
  { size: 20, color: colors.ink, strokeWidth: 2 },
  'ArrowDownIcon',
);
export const ListIcon = icon(List, { size: 18, color: colors.ink, strokeWidth: 2 }, 'ListIcon');
export const MapIcon = icon(MapIconSvg, { size: 18, color: colors.ink, strokeWidth: 2 }, 'MapIcon');
export const ImagesIcon = icon(
  Images,
  { size: 24, color: colors.ink, strokeWidth: 1.9 },
  'ImagesIcon',
);
export const PollIcon = icon(
  ChartBar,
  { size: 24, color: colors.ink, strokeWidth: 1.9 },
  'PollIcon',
);
export const MaximizeIcon = icon(
  Maximize,
  { size: 18, color: colors.ink, strokeWidth: 2 },
  'MaximizeIcon',
);
/** A muted chat. */
export const MutedIcon = icon(
  VolumeOff,
  { size: 14, color: colors.subtle, strokeWidth: 2 },
  'MutedIcon',
);
export const UnmuteIcon = icon(
  Volume2,
  { size: 20, color: colors.ink, strokeWidth: 1.8 },
  'UnmuteIcon',
);
export const ChatIcon = icon(
  MessageCircle,
  { size: 20, color: colors.ink, strokeWidth: 1.8 },
  'ChatIcon',
);
export const SearchIcon = icon(
  Search,
  { size: 18, color: colors.muted, strokeWidth: 2 },
  'SearchIcon',
);
export const PencilIcon = icon(
  Pencil,
  { size: 18, color: colors.ink, strokeWidth: 1.9 },
  'PencilIcon',
);
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
