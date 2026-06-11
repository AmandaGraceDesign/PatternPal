# HANDOFF — Unified Mockup Download Menu

**Branch:** `feat/mockup-social-exports` · **Status:** Design ✅ + plan ✅ committed. Implementation NOT started. Nothing pushed; `main` untouched; working tree clean.

## ▶ Start the new session with this prompt

> Read `docs/superpowers/HANDOFF-unified-mockup-download-menu.md`, then execute `docs/superpowers/plans/2026-06-11-unified-mockup-download-menu.md` using **superpowers:subagent-driven-development** on branch `feat/mockup-social-exports`. Tasks 1–5 are code; Task 6 is manual verification I (the user) will do. Don't push or merge.

## Why this work exists

The clean-mockup → social-size export (prior plan `2026-06-09-mockup-social-exports.md`, code complete & green on this branch) put a **"Share to social"** size list in the Mockup Modal *body*, while the existing **full-size download is a button in the modal header**. During manual testing the user found this confusing — the eye lands on the social section and never connects it to the header Download. **Fix:** merge both into ONE EasyScale-style "Download mockup" checklist where **Full size** is just the first selectable item. Approved approach = Option A (one list, header button retired).

- **Design spec:** `docs/superpowers/specs/2026-06-11-unified-mockup-download-menu-design.md`
- **Implementation plan (6 tasks, full code):** `docs/superpowers/plans/2026-06-11-unified-mockup-download-menu.md`

## What's already on the branch (prior work — done & green)

The 2026-06-09 feature: shared `socialSizes.ts` presets, `mockupSocialExport.ts` (cover-crop geometry + `downloadMockupSocialSizes` + watermark/badge), social export wired into both Mockup-Modal entry points (`AdvancedToolsBar.tsx` + `ActionsSidebar.tsx`), the sidebar download unified to 1500×2250 @ 150 DPI (Option 2), and a signpost note in `RepeatExportModal.tsx`. Gates last green: `tsc` clean, **55/55** vitest. The unified-menu work builds directly on these helpers.

## The 6 tasks (see plan for exact code)

1. **`socialSizes.ts`** — add `'full-size'` to `SizeSlug`, `FULL_SIZE_PRESET` (1500×2250), `mockupDownloadSizes()` = `[full-size, ...mockupSocialSizes()]`; + 3 unit tests. (Do NOT add full-size to `SOCIAL_SIZE_PRESETS` — that feeds the separate Social Export modal.)
2. **`mockupSocialExport.ts`** — add `exportFullSizeMockupBlob()` (½ downscale + watermark/badge + `injectPngDpi(150)`, no crop); branch `downloadMockupSocialSizes` loop on `slug === FULL_SIZE_SLUG`.
3. **`AdvancedToolsBar.tsx`** — replace body social section with the unified "Download mockup" list; rename `onSocialExport`→`onDownloadExport` (generalized Pro guard); default-select/reset to `{full-size}` when unlocked; remove header `onDownload` wiring.
4. **`ActionsSidebar.tsx`** — identical redesign (mirror entry point; builds `baseName` via `getV2Template(selectedMockup)?.name`).
5. **`MockupModal.tsx`** — remove the header Download `<button>` + now-unused `onDownload`/`isDownloading` props.
6. **Manual verification** — user runs `npm run dev`, desktop + iPad. Checklist in the plan.

## Key correctness points (don't drift)

- **Gating preserved, no new rules.** Per-row `locked`: Full size → `!isPro && !isFreeMockup(selectedMockup)`; social → `!isPro && !isFreeSocialSize(slug)`. Square (`instagram-post`) is the free social size.
- **Full size is NOT cover-cropped** — it's the whole product shot, downscaled ½ to 1500×2250 @ 150 DPI (matches the old header button exactly).
- **Single vs zip:** 1 selection → one PNG; 2+ → one zip (mixed full+social allowed). Reuses the existing loop — don't rebuild it.
- **Two entry points must stay identical.** Apply Tasks 3 & 4 as the same change in both files; read each file's current block first (line numbers in the plan are approximate).
- **Imports in `mockupSocialExport.ts` use relative paths** (no `@/` alias — vitest has no alias). Keep that.
- **Don't touch** the Social Export modal logic or the Task-6 signpost note (still correct).

## Gates per task
`npx tsc --noEmit` clean · `npx vitest run` green · `npx eslint <touched file>` no NEW warnings. Method = subagent-driven-development: implementer → spec review → quality review → fix loop → commit, one file/task at a time. **Don't push/merge — user verifies first.**

## Note
A dev server may still be running from the prior session (was on `http://localhost:3001`). It serves the OLD two-button UI until Tasks 3–5 land; restart after implementing.
