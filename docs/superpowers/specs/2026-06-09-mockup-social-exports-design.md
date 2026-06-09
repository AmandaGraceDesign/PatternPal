# Clean Mockup → Social-Size Exports

**Date:** 2026-06-09
**Status:** Approved design, ready for planning
**Author:** Brainstormed with Claude (superpowers)

## Problem

The Social Export modal can only produce a **pattern fill** (optionally with a small mockup composited *on top of* the tiled pattern). There is no way to export **just the product mockup** — clean, full-frame, with a logo — across social-media sizes.

Two distinct problems surfaced during brainstorming:

1. **The gap (this spec fixes it):** No "clean mockup + logo, in social sizes" export exists anywhere. The mockup always sits on a pattern-fill background in Social Export.
2. **A hidden divergence bug (explicitly deferred — see Non-Goals):** When Social Export *does* composite a mockup overlay, it renders the pattern at the template **default position** and ignores the user's drag placement (`patternOffsets`). So the Social composite doesn't match what the user arranged in the Mockup Modal. This is moderate-impact (subtle for small all-over repeats, clearly wrong for large/placed motifs) and is **not** addressed here.

## Decision

Adopt a **clean split** of responsibilities, with a signpost:

- **Mockup Modal = the home for clean product shots.** It gains social-size exports of the product, cropped to fill, using the user's real drag placement.
- **Social Export Modal = pattern graphics (unchanged).** Keeps its existing pattern-fill + optional pattern+mockup "lifestyle" composite, exactly as-is. Adds a small note pointing users who want a clean full-size mockup to the Mockup Modal.

This was chosen over (A) leaving both fully overlapping, and (C) plumbing shared placement state into the Social composite. Rationale: clearest mental model ("one home per need"), least code, and it doesn't touch the working Social path. Revisit only if users complain.

## Scope

### In scope

1. **Mockup Modal social-size exports.** New export controls that produce the clean product mockup at these sizes:

   | Label | Dimensions | Ratio | Crop from 2:3 mockup |
   |---|---|---|---|
   | Square (IG/FB Post) | 1080×1080 | 1:1 | trims top/bottom |
   | Portrait (IG/FB) | 1080×1350 | 4:5 | trims top/bottom slightly |
   | Story / Reel / TikTok | 1080×1920 | 9:16 | trims sides slightly |
   | Pinterest Pin | 1000×1500 | 2:3 | none — exact |

   **FB Cover (1640×624) is intentionally excluded** — a portrait product cover-cropped into a wide banner shows only a horizontal sliver.

2. **Fit mode: crop-to-fill (cover), centered.** Scale the rendered mockup so it covers the target canvas, center it, crop the overflow. No background fill, no letterboxing.

3. **Layering:** logo watermark overlays the product (bottom-center) and the PatternPAL badge stamps (bottom-left), reusing the existing `applyWatermarkToBlob()` and `applyBadgeToBlob()` helpers.

4. **The existing full-resolution 2:3 product download stays** exactly as it is.

5. **Social Export modal note:** add static helper text near the mockup-overlay control — *"Want just the mockup at full size? Export it from the Mockup Modal."*

### Non-goals (deferred — revisit if complaints arrive)

- Solid-color / gradient backgrounds, brand-color picker, transparent-PNG export.
- FB Cover for the clean mockup.
- Fixing the Social composite's no-drag divergence bug (problem #2 above).
- Custom crop positioning (which slice of the product shows). Center-crop only.

## Free / Pro gating

Mirror the Social Export gating already defined in `src/lib/mockups/freeTier.ts`:

- **Free:** Square (1:1) only; free mockup templates only (`FREE_MOCKUP_IDS`); PatternPAL badge locked on; **no logo watermark**.
- **Pro:** all four sizes; any template; logo watermark; badge toggle.

The free social size today is `instagram-post` (1080×1080 square), which matches the Square option — consistent.

## Architecture

### Reuse, don't rebuild

The mockup is already rendered at full resolution (3000×4500) via the existing full-res capture path. The new work is a **post-render crop+resize step per selected size**, structurally parallel to how `generateSocialFillBlob()` produces social-sized pattern output.

