# Handoff — Mockup Modal Performance Pass (DONE)

**Updated:** 2026-06-13 · **Branch:** `feat/mockup-social-exports` · **HEAD:** `f0de5bd`

## Status: COMPLETE — committed, NOT merged
All 10 perf-audit findings implemented + one UX tweak, in a single commit (`f0de5bd`).
Gate green: `npx tsc --noEmit` = 0, `npx vitest run` = 80/80. Manual browser UAT passed by Mandy
("working great"). Dev server was running at localhost:3000 / 10.0.0.144:3000 (iPad).

## What shipped (7 files, +~360/−145)
- **P1 color-mask cache** `MockupPipeline.ts` — new `colorOverlayMaskCache` WeakMap +
  `getColorOverlayMaskCanvas` (mirrors `getAlphaMaskCanvas`). Cached at natural size; 3 downstream
  `destination-in` draws now scale to `width,height`. Killed the 13.5M-px per-render loop.
- **P1 download warm-cache** — new exported `preloadTemplateImages(template, {preview?})` in
  `MockupRendererV2.tsx`; both hosts call it (full-res) on modal open.
- **P2 grid re-renders** — `MockupDownloadMenu.tsx` split into `React.memo` `MockupDownloadRow`
  (primitive props) + memoized size list + `React.memo` menu. Hosts pass `useCallback`'d
  `handleToggleSocialSize` / `handleDownloadMenuLockedClick`. `MockupRendererV2` dep-signatures
  `useMemo`'d (kills slice()-churn re-fires).
- **P3** — JPEG `toBlob`+objectURL snapshot (revoked on replace/unmount, both hosts); reused 1×1
  `willReadFrequently` hit-test canvas; parallel `Promise.all` export encode (`mockupSocialExport.ts`);
  gallery `onPointerEnter` medium preload (`MockupGalleryModal.tsx`).
- **UX** — `handleToggleSocialSize` now calls `setActiveSlug(slug)` so checking a size pops the crop
  slider immediately (both hosts).

## Deliberate deviation
P2 "extract memoized modal-body child" was delivered as per-row memo + useCallback + dep-sig
memoization, NOT a wholesale IIFE→component extraction (high regression risk vs the just-shipped
live-preview feature, marginal gain once snapshot is cheap). Revisit only if profiling still shows
control-bar churn.

## Open / next
- **Not merged.** `feat/mockup-social-exports` has the whole live-preview + crop + perf stack.
- Deferred bug (pre-existing): non-2:3 templates (curtain 0.8, tea-towel/silk-scarf ~0.671) show a
  slightly misaligned crop frame — overlay hardcodes `MOCKUP_SRC_ASPECT=2/3`. Fix = thread real
  `srcW/srcH` into `computePreviewCropFractions` (`src/lib/export/cropFraming.ts`).
- Two near-identical hosts (`AdvancedToolsBar` + `ActionsSidebar`) still share a duplicated modal
  body — keep in sync; `AdvancedToolsBar` uniquely has the scale control + renderTile debounce.
