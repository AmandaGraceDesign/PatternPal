import { describe, it, expect } from 'vitest';
import {
  DEFAULT_WATERMARK,
  computeLogoRect,
  computeBannerBandHeight,
  computeBannerBandRect,
  computeBannerContentLayout,
} from '../lib/watermark/watermark';

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

describe('computeBannerBandHeight', () => {
  it('sizes to the taller of logo vs text, plus padding', () => {
    // logo 120 tall vs text 30+20+4=54 → 120 + 2*16 = 152
    expect(computeBannerBandHeight(120, 30, 20, true, true, 16, 4)).toBe(152);
    // text taller than logo: logo 40 vs 30+20+4=54 → 54 + 32 = 86
    expect(computeBannerBandHeight(40, 30, 20, true, true, 16, 4)).toBe(86);
  });
});

describe('computeBannerBandRect — full-width band at anchorV', () => {
  const W = 1000, H = 800, bh = 150;
  it('top', () => expect(computeBannerBandRect(W, H, 'top', bh)).toEqual({ x: 0, y: 0, width: W, height: bh }));
  it('bottom', () => expect(computeBannerBandRect(W, H, 'bottom', bh)).toEqual({ x: 0, y: H - bh, width: W, height: bh }));
  it('middle', () => expect(computeBannerBandRect(W, H, 'middle', bh)).toEqual({ x: 0, y: Math.round((H - bh) / 2), width: W, height: bh }));
});

describe('computeBannerContentLayout', () => {
  const band = { x: 0, y: 650, width: 1000, height: 150 };
  it('center = logo centered, no text', () => {
    const r = computeBannerContentLayout(band, 'center', 200, 100, true, 16, 16);
    expect(r.text).toBeNull();
    expect(r.logo.x).toBe(Math.round(band.x + (band.width - 200) / 2));
  });
  it('left = logo at left, text to its right, left-aligned', () => {
    const r = computeBannerContentLayout(band, 'left', 200, 100, true, 16, 16);
    expect(r.logo.x).toBe(16);
    expect(r.text).not.toBeNull();
    expect(r.text!.align).toBe('left');
    expect(r.text!.x).toBe(16 + 200 + 16);
  });
  it('right = logo at right, text to its left, right-aligned', () => {
    const r = computeBannerContentLayout(band, 'right', 200, 100, true, 16, 16);
    expect(r.logo.x).toBe(1000 - 16 - 200);
    expect(r.text!.align).toBe('right');
    expect(r.text!.x).toBe((1000 - 16 - 200) - 16);
  });
});
