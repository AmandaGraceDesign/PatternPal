import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTrailingThrottle } from '../lib/utils/trailingThrottle';

describe('createTrailingThrottle', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('fires immediately on the first call (leading edge)', () => {
    const fn = vi.fn();
    const t = createTrailingThrottle(fn, 300);
    t.call();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('coalesces a burst into a single trailing call', () => {
    const fn = vi.fn();
    const t = createTrailingThrottle(fn, 300);
    t.call(); // leading -> 1
    t.call();
    t.call();
    t.call(); // still within window -> scheduled trailing
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(2); // one trailing
  });

  it('does not schedule a trailing call when only the leading call happened', () => {
    const fn = vi.fn();
    const t = createTrailingThrottle(fn, 300);
    t.call();
    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('cancel() drops a pending trailing call', () => {
    const fn = vi.fn();
    const t = createTrailingThrottle(fn, 300);
    t.call();
    t.call(); // schedules trailing
    t.cancel();
    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('re-arms the window after a trailing run to honor a call that lands during it', () => {
    const fn = vi.fn();
    const t = createTrailingThrottle(fn, 300);
    t.call(); // leading -> 1
    t.call(); // queues trailing
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(2); // trailing #1 fires, window re-arms
    t.call(); // lands during re-armed window -> queues another trailing
    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(3); // trailing #2 fires
    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(3); // chain terminates cleanly when idle
  });
});
