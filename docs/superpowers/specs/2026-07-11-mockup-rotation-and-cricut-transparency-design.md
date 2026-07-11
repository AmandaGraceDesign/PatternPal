# Design Spec: Mockup Pattern Rotation + Transparent Cricut PNG

**Date:** 2026-07-11
**Status:** Approved design, pending implementation plan
**Source:** User feature requests (rotation on mockups; transparent PNG for Cricut export)

This spec covers two independent features that ship together. They share no code but are being planned in one pass. Feature A (rotation) is medium effort; Feature B (transparent Cricut) is small. Either can ship without the other.

---

## Feature A — Pattern Rotation on Mockups

### Goal
Let users rotate the pattern within a mockup on a **per-product-area** basis, using a **drag-to-rotate handle** on the live preview, with an optional **"rotate all" toggle** to spin every area together. Rotation affects only the mockup preview/export — it never mutates the user's saved pattern.

### Why this is tractable
The mockup engine **already supports per-zone rotation**. Each zone carries a static `patternAngle` and the tiling stage applies it independently ([MockupPipeline.ts:276-312](../../../src/lib/mockups/mockupEngineV2/MockupPipeline.ts#L276-L312)). Some shipped templates already set different angles per zone (45°, 15°, 53° on one product). What is missing is a **runtime override + UI**, exactly paralleling the pattern-offset override that already ships end-to-end.

### Interaction model
- **Select an area:** Tapping a product area (zone) in the mockup preview selects it. Only the selected zone shows its rotate handle. (Single-zone templates auto-select their one zone.)
- **Rotate handle:** A small circular grab target floating just outside the selected zone's center. Dragging it around the center rotates that zone's pattern. Angle is computed as `atan2(pointerY - centerY, pointerX - centerX)`, so the pattern tracks the finger/Pencil.
- **Body-drag still moves** the pattern (existing offset drag in `MockupRendererV2`). Handle-drag rotates. Move and rotate coexist via the existing "grab-target vs fall-through" gesture split (overlays are `pointer-events:none` except the specific grab target).
- **"Rotate all" toggle:** When ON, dragging any zone's handle applies the same angle **delta** to every zone. When OFF, each zone is independent. Default: OFF.
- **Live preview:** Rotation uses the existing rAF-coalesced, render-scale-independent drag rendering path so it is smooth and correct on iPad/Pencil. Full-resolution angle is applied at export.

### Data flow / architecture
Mirror the existing `patternOffsetOverrides` plumbing:
1. **Engine input:** Add `patternAngleOverrides?: Record<zoneId, number>` (degrees) to the pipeline input type (near the existing offset override in [MockupPipeline.ts](../../../src/lib/mockups/mockupEngineV2/MockupPipeline.ts), ~line 196).
2. **processZone:** Add an `overrideAngle` parameter and fold it into the existing `angleDeg` at [MockupPipeline.ts:276](../../../src/lib/mockups/mockupEngineV2/MockupPipeline.ts#L276) (`angleDeg = (zone.patternAngle ?? 0) + overrideAngle`). No new tiling math — the rotate branch already exists.
3. **Call sites:** Pass `input.patternAngleOverrides?.[zone.id]` at both the multi-zone loop and single-zone call sites (~lines 468-482 and 492-511).
4. **React layer:** Add `patternAngles` state (`Record<zoneId, number>`) and a `selectedZoneId` state in [MockupRendererV2.tsx](../../../src/components/mockups/MockupRendererV2.tsx), paralleling `patternOffsets`. Add the rotate-handle overlay + pointer handlers (reuse the pointer-capture / `wasDragRef` / rAF-coalesce patterns from the existing offset drag at lines 454-543).
5. **Modal control:** Add the "rotate all" toggle in the mockup modal controls near the other pattern controls.
6. **Export:** The angle override must be passed through the export render so the exported mockup matches the preview.

### Gesture / handle detail
- The rotate handle is an absolutely-positioned element inside the same `containerType: inline-size` wrapper used to keep preview and export aligned ([MockupCropStage.tsx:152-167](../../../src/components/mockups/MockupCropStage.tsx#L152-L167)), so its screen position maps to the zone correctly across render scales.
- `touch-action: none` and Pointer Events (not mouse/touch) for iPad/Pencil parity (mandatory per project convention).
- `setPointerCapture`/`releasePointerCapture` for the drag lifecycle; `wasDragRef` distinguishes a rotate-drag from a tap-select.

### Scope boundaries (v1)
- **`sharedPatternArea` templates are excluded.** Templates that tile one continuous pattern across adjacent zones bypass the per-zone rotate/offset block. For v1, the rotate handle is **hidden/disabled** on these templates (no dead controls). Supporting them is explicitly out of scope.
- Rotation is preview/export only — it does not alter the saved pattern or other export paths (EasyScale, repeat/tile) unless a follow-up decides otherwise.
- No slider/numeric input in v1 (drag handle only). The state model (`patternAngles` as degrees) is designed so a slider can be added later with no rework.

### Success criteria
- Selecting an area and dragging its handle visibly rotates only that area's pattern in the live preview.
- "Rotate all" ON rotates every eligible zone together by the same delta.
- The exported mockup matches the preview rotation exactly.
- Works with touch/Pencil on iPad (Pointer Events, `touch-action: none`).
- `sharedPatternArea` templates show no rotate handle and are otherwise unaffected.
- No regression to the existing offset drag, crop drag, or export.

---

## Feature B — Transparent Cricut PNG

### Goal
Let Pro users export the Cricut / Pattern-Fill ("Digital Paper") output as a **transparent PNG**, preserving the alpha of transparent-source patterns instead of baking them onto white.

### Why this is small
The Cricut export tiles the pattern onto a canvas but paints a hardcoded white background first ([repeatFillExport.ts:191-193](../../../src/lib/utils/repeatFillExport.ts#L191-L193)):
```js
ctx.fillStyle = '#ffffff';
ctx.fillRect(0, 0, canvas.width, canvas.height);
```
That single unconditional fill is the **only** thing flattening transparency — the source tiles stay transparent through the tiling loop and the half-drop→full-drop conversion. Remove/skip that fill and PNG output is transparent.

### Data flow / architecture
1. **Config flag:** Add `transparentBackground?: boolean` to `RepeatFillExportConfig` ([repeatFillExport.ts:8-18](../../../src/lib/utils/repeatFillExport.ts#L8-L18)).
2. **Skip the fill:** In `generateRepeatFillExport`, skip the white `fillRect` (lines 191-193) when `transparentBackground && format === 'png'`.
3. **Preview parity:** Mirror the skip in the live preview canvas ([RepeatExportModal.tsx:689-690](../../../src/components/export/RepeatExportModal.tsx#L689-L690)), and render a **checkerboard behind the preview** when transparent is on, so users can see the transparency instead of white-on-white.
4. **UI toggle:** Add a "Transparent background" toggle in the Cricut panel (near the format radio, [RepeatExportModal.tsx:1140-1177](../../../src/components/export/RepeatExportModal.tsx#L1140-L1177)). Enabled **only when format = PNG**; when JPG is selected the toggle is disabled/greyed with a one-line "PNG only" hint (JPEG has no alpha — a transparent canvas would export black).
5. **Metadata:** Verify `injectPngDpi` ([dpiMetadata.ts:31](../../../src/lib/utils/dpiMetadata.ts#L31)) preserves the alpha channel (it edits the `pHYs` chunk only, so it should — confirm with a runtime spot-check).
6. **Social parity (optional):** `generateSocialFillBlob` has an identical white fill (~lines 296-297). Out of scope unless we want the social export transparent too — default: leave social opaque.

### Scope boundaries
- **PNG only.** JPG/TIF unaffected; toggle disabled unless PNG.
- Stays **Pro-locked**, same gating as the existing Cricut export.
- No background *removal* — this preserves existing alpha, it does not knock out a solid background from an opaque pattern. (If users have opaque patterns and want a background stripped, that is a separate future feature.)

### Success criteria
- With a transparent-source pattern + PNG + toggle ON, the exported file has a genuinely transparent background (verified in an image editor / Cricut).
- The preview shows a checkerboard when transparent is on.
- Toggle is disabled and clearly labeled when format is JPG.
- Opaque-source patterns still export fine (transparent toggle simply produces transparent margins/seams where the source had none — acceptable).
- DPI metadata still injects correctly; no alpha loss from that step.

---

## Testing approach

**Feature A (rotation):**
- Unit: `processZone` with a non-zero `overrideAngle` produces a rotated tile vs baseline (pixel-diff or transform assertion).
- Manual: multi-zone template — rotate one zone, confirm others unchanged; toggle "rotate all", confirm all move together; export and diff against preview; iPad/Pencil pass; confirm `sharedPatternArea` template shows no handle.

**Feature B (transparent Cricut):**
- Manual/runtime: export a known transparent PNG source with toggle ON → open result, confirm alpha; toggle OFF → confirm white background (no regression); JPG → toggle disabled; confirm DPI intact.

## Out of scope (both)
- Slider/numeric rotation input (drag handle only in v1).
- Rotation on `sharedPatternArea` templates.
- Background *removal* / knock-out for opaque patterns.
- Transparent output for EasyScale or social exports.
- Any change to the saved pattern data.
