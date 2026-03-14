# Viewport-Based Rendering Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace pre-scaled intermediate canvas rendering with viewport-based `drawImage` from the full-resolution source, eliminating pixelation and extending zoom to 800%.

**Architecture:** The main canvas and SeamInspector both switch to drawing directly from the original HTMLImageElement via the 9-argument `drawImage(src, sx, sy, sw, sh, dx, dy, dw, dh)`. PatternTiler is refactored to accept viewport coordinates and calculate which tile regions are visible. Panning replaces native scroll overflow.

**Tech Stack:** Canvas 2D API, React state management, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-14-viewport-rendering-design.md`

---

## Chunk 1: PatternTiler Refactor + Zoom Controls

### Task 1: Rewrite PatternTiler for viewport-based rendering

**Files:**
- Modify: `src/lib/tiling/PatternTiler.ts` (full rewrite)

- [ ] **Step 1: Read the existing PatternTiler**

Read `src/lib/tiling/PatternTiler.ts` to understand the current API (constructor takes canvas + display dimensions, `render()` takes a pre-scaled image and repeat type).

- [ ] **Step 2: Rewrite PatternTiler with viewport-based API**

Replace the entire file with a new implementation. The new `PatternTiler` takes:
- `ctx`: CanvasRenderingContext2D
- `viewportWidth`, `viewportHeight`: canvas logical dimensions

The `render()` method takes:
- `sourceImage`: HTMLImageElement (full-resolution original)
- `repeatType`: RepeatType
- `scale`: number (DPI-adjusted scale factor: `(zoom / 100) * (96 / dpi)`. At 100% zoom + 300 DPI, scale = 0.32)
- `panX`, `panY`: number (pan offset in screen pixels)

**Note:** The caller (PatternPreviewCanvas) must set `ctx.imageSmoothingEnabled` and apply DPR scaling via `ctx.scale(dpr, dpr)` before calling `render()`. PatternTiler works in logical (CSS) pixels.

```typescript
export type RepeatType = 'full-drop' | 'half-drop' | 'half-brick';

export class PatternTiler {
  private ctx: CanvasRenderingContext2D;
  private viewportWidth: number;
  private viewportHeight: number;

  constructor(ctx: CanvasRenderingContext2D, viewportWidth: number, viewportHeight: number) {
    this.ctx = ctx;
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
  }

  clear() {
    this.ctx.fillStyle = '#0f172a';
    this.ctx.fillRect(0, 0, this.viewportWidth, this.viewportHeight);
  }

  render(
    sourceImage: HTMLImageElement,
    repeatType: RepeatType,
    scale: number,
    panX: number,
    panY: number
  ) {
    this.clear();

    const srcW = sourceImage.naturalWidth;
    const srcH = sourceImage.naturalHeight;
    const scaledW = srcW * scale;
    const scaledH = srcH * scale;

    if (scaledW <= 0 || scaledH <= 0) return;

    switch (repeatType) {
      case 'full-drop':
        this.renderFullDrop(sourceImage, srcW, srcH, scaledW, scaledH, panX, panY);
        break;
      case 'half-drop':
        this.renderHalfDrop(sourceImage, srcW, srcH, scaledW, scaledH, panX, panY);
        break;
      case 'half-brick':
        this.renderHalfBrick(sourceImage, srcW, srcH, scaledW, scaledH, panX, panY);
        break;
    }
  }

  private renderFullDrop(
    img: HTMLImageElement, srcW: number, srcH: number,
    scaledW: number, scaledH: number, panX: number, panY: number
  ) {
    // Calculate which tile indices are visible
    const startCol = Math.floor(-panX / scaledW) - 1;
    const endCol = Math.ceil((this.viewportWidth - panX) / scaledW);
    const startRow = Math.floor(-panY / scaledH) - 1;
    const endRow = Math.ceil((this.viewportHeight - panY) / scaledH);

    for (let col = startCol; col <= endCol; col++) {
      for (let row = startRow; row <= endRow; row++) {
        this.drawTile(img, srcW, srcH, col * scaledW + panX, row * scaledH + panY, scaledW, scaledH);
      }
    }
  }

