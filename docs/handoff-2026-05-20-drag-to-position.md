---
task: Drag-to-position pattern within mockup (mouse / stylus / touch)
status: not started — design agreed, ready to implement
last_updated: 2026-05-20
current_branch: merge-test (commit `4c63a95` is HEAD; not pushed)
---

## TL;DR

Mandy wants users to be able to click-and-drag the pattern inside a mockup to
reposition it (e.g. shift the tile so a specific motif lands where they want
on the product). Works for **tiled patterns only** — single-motif placement
is explicitly NOT in scope.

This session: discussed and agreed on the implementation plan. **Did not start
coding.** The implementation should be picked up fresh.

## Today's session also shipped (already committed)

`4c63a95 feat(mockups-v2): per-region shadow/highlight controls + color-overlay toggle`

- Pipeline: per-additional-layer shadow/highlight toggles + opacity overrides,
  plus `colorOverlayEnabled` flag to skip the color overlay block.
- Template type: `patternAngle` (top-level for single-zone), `shadowLabel`,
  `additionalShadowLabels`, `highlightLabel`, `additionalHighlightLabels`,
  `colorOverlayLabel`.
- Mens-tie template: labels populated ("Tie shadow" / "Jacket shadow" / etc).
- Phone-case template: `patternAngle: 15` (clockwise).
- `MockupRendererV2`: forwards array-shaped props into the pipeline.
- Both sidebars (`ActionsSidebar.tsx`, `AdvancedToolsBar.tsx`): dynamic
  per-layer control rows + a color-overlay checkbox next to the color picker.
- `28/28 vitest passing`, `tsc --noEmit` clean as of commit time.

## Implementation plan for drag-to-position

### Approach: CSS-translate during drag, real re-render on release

The pipeline takes ~50-200ms per render — too slow for 60fps drag. Instead:
- During drag: `transform: translate(dx, dy)` the existing rendered canvas
  for instant feedback (the shadow/highlight stay put during the drag, which
  is a tiny visual cheat — fine for flat-surface templates, acceptable
  elsewhere because it snaps back to truth on release).
- On `pointerup`: commit the accumulated delta to state, which triggers a
  real pipeline render with the new `patternOffset`.

### Slice 1: Pipeline plumbing (~20 LOC)

In [src/lib/mockups/mockupEngineV2/MockupPipeline.ts](../src/lib/mockups/mockupEngineV2/MockupPipeline.ts):

Add to `PipelineInput`:
```ts
/** Runtime offset added to every zone's existing patternOffset.
 *  Used by the modal's drag-to-position feature. Units: pattern-space pixels. */
patternOffsetOverride?: { x: number; y: number };
```

In `processZone`, when computing `offsetX` / `offsetY` (currently lines ~149-150,
where it reads `zone.patternOffset?.x ?? 0`), ADD the override:
```ts
const offsetX = (zone.patternOffset?.x ?? 0) + (overrideOffsetX ?? 0);
const offsetY = (zone.patternOffset?.y ?? 0) + (overrideOffsetY ?? 0);
```
(Pass the override values through as new args to `processZone`.)

Make sure both single-zone and multi-zone code paths apply it. For multi-zone
templates like mens-tie, applying the SAME delta to every zone keeps the
tie and the jacket pattern shifted together, which is what the user wants.

The `offsetX != 0 || offsetY != 0` branch already handles the "no rotation,
shift only" tile path. The rotation branch's `oversized.width = ceil(SQRT2 * max + 2 * offsetPad)`
calc uses `offsetPad = max(|offsetX|, |offsetY|)` — that's still correct because
the combined offset is what we're shifting by. **Sanity check:** for large
drags the oversized canvas could grow huge — clamp the user's drag to e.g.
`±patternArea.width` in the UI to keep memory bounded.

### Slice 2: Renderer prop (~10 LOC)

In [src/components/mockups/MockupRendererV2.tsx](../src/components/mockups/MockupRendererV2.tsx):

Add prop `patternOffsetOverride?: { x: number; y: number }`, destructure it,
forward into `runPipeline({ ... patternOffsetOverride })`. Include in `useEffect` deps
(stringify or destructure as `offsetX, offsetY` for cleaner deps).

