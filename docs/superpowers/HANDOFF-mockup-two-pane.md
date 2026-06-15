# Handoff — Mockup Modal Two-Pane Layout (IMPLEMENTED — awaiting human UAT)

**Updated:** 2026-06-15 · **Branch:** `feat/mockup-social-exports` · **HEAD:** `47e094f`

## Status: code complete, automated gates green, NOT merged, manual browser/iPad UAT pending

Executed via subagent-driven development (fresh implementer + spec review + code-quality review per
task). All 5 plan tasks done. tsc, vitest, and production build all pass. The one thing left is
human visual UAT across breakpoints (especially iPad-portrait Pencil drag) — that can't be done
headlessly.

## What shipped

Two-pane mockup export modal + consolidation of the duplicated modal body.

- **New shared component** `src/components/mockups/MockupModalBody.tsx` — one presentational body
  rendered by BOTH hosts. Kills the AdvancedToolsBar / ActionsSidebar duplicated-body trap. State
  stays in the hosts; the body takes a single typed props object (`MockupModalBodyProps`).
- **Two-pane responsive layout** (one 880px breakpoint, applied once in the shared body):
  - **≥880px (desktop / iPad landscape):** preview LEFT (`flex-[0_0_52%]`, `self-start`, sticky),
    controls RIGHT (`flex-1`, internal `overflow-y-auto max-h-[80vh]`). No page scroll at laptop sizes.
  - **<880px (iPad portrait / phone):** stacked — preview pinned on TOP (`sticky top-0 z-10 bg-white`),
    height-capped ~40vh, controls scroll beneath.
  - Height cap uses a cascading CSS var `[--preview-cap:40vh] min-[880px]:[--preview-cap:60vh]` fed
    into the existing width-driven sizing (`width: min(100%, calc(var(--preview-cap) * W/H))`) so the
    aspect ratio is preserved (a `max-height` would have distorted the canvas).
- **Shell widened:** `MockupModal.tsx` content wrapper `max-w-4xl` → `max-w-6xl` so two panes have room.
- **ActionsSidebar standardized** onto the unified controls bar (short labels — "Bow" not "Bow Color",
  AdvancedToolsBar styling, no separate pink color row, no Scale field). Intentional per spec, not a
  regression. Scale field is conditional (`scale?` prop) — AdvancedToolsBar only.

## Commits (this branch, on top of `f23f4a3`)

- `2136fcf` feat: scaffold shared MockupModalBody props interface
- `9f8bd74` refactor: extract MockupModalBody from AdvancedToolsBar (layout unchanged)
- `3a78f5a` refactor: ActionsSidebar uses shared MockupModalBody
- `47e094f` feat: two-pane mockup modal layout (preview pinned beside controls)
- (+ this docs commit)

## Verification

- **Automated (PASS):** `npx tsc --noEmit` = 0 errors · `npx vitest run` = 80/80 · `npm run build` = success.
- **Each task** passed spec-compliance review + code-quality review (extraction verified byte-faithful
  against the pre-refactor body via git diff; children MockupRendererV2/MockupCropStage untouched;
  no `touch-action`/overflow added to the preview pane).
- **PENDING — human UAT (cannot be automated):** open a real mockup from BOTH entry points
  (AdvancedToolsBar + ActionsSidebar) and confirm at each breakpoint:
  - Laptop ≥1280px: two panes, preview left / controls right, no scroll inside modal.
  - iPad landscape ~1024–1194px: two panes, no scroll.
  - **iPad portrait ~768–834px: stacked, preview pinned top, controls scroll beneath, and
    drag-to-move works with Pencil/touch (the page must NOT scroll while dragging the pattern).**
  - Phone ~390px: stacked, usable.
  - In all: crop slider, size-grid thumbnails update, full-res download produces the correct file.

## Not regressed (verify during UAT)

Live-preview drag-to-move, crop slider, size-grid snapshot, full-res download — all preserved
verbatim through the extraction (renderer/crop props and `onRenderComplete` closure unchanged).

## Notes / future cleanup (non-blocking)

- The `<MockupRendererV2>` JSX block carries pre-existing under-indentation, kept byte-identical
  through the move on purpose. A formatting-only `prettier` pass can normalize it later.
- Optional: if 880px gets reused elsewhere, promote it to a named Tailwind screen in the `@theme`
  block (currently a single-file arbitrary variant — fine as-is).
- ActionsSidebar still calls `getV2Template(selectedMockup)` once for the modal `title` and once
  inside the body IIFE — a tiny, harmless duplicate (the lookup is a cheap object index).
