/**
 * The one file to edit when a new batch of mockups ships.
 *
 * Bump `version` and everyone — including users who dismissed the previous
 * announcement — sees the new one on their next visit. Set `version` to null
 * to switch the announcement off without deleting anything.
 */
export const CURRENT_ANNOUNCEMENT = {
  version: '2026-08-seasonal',
  emoji: '🎃',
  title: 'New Seasonal Mockups',
  body: 'Seven new Halloween & autumn scenes are ready — drop your pattern straight onto them.',
  previewIds: ['halloween-cape', 'halloween-tumbler', 'halloween-bucket', 'halloween-cat-bandana'],
  moreNote: '…plus tea towel, doormat & leggings',
  ctaLabel: 'See All 7 Seasonal',
  ctaCategory: 'seasonal',
} as const satisfies {
  version: string | null;
  emoji: string;
  title: string;
  body: string;
  previewIds: readonly string[];
  moreNote: string;
  ctaLabel: string;
  ctaCategory: string;
};
