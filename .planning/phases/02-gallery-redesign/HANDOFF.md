# Phase 2 Handoff — Gallery Redesign + Tablecloth Template

**Date:** 2026-03-24
**Branch:** mockup-upgrade
**Status:** Phase 2 complete, tablecloth template in progress (tuning), Phase 3 pending

## What Was Done (This Session)

### Tablecloth Photo-Based Mockup Template
- Upgraded from `procedural` to `image` base using `tablecloth.png` photo
- **3 zones** with shared tiling (one continuous pattern across all surfaces):
  - **top** — flat table surface with foreshortening (`foreshorten: 3`) and asymmetric perspective (`rightSqueeze: 305`)
  - **front** — vertical drape with gentle displacement (intensity 4)
  - **corner** — right-side hanging fabric with fabric-drape displacement
- 3 mask PNGs provided by user: `tablecloth-top-mask.png`, `tablecloth-front-mask.png`, `tablecloth-corner-mask.png`

### New Engine Features (for tablecloth, available to all templates)
- **`sharedPatternArea`** on `MockupV2Template` — tiles once across a union bounding box, zones extract sub-regions for continuous pattern flow
- **`rightSqueeze`** on perspective warp — asymmetric squeeze for surfaces that recede to the right
- **`foreshorten`** on `MockupZone` — compresses more vertical rows into a shallow zone to simulate depth on receding surfaces
- All features are opt-in; existing templates (t-shirt dress, onesie, etc.) unaffected

### NotReadableError Fix
- Cloud-synced files (iCloud/Google Drive/Dropbox) that fail to read now show a user-facing error message instead of silently failing
- Fixed in: `PatternControlsTopBar.tsx` (file input + drag-drop), `page.tsx` (drop handler + fallback read)

## Tablecloth Tuning Status
The template is functional and close to final. Current values after iterative tuning:
- Top zone: `rightSqueeze: 305` (derived from mask geometry), `foreshorten: 3`, displacement intensity 2
- Front zone: displacement intensity 4 (vertical-drape)
- Corner zone: displacement intensity 4 (fabric-drape), perspective squeeze 15/5
- User approved the general look; may want further refinement of displacement/foreshorten values

## Current State

| Phase | Status | Completed |
|-------|--------|-----------|
| 1. V2 Templates Complete | Complete | 2026-03-22 |
| 2. Gallery Redesign | Complete | 2026-03-24 |
| Tablecloth Template | In progress (tuning) | - |
| 3. Social Export + V1 Retirement | Not started | - |

## What's Next

### Continue: Tablecloth Fine-Tuning
- May need displacement/foreshorten value adjustments based on visual testing
- Consider adding custom displacement map support (Photoshop-painted grayscale) for pixel-perfect fold control — discussed but not implemented

### Later: Phase 3
- Social media export mockup overlays → V2 pipeline
- All V2 templates in per-size overlay picker
- Delete V1 engine files

## Test Status
- 29/29 vitest tests pass
- TypeScript clean (zero errors)

## Key Files Modified This Session
- `src/lib/mockups/mockupEngineV2/templates/types.ts` — added `sharedPatternArea`, `rightSqueeze`, `foreshorten`
- `src/lib/mockups/mockupEngineV2/templates/templateRegistry.ts` — tablecloth template rewrite
- `src/lib/mockups/mockupEngineV2/MockupPipeline.ts` — shared tiling, foreshorten extraction
- `src/lib/mockups/mockupEngineV2/stages/perspectiveWarp.ts` — rightSqueeze support
- `app/page.tsx` — NotReadableError user-facing error
- `src/components/layout/PatternControlsTopBar.tsx` — NotReadableError user-facing error
- `public/mockups/v2/tablecloth*.png` — base image + 3 zone masks
