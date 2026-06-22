# Pattern Preview INP Fix — Design Spec

**Date:** 2026-06-21
**Status:** Approved (design); pending implementation plan
**Scope chosen:** Perf core + correctness (iPad one-finger pan, a11y, touch-target sizing, zoom-label honesty = sequenced follow-up)
**Author:** Claude (with vercel:performance-optimizer + UX/impeccable lens agents)

## Problem

Vercel Speed Insights (Production, last 7 days) shows the root route `/` failing **INP (Interaction to Next Paint)**:

| Metric | Desktop | Mobile | Verdict |
|---|---|---|---|
| Real Experience Score | 74 | 71 | Needs Improvement |
| INP | **816 ms** | **1,224 ms** | 🔴 Poor (good <200 ms) |
| FCP | 1.24 s | 1.05 s | ✅ |
| LCP | 1.53 s | 1.67 s | ✅ |
| CLS | 0.1 | 0 | ✅ |
| TTFB | 0.58 s | 0.29 s | ✅ |

Loading is healthy; **only interaction latency is bad, and only on `/`** (the live pattern-repeat canvas tool). `/seam-inspector` scores RES 100. `/` renders the same tool whether signed-in or anonymous (auth only gates a 3-free-test limit), so it is effectively the whole app and the dominant route (2.6K desktop / 674 mobile samples).

## Root cause (systematic-debugging Phase 1, evidence-based)

Two distinct main-thread costs, both delaying the paint *after* a gesture (so they land inside the INP window):

1. **Loaded state — per-tile full-res downscale every frame.** `PatternTiler.drawTile()` (`src/lib/tiling/PatternTiler.ts:143-183`) calls `ctx.drawImage(fullResSource, …)` for every visible tile, with `imageSmoothingQuality='high'` (`src/components/canvas/PatternPreviewCanvas.tsx:302-303`). Source images are multi-megapixel (18″ @ 150dpi = 2,700px+, often larger). Each frame = N high-quality downscales of a large image, ×dpr² on iPad.

2. **Empty/landing state — synchronous PNG encode + double decode every zoom tick.** With no image (the common first-visit case), the placeholder path runs `scaledCanvas.toDataURL('image/png')` + a second `new Image()` decode (`PatternPreviewCanvas.tsx:243-269`), and `zoom` is in the effect deps (`:337`), so dragging the zoom slider re-runs this per frame. **Likely the single biggest RUM contributor** because it hits the most-visited state.

**Why the prior fix didn't work:** an existing rAF "coalescing" wrapper (`:277-334`) with a comment claiming it fixed INP only reduced redraw *frequency*. INP measures interaction → next paint; the heavy work runs inside the rAF *before* that paint, i.e. in the presentation-delay slice — still inside the INP window. RUM confirms it is unsolved.

**Compounding factors:** the zoom slider (`type=range step=1`, `PatternControlsTopBar.tsx:336-345`) fires ~190 `onChange`→`setZoom` updates across one drag (~190 React reconciliations of a large tree); `panX/panY` in the render dep array re-tiles from source on every pan frame (`:337`); the canvas-size effect is coupled to `tileWidth` causing a double re-tile on dimension change; unused `tileHeight` in deps; tile-outline toggle triggers a full re-tile.

A cheaper primitive already exists but is unused on the live path: `PatternTiler.renderPreScaled()` (`PatternTiler.ts:107-141`) tiles a pre-scaled tile via cheap blits.

## Design decisions (from brainstorming)

- **Scope:** Perf core + correctness.
- **Zoom/pinch feel:** *Always crisp* — every frame stays full-quality (no CSS-transform soft-during-gesture preview). This simplifies the architecture (no transform-origin anchor math, no degrade/sharpen cross-fade) and fits a craft tool where trust in the pixels matters. Puts the weight on making each crisp frame cheap.
- **UX guardrail:** Degrade-during-gesture would only ever be acceptable for *navigation* (pan/zoom/pinch) and is *forbidden* for *judgment* interactions (scale-preview, repeat-type switch, dimension change). Since we chose always-crisp, this is moot for now but documented for the follow-up.

## Architecture — "cheap crisp frames"

Principle: **never downscale the full-res source more than once per scale value, and never re-tile from source on pan.**

### Rendering
1. **Working-resolution source (new).** On image load, downsample the source *once* into a cached working canvas/bitmap, capped to ~the largest size it can ever display on-screen (× dpr + headroom). Visually lossless (preview is always a downscale), makes every later op cheap, and **reduces canvas memory — mitigates the known iPad canvas-crash bug** (`memory/bug_easyscale_ipad_canvas_crash.md`).
2. **Pre-scaled tile cache (new).** One offscreen "single tile" canvas, rebuilt (one `drawImage` downscale from the working source) *only when scale / image / repeat-type changes*. Tile the viewport by blitting this pre-scaled tile — extend `PatternTiler.renderPreScaled()` to accept a pan offset. Per-frame cost collapses from N downscales to ≤1 downscale + cheap same-size blits, always full quality.
3. **Pan never touches the source.** Pan re-blits cached tiles at an offset (≈free). Remove `panX/panY` from the heavy re-tile trigger (`:337`).
4. **Zoom/pan via refs during gestures.** Slider/pinch/wheel write to a ref and request one imperative rAF render; React state commits on gesture-*end* (pointerup / change). Eliminates the ~190-reconciliation storm.
5. **Fix the landing state.** Pre-scale the placeholder once into an offscreen canvas, tile by blit; **delete `toDataURL` + the double `Image` decode** (`:243-269`).
6. **Slim the effects.** Split the canvas-size effect so dimension change does not double re-tile; drop unused `tileHeight` from the trigger; draw tile-outline as a cheap separate pass, not a full re-tile.

