import { describe, it, expect } from 'vitest';
import {
  deviceMaxExportInches,
  exportCanvasWithinLimits,
  IOS_CANVAS_MAX_SIDE,
  BROWSER_CANVAS_LIMIT,
} from '../lib/utils/imageUtils';

describe('deviceMaxExportInches — device canvas ceiling as a size cap', () => {
  it('caps the max export size at (iOS ceiling / dpi) on iPad', () => {
    // 4096 / 300 ≈ 13.65" — so 14"@300 (4200px) must be disallowed, 12" allowed.
    expect(deviceMaxExportInches(300, true)).toBeCloseTo(IOS_CANVAS_MAX_SIDE / 300);
    expect(deviceMaxExportInches(300, true)).toBeGreaterThanOrEqual(12);
    expect(deviceMaxExportInches(300, true)).toBeLessThan(14);
  });

  it('allows much larger sizes at 150 DPI on iPad', () => {
    // 4096 / 150 ≈ 27.3" — an 18" export at 150 DPI is well within the ceiling.
    expect(deviceMaxExportInches(150, true)).toBeCloseTo(IOS_CANVAS_MAX_SIDE / 150);
    expect(deviceMaxExportInches(150, true)).toBeGreaterThan(18);
  });

  it('uses the far larger desktop ceiling off iOS', () => {
    expect(deviceMaxExportInches(300, false)).toBeCloseTo(BROWSER_CANVAS_LIMIT / 300);
    expect(deviceMaxExportInches(300, false)).toBeGreaterThan(deviceMaxExportInches(300, true));
  });
});

describe('exportCanvasWithinLimits — non-throwing predicate', () => {
  it('rejects a canvas whose side exceeds the iPad ceiling', () => {
    // The reported repro: a 6250px-tall source / 18"@300 = 5400px output.
    expect(exportCanvasWithinLimits(5000, 6250, true)).toBe(false);
    expect(exportCanvasWithinLimits(4096, 5400, true)).toBe(false);
  });

  it('accepts a small scaled canvas on iPad (e.g. 10"@300 from the same source)', () => {
    // 10"@300 scaled ≈ 2000×2500 — comfortably under the ceiling.
    expect(exportCanvasWithinLimits(2000, 2500, true)).toBe(true);
  });

  it('accepts the same oversized-for-iPad canvas on desktop', () => {
    expect(exportCanvasWithinLimits(5000, 6250, false)).toBe(true);
  });
});
