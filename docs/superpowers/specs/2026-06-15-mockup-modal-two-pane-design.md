# Design — Mockup Modal Two-Pane Layout

**Date:** 2026-06-15 · **Branch:** `feat/mockup-social-exports` · **Status:** Approved (design), awaiting plan

## Problem

The mockup export modal is a single vertical stack: controls bar (Scale / Accent / Shadow /
Highlight) → Logo Overlay → PatternPAL badge → download grid → **live preview last**. On a
portrait 2:3 mockup the preview is the tallest element and sits *below* everything that controls
it, so to drag-to-move the pattern the user scrolls past every control, and the adjusters they're
tuning are off-screen while they watch the result. The modal keeps growing taller with each
feature. We have horizontal room we aren't using.

## Goal

Use horizontal space: a two-pane modal where the live preview is pinned beside its controls, so on
a laptop **nothing scrolls** and the adjusters stay next to the image. Must work on laptop AND
iPad (both orientations) per the mandatory mobile/iPad-parity rule (≈half of users are on iPad with
Pencil; Pointer Events + `touch-action: none` already in place — preserve them).

## Approved Layout

Single modal, two layouts swapping at a **~880px** width breakpoint.

### Desktop / iPad landscape (≥ 880px) — two panes
- **Left pane:** live preview (`MockupRendererV2` + `MockupCropStage` overlay), pinned. Holds
  ~52% width. Vertically centered. Drag-to-move pill stays on the image.
- **Right pane:** controls column, top→bottom: unified controls bar (Scale·Accent·Shadow·
  Highlight) → Logo Overlay (Pro) → PatternPAL badge → download grid → Download button.
- No scrolling expected at normal laptop sizes; if the control column ever overflows, only it
  scrolls — the preview pane stays put (sticky).

### iPad portrait / phone (< 880px) — stacked, preview pinned on top
- Preview pinned at top, height-capped (~40vh), does **not** scroll.
- Controls column scrolls beneath the pinned preview.
- Drag-to-move stays under the thumb/Pencil.

## Architecture — consolidate first

Today the modal body is **duplicated** across two hosts:
- `src/components/layout/AdvancedToolsBar.tsx` — has Scale control; color+shadow+highlight in ONE
  combined toolbar row (shadow/highlight interleaved); short labels ("Accent").
- `src/components/sidebar/ActionsSidebar.tsx` — NO Scale; color picker is a separate pink row,
  shadow/highlight in their own row; longer labels ("Accent Color").

**Decision:** extract a single shared `MockupModalBody` component, then build the two-pane layout
once inside it. This kills the known duplication trap (flagged in HANDOFF-mockup-modal-perf) and
guarantees laptop hosts can't drift.

### Shared component
- New: `src/components/mockups/MockupModalBody.tsx`.
- Owns the two-pane / stacked responsive layout and renders the controls bar, Logo Overlay, badge,
  download grid, and preview+crop stage.
- **State stays in the hosts** (it's tied to host-specific logic: scale override, full-res capture,
  snapshot throttle, preload). The body receives state + setters + derived values via props (a
  single well-typed props object, not 30 loose args).
- **Scale control** rendered conditionally: AdvancedToolsBar passes scale props (value + setter +
  reset target); ActionsSidebar omits them and the Scale field doesn't render.
- **Controls standardize** on the AdvancedToolsBar-style unified bar. Consequence: ActionsSidebar's
  color/shadow/highlight controls change to the unified treatment — a deliberate, minor visual
  change to that host. Acceptable; both hosts should look identical anyway.

### Boundaries / interface
The body's contract (what it does / how to use it / what it depends on):
- **Does:** lays out + renders the full mockup-export modal body responsively; no business logic.
- **Use:** `<MockupModalBody {...props} />` from either host, inside `MockupModal`.
- **Depends on:** `MockupRendererV2`, `MockupCropStage`, `MockupDownloadMenu`, `WatermarkPanel`,
  `PatternpalBadgeToggle` — all already shared. No new data deps.

## Out of scope (YAGNI)
- The pre-existing non-2:3 crop-frame misalignment (`cropFraming.ts` hardcoded 2/3) — tracked
  separately in HANDOFF-mockup-modal-perf; not part of this layout work.
- No changes to export pipeline, rendering, snapshotting, or download logic.
- No new controls or features — pure layout + de-duplication.

## Testing / verification
- `npx tsc --noEmit` = 0, `npx vitest run` green (baseline 80/80).
- Manual UAT: laptop (no scroll at ≥880px), iPad landscape (two panes), iPad portrait (pinned
  preview, controls scroll, drag-to-move works with Pencil), phone width.
- Both hosts (AdvancedToolsBar modal + ActionsSidebar modal) render identically aside from Scale.
- Regression check: live-preview drag, crop slider, size-grid thumbnails/snapshot, full-res
  download all still work (don't regress the just-shipped live-preview stack).

## Risks
- Largest risk is regressing the recently shipped live-preview + crop + perf work during extraction.
  Mitigate: extract body first with layout unchanged (verify parity), THEN apply two-pane layout.
