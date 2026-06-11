# Spec — Drag-to-crop mockup framing

**Date:** 2026-06-11
**Branch:** `feat/mockup-social-exports`
**Supersedes:** the Top/Center/Bottom preset anchor UI from
`docs/superpowers/specs/2026-06-11-mockup-crop-anchor-design.md`
**Status:** approved in brainstorm, ready for planning

## Problem

The current mockup download menu frames Square and Portrait exports with a
Top/Center/Bottom preset toggle. Mandy finds the three presets too coarse — she
wants to position the product exactly, "like Canva," by dragging. She also wants
larger row thumbnails and the redundant bottom full-size preview gone.

## Goal

Replace the preset toggle with a continuous, draggable crop for the two sizes that
trim vertically (Square, Portrait). Fold in the bigger-thumbnails and
remove-bottom-preview asks. Keep iPad/Pencil parity and the existing export quality.

## Decisions (from brainstorm)

| Question | Decision |
|----------|----------|
| Per-size vs one shared crop | **Per-size, independent.** No linking, no global default. Each croppable size remembers its own framing; default centered. |
| Drag style | **Style B** — fixed image, draggable crop box over the dimmed full mockup. Chosen over Canva-style "image moves behind fixed frame" because it's simpler to code (one coordinate space, trivial clamp), reuses the existing snapshot, and shows what's being cut. |
| Zoom | **Out of scope.** Reposition only — no scaling into the photo. Crop stays a bounded offset, drag stays a bounded pan. |
| Which sizes get drag | **Square + Portrait only** — the sizes that trim top/bottom from the 2:3 source (today's `cropsVertically` set). Story (trims sides), Pinterest (exact 2:3), and Full (no crop) are unchanged. Story horizontal drag is a possible later addition, explicitly deferred. |

## Geometry

The mockup render is 2:3 (taller than wide). For a target wider than 2:3 the source
is taller than the target, so the cover-crop trims top/bottom and a **vertical**
offset picks which band is kept. That is exactly Square (1:1) and Portrait (4:5).
Story (9:16) is narrower than 2:3 → trims sides; Pinterest (2:3) matches exactly;
Full isn't cropped. So drag only ever moves along the **vertical** axis in this MVP.

The offset is a single scalar `0..1`:
- `0` = top band kept (old `top`)
- `0.5` = centered (old `center`, the default — keeps exports byte-identical)
- `1` = bottom band kept (old `bottom`)

## Components

### 1. Export math — `src/lib/utils/mockupSocialExport.ts`
- Replace `VAnchor = 'top'|'center'|'bottom'` with a numeric vertical offset.
  - `computeCoverCropRect(srcW, srcH, targetW, targetH, offset = 0.5)`: in the
    taller-source branch, `sy = round((srcH - sHeight) * clamp01(offset))`.
    `offset = 0` → top, `0.5` → center (unchanged), `1` → bottom. The wider-source
    branch (Story) ignores `offset` exactly as it ignores the anchor today.
  - `coverCropToBlob(..., offset = 0.5)` — pass the fraction through.
  - `MockupSocialOpts.anchors?: Partial<Record<SizeSlug, VAnchor>>` becomes
    `offsets?: Partial<Record<SizeSlug, number>>` (missing slug → `0.5`).
  - `exportMockupSocialBlob` reads `offsets[preset.slug] ?? 0.5`.
- Keep one exported name for "which sizes are croppable" — fold the brittle
  `MOCKUP_SRC_ASPECT` constant check in `socialSizes.ts#cropsVertically` into a
  function that takes the real source aspect (the mockup render is 2:3 today, but
  some templates differ — passing live dims removes the cosmetic mismatch noted in
  the prior handoff). If simpler, keep `cropsVertically` but feed it real dims.

### 2. Crop stage — new `src/components/mockups/MockupCropStage.tsx`
- Props: the snapshot image URL, the active size preset, its current `offset`, and
  `onChangeOffset(next: number)`.
- Renders the full mockup snapshot at a fixed display size, a dimmed overlay, and a
  crop box of the active size's aspect sized to "cover" (full width for Square/
  Portrait, so it slides vertically). Drag moves the box vertically only; map box
  top → `offset` and clamp to `[0,1]`.
- **Pointer Events** (`onPointerDown/Move/Up`, `setPointerCapture`) and
  `touch-action: none` on the box — identical behavior for finger, Pencil, mouse.
  Mandatory per the iPad-parity requirement.
- For a non-croppable active size, show the snapshot with no box and a "fills
  exactly — no crop" note instead of a draggable frame.

### 3. Menu — `src/components/mockups/MockupDownloadMenu.tsx`
- Bigger row thumbnails (from `width: 40` to a larger tap-friendly size), each
  showing its size's real crop via `background-position` derived from that size's
  `offset` (continuous, not the old 3-position map).
- Tapping a row sets it **active**; the active size drives `MockupCropStage`.
- Remove the separate bottom full-size preview. The crop stage is the live preview.
- State: `offsets: Record<SizeSlug, number>` and `activeSlug` replace
  `anchors` / the `ANCHOR_POSITION` map and the `ANCHORS` toggle array.

### 4. Snapshot source (the gotcha)
- `MockupRendererV2` (`[data-mockup-modal] canvas`) is the source the thumbnails and
  stage snapshot from (`onRenderComplete` → `toDataURL` → `mockupSnapshotUrl`). It
  **must stay mounted** — render it hidden/off-layout, not removed. Both the row
  thumbnails and the crop stage consume the resulting `snapshotUrl`. Deleting the
  visible preview must not delete the source.

### 5. Wiring
- `ActionsSidebar.tsx` and `AdvancedToolsBar.tsx` both embed the shared
  `MockupDownloadMenu`; update both call sites to pass `offsets`/`activeSlug` state
  instead of `anchors`, mirroring the existing two-call-site pattern.

## Data flow

Live mockup canvas (`MockupRendererV2`, hidden)
→ `onRenderComplete` → `toDataURL` → `snapshotUrl`
→ row thumbnails (crop via per-size `offset`) **and** `MockupCropStage` (active size)
→ user drags box → `onChangeOffset(slug, next)` updates `offsets`
→ Download → `exportMockupSocialBlob(canvas, preset, { ..., offsets })`
→ `coverCropToBlob` → `computeCoverCropRect(..., offsets[slug] ?? 0.5)`.

## Error / edge handling
- Clamp `offset` to `[0,1]` on every drag; box can never expose empty canvas.
- Missing/unset offset → `0.5` everywhere (center, backwards-compatible).
- Snapshot not ready (`snapshotUrl === null`) → stage shows a loading placeholder,
  drag disabled, same guard the thumbnails already use.
- Non-croppable active size → no box, no drag, "no crop" note.

## Testing
- Unit (`src/__tests__/mockupSocialExport.test.ts`): `computeCoverCropRect` with
  `offset` 0 / 0.5 / 1 must equal the old top / center / bottom rects; intermediate
  values land between; out-of-range clamps. `offset` is a no-op on the wider-source
  (Story) branch.
- Backwards-compat: default `0.5` keeps all existing exports identical — the 67
  current tests stay green (`tsc` clean, `vitest`, `eslint` 0 errors gate).
- Manual: desktop mouse + iPad/Pencil drag on Square and Portrait; confirm
  thumbnail, stage, and exported PNG all agree.

## Out of scope (YAGNI)
- Zoom / scale into the photo.
- Story horizontal drag and any horizontal offset.
- Shared/linked default or "apply to all" — per-size only.
- Resizable crop box (box size is fixed by cover geometry).
