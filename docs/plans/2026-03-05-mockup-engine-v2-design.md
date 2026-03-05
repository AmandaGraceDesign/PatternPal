# Mockup Engine V2 — Design Document

**Date**: 2026-03-05
**Branch**: mockup-upgrade
**Status**: Approved

## Goal

Upgrade PatternPAL Pro's mockup system with realistic rendering (perspective warping, displacement mapping, lighting) and add 11 new product mockup types across 4 categories.

## Approach

Canvas2D rendering pipeline, proven by the Mockup-Engine-POC. No new dependencies. Procedural product bases initially, with the ability to swap in photo templates later.

## Rendering Pipeline

Four sequential stages, each operating on canvas data:

1. **Tile Pattern** — Tiles the user's uploaded pattern to fill the mockup's pattern area. Reuses existing `PatternTiler.ts` (supports full-drop, half-drop, half-brick).
2. **Perspective Warp** — Strip-subdivision approach (~40 horizontal strips mapped to a trapezoid). Each template has pre-tuned `topSqueeze` and `bottomSqueeze`. Skipped for flat products.
3. **Displacement Map** — Per-pixel displacement with bilinear interpolation. Grayscale map (128=neutral). Procedural generators for fabric-drape, pillow, flat-surface, cylindrical, etc. Pre-tuned intensity and wrinkle frequency per template.
4. **Blend Composite** — Draws product base, composites displaced pattern with blend mode (multiply, overlay, etc.), adds optional lighting/shadow layer from product luminance.

## Controls

Pre-tuned per mockup template. No user-facing sliders. Each template ships with optimal perspective, displacement, and blending settings.

## Architecture

```
src/lib/mockups/
  mockupTemplates.ts              ← existing (untouched)
  mockupEngineV2/
    MockupPipeline.ts             ← orchestrates 4-stage pipeline
    stages/
      patternTiler.ts             ← tiles pattern to canvas (reuses PatternTiler)
      perspectiveWarp.ts          ← strip-based perspective transform
      displacementMap.ts          ← pixel displacement + bilinear interpolation
      blendComposite.ts           ← blend modes + lighting layer
    templates/
      templateRegistry.ts         ← all mockup type definitions
      types.ts                    ← TypeScript interfaces

src/components/mockups/
  MockupRenderer.tsx              ← existing (untouched)
  MockupRendererV2.tsx            ← new renderer using pipeline
  MockupGalleryModal.tsx          ← updated with category tabs
```

### Template Definition Shape

```ts
{
  id: 'tshirt-dress',
  name: "Children's T-Shirt Dress",
  category: 'apparel',
  canvasSize: { width: 800, height: 800 },
  patternArea: { x: 200, y: 150, width: 400, height: 500 },
  perspective: { topSqueeze: 30, bottomSqueeze: 10 },
  displacement: { intensity: 15, wrinkleFreq: 8, type: 'fabric-drape' },
  blend: { mode: 'multiply', opacity: 0.85 },
  lighting: { enabled: true, intensity: 0.3 },
  physicalSize: { width: 20, height: 26, unit: 'in' }
}
```

## Mockup Types

### New (11 types, V2 pipeline)

**Apparel**
- Children's T-Shirt Dress — moderate perspective, flowing fabric displacement
- Women's Skirt — A-line perspective, fabric drape displacement

**Home Goods**
- Tablecloth — subtle displacement, slight perspective for table angle
- Curtain — vertical drape displacement, no perspective
- Blanket — soft fabric displacement, minimal perspective
- Nursery Wall — room scene with wallpaper on wall, minimal displacement

**Stationery**
- Gift Bag — box-like perspective, minimal displacement
- Wallpaper Roll — cylindrical perspective, subtle paper displacement

**Accessories**
- Silk Scarf — flowing fabric displacement, moderate perspective
- Phone Case — curved surface displacement, slight perspective
- Desk Mat — flat surface, very minimal displacement

### Existing (8 types, V1 renderer — untouched)

pillow, wallpaper, onesie, tote-bag, fabric-swatch, throw-pillow, wrapping-paper, journal

### Total: 19 mockup types

## UI Changes

- **MockupGalleryModal**: Add category tabs (All | Apparel | Home Goods | Stationery | Accessories)
- Same entry point — users click existing "Mockups" button
- Old and new mockups appear together in the gallery
- Renderer selection is automatic (V1 for old types, V2 for new types)
- No new controls or settings exposed to the user

## Migration Strategy

Additive — old system stays intact. New engine runs alongside. Old mockup types can be migrated to V2 gradually in the future if desired.

## Asset Strategy

Procedural product bases and displacement maps first. Real product photos can be swapped in later by updating template definitions with image paths.

## References

- POC: `Mockup-Engine-POC.html` (Google Drive)
- ImageMagick reference: `github.com/kashifulhaque/product-mockup-node-python`
