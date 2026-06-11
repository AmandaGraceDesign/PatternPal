import { describe, it, expect } from 'vitest';
import {
  SOCIAL_SIZE_PRESETS,
  mockupSocialSizes,
  MOCKUP_INELIGIBLE_SLUGS,
  mockupDownloadSizes,
  FULL_SIZE_SLUG,
  FULL_SIZE_PRESET,
  cropsVertically,
} from '../lib/export/socialSizes';

describe('mockupSocialSizes', () => {
  it('excludes Facebook Cover', () => {
    const slugs = mockupSocialSizes().map(p => p.slug);
    expect(slugs).not.toContain('facebook-cover');
  });
  it('includes the four croppable sizes', () => {
    const slugs = mockupSocialSizes().map(p => p.slug);
    expect(slugs).toEqual([
      'instagram-post',
      'instagram-portrait',
      'story',
      'pinterest-pin',
    ]);
  });
  it('is exactly the presets minus the ineligible ones', () => {
    expect(mockupSocialSizes().length).toBe(
      SOCIAL_SIZE_PRESETS.length - MOCKUP_INELIGIBLE_SLUGS.length,
    );
  });
});

describe('mockupDownloadSizes', () => {
  it('lists Full size first, then the four croppable social sizes', () => {
    const slugs = mockupDownloadSizes().map(p => p.slug);
    expect(slugs).toEqual([
      'full-size',
      'instagram-post',
      'instagram-portrait',
      'story',
      'pinterest-pin',
    ]);
  });
  it('full-size descriptor outputs 1500×2250', () => {
    const full = mockupDownloadSizes().find(p => p.slug === FULL_SIZE_SLUG);
    expect(full).toBeDefined();
    expect([full!.pxW, full!.pxH]).toEqual([1500, 2250]);
  });
  it('does not leak full-size into the Social Export presets', () => {
    // SOCIAL_SIZE_PRESETS feeds the (separate) Social Export modal — must stay 5 platform sizes.
    expect(SOCIAL_SIZE_PRESETS.map(p => p.slug)).not.toContain('full-size');
  });
});

describe('cropsVertically', () => {
  const bySlug = (slug: string) =>
    mockupDownloadSizes().find(p => p.slug === slug)!;

  it('is true for square (instagram-post) — crops top/bottom', () => {
    expect(cropsVertically(bySlug('instagram-post'))).toBe(true);
  });

  it('is true for portrait (instagram-portrait)', () => {
    expect(cropsVertically(bySlug('instagram-portrait'))).toBe(true);
  });

  it('is false for pinterest-pin — same 2:3 as source, no crop', () => {
    expect(cropsVertically(bySlug('pinterest-pin'))).toBe(false);
  });

  it('is false for story — crops sides, not top/bottom', () => {
    expect(cropsVertically(bySlug('story'))).toBe(false);
  });

  it('is false for full size — never cropped', () => {
    expect(cropsVertically(FULL_SIZE_PRESET)).toBe(false);
  });
});
