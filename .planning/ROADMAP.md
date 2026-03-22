# Roadmap: PatternPAL Pro — V2 Mockup Upgrade

## Overview

Three phases complete the V2 mockup system: first get all templates rendering through the V2 engine (kids dress fixed, 6 V1 mockups migrated, sizeLabels added), then redesign the gallery so it's actually pleasant to use, then upgrade social export to use V2 rendering and retire the V1 engine for good.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: V2 Templates Complete** - All mockup templates rendering through V2 engine with accurate sizing
- [ ] **Phase 2: Gallery Redesign** - MockupGalleryModal rebuilt with live previews, categories, and mobile UX
- [ ] **Phase 3: Social Export + V1 Retirement** - Social export upgraded to V2, V1 engine deleted

## Phase Details

### Phase 1: V2 Templates Complete
**Goal**: Every mockup template renders through the V2 pipeline with physically accurate tile scaling
**Depends on**: Nothing (first phase)
**Requirements**: MOCK-01, MOCK-02, MOCK-03
**Success Criteria** (what must be TRUE):
  1. Kids tshirt-dress renders with visually distinct tile sizes on bodice vs. skirt (bodice ~13.5", skirt ~18" physical width)
  2. All 6 original mockups (onesie, fabric swatch, wallpaper, throw pillow, wrapping paper, journal) render through V2 engine with multiply blend
  3. Every template shows a human-readable sizeLabel (e.g., "13.5" x 18"") in the gallery card
  4. V2 gallery tab contains all 7 templates (6 migrated + kids dress), each renderable without errors
**Plans**: 2 plans

Plans:
- [ ] 01-01-PLAN.md — Per-zone physicalWidth for kids dress + test infrastructure (MOCK-02)
- [ ] 01-02-PLAN.md — Migrate 6 V1 mockups + sizeLabels on all templates (MOCK-01, MOCK-03)

### Phase 2: Gallery Redesign
**Goal**: MockupGalleryModal is a delight to use — live pattern previews, clear organization, works on mobile
**Depends on**: Phase 1
**Requirements**: GALL-01, GALL-02, GALL-03, GALL-04
**Success Criteria** (what must be TRUE):
  1. Mockups are browsable by category tab (apparel, home decor, stationery, etc.) with no V1/V2 tab split
  2. Every gallery card shows the user's actual uploaded pattern tiled onto the product thumbnail in real time
  3. Each card displays the sizeLabel and physical dimensions clearly (readable without tapping)
  4. Gallery is usable on iPhone and iPad — all tap targets 44px+, no horizontal scrolling, layout adapts to narrow screens
**Plans**: TBD

Plans:
- [ ] 02-01: Redesign MockupGalleryModal with category tabs, live previews, size display, mobile layout (GALL-01, GALL-02, GALL-03, GALL-04)

### Phase 3: Social Export + V1 Retirement
**Goal**: Social media export uses V2 rendering throughout and the V1 engine is deleted
**Depends on**: Phase 2
**Requirements**: SOCL-01, SOCL-02, MOCK-04
**Success Criteria** (what must be TRUE):
  1. Social media export mockup overlays render via V2 pipeline (multiply blend, physical scaling) — no V1 canvas compositing path
  2. All 7 V2 templates (migrated V1s + kids dress) appear in the per-size mockup overlay picker in SocialMediaExportModal
  3. V1 engine files (mockupTemplates.ts, MockupRenderer.tsx) are deleted with no TypeScript errors or broken imports
**Plans**: TBD

Plans:
- [ ] 03-01: Upgrade SocialMediaExportModal overlay rendering to V2 pipeline (SOCL-01, SOCL-02)
- [ ] 03-02: Delete V1 mockup engine and clean up all references (MOCK-04)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. V2 Templates Complete | 0/2 | Not started | - |
| 2. Gallery Redesign | 0/1 | Not started | - |
| 3. Social Export + V1 Retirement | 0/2 | Not started | - |
