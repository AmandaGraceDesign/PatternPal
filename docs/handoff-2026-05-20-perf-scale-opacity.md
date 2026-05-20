---
task: Mockup perf wins + per-zone pattern-scale unification + 30% overlay defaults
status: SHIPPED to merge-test (NOT pushed). User visually confirmed.
last_updated: 2026-05-20
current_branch: merge-test (HEAD = `e7fdf75`)
prior_handoff: handoff-2026-05-20-drag-to-position-done.md
---

## TL;DR

Four commits on top of `af6b425`. App is faster (especially gallery on
iPad), pattern scale is consistent within multi-zone mockups, and
shadow/highlight overlays default to 30% instead of 50%.

User confirmed visuals are correct in the browser. iPad still unverified.

## Commits (this session, oldest first)

1. `2816fdd perf(mockups-v2): render gallery thumbs at max 600px via scaleTemplate`
2. `790fd1e perf(mockups-v2): cache per-mask alpha conversion across renders`
3. `f3940b7 perf(mockups-v2): coalesce drag updates to one setState per animation frame`
4. `e7fdf75 feat(mockups-v2): unify pattern scale across zones + default overlays to 30%`

## What changed and why

### 1. Gallery thumbs at low res — `2816fdd`

**Problem:** Gallery rendered every thumbnail through the full
3000×4500 pipeline (~57 templates), then CSS-scaled to ~150px tile.

**Fix:**
- New file [src/lib/mockups/mockupEngineV2/scaleTemplate.ts](../src/lib/mockups/mockupEngineV2/scaleTemplate.ts):
  shallow-clones the template with all pixel-space dimensions (canvasSize,
  patternArea, zone.patternArea, zone.patternOffset, sharedPatternArea,
  canvasPxPerInch) multiplied by a factor.
- New prop `maxRenderDimension?: number` on
  [MockupRendererV2.tsx](../src/components/mockups/MockupRendererV2.tsx).
  When set, the renderer scales the template down before calling
  runPipeline. PNGs stay full-res — drawImage handles scaling natively.
- [MockupGalleryModal.tsx](../src/components/mockups/MockupGalleryModal.tsx)
  passes `maxRenderDimension={600}`. Modal previews (ActionsSidebar,
  AdvancedToolsBar) don't set it, so they render at full resolution.

Roughly **25× less per-pixel work per thumb**.

### 2. Mask alpha cache — `790fd1e`

**Problem:** [MockupPipeline.ts](../src/lib/mockups/mockupEngineV2/MockupPipeline.ts)
ran a per-pixel loop (~13.5 M pixels at full res) to convert each zone
mask to alpha form, every render. The conversion is deterministic.

**Fix:** WeakMap-backed cache `alphaMaskCache` keyed by HTMLImageElement.
Converts each mask exactly once; subsequent renders drawImage from the
cached canvas.

**Bonus correctness fix:** When the template is scaled (gallery thumbs),
mask images are still full-res. Mask extraction now uses proportional
src rects (`ratioX = maskW / canvasWidth`) so the right region gets
extracted regardless of scale. The original "if mask is canvas-sized,
extract sub-region; else scale whole mask" branch is preserved.

NOT cached: color-overlay mask. Uses the opposite alpha convention
(`md[i+3]` directly, not inverted) and runs only once per render — not
worth the additional cache complexity right now.

### 3. Drag rAF throttle — `f3940b7`

**Problem:** Each pointermove during drag → setState → render effect →
pipeline cancel. 60+ moves/sec piled up React renders.

**Fix:** New refs `pendingDragOffsetRef` + `dragRafIdRef` in
MockupRendererV2. Pointermove writes target to the ref and schedules
one rAF; the callback applies the latest. `flushPendingDrag()` on
pointerup commits the final value immediately. Cancel on pointercancel
and on template change.

### 4. Pattern scale unification + 30% overlay defaults — `e7fdf75`

**Problem (scale):** Per-zone `physicalWidth` was being used for tile
scaling, but it represents the real-world piece width, not canvas
pattern density. Same fabric showed at different pattern scales across
zones:
- duvet-1: main 50 px/in, pillow 65.4 (pillow ~30% smaller)
- mens-tie: main 177, knot 209 (knot ~18% smaller)
- girl-dress-1: bodice 120, sleeves 85, skirt 84
- girl-dress-2: 67/69/71/72 (small drift)

