import { describe, it, expect } from 'vitest';
import { DEFAULT_WATERMARK, computeLogoRect } from '../lib/watermark/watermark';

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

describe('computeLogoRect — 9-point logo placement', () => {
  const W = 1000, H = 800, lw = 200, lh = 100, m = 32;
  it('center+bottom matches the legacy formula', () => {
    expect(computeLogoRect(W, H, lw, lh, 'center', 'bottom', m))
      .toEqual({ x: Math.round((W - lw) / 2), y: H - lh - m });
  });
  it('places left+top at the margin', () => {
    expect(computeLogoRect(W, H, lw, lh, 'left', 'top', m)).toEqual({ x: m, y: m });
  });
  it('places right+middle correctly', () => {
    expect(computeLogoRect(W, H, lw, lh, 'right', 'middle', m))
      .toEqual({ x: W - lw - m, y: Math.round((H - lh) / 2) });
  });
});
