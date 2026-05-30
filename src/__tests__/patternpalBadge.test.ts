import { describe, it, expect } from 'vitest';
import {
  pickBadgeVariant,
  computeBadgeRect,
  shouldStampBadge,
  BADGE_WIDTH_PERCENT,
} from '../lib/badge/patternpalBadge';

describe('pickBadgeVariant', () => {
  it('returns navy on a light background', () => {
    expect(pickBadgeVariant(0.9)).toBe('navy');
  });
  it('returns gold on a dark background', () => {
    expect(pickBadgeVariant(0.1)).toBe('gold');
  });
  it('returns navy exactly at the threshold boundary (0.5 is not > 0.5 -> gold)', () => {
    expect(pickBadgeVariant(0.5)).toBe('gold');
    expect(pickBadgeVariant(0.51)).toBe('navy');
  });
});

describe('computeBadgeRect', () => {
  it('sizes the badge to BADGE_WIDTH_PERCENT of canvas width and bottom-left insets it', () => {
    const aspect = 4; // 4:1 badge
    const rect = computeBadgeRect(1000, 1500, aspect);
    expect(rect.drawW).toBe(Math.round(1000 * BADGE_WIDTH_PERCENT));
    expect(rect.drawH).toBe(Math.round(rect.drawW / aspect));
    const inset = Math.round(1000 * 0.04);
    expect(rect.drawX).toBe(inset);
    expect(rect.drawY).toBe(1500 - inset - rect.drawH);
  });
});

describe('shouldStampBadge', () => {
  it('honors badgeEnabled for paid Pro users', () => {
    expect(shouldStampBadge({ isPaidPro: true, badgeEnabled: true })).toBe(true);
    expect(shouldStampBadge({ isPaidPro: true, badgeEnabled: false })).toBe(false);
  });
  it('forces the badge on for trial (non-paid) users regardless of toggle', () => {
    expect(shouldStampBadge({ isPaidPro: false, badgeEnabled: false })).toBe(true);
    expect(shouldStampBadge({ isPaidPro: false, badgeEnabled: true })).toBe(true);
  });
});
