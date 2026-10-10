import { describe, expect, it, jest } from '@jest/globals';

import { fireEvent, render, screen } from '@/test/native';
import { DatePickerSheet } from './DatePickerSheet';
import { TimePickerSheet } from './TimePickerSheet';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock('@/api/auth-client', () => ({ authClient: {}, sessionCookie: async () => null }));

const hidden = { includeHiddenElements: true };

describe('DatePickerSheet', () => {
  it('opens on the selected month, blocks days outside the range, and returns the picked day', async () => {
    const onChange = jest.fn();
    await render(
      <DatePickerSheet
        open
        onClose={() => {}}
        value="2026-10-16"
        min="2026-10-09"
        max="2027-01-07"
        onChange={onChange}
      />,
    );
    expect(screen.getByText('October 2026', hidden)).toBeTruthy();

    // Before today: disabled.
    expect(screen.getByLabelText('8 October', hidden).props.accessibilityState).toMatchObject({
      disabled: true,
    });
    fireEvent.press(screen.getByLabelText('20 October', hidden));
    expect(onChange).toHaveBeenCalledWith('2026-10-20');

    // Can't go back before this month; can go forward to the last allowed one.
    fireEvent.press(screen.getByLabelText('Previous month', hidden));
    expect(screen.getByText('October 2026', hidden)).toBeTruthy();
    for (let i = 0; i < 5; i++) fireEvent.press(screen.getByLabelText('Next month', hidden));
    expect(screen.getByText('January 2027', hidden)).toBeTruthy();
    expect(screen.getByLabelText('8 January', hidden).props.accessibilityState).toMatchObject({
      disabled: true,
    });
  });
});

describe('TimePickerSheet', () => {
  it('starts on the current time and returns what the wheels are turned to', async () => {
    const onChange = jest.fn();
    await render(<TimePickerSheet open onClose={() => {}} value="18:30" onChange={onChange} />);
    const hour = screen.getByLabelText('Hour', hidden);
    const minutes = screen.getByLabelText('Minutes', hidden);
    expect(hour.props.accessibilityValue).toEqual({ text: '18' });
    expect(minutes.props.accessibilityValue).toEqual({ text: '30' });

    // Screen readers turn a wheel one step at a time.
    const turn = (wheel: typeof hour, actionName: 'increment' | 'decrement') =>
      fireEvent(wheel, 'accessibilityAction', { nativeEvent: { actionName } });
    turn(hour, 'decrement');
    turn(minutes, 'increment');
    turn(minutes, 'increment');
    fireEvent.press(screen.getByText('Set 17:40', hidden));
    expect(onChange).toHaveBeenCalledWith('17:40');
  });
});