  private renderHalfDrop(
    img: HTMLImageElement, srcW: number, srcH: number,
    scaledW: number, scaledH: number, panX: number, panY: number
  ) {
    const startCol = Math.floor(-panX / scaledW) - 1;
    const endCol = Math.ceil((this.viewportWidth - panX) / scaledW);
    // Need extra row range because half-drop shifts tiles vertically
    const startRow = Math.floor(-panY / scaledH) - 2;
    const endRow = Math.ceil((this.viewportHeight - panY) / scaledH) + 1;

    for (let col = startCol; col <= endCol; col++) {
      // Handle negative col modulo correctly (JS % is remainder, not modulo)
      const yOffset = (((col % 2) + 2) % 2 !== 0) ? scaledH / 2 : 0;
      for (let row = startRow; row <= endRow; row++) {
        const dx = col * scaledW + panX;
        const dy = row * scaledH + yOffset + panY;
        this.drawTile(img, srcW, srcH, dx, dy, scaledW, scaledH);
      }
    }
  }

  private renderHalfBrick(
    img: HTMLImageElement, srcW: number, srcH: number,
    scaledW: number, scaledH: number, panX: number, panY: number
  ) {
    const startRow = Math.floor(-panY / scaledH) - 1;
    const endRow = Math.ceil((this.viewportHeight - panY) / scaledH);
    // Need extra col range because half-brick shifts tiles horizontally
    const startCol = Math.floor(-panX / scaledW) - 2;
    const endCol = Math.ceil((this.viewportWidth - panX) / scaledW) + 1;

    for (let row = startRow; row <= endRow; row++) {
      const adjustedXOffset = (((row % 2) + 2) % 2 !== 0) ? scaledW / 2 : 0;
      for (let col = startCol; col <= endCol; col++) {
        const dx = col * scaledW + adjustedXOffset + panX;
        const dy = row * scaledH + panY;
        this.drawTile(img, srcW, srcH, dx, dy, scaledW, scaledH);
      }
    }
  }

