# Design — Live preview + contextual crop framing for the mockup modal

**Date:** 2026-06-11
**Branch:** `feat/mockup-social-exports`
**Status:** Approved design (Mandy chose Model A). Implementation pending (fresh session).
**Sketch:** `docs/superpowers/sketches/mockup-live-preview-gestures.html`

## Problem

The crop-stage redesign moved the live `MockupRendererV2` off-screen (`left:-10000px`) and made
a static canvas **snapshot** (`toDataURL`) the visible preview (`MockupCropStage`). That caused
two regressions Mandy hit:

1. **Pattern drag-to-position is gone** — the drag interaction lives on the live canvas
   (`MockupRendererV2` `dragEnabled`), which is now off-screen and untouchable.
2. **Scale changes are sluggish** — every tile-scale change re-renders the off-screen full
   pipeline *and* re-encodes a large PNG snapshot, so you only see the result after that round-trip.

Both share one root cause: a frozen snapshot replaced the live interactive surface.

## Decision

Bring the **live `MockupRendererV2` back as the visible preview**. Draw crop framing +
watermark/badge **as overlays on the live canvas**. Use gesture **Model A (smart contextual)**:
pattern-drag is the default; the crop box is grabbable only when a vertically-croppable social
size is active.

The per-size crop framing feature (draggable vertical offset) **stays** — it just moves from a
separate snapshot onto the live preview.

## Components & layout

- **Live preview (primary):** one visible `MockupRendererV2` with `dragEnabled`, centered in the
  modal. Replaces the off-screen renderer + the snapshot-as-main-view. Its existing low-res
  "preview while interacting" path makes scale changes smooth again (no snapshot in the hot path).
- **Crop framing overlay (on the live canvas):** shown only when a croppable social size is active.
  - *Vertical crop* (Square, Portrait): gold crop box + dimmed top/bottom + a **center grab-bar
    handle** (≥44px touch target). Draggable to set the vertical offset.
  - *Horizontal crop* (Story): static centered band indicator, no drag (auto).
  - *No crop* (Full size, Pinterest): no overlay.
  This is the existing `MockupCropStage` crop math, refactored to render as an absolutely
  positioned overlay over the live canvas instead of over a snapshot background.
- **Watermark + badge overlay:** the crop-region overlay added earlier this session, now layered
  on the live preview's crop region (same `containerType: inline-size` approach). Already matches
  the post-crop export placement.
- **Size list + download button:** unchanged (`MockupDownloadMenu` minus the embedded snapshot
  stage). Per-size thumbnails stay, fed by a **throttled** snapshot.

## Gesture model (Model A — smart contextual)

On `pointerdown` over the preview:

- If a **vertical-crop size is active** AND the pointer lands on the **crop box or its handle**
  → **crop-offset drag** (overlay handles it; the box/handle have `pointer-events:auto`).
- Otherwise → **pattern-position drag** (falls through to `MockupRendererV2`'s existing drag;
  the dim layers are `pointer-events:none` so they don't intercept).

A small live **action label** on the preview always states what the next/current drag does
("Moving the pattern · grab the gold box to frame" ↔ "Sliding the crop frame ↕").

iPad/Pencil parity (mandatory): Pointer Events, `touch-action:none`, large handle hit-target,
no page-scroll while dragging. Both gestures must work with finger and Pencil.

## Data flow (unchanged wiring)

- `socialOffsets[slug]` (vertical crop offset) — already wired into the export
  (`exportMockupSocialBlob` → `coverCropToBlob`). Keep.
- Pattern position lives in `MockupRendererV2` `patternOffsets` state and already persists into
  the full-res export render. **Implementation check:** confirm pattern offsets still flow to the
  export render now that the renderer is on-screen (it did pre-redesign).

## Files touched

- `MockupCropStage.tsx` — refactor from snapshot-background box into an **overlay** sized to the
  live canvas (drop the `backgroundImage` snapshot; keep crop-rect + watermark/badge children).
- `MockupDownloadMenu.tsx` — stop embedding the snapshot stage as the main preview; keep size grid
  + download. (Crop overlay now lives on the live preview, not in the menu.)
- `ActionsSidebar.tsx` + `AdvancedToolsBar.tsx` — un-hide the renderer (on-screen, sized for the
  modal), mount the crop + watermark/badge overlay over it, wire Model-A hit-testing, and
  **throttle** the `toDataURL` snapshot used only for the size thumbnails (e.g. trailing debounce
  ~300–400ms, skip during drag and full-res capture).
- Remove the per-`onRenderComplete` `toDataURL` from the hot path.

## Risks / notes

- **Two consumers** (ActionsSidebar, AdvancedToolsBar) duplicate this modal body and must stay in
  sync. Optional follow-up: extract a shared `MockupModalBody`. Out of scope for the fix unless it
  makes the change cleaner.
- **Curtain template** (3600×4500 = 0.8 aspect) crop-geometry mismatch is pre-existing and still
  deferred. Unchanged by this work.
- Ensure thumbnails/preview don't go blank before the first render (the snapshot reset path).
- The retired `dragEnabled` prop becomes live again — remove the "inert" code comment.

## Testing

- Automated gate: `tsc --noEmit`, `eslint` (no new errors), `vitest run` (69/69 + any new).
- Manual (desktop + iPad/Pencil): pattern drag, crop-box drag, scale smoothness, watermark
  position matches exported PNG, downloads framed correctly, untouched/centered output unchanged.