Pipeline per selected size:

1. Render/capture the mockup at full res (existing path — `setIsCapturingFullRes(true)` → `MockupRendererV2` renders at full `maxRenderDimension`, honoring the user's `patternOffsets`).
2. Create a target canvas at **2× the platform size** (match Social Export's 2× anti-alias convention, `RepeatExportModal.tsx:93`).
3. Draw the full-res mockup with **cover-crop, centered**: scale = `max(targetW/srcW, targetH/srcH)`, center, clip to target bounds.
4. Apply watermark (Pro) then badge (`applyWatermarkToBlob` → `applyBadgeToBlob`).
5. Export PNG. (DPI metadata is irrelevant for social and can be omitted or left at a nominal value.)

### Shared size presets (focused refactor)

The five social size presets currently live inline in `RepeatExportModal.tsx:79–85`. Extract them into a shared module (e.g. `src/lib/export/socialSizes.ts`) as the single source of truth, with metadata indicating which sizes are eligible for clean-mockup export (all except FB Cover). Both modals import from it. This prevents the two modals from drifting.

### Two entry points — keep them consistent

The Mockup Modal download logic exists in **two** places:

- `src/components/layout/AdvancedToolsBar.tsx:488–566` (primary)
- `src/components/sidebar/ActionsSidebar.tsx:387–409` (alternative entry)

To avoid implementing the crop-to-fill export twice and letting them drift, **extract the social-size mockup export into a shared helper** (e.g. `src/lib/utils/mockupSocialExport.ts`) that takes the full-res mockup canvas/blob + target size + watermark/badge config and returns the cropped blob. Both entry points call it.

## Key existing code references

| Concern | Location |
|---|---|
| Mockup modal shell + Download button | `src/components/mockups/MockupModal.tsx:66–82` |
| Primary mockup export handler | `src/components/layout/AdvancedToolsBar.tsx:488–566` |
| Full-res capture trigger / `maxRenderDimension` | `src/components/layout/AdvancedToolsBar.tsx:816`, `818–824` |
| Watermark Pro-gating | `src/components/layout/AdvancedToolsBar.tsx:748–750` |
| Secondary export handler | `src/components/sidebar/ActionsSidebar.tsx:387–409` |
| Pattern drag placement (`patternOffsets`) | `src/components/mockups/MockupRendererV2.tsx:148`, `281–291` |
| Social size presets (to extract) | `src/components/export/RepeatExportModal.tsx:79–85` |
| Social export pipeline (parallel pattern) | `src/lib/utils/repeatFillExport.ts:256–323` |
| 2× scale convention | `src/components/export/RepeatExportModal.tsx:93` |
| Watermark apply | `src/lib/watermark/watermark.ts:139–165` |
| Badge apply / `shouldStampBadge` | `src/lib/badge/patternpalBadge.ts:88–117`, `19–21` |
| Free-tier gating constants | `src/lib/mockups/freeTier.ts:9–17` |
| Social modal note placement (mockup-overlay control) | `src/components/export/RepeatExportModal.tsx:856` (overlay), UI near the mockup toggle |

## Mobile / iPad parity

All new export controls must work with touch + Apple Pencil (≈half of users are on iPad). Use the existing button/control patterns already in the modals; no drag interactions are introduced by this feature (the export buttons are taps), so parity risk is low, but the new controls must be tested on touch.

## Testing / verification

- Each size produces a correctly-dimensioned PNG (Square 1080², Portrait 1080×1350, Story 1080×1920, Pinterest 1000×1500), cover-cropped and centered.
- The user's drag placement is reflected in the exported product (not template default).
- Logo appears only for Pro; badge always present for Free; Free limited to Square.
- Both entry points (AdvancedToolsBar, ActionsSidebar) produce identical output via the shared helper.
- FB Cover is not offered for clean-mockup export.
- Social Export modal still behaves exactly as before, now with the pointer note visible.
- Verified on touch (iPad) as well as desktop.
