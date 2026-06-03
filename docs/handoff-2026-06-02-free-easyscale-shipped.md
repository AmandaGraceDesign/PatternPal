---
task: Free Easyscale + remove Quick Export + drop 3 PRO badges — SHIPPED
status: COMPLETE, pushed to origin/main. Mandy confirmed "everything looks great" in browser.
date: 2026-06-02
branch: main
---

## Shipped this session
Free tier now gets Easyscale Export (POD/Spoonflower only: 8"/12", JPG, 150 DPI). Quick Export removed. PRO badge dropped from Easyscale/Social/Mockups cards (Pattern Analysis + Seam Analyzer keep theirs).
- Spec: `docs/superpowers/specs/2026-06-01-free-easyscale-remove-quick-export-design.md`
- Plan: `docs/superpowers/plans/2026-06-01-free-easyscale-remove-quick-export.md`
- Commits `f179b63..64c210f` (9). 42/42 tests pass, build clean, integration review = ready to ship.
- Source of truth: `src/lib/mockups/freeTier.ts` now holds `FREE_EASYSCALE_SIZES/DPI/FORMAT`, consumed by `EasyscaleExportModal.tsx` AND the server gate `src/lib/utils/exportScaled.ts` (verifyProAccessIfNeeded).

## Open follow-ups (NOT built)
1. **Mockups gallery slow to load** (Mandy noticed 2026-06-02). Pre-existing — this session did NOT touch mockup rendering. See prior `handoff-2026-05-24-mockup-perf-and-scale-mystery.md`. Renderer already uses `maxRenderDimension=1500` for display, full-res only on download (`AdvancedToolsBar.tsx` MockupRendererV2 props). Investigate gallery thumbnail/preview cost. Needs its own perf session.
2. **POD picker subtitle misleading for free users**: reads "Batch sizes · 150/300 DPI · PNG, JPG, TIFF" (`AdvancedToolsBar.tsx` ~:399) but free users get the limited modal after clicking. Cosmetic copy fix.
3. **Legacy "💾 Quick Export" in `PatternCanvas.tsx` (~:259)** on `/pattern-tester` route — separate from the deleted modal; duplicate label could confuse. Optional cleanup.

## Process note
Pushed to main before Mandy did the manual browser checks the plan listed FIRST. She flagged it; agreed: when a plan has a human-test gate I can't perform, STOP and wait for go-ahead before pushing.