  // Draw a single tile, clipping to viewport. Uses 9-arg drawImage to pull
  // only the needed source pixels from the full-resolution image.
  private drawTile(
    img: HTMLImageElement,
    srcW: number, srcH: number,
    dx: number, dy: number,
    dw: number, dh: number
  ) {
    // Skip tiles entirely outside viewport
    if (dx + dw <= 0 || dy + dh <= 0 || dx >= this.viewportWidth || dy >= this.viewportHeight) return;

    // Calculate visible portion
    let clipDx = dx;
    let clipDy = dy;
    let clipDw = dw;
    let clipDh = dh;
    let sx = 0;
    let sy = 0;

    // Clip left
    if (clipDx < 0) {
      const clip = -clipDx;
      sx = (clip / dw) * srcW;
      clipDw -= clip;
      clipDx = 0;
    }
    // Clip top
    if (clipDy < 0) {
      const clip = -clipDy;
      sy = (clip / dh) * srcH;
      clipDh -= clip;
      clipDy = 0;
    }
    // Clip right
    if (clipDx + clipDw > this.viewportWidth) {
      clipDw = this.viewportWidth - clipDx;
    }
    // Clip bottom
    if (clipDy + clipDh > this.viewportHeight) {
      clipDh = this.viewportHeight - clipDy;
    }

    const sw = (clipDw / dw) * srcW;
    const sh = (clipDh / dh) * srcH;

    if (sw <= 0 || sh <= 0 || clipDw <= 0 || clipDh <= 0) return;

    this.ctx.drawImage(img, sx, sy, sw, sh, clipDx, clipDy, clipDw, clipDh);
  }
}
```

- [ ] **Step 3: Do NOT commit yet**

PatternTiler's API has changed and PatternPreviewCanvas still uses the old API. We will commit PatternTiler together with PatternPreviewCanvas in Task 3 to avoid a non-compiling commit.

---

### Task 2: Update zoom state and controls

**Files:**
- Modify: `app/page.tsx:20` (zoom default, add panX/panY state)
- Modify: `src/components/layout/PatternControlsTopBar.tsx:327-370` (slider range)

- [ ] **Step 1: Add pan state and update zoom default in page.tsx**

In `app/page.tsx`, after line 20 (`const [zoom, setZoom] = useState<number>(100);`):

```typescript
// Change zoom default — will be overridden by fit-to-viewport on image load
const [zoom, setZoom] = useState<number>(50);
const [panX, setPanX] = useState<number>(0);
const [panY, setPanY] = useState<number>(0);
```

In `handleClearPattern()` (line 180), add pan reset:
```typescript
setPanX(0);
setPanY(0);
```

In `handleFileUpload` `img.onload` callback (after line 308 `setImage(img)`), add fit-to-viewport:
```typescript
// Fit-to-viewport: calculate initial zoom so pattern fills canvas
// tileWidthInches and tileHeightInches are detectedWidth/detectedHeight
// Use a rough viewport estimate (will be refined by canvas component)
const viewportWidth = window.innerWidth * 0.8; // approximate canvas width
const viewportHeight = window.innerHeight * 0.6;
const fitZoom = Math.min(
  viewportWidth / (detectedWidth * 96),
  viewportHeight / (detectedHeight * 96)
) * 100;
setZoom(Math.max(10, Math.min(800, fitZoom)));
setPanX(0);
setPanY(0);
```

Same fit-to-viewport logic in the paste handler's `img.onload` (around line 151).

- [ ] **Step 2: Pass pan props to PatternPreviewCanvas**

In `app/page.tsx`, update the `<PatternPreviewCanvas>` JSX (around line 513) to pass new props:

```tsx
<PatternPreviewCanvas
  image={image}
  repeatType={repeatType}
  tileWidth={getEffectiveDimensions().width}
  tileHeight={getEffectiveDimensions().height}
  dpi={dpi}
  zoom={zoom}
  onZoomChange={isScalePreviewActive && scalePreviewSize !== null ? undefined : setZoom}
  panX={panX}
  panY={panY}
  onPanChange={(x: number, y: number) => { setPanX(x); setPanY(y); }}
  showTileOutline={showTileOutline}
  tileOutlineColor={tileOutlineColor}
/>
```

- [ ] **Step 3: Update zoom slider range in PatternControlsTopBar**

In `src/components/layout/PatternControlsTopBar.tsx`, update the zoom slider (around lines 328-370):

Change min/max from `0`/`200` to `10`/`800`:
- Line 333 label: `<span className="text-xs text-white whitespace-nowrap">10%</span>`
- Line 336 `min="10"`, line 337 `max="800"`
- Line 339 value clamp: `Math.max(10, Math.min(800, zoom))`
- Line 342 onChange clamp: `Math.max(10, Math.min(800, newZoom))`
- Line 352 background gradient: update `200` to `800` in percentage calc
- Line 355 label: `<span className="text-xs text-white whitespace-nowrap">800%</span>`

- [ ] **Step 4: Do NOT commit yet**

The pan props won't compile until PatternPreviewCanvas accepts them in Task 3. All changes from Tasks 1-3 will be committed together after Task 3.

---

## Chunk 2: Main Canvas Rendering

### Task 3: Rewrite PatternPreviewCanvas for viewport rendering

**Files:**
- Modify: `src/components/canvas/PatternPreviewCanvas.tsx` (major rewrite of rendering logic)

This is the largest task. The key changes:
1. Accept `panX`, `panY`, `onPanChange` props
2. Remove `displayZoomToActualZoom()` — zoom maps directly
3. Remove the intermediate canvas + `toDataURL` roundtrip
4. Use the new PatternTiler API with source image + viewport
5. Replace `overflow-auto` scroll with pointer-event pan handlers
6. Canvas size matches container exactly (no oversized canvas)
7. Update ruler `pixelsPerUnit` formulas

- [ ] **Step 1: Update the component props interface**

Add to `PatternPreviewCanvasProps`:
```typescript
panX: number;
panY: number;
onPanChange?: (x: number, y: number) => void;
```

Add props to destructuring.

- [ ] **Step 2: Add pan event handlers**

Add pan state and handlers (similar to SeamInspector's existing pattern):

```typescript
const [isPanning, setIsPanning] = useState(false);
const panStartRef = useRef({ x: 0, y: 0 });
const panOriginRef = useRef({ x: 0, y: 0 });
const rafPanRef = useRef<number | null>(null);

