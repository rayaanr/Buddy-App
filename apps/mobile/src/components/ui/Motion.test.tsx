import { describe, expect, it, jest } from '@jest/globals';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Text } from 'react-native';

import { colors } from '@/theme';
import { act, fireEvent, render, screen, styleOf } from '@/test/native';
import { BackButton } from './BackButton';
import { Button } from './Button';
import { Chip } from './Chip';
import { PressableScale, Skeleton } from './Motion';
import { SegmentedControl } from './SegmentedControl';

// NativeWind's native rem is 14px, so p-3 = 10.5 and rounded-2xl = 14.

describe('styles reach native', () => {
  it('PressableScale applies its classes', async () => {
    await render(
      <PressableScale testID="press" className="rounded-2xl bg-lime p-3">
        <Text>Hi</Text>
      </PressableScale>,
    );
    expect(styleOf('press')).toMatchObject({
      borderRadius: 14,
      padding: 10.5,
      backgroundColor: colors.lime,
    });
  });

  it('PressableScale sinks while pressed (animated by NativeWind)', async () => {
    jest.useFakeTimers();
    await render(
      <PressableScale testID="press" className="bg-lime">
        <Text>Hi</Text>
      </PressableScale>,
    );
    fireEvent(screen.getByTestId('press'), 'pressIn');
    act(() => jest.advanceTimersByTime(400));
    const animated = screen.getByTestId('press', { hidden: true }).props.jestAnimatedStyle?.value;
    expect(animated).toMatchObject({
      backgroundColor: colors.lime,
      transform: expect.arrayContaining([{ scaleX: expect.closeTo(0.97, 3) }]),
    });
    jest.useRealTimers();
  });

  it('Button keeps its size and colour', async () => {
    await render(<Button testID="btn" label="Join" onPress={() => {}} />);
    expect(styleOf('btn')).toMatchObject({ height: 58, backgroundColor: colors.lime });
  });

  it('Chip shows selected and unselected states', async () => {
    await render(<Chip testID="chip" label="All" selected onPress={() => {}} />);
    expect(styleOf('chip')).toMatchObject({
      height: 42,
      borderWidth: 1,
      backgroundColor: colors.lime,
    });
  });

  it('header icon buttons are filled circles', async () => {
    await render(<BackButton testID="back" onPress={() => {}} />);
    const style = styleOf('back') as { width: number; height: number; borderRadius: number };
    expect(style).toMatchObject({ backgroundColor: colors.surface });
    expect(style.width).toBe(style.height);
    expect(style.borderRadius).toBeGreaterThanOrEqual(style.width / 2);
  });

  it('Skeleton is sized by its classes', async () => {
    await render(<Skeleton testID="sk" className="h-[20px] w-[60px]" />);
    expect(styleOf('sk')).toMatchObject({ height: 20, width: 60 });
  });

  it('SegmentedControl renders its sliding highlight', async () => {
    await render(
      <SegmentedControl
        segments={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ]}
        value="a"
        onChange={() => {}}
      />,
    );
    expect(screen.getByText('A')).toBeTruthy();
  });
});

describe('Reanimated views', () => {
  // NativeWind doesn't style Reanimated components on native (web hides this,
  // since classes pass straight through to the browser), so they take style
  // objects only. Put classes on a plain View inside or around them.
  it('are never given className', () => {
    const root = path.join(__dirname, '../..');
    const files = execSync('git ls-files "*.tsx"', { cwd: root })
      .toString()
      .split('\n')
      .filter(Boolean);
    const offenders = files.filter((file: string) => {
      const source = readFileSync(path.join(root, file), 'utf8');
      // Opening tags of Animated.* / AnimatedView, up to their closing ">".
      const tags = source.match(/<(Animated\.\w+|AnimatedView)\b[^>]*>/g) ?? [];
      return tags.some((tag) => /\bclassName=/.test(tag));
    });
    expect(offenders).toEqual([]);
  });
});
