import { describe, it, expect } from 'vitest';
import { computeCoverCropRect } from '../lib/utils/mockupSocialExport';

// Source is the full-res mockup: 3000×4500 (2:3 portrait).
const SRC_W = 3000;
const SRC_H = 4500;

describe('computeCoverCropRect', () => {
  it('returns the full source when target matches source aspect (2:3)', () => {
    const r = computeCoverCropRect(SRC_W, SRC_H, 1000, 1500);
    expect(r).toEqual({ sx: 0, sy: 0, sWidth: 3000, sHeight: 4500 });
  });

  it('crops top/bottom for a square target (1:1)', () => {
    const r = computeCoverCropRect(SRC_W, SRC_H, 1000, 1000);
    // keep full width, crop height to 3000, center vertically
    expect(r).toEqual({ sx: 0, sy: 750, sWidth: 3000, sHeight: 3000 });
  });

  it('crops top/bottom harder for a wide target (2:1)', () => {
    const r = computeCoverCropRect(SRC_W, SRC_H, 2000, 1000);
    expect(r).toEqual({ sx: 0, sy: 1500, sWidth: 3000, sHeight: 1500 });
  });

  it('crops the sides for a tall target (1:2)', () => {
    const r = computeCoverCropRect(SRC_W, SRC_H, 1000, 2000);
    expect(r).toEqual({ sx: 375, sy: 0, sWidth: 2250, sHeight: 4500 });
  });

  it('offset 0 keeps the TOP band of a square crop (sy = 0)', () => {
    const r = computeCoverCropRect(SRC_W, SRC_H, 1000, 1000, 0);
    expect(r).toEqual({ sx: 0, sy: 0, sWidth: 3000, sHeight: 3000 });
  });

  it('offset 0.5 (default) centers a square crop (sy = 750)', () => {
    expect(computeCoverCropRect(SRC_W, SRC_H, 1000, 1000, 0.5))
      .toEqual({ sx: 0, sy: 750, sWidth: 3000, sHeight: 3000 });
    // omitting the arg must match the explicit 0.5
    expect(computeCoverCropRect(SRC_W, SRC_H, 1000, 1000))
      .toEqual(computeCoverCropRect(SRC_W, SRC_H, 1000, 1000, 0.5));
  });

  it('offset 1 keeps the BOTTOM band of a square crop (sy = 1500)', () => {
    const r = computeCoverCropRect(SRC_W, SRC_H, 1000, 1000, 1);
    expect(r).toEqual({ sx: 0, sy: 1500, sWidth: 3000, sHeight: 3000 });
  });

  it('offset interpolates continuously (0.25 → sy = 375)', () => {
    const r = computeCoverCropRect(SRC_W, SRC_H, 1000, 1000, 0.25);
    expect(r).toEqual({ sx: 0, sy: 375, sWidth: 3000, sHeight: 3000 });
  });

  it('clamps out-of-range offsets into [0,1]', () => {
    expect(computeCoverCropRect(SRC_W, SRC_H, 1000, 1000, -1).sy).toBe(0);
    expect(computeCoverCropRect(SRC_W, SRC_H, 1000, 1000, 2).sy).toBe(1500);
  });

  it('ignores the offset when the crop is horizontal (tall target)', () => {
    // 1:2 target crops the SIDES — vertical offset must be a no-op.
    const r = computeCoverCropRect(SRC_W, SRC_H, 1000, 2000, 1);
    expect(r).toEqual({ sx: 375, sy: 0, sWidth: 2250, sHeight: 4500 });
  });
});
