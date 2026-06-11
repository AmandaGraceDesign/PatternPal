// src/lib/export/socialSizes.ts
// Single source of truth for social-media export size presets, shared by the
// Social Export modal (pattern graphics) and the Mockup Modal (clean product shots).

export type SizeSlug =
  | 'instagram-post'
  | 'instagram-portrait'
  | 'story'
  | 'pinterest-pin'
  | 'facebook-cover'
  | 'full-size';

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

/** Slug for the non-cropped, full-size mockup download (the whole product shot). */
export const FULL_SIZE_SLUG = 'full-size' as const;

/** Full-size mockup output: ½ of the 3000×4500 render = 1500×2250 @ 150 DPI.
 *  Deliberately NOT in SOCIAL_SIZE_PRESETS so the Social Export modal's size list is unaffected. */
export const FULL_SIZE_PRESET: SocialSizePreset = {
  slug: FULL_SIZE_SLUG,
  label: 'Full size',
  pxW: 1500,
  pxH: 2250,
};

/** Ordered list for the unified Mockup Modal download menu: Full size first, then the
 *  four croppable social sizes (no FB Cover). */
export function mockupDownloadSizes(): SocialSizePreset[] {
  return [FULL_SIZE_PRESET, ...mockupSocialSizes()];
}

/** Aspect of the full mockup render (3000×4500). */
export const MOCKUP_SRC_ASPECT = 2 / 3;

/** True when cover-cropping this size from the 2:3 mockup removes top/bottom — i.e.
 *  a vertical Top/Center/Bottom anchor changes the output. Square and Portrait only:
 *  Pinterest is the same 2:3 (no crop), Story crops the sides, Full size isn't cropped.
 *  Mirrors the taller-source branch of computeCoverCropRect. */
export function cropsVertically(preset: SocialSizePreset): boolean {
  if (preset.slug === FULL_SIZE_SLUG) return false;
  return MOCKUP_SRC_ASPECT < preset.pxW / preset.pxH;
}
