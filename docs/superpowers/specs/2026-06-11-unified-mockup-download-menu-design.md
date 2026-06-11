# Unified Mockup Download Menu — Design

**Date:** 2026-06-11 · **Branch (current work):** `feat/mockup-social-exports` · **Status:** Approved design, awaiting implementation.

## Context

The clean-mockup → social-size export (feature shipped in `docs/superpowers/plans/2026-06-09-mockup-social-exports.md`, code complete on `feat/mockup-social-exports`) added a **"Share to social — clean mockup"** section to the Mockup Modal body. But the existing **full-size mockup download lives in the modal *header*** (top-right "Download" button). During Task 7 manual verification the user flagged a UX problem: the eye lands on the body "social export" section and never connects it to the header Download — two zones, two mental models, unclear that the header button is the "full-res single file" path.

**Goal:** Merge both into ONE selectable menu (EasyScale-style: a checklist of sizes + a single Download button), so "Full size" is just another selectable item. Reduces the two-zone disconnect to a single, scannable control.

This supersedes the body social-section UI and the header Download button introduced/used by the 2026-06-09 work. The underlying export helper and geometry are reused.

## Approved approach (Option A — one list, header button retired)

Replace **both** the header "Download" button and the body "Share to social" section with a single body section titled **"Download mockup"**:

```
DOWNLOAD MOCKUP
  [x] Full size        1500 × 2250
  [ ] Post             1080 × 1080
  [ ] Portrait         1080 × 1350
  [ ] Story / Reel     1080 × 1920
  [ ] Pinterest Pin    1000 × 1500
  [   Download (1 file)   ]      ← single PNG; zips when 2+ selected
```

### Behavior

1. **Size list** — same chip/row styling already used by the current social-size chips. Rows:
   - **Full size** — `1500×2250 @ 150 DPI`. The current header-Download output: downscale the full mockup canvas (3000×4500) by ½ and `injectPngDpi(150)`. **NOT cover-cropped** (it's the whole product shot). Labels show the *output* px (1500×2250), i.e. the post-downscale size.
   - **Post / Portrait / Story / Pinterest** — the existing `mockupSocialSizes()` presets, cover-cropped at 2× (Post 2160×2160, Portrait 2160×2700, Story 2160×3840, Pinterest 2000×3000). Row labels keep showing the platform preset px (1080×1080, etc.) as today.
   - **No Facebook Cover** (unchanged exclusion).

2. **One Download button** — label reflects count: `Download (1 file)` → a single PNG; `Download (N files)` → a single zip containing all selected. Mixing Full size + social sizes in one zip is allowed. Disabled when 0 selected or while capturing.

3. **Default selection** = `{ full-size }` when the Full size row is unlocked for the current template/user; if Full size is locked (free user on a Pro template), default to an empty selection. Reset to this default on template change and on modal close (replacing today's `setSocialSizes(new Set())` resets).

4. **Gating — preserved exactly, no new rules:**
   - **Full size** row: free when `isFreeMockup(selectedMockup)`; otherwise requires Pro (🔒 → `setIsUpgradeModalOpen(true)`). This is precisely today's header-`onDownload` guard (`if (!proAllowed && !isFreeMockup(selectedMockup)) → verifyProAccess()/upgrade`).
   - **Post (Square / `instagram-post`)**: free (`isFreeSocialSize`). **Portrait / Story / Pinterest**: 🔒 → upgrade when not Pro.
   - A Pro check still runs once before the actual render/download if any selected row needs Pro.

5. **Watermark + badge** apply to every produced file (already the case in the helper and the full-res path).

### Components / files

- **`src/lib/utils/mockupSocialExport.ts`** — teach the export path a `full-size` option. Recommended shape: extend the selection model so `downloadMockupSocialSizes` (or a thin wrapper) can handle a "full size" item that **skips cover-crop** and instead runs the existing downscale-½ + `injectPngDpi(150)` step, then the shared watermark→badge compositing, before joining the same single-file-vs-zip logic. Keep `computeCoverCropRect`/`coverCropToBlob`/`exportMockupSocialBlob` unchanged for the social presets. Define the `full-size` item as a distinct entry (e.g. a `slug: 'full-size'` preset or a discriminated option) rather than overloading a `SocialSizePreset` with a fake aspect — the geometry differs (no crop).
- **`src/lib/export/socialSizes.ts`** — add a `full-size` descriptor (slug + label + output px 1500×2250) and a helper that returns the ordered unified list `[full-size, ...mockupSocialSizes()]`. Keep `mockupSocialSizes()` as-is for any other caller.
- **`src/components/layout/AdvancedToolsBar.tsx`** — remove the `onDownload` wiring passed to `MockupModal`'s header Download; replace the body "Share to social" section (~lines 803-851) with the unified "Download mockup" list + single Download button. Reuse existing state (`socialSizes` Set, `downloadAfterRenderRef`, `setIsCapturingFullRes`, `isPro`, `proAllowed`, `verifyProAccess`, `setIsUpgradeModalOpen`, `watermark`, `badgeEnabled`) — extend the `SizeSlug` set to include `full-size`.
- **`src/components/sidebar/ActionsSidebar.tsx`** — apply the **identical** redesign (this is the mirror second entry point, ~lines 632-681 + its `onDownload`/`downloadAfterRenderRef` block).
- **`src/components/mockups/MockupModal.tsx`** — remove the header "Download" button (and its `onDownload`/`isDownloading` props if no longer used by either caller). Verify no other caller depends on them.

### Out of scope (unchanged from prior non-goals)

Background fill / transparent PNG, FB Cover clean-mockup, custom crop positioning, the Social Export modal's pattern composite. The **Task 6 signpost note** in `RepeatExportModal.tsx` stays (still correctly points pattern-exporters to the Mockup Modal). Don't push/merge — user verifies first.

## Testing / verification

- **Unit (Vitest):** any new pure helper (e.g. the unified-list builder, or a `full-size` branch that's pure) gets a test. Canvas output stays verified by running the app (jsdom can't rasterize), consistent with the existing approach.
- **Manual (desktop + iPad — ~half of users are iPad/Pencil):**
  - One unified "Download mockup" list is visible; the top-right header Download button is gone.
  - Full size checked by default (when unlocked) → one click downloads a single 1500×2250 @ 150 DPI PNG matching today's output (watermark/badge intact).
  - Select Full size + all social sizes → a single zip with all files at correct dims (Post 2160², Portrait 2160×2700, Story 2160×3840, Pinterest 2000×3000, Full 1500×2250). Social ones cover-cropped/no wallpaper/drag honored; Full size is the whole product shot.
  - Free user on a free template: Full size + Post selectable; Portrait/Story/Pinterest 🔒 → upgrade modal. Free user on a Pro template: Full size 🔒, default selection empty.
  - Both entry points (AdvancedToolsBar mockup modal AND ActionsSidebar mockup modal) behave identically.
  - Touch: rows toggle on tap, Download works, no hover-only affordances.
- **Gates:** `npx tsc --noEmit` clean, `npx vitest run` green, no new eslint warnings in touched files.
