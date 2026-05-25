---
task: Per-region shadow/highlight controls + color-overlay toggle for mens-tie (and any future multi-layer template)
status: in progress — pipeline foundation in, runtime overrides + UI remain
last_updated: 2026-05-19
current_branch: merge-test
---

## TL;DR

Mens-tie has two distinct lighting regions (tie + jacket) and a jacket color overlay. User wants:

1. The tie shadow/highlight sliders to control ONLY the tie
2. A separate pair of shadow/highlight sliders that control ONLY the jacket
3. A checkbox to toggle the jacket color overlay on/off

Foundation is in place from this session (multi-layer paths already supported and rendering). What remains is exposing **runtime overrides per layer** and **a colorOverlay toggle** through the pipeline → renderer → sidebar chain.

## What's already done (don't redo)

- [MockupPipeline.ts](../src/lib/mockups/mockupEngineV2/MockupPipeline.ts) accepts `additionalShadowImages` + `additionalShadowOpacities` (and matching highlight fields). Loops and composites them after the primary shadow/highlight.
- [MockupRendererV2.tsx](../src/components/mockups/MockupRendererV2.tsx) loads `template.additionalShadowPaths`/`additionalHighlightPaths` and passes the image arrays + template opacity arrays through.
- [types.ts](../src/lib/mockups/mockupEngineV2/templates/types.ts) declares `additionalShadowPaths`/`additionalShadowOpacities`/`additionalHighlightPaths`/`additionalHighlightOpacities` on `MockupV2Template`.
- [templateRegistry.ts](../src/lib/mockups/mockupEngineV2/templates/templateRegistry.ts) `'mens-tie'` template is wired with the jacket pair as additionals.
- Tests 28/28 passing, typecheck clean. **Verify this is still true before starting.**

## What remains — three independent slices

### Slice 1: Pipeline runtime overrides (~30 LOC)

Currently the pipeline's `shadowEnabled` / `shadowOpacityOverride` only affect the **primary** shadow (and currently bleed into ALL additional shadows since the `shadowEnabled !== false` check wraps the whole block). We need per-layer toggles.

In [MockupPipeline.ts](../src/lib/mockups/mockupEngineV2/MockupPipeline.ts):

Add to `PipelineInput`:
```ts
/** Per-additional-shadow opacity overrides (parallel to additionalShadowImages). */
additionalShadowOpacityOverrides?: number[];
/** Per-additional-shadow toggle (parallel). When false, that layer is skipped. */
additionalShadowEnableds?: boolean[];
/** Same for highlight. */
additionalHighlightOpacityOverrides?: number[];
additionalHighlightEnableds?: boolean[];
/** Runtime toggle for color overlay layer. When false, color overlay is skipped. Default true. */
colorOverlayEnabled?: boolean;
```

