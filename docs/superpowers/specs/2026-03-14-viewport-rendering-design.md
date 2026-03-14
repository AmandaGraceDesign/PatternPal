# Viewport-Based Rendering for Main Canvas and SeamInspector

## Problem

When users upload high-resolution pattern files (e.g., 6142x6142px at 300 DPI), the canvas pixelates on zoom because the source image is pre-scaled to a small intermediate canvas before tiling. The zoom range is also too limited for professional seam inspection (currently ~200% on the main canvas, 400% on SeamInspector).

User report: "When I zoom in, it seems to pixelate my design even though I uploaded a high res file... I often have to zoom in much closer than 400% to be sure there are no hairlines."

## Approach

Replace pre-scaled intermediate canvas rendering with viewport-based rendering that draws directly from the full-resolution source image. Only the visible portion of the pattern is rendered at any given time.

## Design

### 1. Main Canvas (PatternPreviewCanvas)

**Current flow (being replaced):**
1. Calculate small display size from zoom via `displayZoomToActualZoom()` (100% display = 0.2x actual)
2. Pre-scale source image into a temporary canvas at that small size
3. Pass downscaled image to PatternTiler which draws it in a grid

**New flow:**
1. Zoom slider range: 10% to 800% (direct percentage, no `* 0.2` indirection)
2. Zoom 100% baseline: 1 pattern inch = 96 screen pixels (standard web DPI). A 300 DPI file at 100% appears at ~1/3 its pixel dimensions, matching printed size on screen.
3. **Fit-to-viewport on load:** When an image is uploaded, calculate initial zoom so the tiled pattern fills the visible canvas comfortably: `initialZoom = Math.min(canvasWidth / (tileWidthInches * 96), canvasHeight / (tileHeightInches * 96)) * 100`, clamped to the 10-800 range. This replaces the fixed default of 100.
4. Given the viewport size (visible canvas area), calculate which source-image region is visible at current zoom + pan offset
5. For each tile copy that intersects the viewport, use `ctx.drawImage(srcImage, sx, sy, sw, sh, dx, dy, dw, dh)` to draw directly from the original full-resolution HTMLImageElement
6. No intermediate canvas, no `toDataURL` roundtrip — pixels come straight from the source. This is also a significant performance win since `toDataURL` is synchronous and CPU-intensive.
7. Pan offset state (`panX`, `panY`) added alongside zoom, initialized to `(0, 0)`. Pan resets on new image upload. Panning is handled via pointer/touch event handlers (re-rendering at new offset), replacing the current native `overflow-auto` scroll container. Pan re-renders are throttled via `requestAnimationFrame` to prevent jank.
8. Ctrl+scroll and pinch zoom clamped to 10-800 range
9. `imageSmoothingEnabled = true`, `imageSmoothingQuality = 'high'` for the main preview canvas
10. Canvas size matches the visible container exactly — no need for oversized canvas with overflow scrolling since viewport rendering only draws what's visible
11. DPR handling: The existing `ctx.scale(dpr, dpr)` pattern continues — all viewport coordinates are in logical (CSS) pixels, DPR scaling is handled by the canvas context
12. Placeholder pattern rendering is unchanged — it uses a small fixed-size image with no pixelation concern

### 2. SeamInspector

**Current flow (being replaced):**
1. Creates a downscaled grid image on a temporary canvas
2. Uses `createPattern()` to tile it
3. Zoom buttons scale up to 400% on a pre-downscaled image

**New flow:**
1. Same viewport-based `drawImage` approach as main canvas — draw directly from original source image
2. Zoom range: 100% to 800%
3. 4-corner seam intersection view stays centered on tile boundary by default
4. Keep existing +/- zoom buttons, extend range to 800%
5. Keep existing pan/drag behavior
6. `imageSmoothingEnabled = false` at ALL zoom levels, including during grid-building steps — this is an inspection tool, smoothing must never hide hairline issues
7. Keep toggle between repeat types
8. Replace `createPattern()` + `createTileGrid()` intermediate canvas approach with direct viewport-based `drawImage` from source. For the intersection view (where 4 tiles meet), calculate the 4 tile positions so their shared corner is at the viewport center, then draw visible portions of each. For horizontal/vertical seam views, same approach with appropriate tile layout.