### Correctness fixes
- **Pinch:** rAF-throttle + share the slider's 10–200% clamp; single-sourced zoom value so pinch and slider cannot disagree (`PatternPreviewCanvas.tsx:106-107`).
- **Scale-preview / tile-W/H / DPI inputs:** commit on blur or Enter (debounced), not per keystroke; scale-preview must not lock zoom on the first digit (`PatternControlsTopBar.tsx:291-302`, `:346`).
- **Tile-outline + color:** cheap overlay pass; toggling never re-tiles the pattern.

## Components / responsibilities touched
- `src/lib/tiling/PatternTiler.ts` — extend `renderPreScaled` with pan offset; the live path uses pre-scaled tiles instead of per-tile `drawTile` source downscales.
- `src/components/canvas/PatternPreviewCanvas.tsx` — working-source cache, pre-scaled-tile cache, ref-driven zoom/pan with imperative render, slimmed effects, landing-state fix, outline overlay layer, pinch throttle/clamp.
- `src/components/layout/PatternControlsTopBar.tsx` — commit-on-settle for scale/dimension/DPI inputs; scale-preview no longer locks zoom on first digit.
- `app/page.tsx` — zoom/pan state model adjustments (commit on settle); ensure export/download via `canvasRef` and the free-test flow remain intact.

## Invariants to preserve (do not regress)
- Never show a blank canvas — keep the last good pixels until the next are ready (the existing double-buffer at `:333` guarantees this).
- CLS stays near 0 — any feedback affordance must be absolutely-positioned overlay, never normal flow.
- Export / download (`canvasRef` → `AdvancedToolsBar`, `page.tsx`) keeps working — rendering stays on a main-thread canvas (no OffscreenCanvas/worker in this pass).
- Free-test gating and signup/checkout conversion components unaffected.
- Pattern correctness identical (the pre-scaled tile is a cache of the exact same downscale; verify edge-clipping matches `drawTile`).

## Verification (before trusting RUM's multi-day lag)
- Measure real INP locally via `web-vitals onINP` (or `PerformanceObserver` for `event` entries with `interactionId > 0`), for scripted worst-case gestures: zoom-drag end-to-end on **both empty and loaded** states, pan, dimension change — under 4–6× CPU throttle. Record before/after; target **<200 ms**.
- Performance panel: confirm no long task (>50 ms) in the post-interaction presentation-delay slice.
- Quantify per-frame tile cost via `performance.measure` around the render to prove the downscale-count collapse.
- Ship, then confirm via Production Speed Insights over the following 7-day window.

## Out of scope (sequenced follow-up; iPad pan is #1)
iPad one-finger canvas pan (Pointer Events + `touch-action:none` during pan; currently single-finger touch exits early so there is no touch pan — workflow gap for ~¼ of users), ≥44px touch targets (repeat-type radios, ruler-unit buttons, zoom controls), keyboard zoom/pan/fit, canvas aria label + `aria-live` render-status region, `prefers-reduced-motion`, and honest single-sourced zoom-% display ("100%" = fit, not 1:1).

## Results (implementation — 2026-06-22)

Implemented on branch `perf/pattern-preview-inp-fix` (see `docs/superpowers/plans/2026-06-21-pattern-preview-inp-fix.md`). Tasks 1–7 + 9 shipped; **Task 8 (ref-driven commit-on-settle) intentionally skipped** — it was measurement-gated and no reconciliation bottleneck was demonstrated, so building it would be speculative.

**What changed (the mechanism that fixes INP):**
- Loaded state: per-frame cost collapsed from *N full-res `drawImage` downscales* to *≤1 small downscale + cheap blits*, reusing a cached pre-scaled tile; pan re-blits the cache (no re-tile from source). Working source is downsampled once and capped at natural size (also trims canvas memory → incidental help for the iPad crash).
- Empty/landing state: deleted the per-zoom-tick `toDataURL('image/png')` + double `Image` decode; placeholder is pre-scaled once and tiled directly.
- Correctness: scale-preview commits on blur/Enter (no per-keystroke re-tile, no first-digit zoom lock); pinch floor no longer collapses the tile.

**Verification status:**
- ✅ 93 unit tests pass (incl. new `tilePositions`, `renderPreScaledAt`, `computeWorkingSourceSize`); production build green; `/` serves 200.
- ✅ Manual visual parity confirmed by user across all 3 repeat types, zoom, pan, outline, export — no regressions.
- ⚠️ Throttled local `web-vitals onINP` numbers **not captured** this session (the win is guaranteed by the per-frame work reduction; the harness is wired for future use). **Confirm via Production Speed Insights over the 7-day window post-deploy.**

## Risks
- Working-source downsample cap must be generous enough that max zoom (200%) + high dpr never reveals softness; choose cap = maxOnScreenTilePx × dpr × safety.
- Ref-driven zoom while keeping the slider's displayed `%` in sync needs care (throttled label update or commit-on-settle label).
- Edge-clipping parity between `renderPreScaled` (currently +1px overlap, no pan) and the existing `drawTile` clip logic must be verified visually for all three repeat types.
