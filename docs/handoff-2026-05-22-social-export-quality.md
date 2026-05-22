---
task: Fix mens-dress-shirt mask3 gap, mens-tie pixelation/jacket layers, social export 2× resolution
status: SHIPPED (tsc clean). One commit. Browser-verified by user for the v2 social export migration; this commit's changes verified visually for the dress shirt fix; tie + 2× export not yet end-to-end verified.
created: 2026-05-22
current_branch: merge-test
---

## What changed

Three related quality fixes shipped together:

### 1. Men's dress shirt — uncovered strip near the placket

`patternArea.width` for panel-2 and panel-3 didn't fully contain their masks,
so the rightmost slice of each mask got no pattern (visible as a pink/blank
vertical strip near the button placket, most obvious between the lower
buttons).

Diagnostic: dumped each mask's actual content bbox via PIL at threshold>128
and compared to the configured `patternArea`. mask3 extends to x=2273, but
panel-3's patternArea ended at x=2203 — a 70px gap. mask2 ends at x=2307,
panel-2 ended at x=2274 — a 33px gap.

Fix:
- panel-2 width: 2274 → 2310
- panel-3 width: 2203 → 2280

Side effect: the rotation pivot is `patternArea.width / 2`, so widening
shifts the rotation centre right by ~18px / ~38px. Visually almost
imperceptible.

### 2. Men's tie — pixelation and jacket-layer defaults

**Pixelation** — the tie's narrow zone (621px wide in a 3000px canvas)
forces the pattern image to be upscaled ~2-3× to fill the column. Default
canvas `imageSmoothingQuality` is `'low'`, which produces blocky output at
that scale. Set `imageSmoothingEnabled = true; imageSmoothingQuality = 'high'`
on the per-zone scaled tile canvas in `MockupPipeline.ts`. Helps every
template but especially narrow ones like the tie.

**Jacket layers off by default** — three new behaviors:
- Added `additionalShadowDefaultEnableds?: boolean[]` and
  `additionalHighlightDefaultEnableds?: boolean[]` to template types.
- mens-tie sets both to `[false]` — jacket shadow + jacket highlight start
  off (color overlay was already `defaultEnabled: false`).
- `renderMockupV2Offscreen` now honours these defaults (it previously
  ignored them and force-enabled every layer in social exports). The
  mockup view sidebars and gallery thumbnail also honour them.

User can still flip these on via the sidebar toggle in the mockup view.

### 3. Social media exports rendered at 2× resolution

New constant `SOCIAL_EXPORT_SCALE = 2` in `RepeatExportModal.tsx`. Export
path multiplies `preset.pxW` and `preset.pxH` by 2 before passing them to
`generateSocialFillBlob`, `applyMockupOverlay`, and `applyWatermarkToBlob`.

| Preset | Was | Now |
|--------|-----|-----|
| Instagram / FB Post | 1080×1080 | 2160×2160 |
| Instagram / FB Portrait | 1080×1350 | 2160×2700 |
| Story / Reel / TikTok | 1080×1920 | 2160×3840 |
| Pinterest Pin | 1000×1500 | 2000×3000 |
| Facebook Cover | 1640×624 | 3280×1248 |

Why: the 3000×4500 mockup canvas was downsampled by ~5× when stamped into
a 1080² social canvas. High-frequency textures (the corduroy jacket weave)
aliased badly. 2× export turns that into a ~2.5× downsample, which the
canvas handles much more gracefully. Combined with a pyramid downsample
(halving steps until close to target size) inside `drawMockupOverlay`
that I added earlier in the session.

Watermark sizing uses `w / 1080` as the scale factor, so it stays
proportional at the new resolution — no separate fix needed.

The on-screen preview still renders at the standard preset dimensions;
only the exported file changes.

## Files

EDITED
- [src/lib/mockups/mockupEngineV2/MockupPipeline.ts](../src/lib/mockups/mockupEngineV2/MockupPipeline.ts)
  — high-quality image smoothing on scaledCtx (3 lines added).
- [src/lib/mockups/mockupEngineV2/templates/types.ts](../src/lib/mockups/mockupEngineV2/templates/types.ts)
  — new `additionalShadow/HighlightDefaultEnableds` fields.
- [src/lib/mockups/mockupEngineV2/templates/templateRegistry.ts](../src/lib/mockups/mockupEngineV2/templates/templateRegistry.ts)
  — mens-dress-shirt panel-2/3 widths; mens-tie default-enabled flags.
- [src/components/sidebar/ActionsSidebar.tsx](../src/components/sidebar/ActionsSidebar.tsx)
  — initialize shadow/highlight toggles from template defaults.
- [src/components/layout/AdvancedToolsBar.tsx](../src/components/layout/AdvancedToolsBar.tsx)
  — same.
- [src/lib/utils/renderMockupV2Offscreen.ts](../src/lib/utils/renderMockupV2Offscreen.ts)
  — pass `colorOverlayEnabled` + `additionalShadow/HighlightEnableds` from
  template defaults.
- [src/components/mockups/MockupGalleryModal.tsx](../src/components/mockups/MockupGalleryModal.tsx)
  — pass the new defaults to the thumbnail renderer.
- [src/components/export/RepeatExportModal.tsx](../src/components/export/RepeatExportModal.tsx)
  — pyramid downsample in `drawMockupOverlay`; `SOCIAL_EXPORT_SCALE = 2`
  applied throughout the export loop.

## Verification

- `npx tsc --noEmit` exits 0 after each batch of edits.
- Mens-dress-shirt: user confirmed the placket gap is fixed visually.
- Mens-tie + 2× export: not yet verified end-to-end after the final 2×
  export change. User should re-export an Instagram post with mens-tie
  selected and confirm: (1) jacket has natural texture without moiré,
  (2) tie pattern is sharp, (3) saved file is 2160×2160.

## Gotchas

- The previous `renderMockupV2Offscreen` silently force-enabled every
  layer (including layers the template said default off). If you were
  relying on that behavior anywhere, it's gone.
- File sizes for social exports are roughly 4× bigger (2× W × 2× H).
  PNG files in particular will be chunky. JPG handles it fine.
- The pyramid downsample inside `drawMockupOverlay` creates intermediate
  canvases. For small downsamples (the new 2× export is ~2.5× from the
  mockup) the loop may not iterate at all — that's intentional, it only
  steps when the source is >2× larger than the destination.

## Not done

- Browser-verify mens-tie social export end-to-end with the 2× resolution
  change — confirm jacket weave looks clean and the file is at 2× preset
  size.
- iPad verification for the social export picker scroll behavior +
  v2 mockup export (carried over from prior handoff).
- Consider deleting legacy `mockupTemplates.ts` + `renderMockupOffscreen.ts`
  if nothing else references them (carried over).
- Outstanding backlog item: iPad save-to-Photos for Easyscale + Pattern
  Fill exports (see [tasks/todo.md](../tasks/todo.md)).