In the shadow block (currently ~line 511 after this session's edits):
- Keep the existing primary `shadowImage` block as-is (gated by `shadowEnabled !== false`).
- For the additional-shadow loop, do NOT gate the whole loop with `shadowEnabled`. Instead, per iteration:
  ```ts
  if (input.additionalShadowEnableds?.[i] === false) continue;
  const op = input.additionalShadowOpacityOverrides?.[i]
    ?? input.additionalShadowOpacities?.[i]  // existing template default
    ?? shadowDefault;
  ```
- Mirror the same pattern for highlights.

For color overlay (currently ~line 392), wrap the existing `if (template.colorOverlay && input.colorOverlayMaskImage)` block to also require `input.colorOverlayEnabled !== false`.

### Slice 2: Template labels (~10 LOC)

So the sidebar can render meaningful slider names ("Tie shadow" / "Jacket shadow" / "Jacket color"), add optional label fields to `MockupV2Template` in [types.ts](../src/lib/mockups/mockupEngineV2/templates/types.ts):

```ts
/** Display label for the primary shadow slider. Default "Shadow". */
shadowLabel?: string;
/** Display labels for additional shadow sliders (parallel to additionalShadowPaths). */
additionalShadowLabels?: string[];
/** Display label for the primary highlight slider. Default "Highlight". */
highlightLabel?: string;
/** Display labels for additional highlight sliders. */
additionalHighlightLabels?: string[];
/** Display label for the color overlay toggle. Default "Accent color". */
colorOverlayLabel?: string;
```

Update mens-tie in [templateRegistry.ts](../src/lib/mockups/mockupEngineV2/templates/templateRegistry.ts):
```ts
shadowLabel: 'Tie shadow',
additionalShadowLabels: ['Jacket shadow'],
highlightLabel: 'Tie highlight',
additionalHighlightLabels: ['Jacket highlight'],
colorOverlayLabel: 'Jacket color',
```

### Slice 3: Sidebar UI — duplicate in both files (~80 LOC × 2)

Two near-identical sidebars need the same treatment:
- [src/components/sidebar/ActionsSidebar.tsx](../src/components/sidebar/ActionsSidebar.tsx) (used in main mockup gallery)
- [src/components/layout/AdvancedToolsBar.tsx](../src/components/layout/AdvancedToolsBar.tsx) (used in modal)

Both currently have:
- `shadowEnabled` + `shadowOpacityPercent` state
- `highlightEnabled` + `highlightOpacityPercent` state
- One row of UI per

Refactor to dynamic, template-driven control state. Suggested approach:

```ts
// Replace single state with arrays sized to (1 + additionalShadowPaths.length).
const shadowCount = 1 + (template.additionalShadowPaths?.length ?? 0);
const [shadowEnableds, setShadowEnableds] = useState<boolean[]>(() => Array(shadowCount).fill(true));
const [shadowOpacityPercents, setShadowOpacityPercents] = useState<number[]>(
  () => Array(shadowCount).fill(50)
);
// Same for highlight.
const [colorOverlayEnabled, setColorOverlayEnabled] = useState(true);
```

Use a `useEffect([template.id])` to reset arrays when the user switches templates (sizes can change).

Build labels:
```ts
const shadowLabels = [template.shadowLabel ?? 'Shadow', ...(template.additionalShadowLabels ?? [])];
```

Render a `shadowEnableds.map((_, i) => …)` block that emits the same row UI you have today, one per index. Same for highlights.

Render the color overlay row ONLY if `template.colorOverlay` is set:
```tsx
{template.colorOverlay && (
  <label>
    <input type="checkbox" checked={colorOverlayEnabled} onChange={…} />
    {template.colorOverlayLabel ?? 'Accent color'}
  </label>
)}
```

Wire all five into the `<MockupRendererV2 />` call:
```tsx
<MockupRendererV2
  …
  shadowEnabled={shadowEnableds[0]}
  shadowOpacityOverride={shadowOpacityPercents[0] / 100}
  additionalShadowEnableds={shadowEnableds.slice(1)}
  additionalShadowOpacityOverrides={shadowOpacityPercents.slice(1).map(p => p / 100)}
  highlightEnabled={highlightEnableds[0]}
  highlightOpacityOverride={highlightOpacityPercents[0] / 100}
  additionalHighlightEnableds={highlightEnableds.slice(1)}
  additionalHighlightOpacityOverrides={highlightOpacityPercents.slice(1).map(p => p / 100)}
  colorOverlayEnabled={colorOverlayEnabled}
/>
```

Add the four new props to `MockupRendererV2Props` in [MockupRendererV2.tsx](../src/components/mockups/MockupRendererV2.tsx) and forward them into `runPipeline(...)`.

## Verification checklist

1. `npx tsc --noEmit` clean
2. `npx vitest run` → 28/28 still pass
3. Dev server: open mens-tie. Confirm:
   - Tie shadow toggle hides ONLY tie shadow (jacket shadow still visible)
   - Jacket shadow toggle hides ONLY jacket shadow
   - Both opacity sliders work independently
   - Same for the two highlight toggles
   - Jacket color checkbox toggles the jacket color overlay on/off cleanly
4. Open a single-layer template (e.g. throw-pillow). Confirm:
   - Only ONE shadow row + ONE highlight row appear (no extras for templates without `additionalShadowPaths`)
   - Throw-blanket: confirm the color-overlay checkbox now appears for it too (since it has `colorOverlay`). Default checked = on. Toggling should hide the fringe color tint.

## Outstanding pre-existing items (from earlier handoffs)

- `mens-tie-color-mask.png` is still 4672×7008 (not resized). Works but suboptimal — Mandy may resize, or this can be done with `sips -z 4500 3000` (or `sharp` resize).
- Knot `patternOffset: { x: 80, y: 50 }` in mens-tie is a starting guess. Mandy should eyeball and adjust.
- `memoize extractDominantColor` — still not urgent.

## Don't forget

- Still on `merge-test`. Not pushed.
- All 28 tests passing, typecheck clean as of this handoff.
- This session also: changed throw-blanket default color `#a9a09a` → `'auto'`; added `additionalShadowPaths`/`additionalHighlightPaths` plumbing; wired desk-mat/gift-bag/phone-case as image templates; extended `patternOffset` to honor zero-angle case.
