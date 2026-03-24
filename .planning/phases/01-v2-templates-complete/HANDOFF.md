# Phase 1 Handoff — V2 Templates Complete

**Date:** 2026-03-24
**Branch:** mockup-upgrade
**Status:** Phase 1 plans executed + post-execution bugfixes applied (uncommitted)

## What Was Done

### Phase 1 Execution (committed)
- **Plan 01-01**: Vitest infrastructure + `MockupZone.physicalWidth` for per-zone tile scaling on kids dress
- **Plan 01-02**: 6 V1 mockups migrated to V2 registry + sizeLabels on all templates
- **Verification**: All automated checks passed, human verification pending

### Post-Execution Bugfixes (uncommitted — all in working tree)

1. **Scale bug fixed** — `processZone` in [MockupPipeline.ts](src/lib/mockups/mockupEngineV2/MockupPipeline.ts) now uses `tileWidth`/`tileHeight` (user's physical tile size) instead of deriving from `srcW/dpi`

2. **Color overlay (trim/bow) added to V2 pipeline** — New `colorOverlay` field on `MockupV2Template` type in [types.ts](src/lib/mockups/mockupEngineV2/templates/types.ts). Pipeline stage in MockupPipeline.ts applies accent color with photo shading + soft-light highlights. Onesie (`onesie_mask_color.png`) and wrapping paper (`wrapping_paper_bow_mask.png`) configured.

3. **Gallery deduplicated** — [MockupGalleryModal.tsx](src/components/mockups/MockupGalleryModal.tsx) now renders V2 only (V1 section removed)

4. **Mask format detection** — `processZone` detects alpha-based masks (>10% transparent pixels → invert) vs B/W masks (luminance → alpha). Fixes fabric-swatch, journal, pillow, journal rendering.

5. **Mask size mismatch** — Wallpaper mask is 832×832 but template is 1024×1024. Pipeline now detects size mismatch and scales full mask to fit.

6. **Color override wired through** — `MockupRendererV2` accepts `colorOverride` prop, passed from both `ActionsSidebar` and `AdvancedToolsBar`. Added to effect dependency array.

7. **Bow realism** — Color overlay uses `source-over` (not multiply) + `soft-light` photo highlight pass at 60% for 3D ribbon folds.

## Files Modified (uncommitted)

| File | Changes |
|------|---------|
| `src/lib/mockups/mockupEngineV2/MockupPipeline.ts` | Scale fix, color overlay stage, mask format detection, mask size handling, extractDominantColor helper |
| `src/lib/mockups/mockupEngineV2/templates/types.ts` | `colorOverlay` field on `MockupV2Template` |
| `src/lib/mockups/mockupEngineV2/templates/templateRegistry.ts` | `colorOverlay` on onesie + wrapping-paper templates |
| `src/components/mockups/MockupRendererV2.tsx` | `colorOverride` prop + dependency array |
| `src/components/mockups/MockupGalleryModal.tsx` | V1 section removed, V2 only |
| `src/components/sidebar/ActionsSidebar.tsx` | V2 renderer for mockup detail view |
| `src/components/layout/AdvancedToolsBar.tsx` | `colorOverride` passed to V2 renderer |

## Test Status
- 25/25 vitest tests pass
- TypeScript clean (zero errors)
- Human visual verification still needed for all mockups

## What's Next
- Commit the bugfix changes (7 files above)
- Visual verification of all mockups in browser
- Phase 2: Gallery Redesign (`/gsd:discuss-phase 2`)
