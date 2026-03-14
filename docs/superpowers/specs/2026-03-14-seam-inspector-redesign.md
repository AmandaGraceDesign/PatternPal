# Seam Inspector Redesign — Full-Page New Tab

## Problem

The current SeamInspector opens as a modal overlay (~80vw x 80vh) with a large controls section that eats into canvas space. At high zoom levels (400–800%), the canvas is too small to meaningfully pan around and inspect the full tile. The separate H-Seam/V-Seam view modes add complexity, and the crosshair-based 4-corner intersection view doesn't work correctly for half-drop or half-brick repeat types (which produce T-junctions, not 4-corner meeting points).

## Solution

Replace the modal with a **full-page Seam Inspector that opens in a new browser tab**. Simplify to a single view mode with a **pink dashed tile outline** (instead of crosshair lines) that works universally across all repeat types. Minimize chrome to maximize canvas space.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Window model | New browser tab | Maximum canvas space; user can switch between editor and inspector |
| View modes | Single view only (tile outline) | H-Seam/V-Seam unnecessary with full-viewport canvas; user pans to inspect any edge |
| Seam indicator | Pink dashed tile outline | Works for all repeat types (full-drop, half-drop, half-brick); crosshair only works for full-drop |
| Opening behavior | Jump straight to 200% zoom | No intro screen; faster workflow |
| Controls layout | Minimal top bar + floating bottom-left control | Maximum canvas area |
| Zoom buttons | +/- (no presets) | Smooth, continuous zoom |
| Zoom step (buttons) | 25% | Quick jumps |
| Zoom step (scroll wheel) | 10% | Fine-grained control |
| Zoom range | 25%–800% | Covers overview to pixel-level inspection |

## Layout

### Top Bar (minimal)
- **Left:** "Seam Inspector" title + filename (italic, muted) + repeat-type badge (e.g., "half-drop" in a green pill)
- **Right:** "Drag to pan · Scroll to zoom" hint text (muted)
- No close button in the bar — closing the tab returns to the main editor

### Canvas (fills remaining viewport)
- Background: `#294051` (matches current app dark background)
- Tiled pattern rendered with correct repeat-type offsets
- One tile instance outlined with pink dashed border (`#ec4899`, 2.5px, dashed)
- Opens centered on the outlined tile
- Drag-to-pan (cursor: grab/grabbing)
- Scroll-wheel zoom (10% steps, anchored to cursor position — zoom toward pointer)
- Pan position preserved on zoom change (adjusted to keep the point under the cursor stable)
- Touch support: single-finger pan (pinch-to-zoom deferred to future iteration)

### Floating Control (bottom-left, over canvas)
- Semi-transparent white background with backdrop blur
- Rounded pill shape with subtle shadow
- Contents: `[−]  200%  [+]  |  ☑ Outline`
- `−` / `+` buttons step zoom by 25%
- Percentage display updates live
- Outline checkbox toggles the pink dashed tile border

### Keyboard Shortcuts
- `ESC` — calls `window.close()` (works when opened via `window.open()`; no-op if opened directly)
- Scroll wheel — zoom in/out by 10%

## Repeat Type Behavior

All three repeat types use identical UI — only the tiling layout differs:

### Full-Drop
- Regular grid: tiles stack in aligned rows and columns
- All edges align — panning in any direction from the outlined tile shows clean seam boundaries

### Half-Drop
- Alternating columns offset vertically by half the tile height
- Vertical seams show staggered edges (T-junctions where 3 tiles meet)
- Horizontal seams within a column are normal

### Half-Brick
- Alternating rows offset horizontally by half the tile width
- Horizontal seams show staggered edges (T-junctions where 3 tiles meet)
- Vertical seams within a row are normal

## Data Flow: Parent → Inspector Tab

The main app opens the inspector tab via `window.open('/seam-inspector')`. The new tab communicates with the opener to receive:

1. **Image data** — transferred as a Blob URL or via `window.opener` postMessage with the image's object URL
2. **Repeat type** — `'full-drop' | 'half-drop' | 'half-brick'`
3. **DPI** — number (for DPI-aware zoom calculation)
4. **Filename** — string (display in top bar)
5. **Outline color** — string (defaults to `#ec4899`)

### Communication Pattern
1. Inspector tab loads, sends `{ type: 'ready' }` to `window.opener` (with origin check)
2. Parent responds with `{ type: 'init', imageUrl, repeatType, dpi, filename, outlineColor }`
3. Inspector **copies the image data** to its own `HTMLImageElement` immediately (the parent's Blob URL may be revoked if the parent tab closes)
4. Inspector renders. No further communication needed (one-way data flow).

### Fallback: No opener available
If `window.opener` is null (user refreshed the inspector tab, bookmarked the URL, etc.), show an error state: "No pattern data available. Please open the Seam Inspector from the main editor." with a link back to `/`.

### Security
- Validate `event.origin` on all `postMessage` handlers to prevent cross-origin attacks

## Implementation Scope

### New Files
- `app/seam-inspector/page.tsx` — Next.js page route for the inspector tab

### Modified Files
- `src/components/analysis/SeamInspector.tsx` — gutted and rewritten as the new full-page component (or replaced entirely)
- `app/page.tsx` — change the "Seam Inspector" button to call `window.open()` instead of toggling a modal

### Files to Consider Removing
- The old `SeamInspectorModal.tsx`, `SeamAnalyzerModal.tsx` if they exist solely for the modal pattern

### No Changes Needed
- `PatternTiler.ts` — reuse existing viewport-based rendering
- `PatternPreviewCanvas.tsx` — main canvas unaffected

## Rendering

Reuse the viewport-based rendering approach from the current `SeamInspector` (commit `4c53fab`):

- DPI-aware zoom: `zoomFactor = (zoomLevel / 100) * (96 / dpi)`
- Calculate visible tile range from viewport dimensions and pan offset
- Draw each visible tile directly from source image via 9-arg `drawImage`
- The outlined tile is the tile at grid position `(0, 0)` — a fixed coordinate in the tiling grid, not relative to the viewport. It stays consistent regardless of pan position.
- Draw pink dashed outline rectangle at this tile's position
- `imageSmoothingEnabled = true`, `imageSmoothingQuality = 'high'`
- HiDPI support: `devicePixelRatio` scaling (capped at 2x)

## Out of Scope

- "Looks Good" / "I See an Issue" feedback buttons (Spoonflower feature — not needed)
- Intro/overview screen before inspection
- Guided corner-by-corner walkthrough
- Keyboard arrow panning (users drag to pan)
- Zoom slider (just +/- buttons)
- Any floating bottom-right controls (intentionally avoiding Spoonflower's layout)
- Pinch-to-zoom (deferred — single-finger pan only for touch)
