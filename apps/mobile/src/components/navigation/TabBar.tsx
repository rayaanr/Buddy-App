import type { BottomTabBarProps } from 'expo-router/tabs';
import { router } from 'expo-router';
import type { ComponentType, ReactNode } from 'react';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AnimatedView,
  CalendarIcon,
  CompassIcon,
  PeopleIcon,
  PersonIcon,
  PlusIcon,
  PressableScale,
  selectionHaptic,
} from '@/components/ui';
import { colors, TAB_BAR_HEIGHT } from '@/theme';
import { spring } from '@/theme/motion';

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
        scaleTo={0.92}
        className="flex-1 items-center gap-[5px]"
      >
        <TabIcon focused={focused}>
          <tab.Icon color={color} />
        </TabIcon>
        <Text className="font-sans-medium text-[12px]" style={{ color }}>
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
      <View className="flex-1 items-center">
        <PressableScale
          onPress={() => router.push('/create')}
          accessibilityRole="button"
          accessibilityLabel="New activity"
          haptic="light"
          scaleTo={0.9}
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

/** Gives the icon a small hop when its tab becomes the selected one. */
function TabIcon({ focused, children }: { focused: boolean; children: ReactNode }) {
  const lift = useSharedValue(0);
  useEffect(() => {
    if (focused)
      lift.set(withSequence(withSpring(-4, spring.snappy), withSpring(0, spring.bouncy)));
  }, [focused, lift]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: lift.get() }] }));
  return <AnimatedView style={style}>{children}</AnimatedView>;
}