const handlePointerDown = useCallback((e: React.PointerEvent) => {
  if (e.button !== 0) return; // left click only
  setIsPanning(true);
  panStartRef.current = { x: e.clientX, y: e.clientY };
  panOriginRef.current = { x: panX, y: panY };
  (e.target as HTMLElement).setPointerCapture(e.pointerId);
}, [panX, panY]);

const handlePointerMove = useCallback((e: React.PointerEvent) => {
  if (!isPanning || !onPanChange) return;
  const dx = e.clientX - panStartRef.current.x;
  const dy = e.clientY - panStartRef.current.y;
  // RAF-throttle pan updates to prevent jank
  if (rafPanRef.current !== null) cancelAnimationFrame(rafPanRef.current);
  rafPanRef.current = requestAnimationFrame(() => {
    onPanChange(panOriginRef.current.x + dx, panOriginRef.current.y + dy);
    rafPanRef.current = null;
  });
}, [isPanning, onPanChange]);

const handlePointerUp = useCallback(() => {
  setIsPanning(false);
  if (rafPanRef.current !== null) {
    cancelAnimationFrame(rafPanRef.current);
    rafPanRef.current = null;
  }
}, []);
```

- [ ] **Step 3: Rewrite the main render effect**

Replace the render effect (lines 150-383) with viewport-based rendering. Key points:

- Remove `displayZoomToActualZoom` — use `zoom / 100` directly as the scale factor
- The scale factor converts pattern inches to screen pixels: `scaleFactor = (zoom / 100) * (96 / dpi)` — this means at 100% zoom, 1 pattern pixel = 96/dpi screen pixels
- Remove the intermediate `scaledCanvas` + `toDataURL` roundtrip entirely
- Create PatternTiler with `(ctx, canvasSize.width, canvasSize.height)`
- Call `tiler.render(image, repeatType, scaleFactor, panX, panY)`
- Draw tile outline after pattern, offset by panX/panY:

```typescript
if (showTileOutline) {
  const scaleFactor = (zoom / 100) * (96 / dpi);
  const outlineW = image.naturalWidth * scaleFactor;
  const outlineH = image.naturalHeight * scaleFactor;

  canvasCtx.strokeStyle = tileOutlineColor;
  canvasCtx.lineWidth = 6;
  canvasCtx.setLineDash([]);

  // Find all visible tile positions and draw outline for each
  // This reuses the same grid logic as PatternTiler
  const startCol = Math.floor(-panX / outlineW) - 1;
  const endCol = Math.ceil((canvasSize.width - panX) / outlineW);
  const startRow = Math.floor(-panY / outlineH) - 1;
  const endRow = Math.ceil((canvasSize.height - panY) / outlineH);

  for (let col = startCol; col <= endCol; col++) {
    for (let row = startRow; row <= endRow; row++) {
      let ox = col * outlineW + panX;
      let oy = row * outlineH + panY;

      // Apply repeat type offsets
      if (repeatType === 'half-drop') {
        oy += (((col % 2) + 2) % 2 !== 0) ? outlineH / 2 : 0;
      } else if (repeatType === 'half-brick') {
        ox += (((row % 2) + 2) % 2 !== 0) ? outlineW / 2 : 0;
      }

      // Skip if outside viewport
      if (ox + outlineW <= 0 || oy + outlineH <= 0 || ox >= canvasSize.width || oy >= canvasSize.height) continue;

      canvasCtx.strokeRect(ox + 3, oy + 3, outlineW - 6, outlineH - 6);
    }
  }
}
```

- Placeholder rendering stays unchanged (it's a small image, no pixelation concern)

- [ ] **Step 4: Update ruler pixelsPerUnit calculations**

Replace the old formula block (lines 440-451):

```typescript
// Direct zoom: zoom% = scale factor, no indirection
const scaleFactor = (zoom / 100) * (96 / dpi);
const pixelsPerInch = (zoom / 100) * 96;
const pixelsPerPixel = scaleFactor; // (zoom / 100) * (96 / dpi)

