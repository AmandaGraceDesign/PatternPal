// src/lib/export/socialSizes.ts
// Single source of truth for social-media export size presets, shared by the
// Social Export modal (pattern graphics) and the Mockup Modal (clean product shots).

export type SizeSlug =
  | 'instagram-post'
  | 'instagram-portrait'
  | 'story'
  | 'pinterest-pin'
  | 'facebook-cover';

export interface SocialSizePreset {
  slug: SizeSlug;
  label: string;
  pxW: number;
  pxH: number;
}

export const SOCIAL_SIZE_PRESETS: SocialSizePreset[] = [
  { slug: 'instagram-post',     label: 'Instagram / Facebook Post',     pxW: 1080, pxH: 1080 },
  { slug: 'instagram-portrait', label: 'Instagram / Facebook Portrait', pxW: 1080, pxH: 1350 },
  { slug: 'story',              label: 'Story / Reel / TikTok',         pxW: 1080, pxH: 1920 },
  { slug: 'pinterest-pin',      label: 'Pinterest Pin',                 pxW: 1000, pxH: 1500 },
  { slug: 'facebook-cover',     label: 'Facebook Cover',                pxW: 1640, pxH: 624  },
];

/** Multiplier applied to preset pxW/pxH at export time (2× the platform size for
 *  anti-alias headroom; platforms recompress larger uploads). Matches the Social
 *  Export convention. */
export const SOCIAL_EXPORT_SCALE = 2;

/** Sizes NOT offered for clean-mockup export: a portrait 2:3 product cover-cropped
 *  into a wide banner shows only a horizontal sliver. */
export const MOCKUP_INELIGIBLE_SLUGS: SizeSlug[] = ['facebook-cover'];

/** Social sizes eligible for the clean-mockup export (all except FB Cover). */
export function mockupSocialSizes(): SocialSizePreset[] {
  return SOCIAL_SIZE_PRESETS.filter(p => !MOCKUP_INELIGIBLE_SLUGS.includes(p.slug));
}
