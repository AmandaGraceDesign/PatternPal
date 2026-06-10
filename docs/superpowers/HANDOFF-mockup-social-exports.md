# HANDOFF — Clean Mockup → Social-Size Exports

**Branch:** `feat/mockup-social-exports` · **Status:** Task 1 of 7 done & committed. Resume at Task 2.

## Start the new session with this prompt

> Resume executing `docs/superpowers/plans/2026-06-09-mockup-social-exports.md` from Task 2 using subagent-driven development (superpowers:subagent-driven-development). Branch is `feat/mockup-social-exports`. Read the plan's "Execution progress" section first.

## What this feature is

Add a "clean product mockup → social sizes" export to the **Mockup Modal** (where pattern drag-placement lives), cover-cropped to fill, with logo + badge. Sizes: Square, Portrait 4:5, Story, Pinterest — **no FB Cover**. The **Social Export modal** is unchanged except for one signpost note. Full rationale in the spec.

- **Spec:** `docs/superpowers/specs/2026-06-09-mockup-social-exports-design.md`
- **Plan (full code for every task):** `docs/superpowers/plans/2026-06-09-mockup-social-exports.md`

## Done

- ✅ **Task 1** (commit `04df5d8`): created `src/lib/export/socialSizes.ts` (shared size presets + `mockupSocialSizes()` eligibility) and `src/__tests__/socialSizes.test.ts`; rewired `src/components/export/RepeatExportModal.tsx` to import them. Verified: 51 tests pass, `tsc --noEmit` clean, eslint unchanged, no leftover local defs.

## Remaining (in order)

- **Task 2** — `computeCoverCropRect` pure geometry (TDD) in new `src/lib/utils/mockupSocialExport.ts`.
- **Task 3** — append `coverCropToBlob` + `exportMockupSocialBlob` + `downloadMockupSocialSizes` (canvas glue + zip) to that file. First step: confirm `WatermarkConfig` is exported from `src/lib/watermark/watermark.ts`.
- **Task 4** — Mockup Modal export UI + handler in `src/components/layout/AdvancedToolsBar.tsx` (reuses existing `downloadAfterRenderRef` + `setIsCapturingFullRes` full-res capture).
- **Task 5** — same wired into `src/components/sidebar/ActionsSidebar.tsx`. ⚠️ Only task with uncertainty: its local watermark/badge variable names may differ — its Step 1 is a `grep` to confirm before reusing the shared helper.
- **Task 6** — signpost note in `RepeatExportModal.tsx` near the mockup-overlay control.
- **Task 7** — manual verification, desktop **and** iPad (≈half of users are iPad/Pencil; expected export dims = preset × 2).

## Key facts for the executor

- Test runner: **Vitest + jsdom**, tests in `src/__tests__/`. Existing canvas code is verified by running the app, not pixel-asserted — so Tasks 2's geometry is unit-tested; Tasks 3–6 canvas/UI are verified in Task 7.
- Each task commits atomically. Don't work on `main`.
- Download helpers: `downloadBlob` from `@/lib/utils/downloadCanvas`; `JSZip` from `jszip`.
- Non-goals (do NOT build): background fill / transparent PNG, FB Cover clean-mockup, fixing the Social composite's no-drag divergence, custom crop positioning.

## Visual companion

The brainstorm mockups persist under `.superpowers/brainstorm/` (gitignored) if you want to revisit the agreed UI. Server is stopped.
