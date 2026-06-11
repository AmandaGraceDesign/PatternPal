# Handoff — Drag-to-crop mockup framing: BUILT, awaiting Mandy's manual device test

**Date:** 2026-06-11
**Branch:** `feat/mockup-social-exports`
**Status:** Implemented + fully reviewed + automated gate green. NOT merged, NOT PR'd.

## What was built this session

The **drag-to-crop mockup framing** feature (the "#3 like Canva" ask) is implemented via
subagent-driven-development against `docs/superpowers/plans/2026-06-11-mockup-drag-crop.md`.
Every task got a spec-compliance review + a code-quality review; the whole feature got a
final cross-cutting review. Folds in the bigger thumbnails (#1) and removes the redundant
bottom preview (#2) — the bottom `MockupRendererV2` is now moved off-screen but stays
mounted as the snapshot source (so thumbnails/stage don't go blank).

7 commits (`864aba5`..`db55493`):

| Commit | What |
|--------|------|
| `864aba5` | numeric vertical crop offset `0..1` replaces `VAnchor` enum (export lib) |
| `96b8910` | `MockupCropStage` draggable crop box (Pointer Events, iPad-safe) |
| `1570511` | MockupCropStage uses exported `MOCKUP_SRC_ASPECT` (no re-hardcode) |
| `96d76d9` | download menu: per-size offsets, active size + embedded crop stage |
| `c92e98f` | a11y: distinct focus ring + clearer aria-label on size thumbnail |
| `f18dea7` | ActionsSidebar: drag-crop offsets + hidden snapshot source |
| `db55493` | AdvancedToolsBar: drag-crop offsets + hidden snapshot source |

## Automated gate — GREEN (proof)

- `npx tsc --noEmit` → exit 0; `grep -rn "VAnchor\|socialAnchors\|onSetAnchor\|allCenterAnchors" src` → clean
- `npx vitest run` → 69/69 passing (incl. new offset cases, backwards-compat default-arg test)
- `npx eslint` on the 4 changed components → 0 errors (8 pre-existing warnings, none new)
- App boots & serves HTTP 200 under `next dev --webpack` (runtime compile confirmed)

Offset-consistency was verified end-to-end: stage drag == thumbnail preview == exported crop
all use the same standard cover-crop model and coincide for 2:3 templates. Offset 0.5 is
byte-identical to the old "center" export (backwards-compatible).

## ⭐ NEXT SESSION: Mandy's manual device test (the remaining gate)

Plan Task 6 steps 4–5 require a real device — could not be automated. Dev server: `npm run dev`.
Open the mockup modal from BOTH entry points (ActionsSidebar download panel + AdvancedToolsBar):

- [ ] Bottom full-size preview is gone; the crop stage shows instead.
- [ ] Tap Square row → square box appears; drag up/down; stage + row thumbnail agree as you drag.
- [ ] Repeat for Portrait. Story/Pinterest/Full show "no manual crop" / "no crop".
- [ ] Download Square + Portrait → open PNGs → framing matches where you dragged the box.
- [ ] Download everything centered (untouched) → output unchanged from before the feature.
- [ ] **iPad/Pencil (mandatory parity):** box drags smoothly with finger AND Pencil, page does
      not scroll while dragging (`touch-action: none`), box stays in bounds.
- [ ] **Curtain template specifically** — see known limitation below.

If a fixup is needed, commit: `git commit -m "test: verify drag-crop across desktop + iPad..."`

## Known limitation to verify/decide (deferred per plan scope)

`MockupCropStage` and `cropsVertically()` both assume the snapshot aspect is `MOCKUP_SRC_ASPECT = 2/3`,
but the export reads the LIVE source dims. Every template is ~2:3 EXCEPT **Curtain (3600×4500 = 0.8)**.
On Curtain's social sizes the drag box geometry won't match the export (and for 4:5 Portrait the
export never changes despite a draggable box). The plan explicitly scoped this out ("non-2:3-template
note stays out of scope"); the final review concurred: **defer + document, don't block**.
Clean fix when ready: thread the active template's real `canvasSize` aspect into both
`MockupCropStage` and `cropsVertically()` instead of the `2/3` constant. ~30 templates, only Curtain
affected, only its croppable social sizes.

Decision for Mandy: ship as-is (Curtain crop slightly off) and fix in a follow-up, or fix before merge.

## 🐞 REGRESSION found in live review (fix next session) — logo/watermark missing from preview

When the user adds a logo, it no longer shows on the visible preview (the crop stage).
**Root cause:** the logo is a DOM overlay (`WatermarkPreviewOverlay`, + `BadgePreviewOverlay`),
NOT painted into the mockup `<canvas>`. The crop stage only shows the canvas *snapshot*
(`toDataURL`), which never contained the watermark. The real overlays still live inside the
bottom preview block that Tasks 4/5 moved OFF-SCREEN (`left:-10000px`) — so the logo preview is
off-screen. Export is unaffected (export stamps the watermark separately).

**Fix:** render a watermark + badge overlay ON the crop stage, over the snapshot, scaled to the
240px stage frame. Care needed: the existing overlay uses container-query `cqw` units sized to
the real canvas (`containerType: inline-size` on the canvas wrapper). The stage frame is a fixed
240px / `aspectRatio:'2 / 3'` box — set `containerType: inline-size` on it and reuse
`WatermarkPreviewOverlay`/`BadgePreviewOverlay` so the logo lands in the same relative spot the
export stamps. Pass watermark config + badge-visible into `MockupDownloadMenu`→`MockupCropStage`
(both consumers already have `watermark` and `badgeEnabled`/`shouldStampBadge` in scope).
Verify the logo position in the stage matches the exported PNG.

## Risk note carried from the plan

Pattern-drag on the bottom preview (`MockupRendererV2 dragEnabled`) is **retired** — moving the
renderer off-screen removes that interaction from the modal. If Mandy still wants to drag-reposition
the tiled pattern, the fallback is to keep the renderer visible at small size above the crop stage
instead of off-screen. The `dragEnabled` prop is now inert (documented by a code comment).
