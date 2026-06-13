# Handoff — Mockup Modal Performance Pass

**Created:** 2026-06-12 · **Branch:** `feat/mockup-social-exports` · **HEAD:** `0f3fbc3` (clean tree)

## Context
The live-preview + Model-A crop feature just shipped (7 commits `54e9cd7..0f3fbc3`, reviewed,
gate green, manual UAT passed by Mandy — "working great"). NOT merged yet. Next ask: **make the
mockup modal feel quicker.** A read-only perf audit is already done; this session is to IMPLEMENT it.

Full findings: `.claude/.../memory/mockup_modal_perf_audit.md` (also summarized below).

## Start here
1. `git status` should be clean on `feat/mockup-social-exports`. Baseline: `npx tsc --noEmit` (0),
   `npx vitest run` (80/80 pass).
2. **Brainstorm/confirm scope first** — Mandy may want only the two quick wins, not all 10.
   Recommend doing P1+P1+P3-snapshot first (biggest win/effort), measure, then decide.
3. Mobile/iPad parity is mandatory (Pointer Events + `touch-action:none`) — any change must hold on touch.

## Prioritized fixes (impact-ordered)
- **P1 Color-overlay mask recomputed every render** `src/lib/mockups/MockupPipeline.ts:484-507`.
  13.5M-px getImageData+JS loop per preview render on onesie/wrapping-paper/curtain. Cache in the
  existing `alphaMaskCache` WeakMap keyed by `colorOverlayMaskImage`, mirror `getAlphaMaskCanvas`. **(S, do first)**
- **P1 Download freezes UI** `src/components/layout/AdvancedToolsBar.tsx:856-857` + MockupPipeline.
  `isCapturingFullRes` cold-decodes ~50-80MB full PNGs synchronously. Warm cache on modal open, or
  export social sizes from the medium preview canvas (they cover-crop downscale anyway). **(M)**
- **P3 Snapshot PNG `toDataURL` every 350ms** `AdvancedToolsBar.tsx:192`, `ActionsSidebar.tsx:90`.
  Swap to `toBlob(...,'image/jpeg',0.8)` + `URL.createObjectURL` (revoke prior). Thumbs are 64px. **(S, do with P1)**
- **P2 Whole modal subtree re-renders** on every drag/offset/snapshot — inline IIFE body in both
  hosts (`AdvancedToolsBar.tsx:523-883`, `ActionsSidebar.tsx:445-728`). Extract memoized modal-body
  child, `React.memo` MockupDownloadMenu, `useCallback` renderer props. **(M)**
- **P2 Crop-bar drag re-renders 16-thumbnail grid** `AdvancedToolsBar.tsx:868-875`. React.memo menu + per-row. **(S/M)**
- **P2 `JSON.stringify(patternOffsets)` deps every render** `MockupRendererV2.tsx:337-343`. useMemo signatures. **(S)**
- **P3** image preload on gallery hover (`MockupRendererV2.tsx:201-239`); reuse 1×1 hit-test canvas
  (`MockupRendererV2.tsx:355-364`); export double-encode/serial sizes (`mockupSocialExport.ts:105-167`).

**If only one thing:** P1 color-mask WeakMap cache + P3 JPEG snapshot.

## Watch out for
- Two consumers (`ActionsSidebar` + `AdvancedToolsBar`) share a near-identical modal body — keep
  them in sync; AdvancedToolsBar uniquely has the scale control + `renderTileWidth/Height` debounce.
- Snapshot selector `[data-mockup-modal] canvas` (the `.mockup-canvas` half is dead — safe to drop).
- Verify each change: tsc + vitest green, then `npm run dev` and feel drag/scale/download on a
  color-overlay template (onesie) AND a 2:3 + a non-2:3 (curtain) template.

## Also open (separate, lower priority)
Non-2:3 templates (curtain 0.8, tea-towel/silk-scarf ~0.671) show a visibly misaligned crop frame —
overlay hardcodes `MOCKUP_SRC_ASPECT=2/3` while export uses real src dims. Deferred. Fix = thread
real `srcW/srcH` into `computePreviewCropFractions` (`src/lib/export/cropFraming.ts`).
