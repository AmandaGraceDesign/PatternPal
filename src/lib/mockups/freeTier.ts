// src/lib/mockups/freeTier.ts
/**
 * Single source of truth for what the free tier (anonymous + signed-in free)
 * can use. The gate is *what's offered*, not a usage count: only these mockup
 * templates are openable/downloadable, and only this social size is exportable.
 * Logo watermark stays Pro-only; the PatternPAL badge stays permanent on free
 * output via shouldStampBadge().
 */
export const FREE_MOCKUP_IDS = [
  'onesie',         // Baby Onesie
  'throw-pillow',   // Throw Pillow
  'wallpaper',      // Entry Wallpaper ("bench wallpaper")
  'wrapping-paper', // Wrapping Paper (Gift Box)
] as const;

/** Slug from SOCIAL_SIZE_PRESETS in RepeatExportModal — the 1080×1080 square. */
export const FREE_SOCIAL_SIZE_SLUG = 'instagram-post';

export function isFreeMockup(id: string): boolean {
  return (FREE_MOCKUP_IDS as readonly string[]).includes(id);
}

export function isFreeSocialSize(slug: string): boolean {
  return slug === FREE_SOCIAL_SIZE_SLUG;
}
