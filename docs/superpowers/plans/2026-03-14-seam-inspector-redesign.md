# Seam Inspector Redesign — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the SeamInspector modal with a full-page view in a new browser tab, using a single tile-outline view that works for all repeat types.

**Architecture:** New Next.js page route (`/seam-inspector`) receives image data from the parent tab via `postMessage`. The existing `SeamInspector.tsx` is rewritten as the full-page canvas component. Parent components (`AdvancedToolsBar`, `ActionsSidebar`, `SeamAnalyzer`) switch from rendering a modal to calling `window.open()`.

**Tech Stack:** Next.js App Router, React, Canvas API, `postMessage` for cross-tab communication

**Spec:** `docs/superpowers/specs/2026-03-14-seam-inspector-redesign.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `app/seam-inspector/page.tsx` | Create | Next.js page route — receives data via postMessage, renders SeamInspectorCanvas |
| `src/components/analysis/SeamInspectorCanvas.tsx` | Create | Full-page canvas component — tiling, outline, zoom, pan, floating controls |
| `src/lib/seam-inspector/openSeamInspector.ts` | Create | Helper that calls `window.open()` and handles postMessage handshake |
| `src/components/analysis/SeamInspector.tsx` | Delete | Old modal component — fully replaced |
| `src/components/analysis/SeamAnalyzer.tsx` | Modify | Replace modal toggle with `openSeamInspector()` call |
| `src/components/layout/AdvancedToolsBar.tsx` | Modify | Replace modal rendering with `openSeamInspector()` call |
| `src/components/sidebar/ActionsSidebar.tsx` | Modify | Replace modal rendering with `openSeamInspector()` call |

---

## Chunk 1: Cross-Tab Communication

### Task 1: Create the `openSeamInspector` helper

**Files:**
- Create: `src/lib/seam-inspector/openSeamInspector.ts`

- [ ] **Step 1: Create the helper file**

This module handles `window.open()` and the postMessage handshake. It converts the HTMLImageElement to a data URL, opens the inspector tab, and responds when the inspector sends `{ type: 'ready' }`.

```typescript
// src/lib/seam-inspector/openSeamInspector.ts
'use client';

interface SeamInspectorParams {
  image: HTMLImageElement;
  repeatType: 'full-drop' | 'half-drop' | 'half-brick';
  dpi: number;
  filename: string | null;
  outlineColor?: string;
}

