---
task: Drag-to-position pattern within mockup (per-zone, touch + mouse)
status: SHIPPED — user-verified working on desktop. iPad pending manual test.
last_updated: 2026-05-20
current_branch: merge-test (HEAD = `acded03`; not pushed)
---

## TL;DR

Click-and-drag any region of a mockup (mouse, touch, or Apple Pencil) to
shift the pattern tile within that region. Each zone shifts independently
— dragging the knot does NOT also shift the tie body; dragging a pillow
does NOT also shift the duvet.

User confirmed working on desktop. Treat iPad as "should work" but not
manually verified yet — the implementation uses Pointer Events +
`touch-action: none` + `setPointerCapture`, which is the iPad-correct
recipe ([feedback-mobile-ipad-parity](../memory/...) memory).

## Commits (this session)

1. `7030eb0 feat(mockups-v2): drag-to-position pattern inside mockup canvas`
   — first pass with CSS-translate live preview (wrong UX)
2. `09256dc fix(mockups-v2): drag shifts pattern inside mockup, not the whole canvas`
   — removed CSS-translate; offset commits live so pipeline re-renders
3. `acded03 feat(mockups-v2): per-zone drag — only the clicked zone shifts`
   — added hit-testing so each zone has its own offset

## How it works

### Pipeline ([MockupPipeline.ts](../src/lib/mockups/mockupEngineV2/MockupPipeline.ts))

```ts
patternOffsetOverrides?: Record<string, { x: number; y: number }>;
export const ROOT_ZONE_KEY = '__root__';
```

- Multi-zone templates: `overrides[zone.id]` lookup, additively combined
  with the zone's existing `patternOffset` inside `processZone`.
- Single-zone templates: `overrides[ROOT_ZONE_KEY]` lookup in the
  else-branch of `runPipeline`.
- Both `overrideOffsetX` and `overrideOffsetY` are added on top of the
  zone's static `patternOffset` (so e.g. mens-tie knot's preset
  `{x:80,y:50}` shift still applies, and drag is *additional*).

### Renderer ([MockupRendererV2.tsx](../src/components/mockups/MockupRendererV2.tsx))

- Opt-in via `dragEnabled` prop (default false). Gallery thumbnails in
  [MockupGalleryModal](../src/components/mockups/MockupGalleryModal.tsx)
  do NOT opt in — they keep click-to-select.
- State: `patternOffsets: Record<zoneId, {x, y}>` — only populated when
  the user has actually shifted that zone. Resets on template change.
- `zoneMasksRef` caches the loaded mask images for cheap hit-testing on
  pointerdown.
- Hit-test: `pickZoneAt(cssX, cssY)` iterates `template.zones` IN REVERSE
  (topmost / last-drawn wins), samples a single pixel from each mask via
  `getImageData`, scores it with `max(luminance, 255-alpha)` (handles
  both B/W and alpha-style masks). First score > 128 wins. Falls back to
  first zone if no hit. For single-zone templates, returns
  `ROOT_ZONE_KEY` immediately.
- Pointer events: `onPointerDown/Move/Up/Cancel` with
  `setPointerCapture`. `touch-action: none` on the wrapper.
- Click-vs-drag: <= 5 px total movement = treated as a click and fires
  the parent `onClick`. > 5 px = drag, no synthetic click fires.
- Pipeline re-renders on every offset change (~50-200ms per render).
  Cancellation logic in the existing useEffect coalesces concurrent
  renders. User sees mild lag during fast drags — visual is correct
  (only the pattern shifts inside the mask; the product photo stays put).

### Sidebars

Both [ActionsSidebar](../src/components/sidebar/ActionsSidebar.tsx#L498)
and [AdvancedToolsBar](../src/components/layout/AdvancedToolsBar.tsx#L590)
pass `dragEnabled` on the in-modal preview. No drag UI / buttons /
sliders in the sidebar control panel — Mandy explicitly wants the drag
interaction ON the mockup, not as a control.

## Memory updates (this session)

- `feedback_mobile_ipad_parity.md` — mandatory iPad/touch parity, use
  Pointer Events + `touch-action: none` + `setPointerCapture`. Apply to
  every future UI change.

## Outstanding (low priority)

1. **iPad manual verification** — should work but untested. Try with
   finger + Apple Pencil. Specifically check:
   - Page doesn't scroll while dragging on the canvas (`touch-action: none`)
   - No iOS long-press "Save Image" callout (`onContextMenu` + `userSelect: none`)
   - Hit-testing picks the right zone with a finger tap (Pencil is more
     precise; finger could land on a boundary).

2. **No "Reset position" affordance** — to clear an offset, user has to
   drag back manually or switch templates. We deliberately kept state
   inside the renderer (user picked option A), so a Reset button would
   need either: (a) move state up to the sidebar parents, or (b) expose
   an imperative ref handle from the renderer. Add only if Mandy asks.

3. **Renders lag during fast drags** — pipeline is 50-200ms per render.
   If this becomes annoying:
   - Throttle to ~10/sec via `requestAnimationFrame` or a small timeout
   - Render a low-res preview during drag, full-res on release
   - Build a separate pattern-only layer that can be cheaply translated

4. **Saving drag offsets** — drag offsets are NOT persisted. If user
   reopens the same mockup or exports, the saved offset is gone. If we
   want persistence, the offsets need to bubble up to a parent that
   owns mockup-specific state (and likely belong in the export payload).

5. **From prior handoffs (still true)** —
   - 36 PNGs under `public/mockups/v2/` untracked but referenced by
     templates. Works locally, would 404 on a fresh clone. Worth a
     `chore(assets): commit v2 mockup PNGs` commit eventually.
   - `mens-tie-color-mask.png` is 4672×7008 (not 3000×4500). Suboptimal
     but works.
   - `extractDominantColor` memoization — still not urgent.

## Verification (already passed)

- `npx tsc --noEmit` clean
- `npx vitest run` → 28/28 passing
- Desktop manual: user confirmed "works great" with per-zone behavior

## Don't forget

- Branch: `merge-test`, NOT pushed (Mandy is local-commits-only until
  she's ready to go live).
- Last commit: `acded03`.
- iPad parity is mandatory for any future UI work — see
  `feedback_mobile_ipad_parity` memory.
- `ROOT_ZONE_KEY = '__root__'` is the synthetic zone id for single-zone
  templates. Exported from `MockupPipeline.ts`.
