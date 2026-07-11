import { describe, it, expect } from 'vitest';
import { DEFAULT_WATERMARK } from '../lib/watermark/watermark';

describe('WATERMARK: default config preserves legacy behavior', () => {
  it('defaults to simple-logo mode anchored center+bottom', () => {
    expect(DEFAULT_WATERMARK.mode).toBe('logo');
    expect(DEFAULT_WATERMARK.anchorH).toBe('center');
    expect(DEFAULT_WATERMARK.anchorV).toBe('bottom');
  });
  it('defaults banner fields to empty / sensible band', () => {
    expect(DEFAULT_WATERMARK.bannerTitle).toBe('');
    expect(DEFAULT_WATERMARK.bannerSubtitle).toBe('');
    expect(DEFAULT_WATERMARK.bandColor).toBe('#ffffff');
    expect(DEFAULT_WATERMARK.bandOpacity).toBeGreaterThan(0);
    expect(DEFAULT_WATERMARK.bandOpacity).toBeLessThanOrEqual(1);
  });
});
