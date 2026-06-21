# HANDOFF — Pattern Preview INP Fix

**Date:** 2026-06-21
**Status:** Design approved + committed. Implementation NOT started.
**Pick up by:** reading the spec, then running `superpowers:writing-plans` to produce the implementation plan, then executing.

## Start here
1. Read the approved design spec (the source of truth):
   `docs/superpowers/specs/2026-06-21-pattern-preview-inp-fix-design.md` (commit `9290185`)
2. Invoke `superpowers:writing-plans` to turn it into an implementation plan.
3. Implement, then **verify with the measurement plan in the spec** (local INP via `web-vitals onINP` under 4–6× CPU throttle, target <200ms) before claiming done. Do not trust RUM immediately (multi-day lag).

## One-paragraph context
Vercel Speed Insights shows the root route `/` failing **INP** (816ms desktop / 1,224ms mobile; good <200ms). Everything else (FCP/LCP/CLS/TTFB) is green. `/` is the live pattern-tester canvas (NOT the mockup gallery, NOT a login page) — `app/page.tsx` → `PatternPreviewCanvas`. It's the same page signed-in or not. Root cause = main-thread render cost landing in the post-interaction paint window.

## Root cause (already investigated — don't re-derive)
1. **Loaded state:** `PatternTiler.drawTile()` (`src/lib/tiling/PatternTiler.ts:143-183`) does a high-quality `drawImage` downscale of the multi-MP source **per tile, per frame** (`PatternPreviewCanvas.tsx:302-303`), ×dpr² on iPad.
2. **Empty/landing state (most-visited, likely #1 RUM contributor):** placeholder path runs `toDataURL('image/png')` + double `Image` decode every zoom tick (`PatternPreviewCanvas.tsx:243-269`).
3. Prior rAF "coalescing" (`:277-334`) only cut frequency, not per-frame cost → still inside the INP presentation-delay window. **Failed fix — do not stack another patch on it.**
4. Compounders: ~190 `setZoom` reconciliations per slider drag (`PatternControlsTopBar.tsx:342`), `panX/panY` re-tiling from source (`:337`), canvas-size effect coupled to `tileWidth` (double re-tile), unused `tileHeight` dep, outline toggle triggers full re-tile.

## Approved approach ("cheap crisp frames")
- **Decision: always-crisp** (no CSS-transform soft-during-gesture). Make each crisp frame cheap instead.
- **Working-resolution source (new):** downsample source once on load to a capped working canvas (also shrinks iPad memory → helps the known iPad canvas-crash bug).
- **Pre-scaled tile cache (new):** rebuild one tile only when scale/image/repeat changes; tile via cheap blits — extend existing `PatternTiler.renderPreScaled()` (`:107-141`) with a pan offset.
- **Pan never re-tiles from source** (re-blit at offset); remove `panX/panY` from heavy trigger.
- **Ref-driven zoom/pan during gestures**, commit React state on gesture-end (kills the reconciliation storm).
- **Delete the landing `toDataURL` path**; pre-scale placeholder once, blit.
- **Correctness fixes (in scope):** pinch rAF-throttle + share slider 10–200% clamp (single-sourced zoom); commit scale/dimension/DPI inputs on blur/Enter not per keystroke; scale-preview must not lock zoom on first digit; tile-outline as a cheap overlay pass.

## Invariants (don't regress)
Never blank the canvas; keep CLS ≈ 0 (overlay-only feedback); keep export/download via `canvasRef` working (stay main-thread, no worker this pass); free-test + signup/checkout flows untouched; pattern output pixel-identical (verify edge-clip parity across all 3 repeat types).

## Explicitly OUT of scope (sequenced follow-up; iPad pan = #1)
iPad one-finger pan (currently no touch pan — `PatternPreviewCanvas.tsx:58` exits early), ≥44px touch targets, keyboard zoom/pan, canvas aria + aria-live, prefers-reduced-motion, honest zoom-% label.

## Files in play
`app/page.tsx`, `src/components/canvas/PatternPreviewCanvas.tsx`, `src/lib/tiling/PatternTiler.ts`, `src/components/layout/PatternControlsTopBar.tsx`.
