import { describe, expect, it, jest } from '@jest/globals';
import { Text } from 'react-native';

import { act, fireEvent, render, screen } from '@/test/native';
import { Sheet } from './Sheet';

describe('Sheet (drawer)', () => {
  it('opens, asks to close on a tap outside, and unmounts only after sliding away', async () => {
    jest.useFakeTimers();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const onClose = jest.fn();
    const onClosed = jest.fn();
    try {
      const ui = (open: boolean) => (
        <Sheet open={open} onClose={onClose} onClosed={onClosed}>
          <Text>Drawer body</Text>
        </Sheet>
      );
      const { rerender } = await render(ui(true));
      act(() => jest.advanceTimersByTime(600));
      expect(screen.getByText('Drawer body', { includeHiddenElements: true })).toBeTruthy();

      fireEvent.press(screen.getByLabelText('Close', { includeHiddenElements: true }));
      expect(onClose).toHaveBeenCalledTimes(1);

      // The parent closes it: still on screen while it animates out...
      rerender(ui(false));
      expect(screen.queryByText('Drawer body', { includeHiddenElements: true })).toBeTruthy();
      expect(onClosed).not.toHaveBeenCalled();
      // ...then gone, and onClosed fires.
      act(() => jest.advanceTimersByTime(600));
      expect(onClosed).toHaveBeenCalledTimes(1);
      expect(screen.queryByText('Drawer body', { includeHiddenElements: true })).toBeNull();

      const reanimated = warn.mock.calls.filter((args) => String(args[0]).includes('Reanimated'));
      expect(reanimated).toEqual([]);
    } finally {
      warn.mockRestore();
      jest.useRealTimers();
    }
  });
});