export function openSeamInspector({
  image,
  repeatType,
  dpi,
  filename,
  outlineColor = '#ec4899',
}: SeamInspectorParams): void {
  // Convert image to data URL so the child tab owns the data
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.drawImage(image, 0, 0);
  const imageDataUrl = canvas.toDataURL('image/png');

  const inspectorWindow = window.open('/seam-inspector', '_blank');
  if (!inspectorWindow) return;

  const handleMessage = (event: MessageEvent) => {
    if (event.origin !== window.location.origin) return;
    if (event.data?.type === 'ready') {
      inspectorWindow.postMessage(
        {
          type: 'init',
          imageUrl: imageDataUrl,
          repeatType,
          dpi,
          filename: filename || 'pattern',
          outlineColor,
        },
        window.location.origin
      );
      window.removeEventListener('message', handleMessage);
    }
  };

  window.addEventListener('message', handleMessage);

  // Clean up listener if window closes before ready
  const checkClosed = setInterval(() => {
    if (inspectorWindow.closed) {
      clearInterval(checkClosed);
      window.removeEventListener('message', handleMessage);
    }
  }, 1000);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/seam-inspector/openSeamInspector.ts
git commit -m "feat: add openSeamInspector helper for cross-tab communication"
```

---

### Task 2: Create the `/seam-inspector` page route

**Files:**
- Create: `app/seam-inspector/page.tsx`

- [ ] **Step 1: Create the page route**

This is a thin wrapper that handles the postMessage handshake, loads the image, and renders the canvas component (Task 3). For now, render a loading/error state while the canvas component is built in the next task.

```typescript
// app/seam-inspector/page.tsx
'use client';

import { useEffect, useState } from 'react';

type RepeatType = 'full-drop' | 'half-drop' | 'half-brick';

interface InspectorData {
  image: HTMLImageElement;
  repeatType: RepeatType;
  dpi: number;
  filename: string;
  outlineColor: string;
}

export default function SeamInspectorPage() {
  const [data, setData] = useState<InspectorData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!window.opener) {
      setError('No pattern data available. Please open the Seam Inspector from the main editor.');
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== 'init') return;

      const { imageUrl, repeatType, dpi, filename, outlineColor } = event.data;

      // Copy image data into our own HTMLImageElement
      const img = new Image();
      img.onload = () => {
        setData({
          image: img,
          repeatType,
          dpi,
          filename,
          outlineColor,
        });
      };
      img.onerror = () => {
        setError('Failed to load pattern image.');
      };
      img.src = imageUrl;

      window.removeEventListener('message', handleMessage);
    };

    window.addEventListener('message', handleMessage);

    // Signal ready to parent
    window.opener.postMessage({ type: 'ready' }, window.location.origin);

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // ESC to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') window.close();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-[#294051] flex items-center justify-center">
        <div className="bg-white rounded-lg p-8 max-w-md text-center shadow-xl">
          <h2 className="text-lg font-bold text-[#294051] mb-3">Seam Inspector</h2>
          <p className="text-sm text-[#6b7280] mb-4">{error}</p>
          <a
            href="/"
            className="inline-block px-4 py-2 bg-[#e0c26e] text-white rounded-lg font-semibold text-sm hover:bg-[#c9a94e] transition-colors"
          >
            Go to Editor
          </a>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#294051] flex items-center justify-center">
        <p className="text-[#94a3b8] text-sm">Loading pattern...</p>
      </div>
    );
  }

  // Temporary: render placeholder until SeamInspectorCanvas is built
  return (
    <div className="min-h-screen bg-[#294051] flex items-center justify-center">
      <p className="text-[#94a3b8] text-sm">
        Loaded: {data.filename} ({data.image.naturalWidth}x{data.image.naturalHeight}) — {data.repeatType}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/seam-inspector/page.tsx
git commit -m "feat: add /seam-inspector page route with postMessage handshake"
```

---

## Chunk 2: Full-Page Canvas Component

### Task 3: Create `SeamInspectorCanvas`

**Files:**
- Create: `src/components/analysis/SeamInspectorCanvas.tsx`

- [ ] **Step 1: Create the canvas component**

This is the core component — handles tiling, pink dashed tile outline, panning, scroll-wheel zoom, floating controls. Reuses the viewport-based rendering logic from the old `SeamInspector.tsx`.

```typescript
// src/components/analysis/SeamInspectorCanvas.tsx
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface SeamInspectorCanvasProps {
  image: HTMLImageElement;
  repeatType: 'full-drop' | 'half-drop' | 'half-brick';
  dpi: number;
  filename: string;
  outlineColor: string;
}

export default function SeamInspectorCanvas({
  image,
  repeatType,
  dpi,
  filename,
  outlineColor,
}: SeamInspectorCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState(200);
  const [showOutline, setShowOutline] = useState(true);
  const [isPanning, setIsPanning] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });
  const dragStartRef = useRef({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Clamp zoom to 25-800
  const clampZoom = (z: number) => Math.max(25, Math.min(800, z));

  // Measure container
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Pointer handlers for panning
  const handlePointerDown = useCallback(
    (clientX: number, clientY: number) => {
      setIsPanning(true);
      dragStartRef.current = { x: clientX, y: clientY };
      panStartRef.current = { ...panOffset };
    },
    [panOffset]
  );

  const handlePointerMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!isPanning) return;
      setPanOffset({
        x: panStartRef.current.x + (clientX - dragStartRef.current.x),
        y: panStartRef.current.y + (clientY - dragStartRef.current.y),
      });
    },
    [isPanning]
  );

  const handlePointerUp = useCallback(() => setIsPanning(false), []);

  // Scroll-wheel zoom (10% steps, anchored to cursor)
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -10 : 10;
      const newZoom = clampZoom(zoomLevel + delta);
      if (newZoom === zoomLevel) return;

      // Anchor zoom to cursor position
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) {
        setZoomLevel(newZoom);
        return;
      }

      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      const scale = newZoom / zoomLevel;
      setPanOffset((prev) => ({
        x: cursorX - scale * (cursorX - prev.x),
        y: cursorY - scale * (cursorY - prev.y),
      }));
      setZoomLevel(newZoom);
    },
    [zoomLevel]
  );

  // Attach wheel listener (needs { passive: false })
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Render
  useEffect(() => {
    if (!canvasRef.current || containerSize.width === 0 || containerSize.height === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const deviceDpr = window.devicePixelRatio || 1;
    const safeDpr = Math.min(deviceDpr, 2);
    const zoomFactor = (zoomLevel / 100) * (96 / dpi);

    const canvasWidth = containerSize.width;
    const canvasHeight = containerSize.height;

    canvas.width = canvasWidth * safeDpr;
    canvas.height = canvasHeight * safeDpr;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;

    ctx.setTransform(safeDpr, 0, 0, safeDpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    const srcW = image.naturalWidth;
    const srcH = image.naturalHeight;
    const scaledW = srcW * zoomFactor;
    const scaledH = srcH * zoomFactor;

    // Base position: tile (0,0) starts centered in viewport, then offset by pan
    const baseX = (canvasWidth / 2 - scaledW / 2) + panOffset.x;
    const baseY = (canvasHeight / 2 - scaledH / 2) + panOffset.y;

    // Calculate visible tile range
    const startCol = Math.floor(-baseX / scaledW) - 1;
    const endCol = Math.ceil((canvasWidth - baseX) / scaledW);
    const startRow = Math.floor(-baseY / scaledH) - 1;
    const endRow = Math.ceil((canvasHeight - baseY) / scaledH);

    // Draw tiles
    for (let col = startCol; col <= endCol; col++) {
      for (let row = startRow; row <= endRow; row++) {
        let dx = col * scaledW + baseX;
        let dy = row * scaledH + baseY;

        // Apply repeat-type offsets
        if (repeatType === 'half-drop') {
          dy += (((col % 2) + 2) % 2 !== 0) ? scaledH / 2 : 0;
        } else if (repeatType === 'half-brick') {
          dx += (((row % 2) + 2) % 2 !== 0) ? scaledW / 2 : 0;
        }

        // Viewport culling
        if (dx + scaledW <= 0 || dy + scaledH <= 0 || dx >= canvasWidth || dy >= canvasHeight) continue;
        ctx.drawImage(image, 0, 0, srcW, srcH, dx, dy, scaledW, scaledH);
      }
    }

    // Draw outline around tile (0, 0)
    if (showOutline) {
      let outlineX = baseX;
      let outlineY = baseY;

      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([8, 4]);
      ctx.strokeRect(outlineX, outlineY, scaledW, scaledH);
      ctx.setLineDash([]);
    }
  }, [image, zoomLevel, panOffset, showOutline, containerSize, repeatType, dpi, outlineColor]);

  const repeatLabel =
    repeatType === 'full-drop' ? 'Full Drop' :
    repeatType === 'half-drop' ? 'Half Drop' : 'Half Brick';

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#294051]">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-5 py-2.5 bg-[#f8fafc] border-b border-[#e2e8f0] shrink-0">
        <span className="font-bold text-[#294051] text-[15px]">Seam Inspector</span>
        <span className="text-[#9ca3af] text-xs italic">{filename}</span>
        <span className="text-[10px] px-2 py-0.5 rounded bg-[#f0fdf4] text-[#166534] border border-[#bbf7d0]">
          {repeatLabel}
        </span>
        <span className="ml-auto text-[#9ca3af] text-[11px]">
          Drag to pan · Scroll to zoom
        </span>
      </div>

      {/* Canvas container */}
      <div
        ref={containerRef}
        className="flex-1 relative"
        style={{ cursor: isPanning ? 'grabbing' : 'grab', touchAction: 'none' }}
        onMouseDown={(e) => handlePointerDown(e.clientX, e.clientY)}
        onMouseMove={(e) => handlePointerMove(e.clientX, e.clientY)}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchStart={(e) => {
          if (e.touches.length === 1) {
            handlePointerDown(e.touches[0].clientX, e.touches[0].clientY);
          }
        }}
        onTouchMove={(e) => {
          if (e.touches.length === 1) {
            handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
          }
        }}
        onTouchEnd={handlePointerUp}
        onTouchCancel={handlePointerUp}
      >
        <canvas ref={canvasRef} className="absolute inset-0" />

        {/* Floating control — bottom left */}
        <div className="absolute bottom-5 left-5 flex items-center gap-2.5 px-4 py-2 rounded-[10px] bg-white/[0.93] backdrop-blur-[10px] shadow-[0_2px_12px_rgba(0,0,0,0.2)] text-[#374151] text-[12px] select-none">
          <button
            onClick={() => setZoomLevel((z) => clampZoom(z - 25))}
            className="px-2.5 py-1 rounded-md bg-[#e5e7eb] font-bold text-sm hover:bg-[#d1d5db] transition-colors"
            aria-label="Zoom out"
          >
            −
          </button>
          <span className="font-bold min-w-[42px] text-center text-[13px]">
            {Math.round(zoomLevel)}%
          </span>
          <button
            onClick={() => setZoomLevel((z) => clampZoom(z + 25))}
            className="px-2.5 py-1 rounded-md bg-[#e5e7eb] font-bold text-sm hover:bg-[#d1d5db] transition-colors"
            aria-label="Zoom in"
          >
            +
          </button>
          <span className="text-[#d1d5db] mx-0.5">|</span>
          <label className="flex items-center gap-1.5 cursor-pointer text-[12px]">
            <input
              type="checkbox"
              checked={showOutline}
              onChange={(e) => setShowOutline(e.target.checked)}
              className="w-4 h-4 rounded border-[#d1d5db]"
              style={{ accentColor: '#e0c26e' }}
            />
            Outline
          </label>
        </div>

        {/* Bottom right hint */}
        <div className="absolute bottom-6 right-5 text-[10px] text-white/30">
          ESC or close tab to return
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/analysis/SeamInspectorCanvas.tsx
git commit -m "feat: add SeamInspectorCanvas full-page component with tiling, outline, zoom, pan"
```

---

### Task 4: Wire the canvas into the page route

**Files:**
- Modify: `app/seam-inspector/page.tsx`

- [ ] **Step 1: Replace the placeholder with SeamInspectorCanvas**

In `app/seam-inspector/page.tsx`, replace the temporary placeholder at the bottom of the component with:

```typescript
// Add import at top of file:
import SeamInspectorCanvas from '@/components/analysis/SeamInspectorCanvas';

// Replace the final return (the one with "Loaded: ...") with:
return (
  <SeamInspectorCanvas
    image={data.image}
    repeatType={data.repeatType}
    dpi={data.dpi}
    filename={data.filename}
    outlineColor={data.outlineColor}
  />
);
```

- [ ] **Step 2: Commit**

```bash
git add app/seam-inspector/page.tsx
git commit -m "feat: wire SeamInspectorCanvas into /seam-inspector page route"
```

---

## Chunk 3: Rewire Parent Components

### Task 5: Update `SeamAnalyzer.tsx` to use `openSeamInspector`

**Files:**
- Modify: `src/components/analysis/SeamAnalyzer.tsx`

- [ ] **Step 1: Replace modal logic with window.open**

Replace the import, state, and SeamInspector rendering:

```typescript
// Replace import:
// REMOVE: import SeamInspector from './SeamInspector';
// ADD:
import { openSeamInspector } from '@/lib/seam-inspector/openSeamInspector';

// REMOVE state: const [isModalOpen, setIsModalOpen] = useState(false);

// Update handleInspect:
const handleInspect = () => {
  if (!image) return;
  openSeamInspector({
    image,
    repeatType:
      repeatType === 'fulldrop' ? 'full-drop' :
      repeatType === 'halfdrop' ? 'half-drop' :
      'half-brick',
    dpi: dpi ?? 150,
    filename: null,
    outlineColor: seamLineColor,
  });
};

// REMOVE the <SeamInspector .../> JSX block at the bottom of the return
```

- [ ] **Step 2: Verify the `useState` import can be removed if no other state remains**

Check if `isModalOpen` was the only state. If so, remove `useState` from the import.

- [ ] **Step 3: Commit**

```bash
git add src/components/analysis/SeamAnalyzer.tsx
git commit -m "refactor: SeamAnalyzer uses openSeamInspector instead of modal"
```

---

### Task 6: Update `AdvancedToolsBar.tsx`

**Files:**
- Modify: `src/components/layout/AdvancedToolsBar.tsx`

- [ ] **Step 1: Replace SeamInspector modal with openSeamInspector**

```typescript
// Replace import:
// REMOVE: import SeamInspector from '@/components/analysis/SeamInspector';
// ADD:
import { openSeamInspector } from '@/lib/seam-inspector/openSeamInspector';

// REMOVE state: any isSeamOpen state variable

// Where the SeamInspector button triggers setIsSeamOpen(true), preserve the
// handleProToolClick() wrapper that gates behind pro status:
onClick={() => handleProToolClick(() => openSeamInspector({
  image: image!,
  repeatType,
  dpi,
  filename: originalFilename,
  outlineColor: tileOutlineColor,
})))

// REMOVE the <SeamInspector .../> JSX block
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/AdvancedToolsBar.tsx
git commit -m "refactor: AdvancedToolsBar uses openSeamInspector instead of modal"
```

---

### Task 7: Update `ActionsSidebar.tsx`

**Files:**
- Modify: `src/components/sidebar/ActionsSidebar.tsx`

- [ ] **Step 1: Replace SeamInspector modal with openSeamInspector**

```typescript
// Replace import:
// REMOVE: import SeamInspector from '@/components/analysis/SeamInspector';
// ADD:
import { openSeamInspector } from '@/lib/seam-inspector/openSeamInspector';

// REMOVE state: const [isSeamInspectorOpen, setIsSeamInspectorOpen] = useState(false);

// Change the ToolButton onClick from setIsSeamInspectorOpen(true) to:
onClick={() => openSeamInspector({
  image: image!,
  repeatType,
  dpi,
  filename: originalFilename,
  outlineColor: tileOutlineColor,
})}

// REMOVE the <SeamInspector .../> JSX block
```

- [ ] **Step 2: Commit**

```bash
git add src/components/sidebar/ActionsSidebar.tsx
git commit -m "refactor: ActionsSidebar uses openSeamInspector instead of modal"
```

---

### Task 8: Delete old SeamInspector modal

**Files:**
- Delete: `src/components/analysis/SeamInspector.tsx`

- [ ] **Step 1: Verify no remaining imports of the old component**

```bash
grep -r "from.*SeamInspector'" src/ app/ --include="*.tsx" --include="*.ts"
```

Expected: only references to `SeamInspectorCanvas` and `openSeamInspector`, no references to the old `SeamInspector` default export.

- [ ] **Step 2: Delete the file**

```bash
rm src/components/analysis/SeamInspector.tsx
```

- [ ] **Step 3: Commit**

```bash
git add -u src/components/analysis/SeamInspector.tsx
git commit -m "refactor: remove old SeamInspector modal component"
```

---

## Chunk 4: Manual Testing & Polish

### Task 9: Build verification and browser test

- [ ] **Step 1: Run the build**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 2: Browser test checklist**

Start the dev server (`npm run dev`) and test:

1. Upload a pattern image
2. Click "Seam Analyzer" / "Inspect Seams" — new tab opens
3. Verify: top bar shows filename + repeat type badge
4. Verify: tiled pattern fills viewport, one tile has pink dashed outline
5. Drag to pan — smooth movement, grab/grabbing cursor
6. Scroll wheel — zoom changes by ~10% per scroll tick, anchored to cursor
7. Click `+` button — zoom increases by 25%
8. Click `−` button — zoom decreases by 25%
9. Zoom to 25% (minimum) — verify cannot go lower
10. Zoom to 800% (maximum) — verify cannot go higher
11. Toggle "Outline" checkbox — pink dashed border toggles
12. Switch repeat type to half-drop in main editor, re-open inspector — verify staggered tiling
13. Switch repeat type to half-brick — verify horizontal offset tiling
14. Press ESC — tab closes
15. Refresh the inspector tab — error message appears with link to editor
16. Close parent tab, verify inspector still works with its loaded image

- [ ] **Step 3: Fix any issues found during testing**

- [ ] **Step 4: Final commit if fixes were needed**

```bash
git add -A
git commit -m "fix: address issues found during seam inspector browser testing"
```