**Fix (scale):**
- New optional `canvasPxPerInch?: number` field on `MockupV2Template`
  ([types.ts](../src/lib/mockups/mockupEngineV2/templates/types.ts)).
- When set, the pipeline computes each zone's effective physicalWidth
  as `zone.patternArea.width / template.canvasPxPerInch` instead of
  using `zone.physicalWidth`. Two places in
  [MockupPipeline.ts](../src/lib/mockups/mockupEngineV2/MockupPipeline.ts):
  - The multi-zone loop in `runPipeline`
  - The `sharedPatternArea` shared-tile pre-render
- `scaleTemplate` scales `canvasPxPerInch` by the same factor as the
  canvas (preserves effective inches).
- Per-zone `physicalWidth` still works as the fallback when
  `canvasPxPerInch` isn't set. The four affected templates now set:
  - duvet-1: 50
  - mens-tie: 177
  - girl-dress-1: 84
  - girl-dress-2: 69

**Fix (overlay defaults):**
- [MockupPipeline.ts](../src/lib/mockups/mockupEngineV2/MockupPipeline.ts):
  `shadowDefault = template.shadowOpacity ?? 0.3` (was 0.5);
  same for highlight.
- [ActionsSidebar.tsx](../src/components/sidebar/ActionsSidebar.tsx) and
  [AdvancedToolsBar.tsx](../src/components/layout/AdvancedToolsBar.tsx):
  initial useState `[30]`, reset blocks set `[30]`, `Array(n).fill(30)`,
  and the four `?? 50` fallbacks → `?? 30`.

No templates had explicit `shadowOpacity` / `highlightOpacity` set, so
no per-template overrides needed.

## Verification

- `npx tsc --noEmit` clean after every commit
- `npx vitest run` → 28/28 passing
- User visually confirmed: gallery + modal previews + drag-to-position
  + scale unification all look correct.
- iPad: still unverified (same as prior handoff)

## Outstanding (low priority, ordered roughly by value)

1. **iPad manual verification** — drag-to-position + perf wins should
   feel much better on iPad now. Hasn't been tested.

2. **Per-zone canvas allocation churn** — `processZone` still allocates
   ~7 full-area canvases per zone per render. On a 4-zone template at
   full res, that's ~28 canvases per render. Reusable canvas pool would
   help iPad memory pressure.

3. **Color-overlay mask not cached** — only relevant for templates with
   `colorOverlay` set. Different alpha convention than zone masks (kept
   `md[i+3]` as-is for alpha-style masks). Cache would need a second
   variant, or refactor to use the same convention.

4. **Drag offsets not persisted** — same as prior handoff. Modal close
   loses position. Would need to bubble state up to a parent that owns
   per-mockup state.

5. **No "Reset position" button** — same as prior handoff.

6. **From prior handoffs (still true):**
   - 36 PNGs in `public/mockups/v2/` are untracked but referenced.
     A `chore(assets):` commit eventually.
   - `mens-tie-color-mask.png` is 4672×7008 (not 3000×4500). Works.

## Key concepts to remember

- **`canvasPxPerInch`** is "canvas pixels per real inch of fabric". It
  makes a template's pattern scale uniform across zones. Anchor on the
  dominant zone's existing `patternArea.width / physicalWidth`. If you
  add a new multi-zone template with same-fabric zones, set this field.

- **`scaleTemplate(template, factor)`** clones with pixel dims and
  `canvasPxPerInch` multiplied by `factor`. PNG paths and physical
  units stay the same. Only used by the renderer for thumbnails today.

- **`ROOT_ZONE_KEY = '__root__'`** is still the synthetic zone id used
  by drag overrides on single-zone templates.

- **Mask alpha cache** is per-HTMLImageElement, lives in
  `alphaMaskCache: WeakMap<HTMLImageElement, HTMLCanvasElement>` inside
  MockupPipeline.ts. Same conversion semantics as before (B/W →
  luminance, alpha → 255 - alpha). Color-overlay mask NOT in cache.

## Don't forget

- Branch: `merge-test`, NOT pushed.
- Last commit: `e7fdf75`.
- iPad parity rule still applies — see `feedback_mobile_ipad_parity` memory.
- Adding new multi-zone templates with same-fabric zones: set
  `canvasPxPerInch` from the dominant zone's px/in.
- Adding new opacity defaults: 30% (0.3), not 50%.
