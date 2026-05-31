// src/__tests__/freeTier.test.ts
import { describe, it, expect } from 'vitest';
import {
  FREE_MOCKUP_IDS,
  FREE_SOCIAL_SIZE_SLUG,
  isFreeMockup,
  isFreeSocialSize,
} from '../lib/mockups/freeTier';

describe('free-tier constants', () => {
  it('exposes exactly the four curated free mockups', () => {
    expect([...FREE_MOCKUP_IDS].sort()).toEqual(
      ['onesie', 'throw-pillow', 'wallpaper', 'wrapping-paper'].sort(),
    );
  });
  it('uses the Instagram square as the free social size', () => {
    expect(FREE_SOCIAL_SIZE_SLUG).toBe('instagram-post');
  });
});

describe('isFreeMockup', () => {
  it('returns true for a curated free template', () => {
    expect(isFreeMockup('onesie')).toBe(true);
    expect(isFreeMockup('wrapping-paper')).toBe(true);
  });
  it('returns false for a locked template', () => {
    expect(isFreeMockup('mens-tie')).toBe(false);
    expect(isFreeMockup('nursery-wallpaper')).toBe(false);
  });
});

describe('isFreeSocialSize', () => {
  it('only the Instagram square is free', () => {
    expect(isFreeSocialSize('instagram-post')).toBe(true);
    expect(isFreeSocialSize('story')).toBe(false);
    expect(isFreeSocialSize('pinterest-pin')).toBe(false);
  });
});
