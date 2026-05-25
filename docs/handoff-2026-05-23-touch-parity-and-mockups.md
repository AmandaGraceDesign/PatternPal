---
task: Touch/iPad parity fixes + 2 new mockup templates + shadow/highlight % typing bug
status: SHIPPED (3 commits on `merge-test`) — not yet iPad-verified
created: 2026-05-23
current_branch: merge-test
---

## What shipped (3 commits)

### `fcf6f06` fix(touch+ios): SeamInspector + iOS share-sheet for all exports

**Two real iPad bugs fixed:**

1. **[SeamInspectorModal.tsx](../src/components/analysis/SeamInspectorModal.tsx)** — canvas drag was mouse-only with `touchAction:'none'`, so iPad users could neither pan via touch nor scroll natively. Converted to Pointer Events + `setPointerCapture`. Pattern matches `SeamInspectorCanvas`.

2. **iOS save-to-Photos** (the explicit handoff backlog item) — 4 export pathways bypassed the iOS-aware download helper, hitting raw `<a download>` which silently fails on iOS Safari/Chrome.
   - **Generalized [downloadCanvas.ts](../src/lib/utils/downloadCanvas.ts)** with new `downloadBlob(blob, filename, mimeType)`. Routes through `navigator.share` on iOS → native share sheet → Save to Photos (images) or Save to Files (ZIPs). Loosened `ensureExtension` regex to leave any existing extension intact (was forcibly appending `.png` to `.zip` etc).
   - **[exportScaled.ts](../src/lib/utils/exportScaled.ts)** — Easyscale / Pattern Fill ZIP downloads
   - **[RepeatExportModal.tsx](../src/components/export/RepeatExportModal.tsx)** — social-export single image + ZIP
   - **[QuickExportModal.tsx](../src/components/export/QuickExportModal.tsx)** — single JPG
   - `downloadCanvasAsImage` / `downloadBlobAsImage` (existing exports) now delegate to `downloadBlob` — call sites in `ActionsSidebar` / `AdvancedToolsBar` unchanged.

**Audit findings (not bugs, no changes):**
- `PatternCanvas.tsx:906` mouse-drag pan — iPad uses native `overflow-auto` momentum scroll instead, graceful degradation
- All `onMouseEnter/Leave` color flips → hover-only styling, click handlers still work on touch
- `SeamAnalyzerModal` has both mouse + touch handlers (duplicated but functional)
- `PatternPreviewCanvas`, `SeamInspectorCanvas`, `MockupRendererV2` → already use Pointer Events correctly

### `e625f30` feat(mockups-v2): nursery-wallpaper + wrapping-paper-roll, drop 3 procedural placeholders

**Added:**
- **`nursery-wallpaper`** — single zone (wall), 3000×4500, full asset set incl. color mask labeled `'Accent Color'`. Mask bbox (0,0–3000,3950). `colorOverlayLabel` may need rename once Mandy sees what the color-mask actually controls.
- **`wrapping-paper-roll`** — two zones (`sheet` mask1 = full canvas, `roll` mask2 = 236,712–2780,3916). Roll zone has `patternOffset: { x: 487, y: 281 }` so the print reads as a layered piece of paper rather than one flat plane. No color overlay.

**Removed three procedural placeholders** (zero references outside registry):
- `nursery-wall` (1000×800 procedural — distinct from the new asset-backed `nursery-wallpaper`)
- `wallpaper-roll` (procedural cylinder render)
- `wrapping-paper-v2` (procedural "Flat Sheet")

### `aaecdfe` fix(mockup-controls): allow typing shadow/highlight percent without toggling checkbox

The `<input type="number">` for shadow/highlight % was nested inside the same `<label>` as its checkbox. Per HTML spec, clicks/typing inside a `<label>` retarget to its first associated form control — so selecting the percent and typing toggled the checkbox off. Split into outer `<div>` + inner `<label>` wrapping only the checkbox + text span. Applied in both [ActionsSidebar.tsx](../src/components/sidebar/ActionsSidebar.tsx) and [AdvancedToolsBar.tsx](../src/components/layout/AdvancedToolsBar.tsx). Select-and-type now works normally.

## Verification

- `npx tsc --noEmit` — clean after each commit
- `npx vitest run` — 28/28 pass
- **Not browser-verified, not iPad-verified.** That's tomorrow.

## Open issue (investigated, not fixed)

**wrapping-paper-roll highlight washes out at 100%.** Diagnosed:
- PNG is RGBA, transparent. Alpha range 0–248. ✓
- **But only 28% of pixels are fully transparent** — the other 72% have white at varying alpha
- Render path is correct: `soft-light` + `globalAlpha = percent/100`, drawn once
- soft-light(white, base) ≈ sqrt(base) — applied at globalAlpha=1.0 across 72% of canvas, the whole product reads as white. Math is right, PNG is too aggressive.

**Recommended fix (PNG-side):** re-export [wrapping-paper-roll-highlight.png](../public/mockups/v2/wrapping-paper-roll-highlight.png) with tighter highlight regions — paint only the actual specular spots, leave the rest fully transparent. Tea-towel / mens-tie highlights are the reference.

**Alternative (code-side):** add a per-template `highlightStrength` multiplier in the registry that scales `globalAlpha` down before soft-light, or cap the slider max at 60% for aggressive highlights. Not implemented — PNG fix is cleaner.

## iPad test checklist for tomorrow

**Touch parity:**
- [ ] Seam Inspector modal — drag inside canvas with finger AND Apple Pencil
- [ ] Easyscale "Generate Export" → native share sheet appears, can save .zip to Files
- [ ] Repeat Export → social media single + multi → share sheet appears
- [ ] Quick Export single JPG → share sheet appears
- [ ] Mockup download (PNG, watermarked + un-watermarked) → still works (these already used iOS-aware path)

**Mockup controls:**
- [ ] Shadow/highlight: triple-click the % number, type 45, press Enter — checkbox stays checked, value updates
- [ ] Same flow with finger/Pencil on iPad

**New templates:**
- [ ] `nursery-wallpaper` — pattern fills wall, color overlay control labeled "Accent Color" actually controls what makes sense (rename if not)
- [ ] `wrapping-paper-roll` — pattern continuous-but-offset between sheet and roll, reads as "layered"
- [ ] Removed templates no longer appear in gallery: `nursery-wall`, `wallpaper-roll`, `wrapping-paper-v2`

## Known unrelated state on branch

Pre-existing untracked v2 assets remain in `public/mockups/v2/` from prior sessions (`desk-mat-*`, `gift-bag-*`, `mens-dress-shirt-*`, `mens-tie-*`, `phone-case-*`, `womens-blouse-*`). Their registry entries are already committed, so the templates are technically broken on disk for fresh clones until those assets get added. Out of scope.

Also untracked: many handoff docs from prior days, `.claude/`, `.superpowers/`, `openspec/`, `tasks/`.

## Carried over

- iPad: re-shoot `wrapping-paper-roll-highlight.png` with tighter highlight regions
- iPad: tune `nursery-wallpaper` `colorOverlayLabel` if "Accent Color" doesn't match what the color mask covers
- iPad: confirm `wrapping-paper-roll` zones (sheet/roll) read correctly — if swapped, flip mask1/mask2 in registry
- Backlog: commit the pre-existing untracked v2 assets (desk-mat, gift-bag, mens-dress-shirt, mens-tie, phone-case, womens-blouse) so registry entries work on fresh clones
- Backlog: Entry Wallpaper `colorOverlayLabel` rename (carried from prior handoff)
