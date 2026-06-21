import { describe, it, expect } from 'vitest';
import { computeWorkingSourceSize } from '../lib/tiling/workingSource';

describe('computeWorkingSourceSize', () => {
  it('never upsamples the source (caps at natural size)', () => {
    // need is larger than natural -> clamp to natural
    const r = computeWorkingSourceSize(2700, 2700, 4000, 4000, 1.15);
    expect(r.width).toBe(2700);
    expect(r.height).toBe(2700);
  });

  it('downsamples a high-res source to ~the needed device size + safety headroom', () => {
    // natural 5400, need 3000 device px, safety 1.15 -> ~3450
    const r = computeWorkingSourceSize(5400, 5400, 3000, 3000, 1.15);
    expect(r.width).toBe(Math.round(5400 * Math.min(1, (3000 * 1.15) / 5400)));
    expect(r.width).toBeLessThan(5400);
    expect(r.width).toBeGreaterThanOrEqual(3000); // covers the tile with headroom
  });

  it('preserves aspect ratio using the larger of the two dimension ratios', () => {
    // wide source, square need -> height need binds, both dims scaled together
    const r = computeWorkingSourceSize(4000, 2000, 1000, 1000, 1.0);
    expect(r.width / r.height).toBeCloseTo(2, 5);
    // height need (1000) is the binding constraint -> scale = 1000/2000 = 0.5
    expect(r.height).toBe(1000);
    expect(r.width).toBe(2000);
  });

  it('clamps to at least 1px', () => {
    const r = computeWorkingSourceSize(100, 100, 0, 0, 1.15);
    expect(r.width).toBeGreaterThanOrEqual(1);
    expect(r.height).toBeGreaterThanOrEqual(1);
  });
});