### 3. PatternTiler Refactor

**Current API:** Takes a pre-scaled image and draws it in a grid at fixed positions. No concept of viewport or source-image cropping.

**New API parameters:**
- `sourceImage`: Original full-resolution HTMLImageElement
- `tileWidth`, `tileHeight`: Source pixel dimensions of one tile
- `zoom`: Scale factor (1.0 = 100%)
- `viewport`: `{ x, y, width, height }` — visible area in screen pixels, where x/y is the pan offset
- `repeatType`: 'full-drop' | 'half-drop' | 'half-brick'

**Rendering logic:**
1. Calculate scaled tile size: `tileWidth * zoom`, `tileHeight * zoom`
2. Determine which tile grid positions intersect the viewport (accounting for repeat type offsets)
3. For each visible tile, calculate source crop rect and destination rect
4. Draw with `ctx.drawImage(srcImage, sx, sy, sw, sh, dx, dy, dw, dh)`

**Repeat type offsets:**
- Full drop: `(col * scaledW, row * scaledH)` — straight grid
- Half drop: Odd columns offset vertically by `scaledH / 2`
- Half brick: Odd rows offset horizontally by `scaledW / 2`

**Performance:** At 10% zoom on a 6142px tile, a 1920x1080 viewport needs ~15 tile draws. At 800% zoom, only 1 partial tile is visible. Each `drawImage` call is a simple blit from the source — no intermediate processing. Pan re-renders are RAF-throttled.

### 4. Zoom Controls

**Main canvas (PatternControlsTopBar):**
- Slider range: 10 to 800
- Remove `displayZoomToActualZoom()` indirection
- Zoom % maps directly to scale factor: `zoom / 100`
- Ctrl+scroll and pinch-to-zoom clamped to 10-800
- Zoom label shows actual percentage

**SeamInspector:**
- Existing +/- buttons, range extended from 100-400 to 100-800
- Keep existing step size

### 5. Ruler Integration

Ruler is unaffected by the rendering change — it takes `pixelsPerUnit` as a prop computed from zoom and DPI:
- Inches: `(zoom / 100) * 96`
- Centimeters: `(zoom / 100) * 96 / 2.54`
- Pixels: `(zoom / 100) * (96 / dpi)`

These formulas simplify from the current ones since the `* 0.2` indirection is removed.

### 6. Tile Outline

Tile outline (`strokeRect`) updates to account for pan offset:
- Outline position shifts by `panX`, `panY`
- Outline size: `srcTileWidth * (zoom / 100)` by `srcTileHeight * (zoom / 100)`
- Logic otherwise unchanged

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/tiling/PatternTiler.ts` | Rewrite to viewport-based rendering with source image cropping |
| `src/components/canvas/PatternPreviewCanvas.tsx` | Remove pre-scaling, add pan state, update zoom formula, pass source image + viewport to PatternTiler |
| `src/components/analysis/SeamInspector.tsx` | Replace `createPattern()` with viewport-based rendering, extend zoom to 800%, disable image smoothing |
| `src/components/layout/PatternControlsTopBar.tsx` | Update slider range to 10-800, remove zoom indirection |
| `app/page.tsx` | Add `panX`/`panY` state, update zoom default/range |

## What Stays the Same

- Ruler component and unit conversion (already fixed)
- Export functionality
- Mockup system
- Pattern upload/paste flow
- DPI detection
- Repeat type selection UI
- SeamInspector pan/drag behavior
- Tile outline feature (with pan offset update)

## Success Criteria

1. A 6142x6142px 300 DPI tile renders without pixelation at any zoom level up to 800%
2. At 800% zoom, individual source pixels are visible and sharp in SeamInspector (`imageSmoothingEnabled = false`)
3. Ruler measurements remain accurate across all zoom levels and units, including extreme combinations (10% zoom + 600 DPI)
4. Tile outline overlays correctly at all zoom/pan positions
5. All three repeat types (full-drop, half-drop, half-brick) render correctly
6. No performance degradation — viewport rendering should be faster than current full-tile pre-scaling
7. Existing panning behavior in SeamInspector is preserved
8. On image upload, initial zoom fits the pattern comfortably in the viewport
9. No increase in memory usage — only the original HTMLImageElement is held, no intermediate canvases
