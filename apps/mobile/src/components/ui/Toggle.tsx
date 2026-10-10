import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { colors } from '@/theme';
import { spring } from '@/theme/motion';
import { selectionHaptic } from './Motion';

const TRACK_W = 50;
const TRACK_H = 30;
const KNOB = 24;
const PAD = (TRACK_H - KNOB) / 2;

interface ToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  /** Read by screen readers, e.g. "Group chat messages". */
  label: string;
  disabled?: boolean;
}

/**
 * On/off switch, drawn the same on iOS, Android and web: a light knob that
 * slides over a lime track when on, a dark one when off. (The system switch
 * can't be styled to match, and its knob vanished against the page.)
 */
export function Toggle({ value, onValueChange, label, disabled }: ToggleProps) {
  const knob = useAnimatedStyle(() => ({
    transform: [{ translateX: withSpring(value ? TRACK_W - KNOB - PAD * 2 : 0, spring.snappy) }],
  }));
  return (
    <Pressable
      onPress={() => {
        selectionHaptic();
        onValueChange(!value);
      }}
      disabled={disabled}
      role="switch"
      aria-checked={value}
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      hitSlop={8}
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <View
        style={{
          width: TRACK_W,
          height: TRACK_H,
          borderRadius: TRACK_H / 2,
          padding: PAD,
          backgroundColor: value ? colors.lime : colors.outline,
        }}
      >
        <Animated.View
          style={[
            {
              width: KNOB,
              height: KNOB,
              borderRadius: KNOB / 2,
              backgroundColor: '#ffffff',
              shadowColor: '#000',
              shadowOpacity: 0.35,
              shadowRadius: 3,
              shadowOffset: { width: 0, height: 1 },
              elevation: 3,
            },
            knob,
          ]}
        />
      </View>
    </Pressable>
  );
}
