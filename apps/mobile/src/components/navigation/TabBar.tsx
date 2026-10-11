import type { BottomTabBarProps } from 'expo-router/tabs';
import { router } from 'expo-router';
import type { ComponentType } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  CalendarIcon,
  CompassIcon,
  PeopleIcon,
  PersonIcon,
  PlusIcon,
  PressableScale,
  selectionHaptic,
} from '@/components/ui';
import { colors, TAB_BAR_HEIGHT } from '@/theme';

const TABS: Record<string, { label: string; Icon: ComponentType<{ color?: string }> }> = {
  index: { label: 'Discover', Icon: CompassIcon },
  activities: { label: 'Activities', Icon: CalendarIcon },
  communities: { label: 'Communities', Icon: PeopleIcon },
  profile: { label: 'Profile', Icon: PersonIcon },
};

/** Five-slot tab bar with the lime "new activity" button in the middle. */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  const items = state.routes.map((route, index) => {
    const tab = TABS[route.name];
    if (!tab) return null;
    const focused = state.index === index;
    const color = focused ? colors.lime : colors.muted;
    const onPress = () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });
      if (!focused && !event.defaultPrevented) {
        selectionHaptic();
        navigation.navigate(route.name, route.params);
      }
    };
    return (
      <PressableScale
        key={route.key}
        onPress={onPress}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={tab.label}
        scale="strong"
        className="min-w-0 flex-1 items-center gap-[5px]"
      >
        {/* No hop: tabs are tapped dozens of times a day; the colour says which is on. */}
        <tab.Icon color={color} />
        {/* One line always: shrinks a little rather than wrap ("Communitie/s"),
            e.g. with a larger system text size. */}
        <Text
          className="font-sans-medium text-[12px]"
          style={{ color }}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          maxFontSizeMultiplier={1.3}
        >
          {tab.label}
        </Text>
      </PressableScale>
    );
  });

  return (
    <View
      className="flex-row items-start border-t border-line bg-tab-bar px-1 pt-2.5"
      style={{ height: TAB_BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom }}
    >
      {items.slice(0, 2)}
      {/* Fixed width, so the four tabs share the rest and "Communities" fits. */}
      <View className="w-[68px] items-center">
        <PressableScale
          onPress={() => router.push('/create')}
          accessibilityRole="button"
          accessibilityLabel="New activity"
          haptic="light"
          scale="strong"
          className="-mt-1.5 h-[58px] w-[58px] items-center justify-center rounded-[19px] bg-lime"
          style={{
            shadowColor: colors.lime,
            shadowOpacity: 0.35,
            shadowRadius: 11,
            shadowOffset: { width: 0, height: 0 },
            elevation: 6,
          }}
        >
          <PlusIcon />
        </PressableScale>
      </View>
      {items.slice(2)}
    </View>
  );
}
