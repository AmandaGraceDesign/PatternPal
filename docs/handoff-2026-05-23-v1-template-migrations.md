---
task: Migrate 6 v1 templates to v2 pipeline + swap tea-towel-2 → tea-towel-3
status: SHIPPED (committed) — not yet browser-verified
created: 2026-05-23
current_branch: merge-test
---

## What shipped

7 templates moved onto the v2 mockup engine (zones / mask-driven). All canvas sizes are now 3000×4500 (entry-wallpaper is 3000×4472 because the source asset is). The 6 v1 ids (`onesie`, `fabric-swatch`, `wallpaper`, `throw-pillow`, `wrapping-paper`, `journal`) are preserved — required by [src/__tests__/templateRegistry.test.ts:30](../src/__tests__/templateRegistry.test.ts#L30) MOCK-01 and [src/__tests__/galleryModal.test.ts:29](../src/__tests__/galleryModal.test.ts#L29).

| id | name (display) | zones | physicalSize | offset trick? | colorOverlayLabel |
|---|---|---|---|---|---|
| `onesie` | Baby Onesie | body + sleeves | 10.5×18" | yes (sleeves) | "Onesie Trim Color" |
| `fabric-swatch` | Fabric Swatch | body + detail | 12×12" | yes (detail) — **user-requested** | — |
| `wallpaper` | Entry Wallpaper | wall (single) | 86×60" | n/a | "Accent Color" |
| `throw-pillow` | Throw Pillow | pillow (single) | 18×18" | n/a | — |
| `wrapping-paper` | Wrapping Paper (Gift Box) | box (single) | 8×8" (preserved per user) | n/a | "Bow Color" |
| `journal` | A5 Journal | cover (single) | 5.5×8.5" | n/a | — (no shadow/highlight provided) |
| `tea-towel-3` | Tea Towel (Folded) | body + stripe | 20×28" | yes (stripe) | — |

**Asset-family naming note:** for backward-compat the registry keys (`wrapping-paper`, `wallpaper`) no longer match their asset filenames (`gift-box-*`, `entry-wallpaper-*`). Comments in the registry explain why.

**Offset trick** = `patternOffset: { x: 487, y: 281 }` on the secondary zone so its pattern doesn't tile in phase with the body. Same shift used on tote-bag trim. Quick to remove if a particular template reads as "broken" rather than "layered".

**Special-case UI labels** (the `selectedMockup === 'onesie' ? ...` ternaries in [ActionsSidebar.tsx:410](../src/components/sidebar/ActionsSidebar.tsx#L410) and [AdvancedToolsBar.tsx:467](../src/components/layout/AdvancedToolsBar.tsx#L467)) are now redundant for everything except the fallback case — every migrated template sets `colorOverlayLabel` directly or has no color overlay. Not cleaned up; not needed for correctness.

**Asset deletions** (22 files):
- v1 legacy under `public/mockups/`: `onesie*` (4), `journal*` (2), `wrapping_paper*` (5), `throw_pillow*` (2), `fabric_swatch*` (2), `wallpaper*` (2)
- v2 deprecated under `public/mockups/v2/`: `tea-towel-2*` (5)

**Asset additions** (37 files under `public/mockups/v2/`): the 7 new template families + their shadow/highlight/color-mask siblings. One filename typo fixed inline: `throw-pillow-hghlight.png` → `throw-pillow-highlight.png`.

## Files

EDITED
- [src/lib/mockups/mockupEngineV2/templates/templateRegistry.ts](../src/lib/mockups/mockupEngineV2/templates/templateRegistry.ts) — all 7 entries replaced
- [docs/handoff-2026-05-22-tote-cleanup-preview-sizing.md](handoff-2026-05-22-tote-cleanup-preview-sizing.md) — marked tote browser-verified

## Verification

- `npx tsc --noEmit` — clean
- `npx vitest run src/__tests__/templateRegistry.test.ts` — 23/23 pass (MOCK-01 v1-id preservation, MOCK-02 dress zones, MOCK-03 sizeLabel format)
- **Not browser-verified** — every migrated template needs eyes-on. Priority checks:
  - **Mask-offset trio** (onesie sleeves, fabric-swatch detail, tea-towel-3 stripe): does the offset read as "layered fabric" or "broken render"? Remove `patternOffset` line on the offending zone if wrong.
  - **Entry Wallpaper "Accent Color"** label: the color-mask bbox (1295, 1968, 2884, 2864) is positioned where a frame/mirror/decor item would live. Rename `colorOverlayLabel` to match what it actually controls (e.g., "Frame Color").
  - **Onesie sleeves**: 10.5" physicalWidth was inherited from v1 — onesie body is now smaller relative to canvas than v1, may need scale tweak.
  - **Gift box / Bow Color**: confirm the color-mask actually controls the bow (was the case in v1).

## Diagnostic notes

- Mask bboxes were derived via Python+PIL by thresholding L>128 on each mask. Union bboxes used for `patternArea` when multiple zones exist.
- Entry-wallpaper canvas is 3000×**4472**, not the 4500 convention — kept as-is to match the source asset. If it causes preview-width inconsistencies (preview is locked to 600px CSS but height is intrinsic), worth re-shooting to 4500.
- Journal v2 has no shadow/highlight/color assets — render will be flatter than other templates. Provide assets if you want shadow/highlight depth.

## Known unrelated state on the branch

Pre-existing untracked v2 assets from prior sessions remain in `public/mockups/v2/` (`desk-mat-*`, `gift-bag-*`, `mens-dress-shirt-*`, `mens-tie-*`, `phone-case-*`). Their registry entries are already committed, so the templates are technically broken on disk for fresh clones until those assets get added. Out of scope for this session — separate cleanup.

## Not done

- Browser-verify all 7 migrated templates.
- Tune `colorOverlayLabel` on entry-wallpaper to match what the accent mask actually controls.
- Consider committing the pre-existing untracked v2 assets (desk-mat, gift-bag, mens-dress-shirt, mens-tie, phone-case) so the registry entries actually work for fresh clones.
- Outstanding backlog (carried over):
  - iPad verification for social export picker scroll + v2 mockup export
  - iPad save-to-Photos for Easyscale + Pattern Fill
