# PatternPAL Pro — V2 Mockup Upgrade

## What This Is

PatternPAL Pro is a browser-based tool for textile/surface pattern designers. Users upload a pattern tile and preview it tiling seamlessly, inspect seams, analyze color/composition, view patterns on product mockups, and export print-ready files. Built by Amanda Grace Design, live at `pattern-tester.amandagracedesign.com`.

This milestone completes the V2 mockup system: migrating all existing V1 mockups to the V2 engine, finishing the kids dress multi-zone template, redesigning the mockup gallery with better UX, and integrating all mockups into social media export overlays using V2 rendering.

## Core Value

Every mockup renders the user's pattern at physically accurate scale on a realistic product — the thing that makes designers choose PatternPAL over screenshotting their tile into Canva.

## Requirements

### Validated

- ✓ V2 mockup engine with multi-zone support, masks, multiply blend, physical scaling — existing
- ✓ Kids tshirt-dress template with bodice/skirt zones, mask-aligned coordinates — existing (in progress)
- ✓ Social media export with mockup overlay compositing pipeline — existing
- ✓ 6 V1 mockups rendering via canvas compositing (onesie, fabric swatch, wallpaper, throw pillow, wrapping paper, journal) — existing
- ✓ MockupGalleryModal with V1/V2 tabs and category grouping — existing

### Active

- [ ] Finish kids tshirt-dress: per-zone physical widths for accurate skirt tile scaling
- [ ] Migrate all 6 V1 mockups to V2 engine as single-zone templates
- [ ] Add sizeLabel to all templates (V1-migrated and new)
- [ ] Redesign MockupGalleryModal: categories/tabs, live pattern previews on thumbnails, size/info display, mobile-friendly UX
- [ ] Upgrade social media export overlay rendering to use V2 engine
- [ ] Add all V2 templates (including migrated V1s) to social media export mockup overlay picker
- [ ] Retire V1 mockup rendering engine once all templates migrated

### Out of Scope

- New mockup templates beyond the existing 6 + kids dress — focus on quality of existing set first
- AI-powered mockup generation — manual templates only
- Video/animated mockup previews — static images only
- Custom user-uploaded mockup templates — not this milestone

## Context

- **Branch:** `mockup-upgrade` — active development branch
- **V2 Engine:** Located at `src/lib/mockups/mockupEngineV2/` with zone-based rendering, mask alignment, physical dimension scaling
- **V1 Engine:** Located at `src/lib/mockups/` with `MockupRenderer.tsx` and `mockupTemplates.ts`
- **Key learning:** Photo-based mockups should use perspective=0, displacement=0 (photo has natural perspective). Always scan mask pixel bounds with tools rather than guessing coordinates.
- **Mask alignment:** Zone `patternArea` must match exact mask white-pixel bounds with ~10px overlap at seam boundaries
- **Social export pipeline:** Pattern tiling → Mockup overlay → Watermark → Download (in `SocialMediaExportModal`)
- **Gallery state:** Currently has V1/V2 tabs in `MockupGalleryModal.tsx`, categories added for gifting/wallpaper/fabric

## Constraints

- **Tech stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, Canvas API for all rendering — no WebGL
- **Build:** Webpack (explicitly, not Turbopack) — `--webpack` flag required
- **Canvas limits:** iOS 16M pixel limit, browsers ~67M pixel safety cap
- **Touch targets:** Minimum 44px for all interactive elements (Apple HIG)
- **Pro-gated:** All mockup features require Pro verification before rendering
- **No testing by Claude:** User tests manually — start dev server and report issues

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| V1 mockups migrate as single-zone | Multi-zone adds complexity without value for existing templates (one pattern area each) | — Pending |
| Photo-based mockups: perspective=0, displacement=0 | Photo already has natural perspective and fabric texture; multiply blend handles the rest | ✓ Good |
| Mask bounds from Pillow scan, not visual guessing | Precise pixel alignment prevents seam gaps; 10px overlap covers anti-aliased transitions | ✓ Good |
| V2 engine for social export overlays | Unified rendering pipeline, better quality, one codebase to maintain | — Pending |

---
*Last updated: 2026-03-22 after initialization*
