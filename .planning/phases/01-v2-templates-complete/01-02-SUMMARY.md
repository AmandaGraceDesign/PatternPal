---
phase: 01-v2-templates-complete
plan: 02
subsystem: template-registry
tags: [template-migration, v1-mockups, sizeLabel, photo-based, wrapping-paper-disambiguation]

# Dependency graph
requires:
  - 01-01 (vitest infrastructure, MockupZone.physicalWidth, test scaffolds)
provides:
  - 6 V1 mockups migrated as photo-based V2 templates (onesie, fabric-swatch, wallpaper, throw-pillow, wrapping-paper, journal)
  - sizeLabel on every V2 template (migrated + procedural + kids dress)
  - Wrapping paper display name disambiguation (Gift Box vs Flat Sheet)
affects:
  - V2 gallery tab (all 7+ templates now renderable without errors)
  - MOCK-01 and MOCK-03 requirement completion

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Photo-based V2 templates: perspective=0, displacement=0, lighting intensity=0.25
    - sizeLabel format locked: W×H" (Wcm×Hcm) Product Name
    - Category grouping comments for each product type in templateRegistry

key-files:
  created: []
  modified:
    - src/lib/mockups/mockupEngineV2/templates/templateRegistry.ts

key-decisions:
  - "6 V1 templates added with lighting enabled (intensity=0.25) — two-pass confirmed: lighting OFF verified first (V1-faithful), then ON for V2 enhancement"
  - "wrapping-paper-v2 renamed to Wrapping Paper (Flat Sheet) to disambiguate from photo version (Gift Box)"
  - "All V1 migration templates use full canvas patternArea (0,0,1024,1024) matching V1 behavior"

# Metrics
duration: 3min
completed: 2026-03-22
---

# Phase 1 Plan 02: V2 Templates — V1 Migration and sizeLabel Backfill Summary

**6 V1 mockups migrated as single-zone photo-based V2 templates with lighting enabled, sizeLabels added to all 18 V2 templates (migrated + procedural + kids dress), wrapping paper variants disambiguated**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-22T20:35:04Z
- **Completed:** 2026-03-22T20:37:59Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Added 6 V1 migration templates to templateRegistry.ts: onesie, fabric-swatch, wallpaper, throw-pillow, wrapping-paper (Gift Box), journal
- All 6 use photo-based productBase with original V1 image/mask paths, perspective=0, displacement=0
- Two-pass process followed: lighting OFF for V1 fidelity verification, then lighting enabled (intensity=0.25)
- wrapping-paper-v2 renamed from "Wrapping Paper" to "Wrapping Paper (Flat Sheet)" for disambiguation
- sizeLabels added to all 11 existing procedural templates (womens-skirt, tablecloth, curtain, blanket, nursery-wall, gift-bag, wrapping-paper-v2, wallpaper-roll, silk-scarf, phone-case, desk-mat)
- All 24 tests across MOCK-01, MOCK-02, MOCK-03 pass
- TypeScript compiles clean with no errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Add 6 V1 migration templates** - `d50b7ff` (feat)
2. **Task 2: Add sizeLabels to all procedural templates** - `427aa91` (feat)

## Files Created/Modified

- `src/lib/mockups/mockupEngineV2/templates/templateRegistry.ts` - 6 new photo-based templates, 11 sizeLabels added, wrapping-paper-v2 renamed

## Decisions Made

- 6 V1 templates added with lighting enabled at intensity=0.25 — two-pass approach confirmed in commit message (V1-faithful with lighting OFF before enabling)
- Wrapping paper disambiguated: photo version = "Wrapping Paper (Gift Box)", procedural = "Wrapping Paper (Flat Sheet)"
- All V1 migration templates use full canvas patternArea (x:0, y:0, w:1024, h:1024) matching original V1 behavior

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- MOCK-01 and MOCK-03 implementation complete
- All phase tests (MOCK-01, MOCK-02, MOCK-03) green — 24/24 passing
- TypeScript clean, no blockers
- Phase 1 complete: V2 template registry has all V1 mockups + sizeLabels on every template

---
*Phase: 01-v2-templates-complete*
*Completed: 2026-03-22*

## Self-Check: PASSED

- templateRegistry.ts: FOUND
- 01-02-SUMMARY.md: FOUND
- commit d50b7ff: FOUND
- commit 427aa91: FOUND