### Slice 3: Drag UI in both sidebars (~60 LOC × 2)

In [ActionsSidebar.tsx](../src/components/sidebar/ActionsSidebar.tsx) and
[AdvancedToolsBar.tsx](../src/components/layout/AdvancedToolsBar.tsx):

Add state inside the modal:
```ts
const [patternOffset, setPatternOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
const [dragState, setDragState] = useState<{
  startClientX: number;
  startClientY: number;
  startOffsetX: number;
  startOffsetY: number;
  // CSS-space delta during drag, applied as transform; pattern-space delta
  // is computed on release using canvas internal/CSS ratio.
  liveDx: number;
  liveDy: number;
} | null>(null);
```

Reset on mockup-change effect (alongside the existing array resets).

Wrap the canvas in a div with:
- `style={{ touchAction: 'none', cursor: dragState ? 'grabbing' : 'grab' }}`
- `onPointerDown` — record start
- `onPointerMove` — update `liveDx`/`liveDy`, apply `style={{ transform: translate(liveDx, liveDy) }}` on the canvas element via a ref or inline-style
- `onPointerUp` — compute pattern-space delta:
  ```ts
  const rect = canvas.getBoundingClientRect();
  const scale = canvas.width / rect.width; // internal px per CSS px
  const dx = liveDx * scale;
  const dy = liveDy * scale;
  setPatternOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
  setDragState(null); // clears the CSS transform too
  ```

Pass `patternOffsetOverride={patternOffset}` to `<MockupRendererV2>`.

Add a "Reset position" button (next to the existing Scale / Color / Shadow row)
that sets `patternOffset` back to `{ x: 0, y: 0 }`. Only show it when offset is non-zero.

### Disambiguate from existing onClick (gallery thumbnails)

For the modal canvas, no click handler conflicts. But the **gallery thumbnails**
in `MockupGalleryModal` currently use `onClick` to select a mockup — DO NOT
add drag there. Drag is in-modal only.

Also for `MockupRendererV2`'s `onClick` prop: when dragging, set a flag so
the synthetic click that fires on pointerup doesn't trigger anything. Simple
approach: if `Math.abs(liveDx) + Math.abs(liveDy) > 5` on pointerup, call
`e.preventDefault()` / set a `wasDrag` flag and short-circuit any onClick.

### One-time hint

Add a small inline tip the first time the modal opens for a mockup:
"Tip: drag the mockup to reposition the pattern." Use localStorage to
remember dismissal. Low priority — can skip in v1.

## Verification checklist (for next session)

1. `npx tsc --noEmit` clean
2. `npx vitest run` → 28/28 pass
3. Open mens-tie in modal, drag the pattern up/down → tie AND jacket pattern
   shift together; shadows/highlights stay anchored (correct).
4. Open phone-case, drag → tiled motif shifts; rotation (15°) preserved.
5. Test on iPad with Apple Pencil and finger — `touch-action: none` should
   prevent page scroll while dragging on the canvas.
6. "Reset position" button appears when offset != 0 and clears it.
7. Gallery thumbnail click still opens the modal (drag was not added there).

## Outstanding from earlier handoffs (still true)

- 36 PNGs under `public/mockups/v2/` are untracked but referenced by templates.
  Works locally; would 404 on a fresh clone. Worth a `chore(assets): commit
  v2 mockup PNGs` commit eventually.
- `mens-tie-color-mask.png` is 4672×7008 (not resized to 3000×4500). Works
  but suboptimal.
- Knot `patternOffset: { x: 80, y: 50 }` in mens-tie is a starting guess —
  eyeball and adjust if it looks off.
- `extractDominantColor` memoization — still not urgent.

## Don't forget

- Branch: `merge-test`, not pushed.
- Last commit: `4c63a95`.
- The drag offset is in **pattern-space pixels** (canvas-internal), not CSS px.
  Always convert via the canvas's `boundingClientRect` ratio.
- For multi-zone templates, apply the SAME delta to every zone — don't try
  to track per-zone offsets from the UI.