const getPixelsPerUnit = (unit: 'in' | 'cm' | 'px') => {
  if (unit === 'in') return pixelsPerInch;
  if (unit === 'cm') return pixelsPerInch / 2.54;
  return pixelsPerPixel;
};
```

- [ ] **Step 5: Update zoom clamp values in wheel/pinch handlers**

- Wheel handler (line 57): Change `Math.min(200, ...)` to `Math.min(800, ...)` and `Math.max(0, ...)` to `Math.max(10, ...)`
- Pinch handler (line 80): Same clamp change

- [ ] **Step 6: Update the scroll container to pan container**

In the JSX, change the scroll container div (around line 500-513):
- Remove `overflow-auto` class
- Add `overflow-hidden` class
- Add pointer event handlers for panning
- Add cursor style (grab/grabbing)

```tsx
<div
  ref={scrollContainerRef}
  className="flex-1 overflow-hidden bg-[#0f172a] relative"
  style={{
    touchAction: 'none',
    cursor: isPanning ? 'grabbing' : 'grab',
  }}
  onPointerDown={handlePointerDown}
  onPointerMove={handlePointerMove}
  onPointerUp={handlePointerUp}
  onPointerCancel={handlePointerUp}
>
```

Remove the old touch handlers (`onTouchStart`, `onTouchMove`, `onTouchEnd`) from this div since pointer events handle both mouse and touch.

- [ ] **Step 7: Update canvas sizing**

In the canvas sizing effect (lines 90-140), change the height calculation:
- Remove the `* 1.1` oversizing — canvas matches container exactly
- Remove `containerHeight` state and `setContainerHeight` calls (no longer needed for overflow)

```typescript
// Canvas matches visible container exactly
const displayHeight = scrollParent
  ? Math.round(scrollParent.clientHeight)
  : Math.round(window.innerHeight * 0.8);
```

- [ ] **Step 8: Clean up removed code**

Remove the following from PatternPreviewCanvas:
- Delete the `displayZoomToActualZoom` function (lines 144-148)
- Delete the `tileDisplaySize` state (`useState`) and all `setTileDisplaySize` calls — tile dimensions are now computed directly from `zoom`, `dpi`, and `image.naturalWidth/Height`
- Delete `containerHeight` state and any JSX that uses it
- Remove old touch handlers (`handleTouchStart`, `handleTouchMove`, `handleTouchEnd`, `getTouchDistance`, `pinchRef`) — pointer events replace these

- [ ] **Step 9: Verify TypeScript compiles cleanly**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors

- [ ] **Step 9: Test in browser**

1. Open http://localhost:3000
2. Upload a high-res pattern file (300+ DPI, 3000+ px)
3. Verify: Pattern renders without pixelation at default zoom
4. Zoom to 800% — verify individual source pixels are visible and sharp
5. Zoom to 10% — verify multiple tile repetitions visible
6. Pan by dragging — verify smooth movement
7. Toggle tile outline — verify it overlays correctly at all zoom/pan positions
8. Toggle repeat types (full-drop, half-drop, half-brick) — verify correct tiling
9. Check ruler reads correct values in all units at various zoom levels
10. Test Ctrl+scroll zoom — verify 10-800 range
11. Test on mobile viewport — verify pinch-to-zoom and touch panning

- [ ] **Step 11: Commit Tasks 1-3 together (all must compile)**

```bash
git add src/lib/tiling/PatternTiler.ts src/components/canvas/PatternPreviewCanvas.tsx app/page.tsx src/components/layout/PatternControlsTopBar.tsx
git commit -m "feat: viewport-based rendering for main canvas

