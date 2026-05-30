# Handoff: "Tested in PatternPAL" Badge

**Date:** 2026-05-30
**Status:** Shipped to `main` (committed + pushed). Manually verified in dev (social + Girls' Dress mockup).

## What shipped

A PatternPAL brand badge stamped onto **Social Media exports** and **Mockup downloads** only (never Easyscale/Cricut or Pattern Fill). Default-ON & removable for paid Pro; locked-on for trial users. Auto navy/gold by background contrast at export time. Fixed bottom-left, ~20% of canvas width.

## Files

- **`src/lib/badge/patternpalBadge.ts`** (new) — `shouldStampBadge`, `pickBadgeVariant`, `computeBadgeRect`, `sampleRegionLuminance`, `applyBadgeToBlob`. `BADGE_WIDTH_PERCENT = 0.2`, inset 4%, luminance threshold 0.5.
- **`src/components/badge/PatternpalBadgeToggle.tsx`** (new) — toggle row. Copy: "Your work passed a real Print Approval Lab — tested, scaled, seam-checked. Show it. Small credit, bottom-left, togglable per export." Trial: "Included on trial exports — upgrade to remove."
- **`src/components/badge/BadgePreviewOverlay.tsx`** (new) — live preview overlay, bottom-left, always **navy** (placement/size hint only).
- **`src/components/export/RepeatExportModal.tsx`** — added `isPro` prop; `badgeEnabled` state; stamp in social export loop (after watermark); toggle row; badge preview in `SocialPreviewSlide`.
- **`src/components/layout/AdvancedToolsBar.tsx`** — passes `isPro` to RepeatExportModal; `badgeEnabled` state; stamp in mockup `onDownload`; toggle row; preview overlay in canvas wrapper.
- **`src/components/sidebar/ActionsSidebar.tsx`** — same as AdvancedToolsBar (second mockup entry point).
- **`public/tested-in-patternpal-{navy,gold}.png`** — assets. `.zip` gitignored.

## Gating logic

`shouldStampBadge({ isPaidPro, badgeEnabled })` → trial (`!isPaidPro`) forced true; paid Pro honors the toggle. Call sites pass paid **`isPro`** (NOT `proAllowed`, which includes trials).

## Tests

`src/__tests__/patternpalBadge.test.ts` — 6 passing (pure functions only; canvas paths verified manually, per codebase convention). `npx tsc --noEmit` clean.

## Known limitations / follow-ups

1. **Preview color is always navy**; the **export** auto-picks navy/gold per the real background. On dark patterns the on-screen preview shows navy but the download is gold. If exact preview color is wanted, sample the preview canvas and switch the overlay variant.
2. **Mockup preview wrapper** uses `width: min(100%, calc(60vh * W/H))` + `aspectRatio` + `containerType: inline-size` to shrink-wrap the canvas (so the badge `cqw` anchors correctly and the canvas can't collapse). Watch this if mockup modal layout changes.
3. **Badge size/inset** are single constants in `patternpalBadge.ts` + matching `cqw` values in `BadgePreviewOverlay.tsx` — keep them in sync if tuned.
4. Not yet verified on a **landscape** mockup or on **iPad/touch** — recommended before wide release.

## Design docs

- Spec: `docs/superpowers/specs/2026-05-30-patternpal-badge-design.md`
- Plan: `docs/superpowers/plans/2026-05-30-patternpal-badge.md`
