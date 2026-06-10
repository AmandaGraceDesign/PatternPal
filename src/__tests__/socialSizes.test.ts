import { describe, it, expect } from 'vitest';
import {
  SOCIAL_SIZE_PRESETS,
  mockupSocialSizes,
  MOCKUP_INELIGIBLE_SLUGS,
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
