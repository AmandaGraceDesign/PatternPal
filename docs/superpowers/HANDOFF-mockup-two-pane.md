# Handoff — Mockup Modal Two-Pane Layout (READY TO EXECUTE)

**Updated:** 2026-06-15 · **Branch:** `feat/mockup-social-exports` · **HEAD:** `68daed5`

## Status: design + plan committed, NOT started

Brainstormed (with visual companion), spec'd, and planned. Zero implementation yet. Clean tree.
Resume in a fresh session and execute the plan.

## The decision (locked via visual brainstorming)

Mockup export modal goes **wide / two-pane** to fix: controls (Scale/Shadow/Highlight at top) are
separated from drag-to-move (preview at the bottom), forcing scrolling.

- **Desktop / iPad landscape (≥880px):** preview LEFT (pinned), controls RIGHT. No scroll.
- **iPad portrait / phone (<880px):** preview pinned on TOP (~40vh cap), controls scroll beneath.
- **Consolidate first:** extract one shared `MockupModalBody` component (kills the
  `AdvancedToolsBar` / `ActionsSidebar` duplicated-body trap), THEN apply layout once.
- Scale field conditional (AdvancedToolsBar only). ActionsSidebar's controls intentionally adopt
  the unified bar — expected, not a regression.

## Artifacts

- **Spec:** `docs/superpowers/specs/2026-06-15-mockup-modal-two-pane-design.md`
- **Plan:** `docs/superpowers/plans/2026-06-15-mockup-modal-two-pane.md` — 5 tasks, full code/prop
  wiring. Task 1 scaffold props → Task 2 extract from AdvancedToolsBar (parity) → Task 3 point
  ActionsSidebar at it → Task 4 apply two-pane layout → Task 5 verify + doc.

## Critical constraints

- **Extract with layout UNCHANGED first, verify parity, THEN change layout.** Do not regress the
  just-shipped live-preview + crop + perf stack (drag, crop slider, size-grid snapshot, full-res
  download must keep working).
- **iPad parity is mandatory** (~half users on iPad/Pencil): Pointer Events + `touch-action: none`,
  test drag-to-move on a real iPad-portrait viewport.
- Gate every task: `npx tsc --noEmit` = 0, `npx vitest run` = 80/80, + manual UAT per breakpoint.

## How to resume

Fresh session: *"execute the two-pane plan"* — chosen execution mode was **subagent-driven**
(`superpowers:subagent-driven-development`): fresh implementer per task + spec review + code-quality
review, looping. Plan tasks are self-contained with exact line ranges and prop wiring.

## Key line ranges (verify before editing — may shift)

- AdvancedToolsBar modal body: `src/components/layout/AdvancedToolsBar.tsx:620-913`
- ActionsSidebar modal body: `src/components/sidebar/ActionsSidebar.tsx:503-759`
- Modal shell width cap to widen: `src/components/mockups/MockupModal.tsx:91` (`max-w-4xl` → `max-w-6xl`)
