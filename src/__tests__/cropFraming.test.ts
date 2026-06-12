import { describe, it, expect } from 'vitest';
import { computePreviewCropFractions } from '../lib/export/cropFraming';
import {
  SOCIAL_SIZE_PRESETS,
  FULL_SIZE_PRESET,
  type SocialSizePreset,
} from '../lib/export/socialSizes';

const preset = (slug: string): SocialSizePreset =>
  SOCIAL_SIZE_PRESETS.find(p => p.slug === slug)!;

describe('computePreviewCropFractions', () => {
  it('square (1:1) is a vertical crop: full width, height slides with offset', () => {
    const r = computePreviewCropFractions(preset('instagram-post'), 0.5);
    expect(r.mode).toBe('vertical');
    expect(r.widthFraction).toBeCloseTo(1, 5);
    expect(r.leftFraction).toBeCloseTo(0, 5);
    expect(r.heightFraction).toBeCloseTo(2 / 3, 5);
    expect(r.travel).toBeCloseTo(1 / 3, 5);
    expect(r.topFraction).toBeCloseTo((1 / 3) * 0.5, 5);
  });

  it('square offset 0 pins the box to the top, offset 1 to the bottom', () => {
    expect(computePreviewCropFractions(preset('instagram-post'), 0).topFraction).toBeCloseTo(0, 5);
    expect(computePreviewCropFractions(preset('instagram-post'), 1).topFraction).toBeCloseTo(1 / 3, 5);
  });

  it('portrait (4:5) is a vertical crop with a taller box than square', () => {
    const r = computePreviewCropFractions(preset('instagram-portrait'), 0.5);
    expect(r.mode).toBe('vertical');
    expect(r.heightFraction).toBeCloseTo((2 / 3) / 0.8, 5); // 0.8333…
    expect(r.travel).toBeCloseTo(1 - (2 / 3) / 0.8, 5);
  });

  it('story (9:16) is a horizontal crop: full height, centered narrower band, no travel', () => {
    const r = computePreviewCropFractions(preset('story'), 0.5);
    expect(r.mode).toBe('horizontal');
    expect(r.heightFraction).toBeCloseTo(1, 5);
    expect(r.topFraction).toBeCloseTo(0, 5);
    expect(r.travel).toBeCloseTo(0, 5);
    expect(r.widthFraction).toBeCloseTo((1080 / 1920) / (2 / 3), 5); // 0.84375
    expect(r.leftFraction).toBeCloseTo((1 - (1080 / 1920) / (2 / 3)) / 2, 5);
  });

  it('pinterest (2:3) matches the source — no crop, whole frame', () => {
    const r = computePreviewCropFractions(preset('pinterest-pin'), 0.5);
    expect(r.mode).toBe('none');
    expect(r.widthFraction).toBeCloseTo(1, 5);
    expect(r.heightFraction).toBeCloseTo(1, 5);
    expect(r.travel).toBeCloseTo(0, 5);
  });

  it('full-size is never cropped — whole frame', () => {
    const r = computePreviewCropFractions(FULL_SIZE_PRESET, 0.5);
    expect(r.mode).toBe('none');
    expect(r.widthFraction).toBeCloseTo(1, 5);
    expect(r.heightFraction).toBeCloseTo(1, 5);
  });
});
