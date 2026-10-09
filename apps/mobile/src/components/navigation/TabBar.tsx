import type { BottomTabBarProps } from 'expo-router/tabs';
import { router } from 'expo-router';
import type { ComponentType } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CalendarIcon, CompassIcon, PeopleIcon, PersonIcon, PlusIcon } from '@/components/ui';
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
      if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
    };
    return (
      <Pressable
        key={route.key}
        onPress={onPress}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={tab.label}
        className="flex-1 items-center gap-[5px]"
      >
        <tab.Icon color={color} />
        <Text className="font-sans-medium text-[12px]" style={{ color }}>
          {tab.label}
        </Text>
      </Pressable>
    );
  });

  return (
    <View
      className="flex-row items-start border-t border-line bg-tab-bar px-1 pt-2.5"
      style={{ height: TAB_BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom }}
    >
      {items.slice(0, 2)}
      <View className="flex-1 items-center">
        <Pressable
          onPress={() => router.push('/create')}
          accessibilityRole="button"
          accessibilityLabel="New activity"
          className="-mt-1.5 h-[58px] w-[58px] items-center justify-center rounded-[19px] bg-lime active:scale-95"
          style={{
            shadowColor: colors.lime,
            shadowOpacity: 0.35,
            shadowRadius: 11,
            shadowOffset: { width: 0, height: 0 },
            elevation: 6,
          }}
        >
          <PlusIcon />
        </Pressable>
      </View>
      {items.slice(2)}
    </View>
  );
}