Rewrite PatternTiler to draw directly from full-res source image
via 9-arg drawImage. Remove intermediate canvas and toDataURL
roundtrip. Replace overflow scroll with pointer-event panning.
Extend zoom range to 10-800%. Add fit-to-viewport on upload."
```

---

## Chunk 3: SeamInspector

### Task 4: Rewrite SeamInspector for viewport rendering

**Files:**
- Modify: `src/components/analysis/SeamInspector.tsx`

- [ ] **Step 1: Read SeamInspector current implementation**

Read `src/components/analysis/SeamInspector.tsx` to understand the current rendering approach — `createTileGrid()` builds a 4x4 grid on an offscreen canvas, then `createPattern()` tiles it.

- [ ] **Step 2: Remove createTileGrid and renderManualTiling helpers**

Delete the `createTileGrid` function (lines 22-88) and `renderManualTiling` function (lines 566-596). They will be replaced with direct viewport rendering.

- [ ] **Step 3: Extend zoom range**

Update zoom buttons and clamp values:
- Zoom out button (line 405): Change `Math.max(50, ...)` to `Math.max(100, ...)`
- Zoom in button (line 452): Change `Math.min(400, ...)` to `Math.min(800, ...)`
- Add an 800% preset button after the 400% button
- Keep existing step size (25)

- [ ] **Step 4: Disable image smoothing**

In the render effect (around line 213-215), change:
```typescript
ctx.imageSmoothingEnabled = false;
// Remove: ctx.imageSmoothingQuality = 'high';
```

- [ ] **Step 5: Rewrite intersection view rendering**

Replace the intersection view block (lines 218-257) with direct viewport rendering:

```typescript
if (seamType === 'intersection') {
  const srcW = image.naturalWidth;
  const srcH = image.naturalHeight;
  const scaledW = srcW * zoomFactor;
  const scaledH = srcH * zoomFactor;

  // Center the view on the intersection of 4 tiles
  const centerX = (canvasWidth / 2) + panOffset.x;
  const centerY = (canvasHeight / 2) + panOffset.y;

  // Calculate tile positions for all repeat types
  // The intersection point is at the corner where tiles meet
  const basePanX = centerX - scaledW;
  const basePanY = centerY - scaledH;

  // Calculate visible tile range
  const startCol = Math.floor(-basePanX / scaledW) - 1;
  const endCol = Math.ceil((canvasWidth - basePanX) / scaledW);
  const startRow = Math.floor(-basePanY / scaledH) - 1;
  const endRow = Math.ceil((canvasHeight - basePanY) / scaledH);

  for (let col = startCol; col <= endCol; col++) {
    for (let row = startRow; row <= endRow; row++) {
      let dx = col * scaledW + basePanX;
      let dy = row * scaledH + basePanY;

      // Apply repeat type offsets
      if (repeatType === 'half-drop') {
        dy += (((col % 2) + 2) % 2 !== 0) ? scaledH / 2 : 0;
      } else if (repeatType === 'half-brick') {
        dx += (((row % 2) + 2) % 2 !== 0) ? scaledW / 2 : 0;
      }

      // Skip tiles outside viewport
      if (dx + scaledW <= 0 || dy + scaledH <= 0 || dx >= canvasWidth || dy >= canvasHeight) continue;

      ctx.drawImage(image, 0, 0, srcW, srcH, dx, dy, scaledW, scaledH);
    }
  }

  // Draw pink crosshair
  if (showPinkLines) {
    ctx.strokeStyle = seamLineColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(canvasWidth, centerY);
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, canvasHeight);
    ctx.stroke();
  }
}
```

- [ ] **Step 6: Rewrite horizontal seam view**

Replace the horizontal seam block (lines 258-295) with direct viewport rendering:

```typescript
else if (seamType === 'horizontal') {
  const srcW = image.naturalWidth;
  const srcH = image.naturalHeight;
  const scaledW = srcW * zoomFactor;
  const scaledH = srcH * zoomFactor;

  // Section offset along the seam
  const sectionWidth = scaledW / 3;
  const sectionOffset = seamSection === 'start' ? 0 :
                        seamSection === 'middle' ? sectionWidth :
                        sectionWidth * 2;

  // Center view on horizontal seam at the selected section
  const basePanX = (canvasWidth / 2) - sectionOffset - sectionWidth / 2 + panOffset.x;
  const basePanY = (canvasHeight / 2) - scaledH + panOffset.y;

  const startCol = Math.floor(-basePanX / scaledW) - 1;
  const endCol = Math.ceil((canvasWidth - basePanX) / scaledW);
  const startRow = Math.floor(-basePanY / scaledH) - 1;
  const endRow = Math.ceil((canvasHeight - basePanY) / scaledH);

  for (let col = startCol; col <= endCol; col++) {
    for (let row = startRow; row <= endRow; row++) {
      let dx = col * scaledW + basePanX;
      let dy = row * scaledH + basePanY;

      if (repeatType === 'half-brick') {
        dx += (((row % 2) + 2) % 2 !== 0) ? scaledW / 2 : 0;
      }

      if (dx + scaledW <= 0 || dy + scaledH <= 0 || dx >= canvasWidth || dy >= canvasHeight) continue;
      ctx.drawImage(image, 0, 0, srcW, srcH, dx, dy, scaledW, scaledH);
    }
  }

  // Draw pink seam line at the horizontal seam
  if (showPinkLines) {
    const seamY = (canvasHeight / 2) + panOffset.y;
    ctx.strokeStyle = seamLineColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, seamY);
    ctx.lineTo(canvasWidth, seamY);
    ctx.stroke();
  }
}
```

- [ ] **Step 7: Rewrite vertical seam view**

Replace the vertical seam block (lines 297-335) with direct viewport rendering:

```typescript
else {
  // Vertical seam
  const srcW = image.naturalWidth;
  const srcH = image.naturalHeight;
  const scaledW = srcW * zoomFactor;
  const scaledH = srcH * zoomFactor;

  const sectionHeight = scaledH / 3;
  const sectionOffset = seamSection === 'start' ? 0 :
                        seamSection === 'middle' ? sectionHeight :
                        sectionHeight * 2;

  // Center view on vertical seam at the selected section
  const basePanX = (canvasWidth / 2) - scaledW + panOffset.x;
  const basePanY = (canvasHeight / 2) - sectionOffset - sectionHeight / 2 + panOffset.y;

  const startCol = Math.floor(-basePanX / scaledW) - 1;
  const endCol = Math.ceil((canvasWidth - basePanX) / scaledW);
  const startRow = Math.floor(-basePanY / scaledH) - 1;
  const endRow = Math.ceil((canvasHeight - basePanY) / scaledH);

  for (let col = startCol; col <= endCol; col++) {
    for (let row = startRow; row <= endRow; row++) {
      let dx = col * scaledW + basePanX;
      let dy = row * scaledH + basePanY;

      if (repeatType === 'half-drop') {
        dy += (((col % 2) + 2) % 2 !== 0) ? scaledH / 2 : 0;
      }

      if (dx + scaledW <= 0 || dy + scaledH <= 0 || dx >= canvasWidth || dy >= canvasHeight) continue;
      ctx.drawImage(image, 0, 0, srcW, srcH, dx, dy, scaledW, scaledH);
    }
  }

  // Draw pink seam line at the vertical seam
  if (showPinkLines) {
    const seamX = (canvasWidth / 2) + panOffset.x;
    ctx.strokeStyle = seamLineColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(seamX, 0);
    ctx.lineTo(seamX, canvasHeight);
    ctx.stroke();
  }
}
```

- [ ] **Step 8: Remove MAX_CANVAS_PIXELS constant**

Delete line 17 (`const MAX_CANVAS_PIXELS = 16_000_000;`) — no longer needed since we don't build intermediate canvases.

- [ ] **Step 9: Verify TypeScript compiles cleanly**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors

- [ ] **Step 10: Test SeamInspector in browser**

1. Upload a high-res pattern
2. Open Seam Inspector
3. Intersection view: verify 4 tiles meet at center crosshair, no pixelation
4. Zoom to 800% — verify individual pixels visible and sharp (no smoothing)
5. Pan around — verify smooth movement
6. Switch to horizontal seam view — verify seam line centered, sections work
7. Switch to vertical seam view — same checks
8. Test all three repeat types in each view
9. Toggle pink lines on/off
10. Test keyboard navigation (arrows for section switching)

- [ ] **Step 11: Commit SeamInspector rewrite**

```bash
git add src/components/analysis/SeamInspector.tsx
git commit -m "feat: viewport-based rendering for SeamInspector

