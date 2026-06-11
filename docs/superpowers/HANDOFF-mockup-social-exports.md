# HANDOFF — Clean Mockup → Social-Size Exports

**Branch:** `feat/mockup-social-exports` · **Status:** Tasks 2–4 done & green. Task 5 committed but **awaiting a scope decision (below)**. Tasks 6–7 not started. Nothing pushed; `main` untouched. Working tree clean.

## ▶ Start the new session with this prompt

> Read `docs/superpowers/HANDOFF-mockup-social-exports.md`. We're mid-execution of `docs/superpowers/plans/2026-06-09-mockup-social-exports.md` using **superpowers:subagent-driven-development** on branch `feat/mockup-social-exports`. Resume at "THE DECISION TO MAKE FIRST" — re-ask me that question, then continue Task 5 per my answer, then Tasks 6–7. I want to test before any merge/push.

---

## ⏸ THE DECISION TO MAKE FIRST (resume here)

Task 5 wired the social export into the **ActionsSidebar** entry point correctly — BUT to get the full-res canvas the export needs, it also **rewired the existing "Download mockup" button** there, changing its output. That existing-button change was **not requested**.

| | Before | After (committed `68aca30`) | AdvancedToolsBar entry |
|---|---|---|---|
| ActionsSidebar single-file "Download mockup" | ~1000×1500 (preview-res) | **~3000×4500, ~4× larger file, no 150-DPI metadata** | 1500×2250 @ 150 DPI |

A spec review confirmed a **minimal alternative was viable**: the existing `onDownload` fires *before* the full-res render is triggered, so it could have been left untouched, with the new full-res pipeline used **only** by the social export.

**The new social export feature is correct and works regardless of this choice.** This only affects the *existing* sidebar download button. Pick one:

- **Option 1 — Preserve existing (minimal) [RECOMMENDED].** Redo Task 5 so the sidebar "Download mockup" behaves exactly as before; the new full-res capture pipeline is used ONLY by `onSocialExport`. Most minimal; matches "only modify what's requested."
  - *Mechanics:* In `src/components/sidebar/ActionsSidebar.tsx`, restore `onDownload` to its pre-Task-5 synchronous form (see it at `git show d4f09de:src/components/sidebar/ActionsSidebar.tsx`), while KEEPING the new `socialSizes` state, `onSocialExport`, the size-chip UI, the `setSocialSizes(new Set())` resets, and the `downloadAfterRenderRef`/`isCapturingFullRes`/`onRenderComplete` + `MockupRendererV2` props (those feed the social export). Confirm the renderer still defaults to preview mode when `isCapturingFullRes` is false so the synchronous `onDownload` still grabs preview-res. Re-run spec + quality review, then amend/replace commit `68aca30`.

- **Option 2 — Unify both @ 150 DPI.** Keep the rewire; ADD the same 2× downscale + `injectPngDpi(150)` step AdvancedToolsBar uses so BOTH entry points' download buttons produce identical 1500×2250 files. A deliberate consistency/quality improvement to the existing button.
  - *Mechanics:* In ActionsSidebar's `downloadAfterRenderRef.current` callback, replicate the downscale+DPI block from `src/components/layout/AdvancedToolsBar.tsx` (the `OUTPUT_DPI = 150`, `dl.width = mockupCanvas.width / 2`, `injectPngDpi(...)` block, ~lines 578-602). Import `injectPngDpi`. Re-review, commit.

- **Option 3 — Keep as-is (full-res 3000×4500).** Accept `68aca30` as final for Task 5. No code change — just mark Task 5 done and proceed. *Not recommended:* leaves the two entries inconsistent and drops the 150-DPI metadata (large files).

---

## ✅ Done (commits, in order)

- **Task 1** (`04df5d8`): shared `src/lib/export/socialSizes.ts` presets + `mockupSocialSizes()` eligibility; `RepeatExportModal` rewired to import them.
- **Task 2** (`dddafcd`): pure `computeCoverCropRect` + `CoverCropRect` in `src/lib/utils/mockupSocialExport.ts`; 4 TDD unit tests. Spec ✅ + quality ✅.
- **Task 3** (`243ade4`): appended `coverCropToBlob`, `MockupSocialOpts`, `exportMockupSocialBlob`, `downloadMockupSocialSizes` to that file (canvas + watermark/badge + 1-file-vs-zip). Imports are **relative paths** (not `@/`) because `vitest.config.ts` has no `@/` alias — this is correct/required. Includes a `console.error` in the per-size catch (from review). Spec ✅ + quality ✅.
- **Task 4** (`d4f09de`): Mockup Modal export UI + `onSocialExport` in `src/components/layout/AdvancedToolsBar.tsx` (primary entry). Reuses the existing `[data-mockup-modal]` querySelector capture (the component has no ref). Passes the full-res canvas straight through (the helper scales per-preset). Includes a **stale-selection fix**: `setSocialSizes(new Set())` resets at the per-template `useEffect` + both modal `onClose` sites; and an Export-button label fix. Spec ✅ + quality ✅.
- **Task 5** (`68aca30`): social export wired into `src/components/sidebar/ActionsSidebar.tsx` (secondary entry). Social-export feature itself is **spec-compliant** (state/handler/UI/gating/resets all correct, `setSocialSizes` resets present). **BUT** it also migrated the existing `onDownload` → see the decision above. **Awaiting decision before this task is accepted.**

**Gates at each step:** `npx tsc --noEmit` clean, `npx vitest run` = 55/55, eslint introduced 0 new warnings. Tasks 2–5 each touched only their intended file.

## ⬜ Remaining

- **Task 5 finalize** — apply chosen option, re-review, commit.
- **Task 6** — signpost note in `src/components/export/RepeatExportModal.tsx` near the mockup-overlay control (static helper text pointing users to the Mockup Modal for a clean full-size mockup). Plan has the exact JSX.
- **Task 7** — **manual verification, desktop + iPad** (≈half of users are iPad/Pencil). User wants to do this and test before any merge/push. Expected export dims = preset × 2: Square 2160×2160, Portrait 2160×2700, Story 2160×3840, Pinterest 2000×3000. Cover-cropped to fill, no pattern background, drag placement honored, logo + "Tested in PatternPAL" badge present. Free tier: only the Square chip selectable; others 🔒 → upgrade modal. No FB Cover chip. Social Export modal unchanged + new signpost note visible. Full steps in the plan's Task 7.

## Process / key facts for the executor

- **Method:** superpowers:subagent-driven-development — per task: implementer subagent → spec-compliance review subagent → code-quality review subagent → fix loop → commit. Don't work on `main`. Commit each task atomically.
- **Test runner:** Vitest + jsdom, `src/__tests__/`. Canvas/UI is verified by running the app (Task 7), not pixel-asserted; only pure geometry (Task 2) is unit-tested.
- **Helper API** (`src/lib/utils/mockupSocialExport.ts`): `downloadMockupSocialSizes(sourceCanvas, presets, { watermark, isPro, badgeEnabled }, baseName)`. `mockupSocialSizes()` returns the 4 croppable presets (no FB Cover). `isFreeSocialSize(slug)` is true only for `'instagram-post'` (the free Square).
- **Non-goals (do NOT build):** background fill / transparent PNG, FB Cover clean-mockup, fixing the Social composite's no-drag divergence, custom crop positioning.
- **Don't merge or push** — the user does that after testing.

## Visual companion

Brainstorm mockups persist under `.superpowers/brainstorm/` (gitignored) if you want to revisit the agreed UI. Spec: `docs/superpowers/specs/2026-06-09-mockup-social-exports-design.md`.
