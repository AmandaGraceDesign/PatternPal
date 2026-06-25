import { describe, it, expect, afterEach } from 'vitest';
import {
  assertExportCanvasWithinLimits,
  IOS_CANVAS_MAX_SIDE,
  BROWSER_CANVAS_LIMIT,
} from '../lib/utils/imageUtils';

// isIOS() (in downloadCanvas.ts) reads navigator.userAgent, so we can flip the
// guard between its desktop and iPad branches by overriding the UA string.
const realUA = navigator.userAgent;
function setUserAgent(ua: string) {
  Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
}
afterEach(() => setUserAgent(realUA));

const DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120';
const IPAD_UA = 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605 Safari/604';

describe('assertExportCanvasWithinLimits', () => {
  it('allows a 12" @ 300 DPI tile (3600px) on iPad — the support-report case', () => {
    setUserAgent(IPAD_UA);
    expect(() => assertExportCanvasWithinLimits(3600, 3600)).not.toThrow();
  });

  it('blocks an 18" @ 300 DPI tile (5400px) on iPad with a friendly message', () => {
    setUserAgent(IPAD_UA);
    expect(() => assertExportCanvasWithinLimits(5400, 5400)).toThrow(/iPad/i);
  });

  it('blocks a 24" @ 300 DPI tile (7200px) on iPad', () => {
    setUserAgent(IPAD_UA);
    expect(() => assertExportCanvasWithinLimits(7200, 7200)).toThrow();
  });

  it('allows exactly the iPad ceiling (4096px) but blocks one past it', () => {
    setUserAgent(IPAD_UA);
    expect(() => assertExportCanvasWithinLimits(IOS_CANVAS_MAX_SIDE, IOS_CANVAS_MAX_SIDE)).not.toThrow();
    expect(() => assertExportCanvasWithinLimits(IOS_CANVAS_MAX_SIDE + 1, 100)).toThrow();
  });

  it('allows large desktop exports that would be blocked on iPad', () => {
    setUserAgent(DESKTOP_UA);
    expect(() => assertExportCanvasWithinLimits(7200, 7200)).not.toThrow();
  });

  it('still enforces the desktop browser ceiling', () => {
    setUserAgent(DESKTOP_UA);
    expect(() => assertExportCanvasWithinLimits(BROWSER_CANVAS_LIMIT + 1, 100)).toThrow();
  });
});
