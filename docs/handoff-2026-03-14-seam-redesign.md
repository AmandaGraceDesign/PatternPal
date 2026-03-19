# Handoff — March 14, 2026 — Seam Inspector Redesign

## Branch: `seam-analyzer`

## Goal

Redesign SeamInspector to open as a full-page view in a **new browser tab** instead of a cramped modal. Single view mode with pink dashed tile outline (works for all repeat types). Maximum canvas space for panning at high zoom.

## Status: READY TO EXECUTE

- [x] Brainstorming complete (visual companion used for mockups)
- [x] Spec written: `docs/superpowers/specs/2026-03-14-seam-inspector-redesign.md`
- [x] Spec reviewed and approved
- [x] Implementation plan written: `docs/superpowers/plans/2026-03-14-seam-inspector-redesign.md`
- [x] Plan reviewed and approved
- [ ] Implementation (4 chunks, 9 tasks)

## Design Decisions (from brainstorming)

1. **New browser tab** (not modal overlay) — maximum canvas space
2. **Single view** — removed H-Seam/V-Seam modes, user just pans around
3. **Pink dashed tile outline** replaces crosshair — works for full-drop, half-drop, half-brick (crosshair only works for full-drop since half-drop/half-brick create T-junctions, not 4-corner intersections)
4. **Minimal top bar** — title + filename + repeat-type badge + hint text
5. **Floating bottom-left control** — zoom +/- and outline toggle
6. **Hybrid zoom** — buttons step 25%, scroll wheel steps 10%, range 25–800%
7. **Jump straight in** at 200% zoom — no intro screen
8. **Zoom anchored to cursor** — scroll-wheel zoom toward pointer position

## Implementation Plan Summary

| Chunk | Tasks | What |
|-------|-------|------|
| 1 | 1–2 | Cross-tab communication: `openSeamInspector` helper + `/seam-inspector` page route |
| 2 | 3–4 | Full-page canvas: `SeamInspectorCanvas` component with tiling, outline, zoom, pan |
| 3 | 5–7 | Rewire parents: SeamAnalyzer, AdvancedToolsBar, ActionsSidebar → use `openSeamInspector()` |
| 4 | 8–9 | Delete old modal, build verify, browser test |

## Key Files

- **Spec:** `docs/superpowers/specs/2026-03-14-seam-inspector-redesign.md`
- **Plan:** `docs/superpowers/plans/2026-03-14-seam-inspector-redesign.md`
- **New page route:** `app/seam-inspector/page.tsx` (to be created)
- **New canvas component:** `src/components/analysis/SeamInspectorCanvas.tsx` (to be created)
- **New helper:** `src/lib/seam-inspector/openSeamInspector.ts` (to be created)
- **Old file to delete:** `src/components/analysis/SeamInspector.tsx`

## To Resume

Run the implementation plan. Start with `/clear` for a fresh context window, then execute the plan at `docs/superpowers/plans/2026-03-14-seam-inspector-redesign.md`.

## Commits This Session

- `d8dd01a` fix: enable image smoothing in SeamInspector
- `c7e7f11` docs: add seam inspector redesign spec
- `63e0f52` docs: add seam inspector redesign implementation plan
