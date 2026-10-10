import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';

import { useHasPassed } from './useNow';

describe('useHasPassed', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('is true straight away for a moment already past', () => {
    const { result } = renderHook(() => useHasPassed(new Date(Date.now() - 1000).toISOString()));
    expect(result.current).toBe(true);
  });

  it('flips once the moment arrives', () => {
    const at = new Date(Date.now() + 60_000).toISOString();
    const { result } = renderHook(() => useHasPassed(at));
    expect(result.current).toBe(false);
    act(() => jest.advanceTimersByTime(59_000));
    expect(result.current).toBe(false);
    act(() => jest.advanceTimersByTime(2_000));
    expect(result.current).toBe(true);
  });

  it('waits correctly past the ~24.8-day setTimeout limit', () => {
    const days = 40 * 24 * 60 * 60 * 1000;
    const at = new Date(Date.now() + days).toISOString();
    const { result } = renderHook(() => useHasPassed(at));
    act(() => jest.advanceTimersByTime(30 * 24 * 60 * 60 * 1000));
    expect(result.current).toBe(false);
    act(() => jest.advanceTimersByTime(11 * 24 * 60 * 60 * 1000));
    expect(result.current).toBe(true);
  });
});
