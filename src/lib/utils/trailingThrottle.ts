export interface TrailingThrottle {
  /** Fire on the leading edge if idle; otherwise schedule one trailing call. */
  call: () => void;
  /** Drop any pending trailing call. */
  cancel: () => void;
}

/**
 * Leading + trailing throttle. The first `call()` runs `fn` synchronously; further
 * calls inside `ms` are coalesced into a single trailing `fn` run at the end of the
 * window. Used to keep `toDataURL` off the per-render hot path: thumbnails appear at
 * once, then update once after a drag/scale burst settles.
 */
export function createTrailingThrottle(fn: () => void, ms: number): TrailingThrottle {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let trailingQueued = false;

  const startWindow = () => {
    timer = setTimeout(() => {
      timer = null;
      if (trailingQueued) {
        trailingQueued = false;
        fn();
        startWindow(); // honor any calls that land during the trailing run's window
      }
    }, ms);
  };

  return {
    call() {
      if (timer === null) {
        fn();
        startWindow();
      } else {
        trailingQueued = true;
      }
    },
    cancel() {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      trailingQueued = false;
    },
  };
}