Draw directly from source image, removing createTileGrid
intermediate canvas and createPattern. Extend zoom to 800%.
Disable image smoothing at all zoom levels for accurate
seam inspection."
```

---

## Chunk 4: Final Integration

### Task 5: Integration testing and cleanup

**Files:**
- Possibly: `src/components/canvas/Ruler.tsx` (extend px steps if needed)
- Possibly: any file with remaining compilation errors

- [ ] **Step 1: Full TypeScript check**

Run: `npx tsc --noEmit --pretty`
Expected: No errors. Fix any remaining issues.

- [ ] **Step 2: Test ruler at extreme zoom/DPI combinations**

Test with a 600 DPI file at 10% zoom:
- `pixelsPerPixel = 0.1 * 96/600 = 0.016`
- A 5000px step = 80 screen pixels — borderline OK
- If labels overlap, add `10000, 20000` to the steps array in `Ruler.tsx` line 136

- [ ] **Step 3: Test Scale Preview compatibility**

1. Enable Scale Preview with a custom size
2. Verify the pattern renders at the scaled size
3. Verify zoom slider shows "locked by scale preview"
4. Verify ruler shows correct measurements for the scaled tile

- [ ] **Step 4: Remove console.log debug statements**

Search for and remove any `console.log` statements that were in the original code for debugging (e.g., `console.log('🔍 PatternTiler.renderFullDrop:')`, `console.log('🎯 DISPLAY SIZE CALC:')`, etc.).

Run: `grep -rn "console.log" src/components/canvas/PatternPreviewCanvas.tsx src/lib/tiling/PatternTiler.ts`

Remove all debug logs from these files.

- [ ] **Step 5: Final browser test**

Full regression test:
1. Upload pattern — verify fit-to-viewport initial zoom
2. Zoom slider 10% to 800% — smooth, no pixelation at any level
3. All three repeat types — correct tiling
4. Tile outline — correct position at all zoom/pan
5. Ruler — correct measurements in in/cm/px
6. Seam Inspector — all views, all zoom levels, sharp pixels
7. Clear pattern — everything resets
8. Paste image — works correctly
9. Scale Preview — compatible with new zoom
10. Mobile: touch panning and pinch zoom

- [ ] **Step 6: Commit any remaining fixes**

```bash
git add -A
git commit -m "fix: integration fixes for viewport-based rendering

Clean up debug logs, fix ruler edge cases, verify Scale Preview
compatibility."
```
