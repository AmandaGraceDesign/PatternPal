# Tablecloth Template Handoff — UV Warp Implementation Needed

**Date:** 2026-03-25
**Branch:** mockup-upgrade
**Status:** Tablecloth template functional but perspective warp needs UV-based approach

## What's Done
- Photo-based tablecloth with 3 zones (top, front, corner) using shared tiling
- Engine features: `sharedPatternArea`, `rightSqueeze`, `foreshorten` (all working)
- Zone masks provided and wired up
- NotReadableError fix for cloud-synced files
- **User created Photoshop perspective warp** of a UV gradient map

## What Needs to Happen Next

### Implement UV-map-based warp (replaces procedural perspective)
The procedural `rightSqueeze`/`foreshorten` approach can't match the photo's perspective accurately. The user warped a UV gradient map in Photoshop that encodes the exact transformation.

**Key files:**
- `public/mockups/v2/tablecloth-uvmap.png` — original flat UV gradient (R=X, G=Y, 0-255)
- `public/mockups/v2/tablecloth-uvmap-warped.png` — Photoshop-warped UV map matching tablecloth perspective

**Implementation plan:**
1. Add `uvMapPath` to `MockupV2Template` (or `MockupZone`) type
2. Load the warped UV map in `MockupRendererV2.tsx` (same pattern as zone masks)
3. In `processZone` (or a new stage), replace procedural perspective warp with UV lookup:
   - For each output pixel (x, y), read R and G from the warped UV map
   - R/255 * sourceWidth = source X, G/255 * sourceHeight = source Y
   - Sample the flat tiled pattern at that source coordinate
4. The UV map covers ALL zones — could simplify to single-zone with UV warp + combined mask
5. Remove `rightSqueeze`, `foreshorten` from tablecloth template (no longer needed)
6. Keep zone masks for clipping, displacement for subtle wrinkles, lighting for depth

**Reference files:**
- `public/mockups/v2/tablecloth-grid.png` — flat grid (200px spacing, used to generate UV map)
- `public/mockups/v2/tablecloth-top-warp.png` — user's Photoshop warp of checkerboard (visual reference)

## Current Template State (in templateRegistry.ts)
- Top zone: `rightSqueeze: 305`, `foreshorten: 1` (effectively disabled), displacement 2
- Front zone: displacement 4 (vertical-drape)
- Corner zone: displacement 4 (fabric-drape), perspective 15/5
- All zones share `sharedPatternArea` for continuous tiling

## Test Status
- 29/29 vitest tests pass
- TypeScript clean

## Key Files
- `src/lib/mockups/mockupEngineV2/templates/types.ts` — zone/template types
- `src/lib/mockups/mockupEngineV2/templates/templateRegistry.ts` — tablecloth config
- `src/lib/mockups/mockupEngineV2/MockupPipeline.ts` — rendering pipeline
- `src/lib/mockups/mockupEngineV2/stages/perspectiveWarp.ts` — current procedural warp (to be replaced for UV-based zones)
- `src/components/mockups/MockupRendererV2.tsx` — asset loading + pipeline invocation
