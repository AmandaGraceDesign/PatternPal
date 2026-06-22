# Pattern Preview INP Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the root-route pattern-preview canvas (`/`) hit INP <200ms by making every post-gesture paint cheap — collapsing the per-tile full-res downscale into a single cached pre-scaled-tile blit, and deleting the landing-state `toDataURL` round-trip.

**Architecture:** "Cheap crisp frames." On image load, downsample the source once into an adaptively-sized **working canvas** (caps memory → also mitigates the iPad canvas crash). Build one **pre-scaled tile** (one `drawImage` downscale from the working source) and rebuild it only when scale/image/dpr change. Tile the viewport by blitting that cached tile at a pan offset — so pan re-blits (≈free) and zoom costs ≤1 downscale per frame instead of N. The landing/empty state pre-scales the 800×800 placeholder once and tiles it directly, deleting the `toDataURL('image/png')` + double `Image` decode that runs every zoom tick. Tile placement is extracted into one pure, tested `tilePositions()` function shared by old and new render paths, guaranteeing pixel-placement parity across all three repeat types.

**Tech Stack:** Next.js (App Router) client component, HTML5 Canvas 2D, TypeScript, Vitest (jsdom) for the pure-logic units, `web-vitals` for the INP verification harness.

**Verification posture:** The pure geometry/sizing helpers are TDD'd. The canvas integration is verified manually against the spec's measurement plan (local `web-vitals onINP` under 4–6× CPU throttle, target <200ms) — jsdom cannot render `drawImage`, so unit tests use a recording mock context for call-shape, not pixels. The riskiest piece (ref-driven commit-on-settle) is **measurement-gated**: implement it only if INP still exceeds target after the cache work lands.

**Source of truth:** `docs/superpowers/specs/2026-06-21-pattern-preview-inp-fix-design.md`

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `src/lib/tiling/PatternTiler.ts` | Tiling geometry + render primitives | Add pure `tilePositions()`; refactor 3 full-res renderers to use it; add `renderPreScaledAt()` |
| `src/lib/tiling/workingSource.ts` | Working-source sizing math (aspect-preserving, capped at natural) | **Create** |
| `src/components/canvas/PatternPreviewCanvas.tsx` | Live canvas: working-source cache, pre-scaled-tile cache, landing-state fix, outline overlay | Modify render effect + add cache refs |
| `src/lib/perf/inpHarness.ts` | Dev-only `web-vitals onINP` logger for verification | **Create** |
| `src/__tests__/tilePositions.test.ts` | Geometry parity tests | **Create** |
| `src/__tests__/renderPreScaledAt.test.ts` | Pre-scaled blit call-shape tests | **Create** |
| `src/__tests__/workingSourceSize.test.ts` | Sizing math tests | **Create** |

**Untouched invariants:** `renderPreScaled()` signature (used by `PatternCanvas.tsx` + `MockupPipeline.ts` exports) — do not modify it. Export/download via `canvasRef` stays main-thread. Free-test gating, signup/checkout, ruler, fullscreen untouched.

---

## Task 1: Extract pure `tilePositions()` and route the full-res renderers through it

**Why first:** This is the shared, tested geometry primitive that guarantees the new pre-scaled path places tiles identically to the existing full-res path across all 3 repeat types. Refactoring the existing renderers to consume it (and proving coordinates are unchanged) de-risks everything downstream and removes duplication.

**Files:**
- Modify: `src/lib/tiling/PatternTiler.ts`
- Test: `src/__tests__/tilePositions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/tilePositions.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { tilePositions } from '../lib/tiling/PatternTiler';

describe('tilePositions', () => {
  it('full-drop, no pan: covers the viewport with a 1-tile border', () => {
    // viewport 250x250, tile 100x100 -> cols -1..3 (ceil(250/100)=3), rows -1..3
    const pos = tilePositions('full-drop', 100, 100, 0, 0, 250, 250);
    const xs = [...new Set(pos.map(p => p.dx))].sort((a, b) => a - b);
    const ys = [...new Set(pos.map(p => p.dy))].sort((a, b) => a - b);
    expect(xs).toEqual([-100, 0, 100, 200, 300]);
    expect(ys).toEqual([-100, 0, 100, 200, 300]);
    expect(pos.length).toBe(25);
  });

  it('full-drop applies pan as an integer-rounded offset', () => {
    const pos = tilePositions('full-drop', 100, 100, 30, 30, 250, 250);
    // startCol = floor(-30/100)-1 = -2; first dx = round(-2*100 + 30) = -170
    expect(Math.min(...pos.map(p => p.dx))).toBe(-170);
  });

  it('half-drop offsets odd columns down by half a tile', () => {
    const pos = tilePositions('half-drop', 100, 100, 0, 0, 250, 250);
    const col0 = pos.filter(p => p.dx === 0).map(p => p.dy).sort((a, b) => a - b);
    const col1 = pos.filter(p => p.dx === 100).map(p => p.dy).sort((a, b) => a - b);
    // even column aligned to grid, odd column shifted +50
    expect(col0).toContain(0);
    expect(col1).toContain(50);
    expect(col1).not.toContain(0);
  });

  it('half-brick offsets odd rows right by half a tile', () => {
    const pos = tilePositions('half-brick', 100, 100, 0, 0, 250, 250);
    const row0 = pos.filter(p => p.dy === 0).map(p => p.dx).sort((a, b) => a - b);
    const row1 = pos.filter(p => p.dy === 100).map(p => p.dx).sort((a, b) => a - b);
    expect(row0).toContain(0);
    expect(row1).toContain(50);
    expect(row1).not.toContain(0);
  });

  it('negative pan keeps the half-drop parity stable (no flicker on odd columns)', () => {
    // col parity must use the floored-modulo form so negative columns behave
    const pos = tilePositions('half-drop', 100, 100, -250, 0, 250, 250);
    // column at dx = round(col*100 + pan); find a known odd column and assert its +50 shift
    const colMinus1 = pos.filter(p => p.dx === Math.round(-1 * 100 + -250)); // col -1 => dx -350
    // col -1 is odd -> shifted by +50
    expect(colMinus1.some(p => (p.dy % 100) === 50)).toBe(true);
  });

  it('returns nothing for non-positive tile sizes', () => {
    expect(tilePositions('full-drop', 0, 100, 0, 0, 250, 250)).toEqual([]);
    expect(tilePositions('full-drop', 100, -1, 0, 0, 250, 250)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/__tests__/tilePositions.test.ts`
Expected: FAIL — `tilePositions is not a function` / no export named `tilePositions`.

- [ ] **Step 3: Add `tilePositions` and a `RepeatType`-typed `TilePos`**

In `src/lib/tiling/PatternTiler.ts`, directly **after** the `export type RepeatType` line (line 1), insert:

```typescript
export interface TilePos {
  dx: number;
  dy: number;
}

/**
 * Pure tile-placement geometry shared by the full-res and pre-scaled render
 * paths. Returns the top-left destination coordinate of every tile that can
 * touch the viewport, including a 1-tile border, with the same rounding and
 * half-drop / half-brick parity the renderers have always used.
 */
export function tilePositions(
  repeatType: RepeatType,
  scaledW: number,
  scaledH: number,
  panX: number,
  panY: number,
  viewportWidth: number,
  viewportHeight: number,
): TilePos[] {
  const positions: TilePos[] = [];
  if (scaledW <= 0 || scaledH <= 0) return positions;

  if (repeatType === 'half-brick') {
    const startRow = Math.floor(-panY / scaledH) - 1;
    const endRow = Math.ceil((viewportHeight - panY) / scaledH);
    const startCol = Math.floor(-panX / scaledW) - 2;
    const endCol = Math.ceil((viewportWidth - panX) / scaledW) + 1;
    for (let row = startRow; row <= endRow; row++) {
      const xOffset = (((row % 2) + 2) % 2 !== 0) ? Math.round(scaledW / 2) : 0;
      for (let col = startCol; col <= endCol; col++) {
        positions.push({
          dx: Math.round(col * scaledW + xOffset + panX),
          dy: Math.round(row * scaledH + panY),
        });
      }
    }
  } else if (repeatType === 'half-drop') {
    const startCol = Math.floor(-panX / scaledW) - 1;
    const endCol = Math.ceil((viewportWidth - panX) / scaledW);
    const startRow = Math.floor(-panY / scaledH) - 2;
    const endRow = Math.ceil((viewportHeight - panY) / scaledH) + 1;
    for (let col = startCol; col <= endCol; col++) {
      const yOffset = (((col % 2) + 2) % 2 !== 0) ? Math.round(scaledH / 2) : 0;
      for (let row = startRow; row <= endRow; row++) {
        positions.push({
          dx: Math.round(col * scaledW + panX),
          dy: Math.round(row * scaledH + yOffset + panY),
        });
      }
    }
  } else {
    // full-drop
    const startCol = Math.floor(-panX / scaledW) - 1;
    const endCol = Math.ceil((viewportWidth - panX) / scaledW);
    const startRow = Math.floor(-panY / scaledH) - 1;
    const endRow = Math.ceil((viewportHeight - panY) / scaledH);
    for (let col = startCol; col <= endCol; col++) {
      for (let row = startRow; row <= endRow; row++) {
        positions.push({
          dx: Math.round(col * scaledW + panX),
          dy: Math.round(row * scaledH + panY),
        });
      }
    }
  }
  return positions;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/__tests__/tilePositions.test.ts`
Expected: PASS (6 passing).

- [ ] **Step 5: Route the three full-res renderers through `tilePositions` (DRY, proves parity)**

In `src/lib/tiling/PatternTiler.ts`, replace the bodies of `renderFullDrop`, `renderHalfDrop`, and `renderHalfBrick` (lines ~49–101) with calls to the shared function. Replace the three methods with:

```typescript
  private renderFullDrop(
    img: HTMLImageElement, srcW: number, srcH: number,
    scaledW: number, scaledH: number, panX: number, panY: number
  ) {
    for (const { dx, dy } of tilePositions('full-drop', scaledW, scaledH, panX, panY, this.viewportWidth, this.viewportHeight)) {
      this.drawTile(img, srcW, srcH, dx, dy, scaledW, scaledH);
    }
  }

  private renderHalfDrop(
    img: HTMLImageElement, srcW: number, srcH: number,
    scaledW: number, scaledH: number, panX: number, panY: number
  ) {
    for (const { dx, dy } of tilePositions('half-drop', scaledW, scaledH, panX, panY, this.viewportWidth, this.viewportHeight)) {
      this.drawTile(img, srcW, srcH, dx, dy, scaledW, scaledH);
    }
  }

  private renderHalfBrick(
    img: HTMLImageElement, srcW: number, srcH: number,
    scaledW: number, scaledH: number, panX: number, panY: number
  ) {
    for (const { dx, dy } of tilePositions('half-brick', scaledW, scaledH, panX, panY, this.viewportWidth, this.viewportHeight)) {
      this.drawTile(img, srcW, srcH, dx, dy, scaledW, scaledH);
    }
  }
```

> Note: `tilePositions` reproduces each renderer's original `startCol/endCol/startRow/endRow` bounds and offset math exactly. `drawTile` still does per-tile source clipping, so full-res output is byte-identical. This refactor is what guarantees the new pre-scaled path (Task 2) places tiles identically.

- [ ] **Step 6: Run lint + the full test suite**

Run: `npx vitest run && npx eslint src/lib/tiling/PatternTiler.ts`
Expected: all tests PASS, no lint errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/tiling/PatternTiler.ts src/__tests__/tilePositions.test.ts
git commit -m "refactor(tiling): extract pure tilePositions() shared by full-res renderers"
```

---

## Task 2: Add `renderPreScaledAt()` — pan-aware blit of a pre-scaled tile

**Files:**
- Modify: `src/lib/tiling/PatternTiler.ts`
- Test: `src/__tests__/renderPreScaledAt.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/renderPreScaledAt.test.ts`. We use a recording mock context (jsdom has no 2D renderer), asserting the method clears once and issues one `drawImage` per on-viewport tile position:

```typescript
import { describe, it, expect } from 'vitest';
import { PatternTiler, tilePositions } from '../lib/tiling/PatternTiler';

function recordingCtx() {
  const calls: Array<{ op: string; args: unknown[] }> = [];
  const ctx = {
    fillStyle: '',
    fillRect: (...args: unknown[]) => calls.push({ op: 'fillRect', args }),
    drawImage: (...args: unknown[]) => calls.push({ op: 'drawImage', args }),
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

const fakeTile = (w: number, h: number) =>
  ({ width: w, height: h } as unknown as HTMLCanvasElement);

describe('PatternTiler.renderPreScaledAt', () => {
  it('clears once, then blits the tile at every on-viewport position', () => {
    const { ctx, calls } = recordingCtx();
    const tiler = new PatternTiler(ctx, 250, 250);
    tiler.renderPreScaledAt(fakeTile(200, 200), 100, 100, 'full-drop', 0, 0);

    const clears = calls.filter(c => c.op === 'fillRect');
    const blits = calls.filter(c => c.op === 'drawImage');
    expect(clears.length).toBe(1);

    // Every full-drop position that overlaps a 250x250 viewport (tile 100, +1px overlap)
    const expected = tilePositions('full-drop', 100, 100, 0, 0, 250, 250)
      .filter(p => !(p.dx + 101 <= 0 || p.dy + 101 <= 0 || p.dx >= 250 || p.dy >= 250));
    expect(blits.length).toBe(expected.length);
  });

  it('draws each tile at ceil(tileW)+1 / ceil(tileH)+1 to avoid sub-pixel gaps', () => {
    const { ctx, calls } = recordingCtx();
    const tiler = new PatternTiler(ctx, 100, 100);
    tiler.renderPreScaledAt(fakeTile(64, 64), 33, 33, 'full-drop', 0, 0);
    const firstBlit = calls.find(c => c.op === 'drawImage')!;
    // drawImage(tile, dx, dy, dw, dh) -> dw/dh are args[3]/args[4]
    expect(firstBlit.args[3]).toBe(34);
    expect(firstBlit.args[4]).toBe(34);
  });

  it('renders nothing (only the clear) for a zero-size tile', () => {
    const { ctx, calls } = recordingCtx();
    const tiler = new PatternTiler(ctx, 250, 250);
    tiler.renderPreScaledAt(fakeTile(0, 0), 0, 0, 'full-drop', 0, 0);
    expect(calls.filter(c => c.op === 'drawImage').length).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/__tests__/renderPreScaledAt.test.ts`
Expected: FAIL — `tiler.renderPreScaledAt is not a function`.

- [ ] **Step 3: Implement `renderPreScaledAt`**

In `src/lib/tiling/PatternTiler.ts`, add this method directly **after** the existing `renderPreScaled` method (after line ~141), leaving `renderPreScaled` untouched:

```typescript
  /**
   * Tile the viewport by blitting an already-scaled tile canvas at a pan offset.
   * Per-frame cost is N cheap same-size blits — no per-tile source downscale.
   * `tileW`/`tileH` are the CSS-pixel destination size; the `tile` canvas may be
   * backed at device resolution for crispness. Placement matches the full-res
   * renderers exactly via the shared tilePositions().
   */
  renderPreScaledAt(
    tile: HTMLCanvasElement,
    tileW: number,
    tileH: number,
    repeatType: RepeatType,
    panX: number,
    panY: number,
  ) {
    this.clear();
    if (tileW <= 0 || tileH <= 0) return;

    // +1px overlap prevents sub-pixel anti-aliasing gaps between tiles
    const dw = Math.ceil(tileW) + 1;
    const dh = Math.ceil(tileH) + 1;

    for (const { dx, dy } of tilePositions(
      repeatType, tileW, tileH, panX, panY, this.viewportWidth, this.viewportHeight,
    )) {
      if (dx + dw <= 0 || dy + dh <= 0 || dx >= this.viewportWidth || dy >= this.viewportHeight) continue;
      this.ctx.drawImage(tile, dx, dy, dw, dh);
    }
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/__tests__/renderPreScaledAt.test.ts`
Expected: PASS (3 passing).

- [ ] **Step 5: Commit**

```bash
git add src/lib/tiling/PatternTiler.ts src/__tests__/renderPreScaledAt.test.ts
git commit -m "feat(tiling): add renderPreScaledAt() for pan-aware pre-scaled tiling"
```

---

## Task 3: Working-source sizing math

**Files:**
- Create: `src/lib/tiling/workingSource.ts`
- Test: `src/__tests__/workingSourceSize.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/workingSourceSize.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { computeWorkingSourceSize } from '../lib/tiling/workingSource';

describe('computeWorkingSourceSize', () => {
  it('never upsamples the source (caps at natural size)', () => {
    // need is larger than natural -> clamp to natural
    const r = computeWorkingSourceSize(2700, 2700, 4000, 4000, 1.15);
    expect(r.width).toBe(2700);
    expect(r.height).toBe(2700);
  });

  it('downsamples a high-res source to ~the needed device size + safety headroom', () => {
    // natural 5400, need 3000 device px, safety 1.15 -> ~3450
    const r = computeWorkingSourceSize(5400, 5400, 3000, 3000, 1.15);
    expect(r.width).toBe(Math.round(5400 * Math.min(1, (3000 * 1.15) / 5400)));
    expect(r.width).toBeLessThan(5400);
    expect(r.width).toBeGreaterThanOrEqual(3000); // covers the tile with headroom
  });

  it('preserves aspect ratio using the larger of the two dimension ratios', () => {
    // wide source, square need -> width ratio dominates, both dims scaled together
    const r = computeWorkingSourceSize(4000, 2000, 1000, 1000, 1.0);
    expect(r.width / r.height).toBeCloseTo(2, 5);
    // height need (1000) is the binding constraint -> scale = 1000/2000 = 0.5
    expect(r.height).toBe(1000);
    expect(r.width).toBe(2000);
  });

  it('clamps to at least 1px', () => {
    const r = computeWorkingSourceSize(100, 100, 0, 0, 1.15);
    expect(r.width).toBeGreaterThanOrEqual(1);
    expect(r.height).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/__tests__/workingSourceSize.test.ts`
Expected: FAIL — cannot find module `../lib/tiling/workingSource`.

- [ ] **Step 3: Implement the helper**

Create `src/lib/tiling/workingSource.ts`:

```typescript
/**
 * Size for the cached "working" downsample of a source image.
 *
 * Goal: large enough that the biggest on-screen tile is still a downscale from
 * it (crisp), but no larger than necessary (caps canvas memory — mitigates the
 * iPad canvas-crash bug). Aspect ratio is preserved and the result is never
 * larger than the natural image (we never upsample the source).
 *
 * @param neededDeviceWidth  the largest tile width we must draw, in device px
 * @param neededDeviceHeight the largest tile height we must draw, in device px
 * @param safety             headroom multiplier so max zoom never reveals softness
 */
export function computeWorkingSourceSize(
  naturalWidth: number,
  naturalHeight: number,
  neededDeviceWidth: number,
  neededDeviceHeight: number,
  safety = 1.15,
): { width: number; height: number } {
  const scale = Math.min(
    1,
    Math.max(
      (neededDeviceWidth * safety) / naturalWidth,
      (neededDeviceHeight * safety) / naturalHeight,
    ),
  );
  return {
    width: Math.max(1, Math.round(naturalWidth * scale)),
    height: Math.max(1, Math.round(naturalHeight * scale)),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/__tests__/workingSourceSize.test.ts`
Expected: PASS (4 passing).

- [ ] **Step 5: Commit**

```bash
git add src/lib/tiling/workingSource.ts src/__tests__/workingSourceSize.test.ts
git commit -m "feat(tiling): add computeWorkingSourceSize() (aspect-preserving, capped)"
```

---

## Task 4: Fix the landing/empty state — delete the `toDataURL` round-trip

**Why:** Per the spec this is the likely single biggest RUM contributor — every zoom tick on the most-visited (no-image) state runs `scaledCanvas.toDataURL('image/png')` plus a second `new Image()` decode. Replace with a once-cached pre-scaled placeholder tile and a direct blit loop. **Manual-verify task** (canvas rendering).

**Files:**
- Modify: `src/components/canvas/PatternPreviewCanvas.tsx`

- [ ] **Step 1: Add cache refs for the placeholder**

In `src/components/canvas/PatternPreviewCanvas.tsx`, after the existing `pinchRef` declaration (line ~54), add:

```typescript
  // Cached placeholder image + its pre-scaled tile (landing-state perf)
  const placeholderImgRef = useRef<HTMLImageElement | null>(null);
  const placeholderTileRef = useRef<{ key: string; canvas: HTMLCanvasElement } | null>(null);
```

- [ ] **Step 2: Replace the empty-state render block**

Replace the entire `if (!image) { ... return ...; }` block (lines ~211–275) with this version. It loads the placeholder once, pre-scales it into a cached device-resolution tile, then tiles by direct blit — no `toDataURL`, no second decode, no inner `rAF`:

```typescript
    if (!image) {
      const drawPlaceholder = (pImg: HTMLImageElement) => {
        if (cancelled) return;

        const defaultDpi = 150;
        const defaultTileWidth = 18;
        const scaleFactor = (zoom / 100) * (96 / defaultDpi);
        const targetSize = defaultTileWidth * defaultDpi;
        const displayScale = (targetSize / pImg.width) * scaleFactor * 0.5;

        const displayWidth = Math.max(1, Math.round(pImg.width * displayScale));
        const displayHeight = Math.max(1, Math.round(pImg.height * displayScale));

        // Build (or reuse) a device-resolution pre-scaled tile. Rebuild only when
        // the display size or dpr changes — NOT every zoom tick.
        const tileKey = `${displayWidth}x${displayHeight}@${currentDpr}`;
        let cached = placeholderTileRef.current;
        if (!cached || cached.key !== tileKey) {
          const tileCanvas = document.createElement('canvas');
          tileCanvas.width = Math.max(1, Math.round(displayWidth * currentDpr));
          tileCanvas.height = Math.max(1, Math.round(displayHeight * currentDpr));
          const tctx = tileCanvas.getContext('2d');
          if (!tctx) return;
          tctx.fillStyle = '#ffffff';
          tctx.fillRect(0, 0, tileCanvas.width, tileCanvas.height);
          tctx.imageSmoothingEnabled = true;
          tctx.imageSmoothingQuality = 'high';
          tctx.drawImage(pImg, 0, 0, tileCanvas.width, tileCanvas.height);
          cached = { key: tileKey, canvas: tileCanvas };
          placeholderTileRef.current = cached;
        }

        canvasCtx.setTransform(1, 0, 0, 1, 0, 0);
        canvasCtx.scale(currentDpr, currentDpr);
        canvasCtx.fillStyle = '#0f172a';
        canvasCtx.fillRect(0, 0, canvasSize.width, canvasSize.height);

        const cols = Math.ceil(canvasSize.width / displayWidth) + 2;
        const rows = Math.ceil(canvasSize.height / displayHeight) + 2;
        for (let x = -1; x < cols; x++) {
          for (let y = -1; y < rows; y++) {
            canvasCtx.drawImage(cached.canvas, x * displayWidth, y * displayHeight, displayWidth, displayHeight);
          }
        }

        if (showTileOutline) {
          canvasCtx.strokeStyle = tileOutlineColor;
          canvasCtx.lineWidth = 6;
          canvasCtx.setLineDash([]);
          canvasCtx.strokeRect(3, 3, displayWidth - 6, displayHeight - 6);
        }
      };

      // Load the placeholder once; reuse the decoded image thereafter.
      const cachedImg = placeholderImgRef.current;
      if (cachedImg && cachedImg.complete) {
        rafId = requestAnimationFrame(() => drawPlaceholder(cachedImg));
      } else {
        const placeholderImg = cachedImg ?? new Image();
        placeholderImg.onload = () => {
          placeholderImgRef.current = placeholderImg;
          rafId = requestAnimationFrame(() => drawPlaceholder(placeholderImg));
        };
        if (!placeholderImg.src) placeholderImg.src = '/place_design_here.jpg';
      }
      return () => { cancelled = true; if (rafId !== undefined) cancelAnimationFrame(rafId); };
    }
```

- [ ] **Step 3: Build to confirm no type/lint errors**

Run: `npx eslint src/components/canvas/PatternPreviewCanvas.tsx && npx tsc --noEmit -p tsconfig.json`
Expected: no errors. (If `tsc` reports unrelated pre-existing errors elsewhere, confirm none are in `PatternPreviewCanvas.tsx`.)

- [ ] **Step 4: Manual visual check — empty state**

Run: `npm run dev`, open `/` with no image. Confirm: tiled placeholder renders identically to before (white tiles on dark `#0f172a` background); dragging the zoom slider re-tiles crisply with no flicker; toggling "Show Tile Outline" draws the outline. In DevTools Performance, record a zoom-slider drag and confirm **no `toDataURL` / image-decode entries** appear per frame.

- [ ] **Step 5: Commit**

```bash
git add src/components/canvas/PatternPreviewCanvas.tsx
git commit -m "perf(canvas): cache pre-scaled placeholder tile, delete toDataURL landing path"
```

---

## Task 5: Loaded-state pre-scaled tile cache + adaptive working source

**Why:** Collapse the per-tile full-res downscale (N downscales/frame, ×dpr² on iPad) into ≤1 downscale/frame from a memory-capped working source; pan re-blits the cached tile for free. **Manual-verify task.**

**Files:**
- Modify: `src/components/canvas/PatternPreviewCanvas.tsx`

- [ ] **Step 1: Add imports and cache refs**

In `src/components/canvas/PatternPreviewCanvas.tsx`, update the tiler import (line 4) and add the new helper import beneath it:

```typescript
import { PatternTiler, tilePositions, RepeatType } from '@/lib/tiling/PatternTiler';
import { computeWorkingSourceSize } from '@/lib/tiling/workingSource';
```

(`tilePositions` is imported for the outline overlay in Step 3; if your editor flags it unused before Step 3, add it together with that step.)

After the placeholder refs added in Task 4 Step 1, add:

```typescript
  // Loaded-state caches: once-downsampled working source + current pre-scaled tile
  const workingSourceRef = useRef<{ image: HTMLImageElement; canvas: HTMLCanvasElement } | null>(null);
  const tileCacheRef = useRef<{ key: string; canvas: HTMLCanvasElement } | null>(null);
```

- [ ] **Step 2: Replace the loaded-state tiling with the cached pre-scaled path**

In the loaded-state `rafId = requestAnimationFrame(() => { ... })` block (lines ~283–334), replace everything from `const scaleFactor = ...` down to **just before** the `if (showTileOutline) {` line with:

```typescript
      const scaleFactor = (zoom / 100) * (96 * tileWidth / img.naturalWidth);

      // Reuse offscreen canvas — resize only when needed
      if (!offscreenRef.current) offscreenRef.current = document.createElement('canvas');
      const offscreen = offscreenRef.current;
      const pixelW = canvasSize.width * currentDpr;
      const pixelH = canvasSize.height * currentDpr;
      if (offscreen.width !== pixelW || offscreen.height !== pixelH) {
        offscreen.width = pixelW;
        offscreen.height = pixelH;
      }
      const offCtx = offscreen.getContext('2d');
      if (!offCtx) return;

      offCtx.setTransform(1, 0, 0, 1, 0, 0);
      offCtx.scale(currentDpr, currentDpr);
      offCtx.imageSmoothingEnabled = true;
      offCtx.imageSmoothingQuality = 'high';

      // CSS-pixel display size of one tile (same value the full-res path used)
      const scaledW = Math.ceil(img.naturalWidth * scaleFactor);
      const scaledH = Math.ceil(img.naturalHeight * scaleFactor);

      if (scaledW > 0 && scaledH > 0) {
        // Device-pixel tile size = crispness target
        const tileDevW = Math.max(1, Math.ceil(scaledW * currentDpr));
        const tileDevH = Math.max(1, Math.ceil(scaledH * currentDpr));

        // (1) Ensure a working downsample of the source large enough for this tile.
        //     Grows on demand up to natural size; caps memory (iPad).
        const need = computeWorkingSourceSize(img.naturalWidth, img.naturalHeight, tileDevW, tileDevH);
        let ws = workingSourceRef.current;
        if (!ws || ws.image !== img || ws.canvas.width < need.width || ws.canvas.height < need.height) {
          const wc = document.createElement('canvas');
          wc.width = need.width;
          wc.height = need.height;
          const wctx = wc.getContext('2d');
          if (!wctx) return;
          wctx.imageSmoothingEnabled = true;
          wctx.imageSmoothingQuality = 'high';
          wctx.drawImage(img, 0, 0, need.width, need.height);
          ws = { image: img, canvas: wc };
          workingSourceRef.current = ws;
        }

        // (2) Build the pre-scaled tile (ONE downscale) only when scale/image/dpr change.
        //     Pan does not change tileKey -> tile is reused -> pan is pure blits.
        const tileKey = `${img.src}|${tileDevW}x${tileDevH}`;
        let tc = tileCacheRef.current;
        if (!tc || tc.key !== tileKey) {
          const tcv = document.createElement('canvas');
          tcv.width = tileDevW;
          tcv.height = tileDevH;
          const tctx = tcv.getContext('2d');
          if (!tctx) return;
          tctx.imageSmoothingEnabled = true;
          tctx.imageSmoothingQuality = 'high';
          tctx.drawImage(ws.canvas, 0, 0, tileDevW, tileDevH);
          tc = { key: tileKey, canvas: tcv };
          tileCacheRef.current = tc;
        }

        // (3) Tile the viewport via cheap blits at the pan offset.
        const tiler = new PatternTiler(offCtx, canvasSize.width, canvasSize.height);
        tiler.renderPreScaledAt(tc.canvas, scaledW, scaledH, repeatType, panX, panY);
      } else {
        offCtx.fillStyle = '#ffffff';
        offCtx.fillRect(0, 0, canvasSize.width, canvasSize.height);
      }
```

- [ ] **Step 3: Update the outline overlay to use cached `scaledW/scaledH`**

The existing outline block (lines ~308–329) computes `outlineW = Math.ceil(img.naturalWidth * scaleFactor)` — identical to the new `scaledW`. Leave the outline block as-is (it reads `scaleFactor`, `panX`, `panY`, `img`, all still in scope) **except** confirm it sits after the tiling block and before the final blit. The final blit lines stay:

```typescript
      // Blit complete frame to visible canvas in one operation — no intermediate blank state
      canvasCtx.setTransform(1, 0, 0, 1, 0, 0);
      canvasCtx.drawImage(offscreen, 0, 0);
```

> The outline is drawn into the offscreen *after* tiling, reusing the cached tile — so toggling the outline never rebuilds the working source or the tile (it just re-runs the cheap blit pass). This satisfies the spec's "outline as a cheap overlay pass."

- [ ] **Step 4: Drop the unused `tileHeight` from the render effect deps**

On the render effect dependency array (line ~337), remove `tileHeight` (it is not read in the render effect — only `tileWidth` feeds `scaleFactor`). Change:

```typescript
  }, [image, repeatType, tileWidth, tileHeight, zoom, dpi, showTileOutline, tileOutlineColor, canvasSize, dpr, panX, panY]);
```

to:

```typescript
  }, [image, repeatType, tileWidth, zoom, dpi, showTileOutline, tileOutlineColor, canvasSize, dpr, panX, panY]);
```

- [ ] **Step 5: Clear caches when the image is cleared/replaced**

To avoid a stale working source after "Clear" or a new upload, invalidate the caches when `image` changes. Add this effect right after the render effect (after line ~337):

```typescript
  // Drop cached working source + tile when the image changes (clear/replace)
  useEffect(() => {
    workingSourceRef.current = null;
    tileCacheRef.current = null;
  }, [image]);
```

(The `img.src` / `ws.image !== img` guards already protect correctness; this also frees the memory promptly — important for the iPad memory ceiling.)

- [ ] **Step 6: Build + lint**

Run: `npx eslint src/components/canvas/PatternPreviewCanvas.tsx && npx tsc --noEmit -p tsconfig.json`
Expected: no errors in this file. The `tilePositions` import is used only if you reference it; if unused, drop it from the import to satisfy lint.

- [ ] **Step 7: Manual visual + correctness check (all 3 repeat types)**

Run `npm run dev`. Upload a real multi-MP pattern. For **full-drop, half-drop, half-brick**:
- Confirm tiling looks pixel-identical to `main` (compare side-by-side; verify no seams/gaps and that the half-drop/half-brick stagger matches).
- Zoom 10%→200%: crisp at every step, no softness at 200%.
- Pan in all directions: no re-tile hitch, no blank flashes (double-buffer intact), pattern stays aligned to the seam.
- Toggle outline + change outline color: outline appears/updates without a visible re-tile.
- Export/download via Advanced Tools: output still correct (reads `canvasRef`).

- [ ] **Step 8: Commit**

```bash
git add src/components/canvas/PatternPreviewCanvas.tsx
git commit -m "perf(canvas): pre-scaled tile cache + adaptive working source for loaded state"
```

---

## Task 6: Correctness fixes — scale-preview commit-on-settle + pinch clamp parity

**Why:** The Scale Preview number input fires `onScalePreviewChange` + `onScalePreviewActiveChange(true)` on **every keystroke**, re-tiling per character and locking the zoom slider on the first digit. Commit on blur/Enter instead. Also align the pinch floor with the slider's clamp. **Manual-verify task.**

**Files:**
- Modify: `src/components/layout/PatternControlsTopBar.tsx`
- Modify: `src/components/canvas/PatternPreviewCanvas.tsx`

- [ ] **Step 1: Make the Scale Preview input commit on settle**

In `src/components/layout/PatternControlsTopBar.tsx`, add a local draft state near the other `useState` hooks (after line ~79):

```typescript
  const [scaleDraft, setScaleDraft] = useState<string>('');
  const scaleDraftActive = useRef(false);
```

Replace the Scale Preview `<input>` (lines ~286–303) with a version that edits a draft string and only commits to the parent on blur or Enter:

```typescript
            <input
              type="number"
              min="1"
              step="1"
              value={
                scaleDraftActive.current
                  ? scaleDraft
                  : String(scalePreviewSize ?? Math.max(1, Math.round(Math.max(originalTileWidth, originalTileHeight))))
              }
              onFocus={(e) => {
                scaleDraftActive.current = true;
                setScaleDraft(e.target.value);
              }}
              onChange={(e) => setScaleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              }}
              onBlur={() => {
                scaleDraftActive.current = false;
                const raw = scaleDraft.trim();
                if (raw === '') {
                  onScalePreviewChange(null);
                  onScalePreviewActiveChange(false);
                  return;
                }
                const value = parseFloat(raw);
                if (isNaN(value) || value < 1) {
                  // ignore invalid entry; revert to last committed value
                  return;
                }
                onScalePreviewChange(value);
                onScalePreviewActiveChange(true);
              }}
              className="w-full px-3 py-2 text-xs bg-white/10 border border-white/20 rounded-md text-white placeholder-white/70 focus:outline-none focus:ring-1 focus:ring-[#e0c26e] focus:border-[#e0c26e]"
            />
```

> Effect: typing no longer re-tiles per keystroke and no longer locks the zoom slider mid-entry; the scale preview activates only once, on commit.

- [ ] **Step 2: Align the pinch zoom floor with the slider clamp**

In `src/components/canvas/PatternPreviewCanvas.tsx`, the pinch handler (line ~106) uses `Math.max(1, ...)` on the *actual* zoom, inconsistent with the slider's 10–200% *user* range (the page clamps on commit, but the in-gesture value should not undershoot the visible floor). Since the canvas receives actual zoom, derive the floor from `baseZoom`-independent intent by leaving final clamping to the page but raising the local floor to avoid a zero-ish tile. Change line ~106:

```typescript
        const newZoom = Math.max(1, pinchRef.current.startZoom * scale);
```

to:

```typescript
        // Page clamps the committed user-zoom to 10–200%; keep the in-gesture
        // actual-zoom strictly positive so the tile never collapses to 0px.
        const newZoom = Math.max(0.5, pinchRef.current.startZoom * scale);
```

> Rationale: `onZoomChange` already routes through the page's `Math.max(10, Math.min(200, (z / baseZoom) * 100))` clamp, so the user-facing range stays single-sourced; this only prevents a degenerate 0px tile mid-pinch.

- [ ] **Step 3: Build + lint**

Run: `npx eslint src/components/layout/PatternControlsTopBar.tsx src/components/canvas/PatternPreviewCanvas.tsx && npx tsc --noEmit -p tsconfig.json`
Expected: no errors in these files.

- [ ] **Step 4: Manual check**

Run `npm run dev`. With an image loaded: type a multi-digit number into Scale Preview (e.g. `36`) — confirm the canvas does **not** re-tile until you blur/press Enter, and the zoom slider stays enabled until commit. After commit, the preview size + locked-zoom note appear as before. On iPad/touch, pinch-zoom stays within 10–200% and never blanks.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/PatternControlsTopBar.tsx src/components/canvas/PatternPreviewCanvas.tsx
git commit -m "fix(controls): commit scale-preview on settle; clamp pinch floor"
```

---

## Task 7: INP verification harness + measurement

**Why:** Prove the fix locally before trusting RUM's multi-day lag. **Manual-verify task.**

**Files:**
- Create: `src/lib/perf/inpHarness.ts`
- Modify: `app/page.tsx` (dev-only wiring)

- [ ] **Step 1: Add `web-vitals` (dev dependency)**

Run: `npm install --save-dev web-vitals`
Expected: `web-vitals` appears in `devDependencies`.

- [ ] **Step 2: Create the harness**

Create `src/lib/perf/inpHarness.ts`:

```typescript
// Dev-only INP logger. Logs each interaction's latency to the console so we can
// confirm worst-case gestures (zoom-drag, pan, dimension change) stay <200ms
// under CPU throttle, before trusting Production Speed Insights' multi-day lag.
export function startInpHarness() {
  if (process.env.NODE_ENV !== 'development') return;
  import('web-vitals/attribution')
    .then(({ onINP }) => {
      onINP(
        (metric) => {
          const target = (metric.attribution as { interactionTarget?: string } | undefined)?.interactionTarget;
          // eslint-disable-next-line no-console
          console.log(`[INP] ${Math.round(metric.value)}ms (${metric.rating})`, target ?? '');
        },
        { reportAllChanges: true },
      );
    })
    .catch(() => {
      // web-vitals is a dev-only dependency; ignore if unavailable in prod builds
    });
}
```

- [ ] **Step 3: Wire it in (dev only)**

In `app/page.tsx`, add an effect inside `Home` after the existing fullscreen-sync effect (after line ~64):

```typescript
  // Dev-only INP measurement harness (no-op in production)
  useEffect(() => {
    import('@/lib/perf/inpHarness').then(({ startInpHarness }) => startInpHarness());
  }, []);
```

- [ ] **Step 4: Measure before/after under throttle**

In Chrome DevTools → Performance → CPU: **4× slowdown**. Run `npm run dev`. For each scenario, perform the gesture and read the `[INP]` console line (worst value over ~5 repeats):

1. **Empty state** — drag the zoom slider full range.
2. **Loaded state** — drag the zoom slider full range (use a multi-MP image).
3. **Loaded state** — pan across the canvas.
4. **Loaded state** — change the Scale Preview value (commit).
5. **Loaded state** — toggle repeat type and tile outline.

Record each. **Target: every scenario <200ms.** Also confirm in the Performance flame chart that no single long task >50ms lands in the post-interaction presentation-delay slice.

- [ ] **Step 5: Decision gate**

- If **all scenarios <200ms** → the cache work is sufficient. Skip Task 8. Proceed to Task 9 (final verification + ship).
- If **any scenario ≥200ms** → note which gesture and whether the cost is React reconciliation (long "Recalculate Style / Commit" in the flame chart during slider drag) vs canvas work. Proceed to Task 8 (ref-driven commit-on-settle) targeting that gesture.

- [ ] **Step 6: Commit**

```bash
git add src/lib/perf/inpHarness.ts app/page.tsx package.json package-lock.json
git commit -m "test(perf): add dev-only web-vitals INP harness for canvas gestures"
```

---

## Task 8 (MEASUREMENT-GATED): Ref-driven zoom commit-on-settle

**Only implement if Task 7 Step 5 shows a zoom-slider-drag interaction ≥200ms attributable to React reconciliation (~190 `setZoom` calls per drag).** Otherwise skip — adding this without evidence is over-engineering the riskiest piece.

**Approach (concrete):** Drive the canvas imperatively during a slider drag via a ref handle, and commit `zoom` React state only on `pointerup`/`change`. This kills the reconciliation storm while keeping the committed state model intact for export/scale-preview.

**Files:**
- Modify: `src/components/canvas/PatternPreviewCanvas.tsx` (expose `useImperativeHandle({ renderAt(zoomActual, panX, panY) })` that runs the same cached-tile render path without React state)
- Modify: `src/components/layout/PatternControlsTopBar.tsx` (slider `onInput` → call the imperative render via a forwarded ref/callback; `onChange`/`onPointerUp` → `onZoomChange` commit)
- Modify: `app/page.tsx` (forward a `canvasApiRef` from `Home` to both the slider and the canvas)

- [ ] **Step 1:** Refactor the loaded-state render body (Task 5) into a standalone `renderFrame(zoomActual: number, panX: number, panY: number)` closure inside the component that reads from the cache refs and writes to the visible canvas. The render effect calls `renderFrame(zoom, panX, panY)`.

- [ ] **Step 2:** Add `const api = useRef<{ renderAt: (z: number, px: number, py: number) => void } | null>(null)` plumbing via `useImperativeHandle` (convert the component to `forwardRef`), exposing `renderAt` = `renderFrame`.

- [ ] **Step 3:** In the slider, on `onInput` write the draft zoom to a ref and call `api.current?.renderAt(...)` (throttled to one `requestAnimationFrame`); on `onChange` / pointerup call `onZoomChange` to commit React state once.

- [ ] **Step 4:** Re-run the Task 7 measurement for the zoom-drag scenario. Confirm <200ms and a single React commit per drag in the flame chart.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "perf(canvas): ref-driven zoom render during drag, commit state on settle"
```

> If implementing, write a focused unit test for the rAF throttle reused here if one does not already exist (`src/lib/utils/trailingThrottle.ts` is already tested and may be reusable for the slider `onInput` coalescing).

---

## Task 9: Final verification + ship

**Files:** none (verification only)

- [ ] **Step 1: Full regression of invariants**

With `npm run dev`:
- Never-blank: rapid zoom + pan + repeat-type switching never shows a blank canvas frame.
- CLS ≈ 0: no layout shift from any canvas feedback (outline is canvas-drawn, not DOM).
- Export/download: download a tiled pattern and a full-size export; bytes look correct.
- Free-test flow: as an anonymous user, run 3 tests → the sign-in gate fires on the 4th (unchanged).
- iPad/touch: pinch-zoom and the fullscreen toggle work; no white-screen on a large image (working-source cap reduces memory — note this is an incidental mitigation, **not** the full iPad-crash fix in `memory/bug_easyscale_ipad_canvas_crash.md`).

- [ ] **Step 2: Run the whole suite + lint + build**

Run: `npx vitest run && npx eslint && npm run build`
Expected: all tests PASS, no lint errors, production build succeeds.

- [ ] **Step 3: Record before/after INP numbers in the spec or a short results note**

Append a "Results" section to `docs/superpowers/specs/2026-06-21-pattern-preview-inp-fix-design.md` (or a sibling results file) with the throttled local INP measurements from Task 7 for each scenario, before vs after.

- [ ] **Step 4: Commit + open PR**

```bash
git add -A
git commit -m "docs: record local INP before/after for pattern-preview fix"
```

Then open a PR (do not push to `main` directly). After merge + deploy, confirm via Production Speed Insights over the following 7-day window that `/` INP moves into the green (<200ms).

---

## Self-Review (against the spec)

**Spec coverage:**
- Working-resolution source → Task 3 + Task 5 (adaptive, capped, aspect-preserving).
- Pre-scaled tile cache → Task 2 (`renderPreScaledAt`) + Task 5 (cache + rebuild only on scale/image/dpr).
- Pan never re-tiles from source → Task 5 (pan does not change `tileKey`; re-blits cached tile).
- Ref-driven zoom/pan commit-on-settle → Task 8, **measurement-gated** (spec lists it; sequenced last and evidence-gated to avoid over-engineering the riskiest change — documented deviation).
- Delete landing `toDataURL` + double decode → Task 4.
- Slim effects: drop unused `tileHeight` dep → Task 5 Step 4; outline as cheap overlay (no tile rebuild) → Task 5 Step 3; canvas-size double-retile — left as-is (cheap now that re-tile is a blit; not worth the dep-splitting risk — documented deviation).
- Correctness: pinch clamp → Task 6 Step 2; scale-preview commit-on-settle + no first-digit zoom-lock → Task 6 Step 1.
- Verification (`web-vitals onINP`, 4–6× throttle, <200ms target) → Task 7 + Task 9.

**Deviations from spec (intentional, noted):**
1. **Added `renderPreScaledAt` instead of mutating `renderPreScaled`.** The existing `renderPreScaled` is consumed by `PatternCanvas.tsx` and `MockupPipeline.ts` (mockup exports) — changing its signature would risk shipped export paths. New method, same geometry.
2. **Ref-driven commit-on-settle is measurement-gated (Task 8).** The dominant INP cost per the spec is per-frame paint, fixed by the caches. The 190-reconciliation storm affects drag *smoothness* more than any single interaction's paint; gating it on measurement honors "verify before adding complexity."
3. **Canvas-size effect double-retile left untouched.** Re-tile is now a cheap blit, so the double-fire is negligible; splitting the effect adds risk for little gain.

**Placeholder scan:** none — every code step contains complete code.

**Type consistency:** `tilePositions(repeatType, scaledW, scaledH, panX, panY, viewportWidth, viewportHeight)` and `renderPreScaledAt(tile, tileW, tileH, repeatType, panX, panY)` and `computeWorkingSourceSize(naturalWidth, naturalHeight, neededDeviceWidth, neededDeviceHeight, safety)` signatures are used identically across Tasks 1–5 and their tests. Cache shapes (`{ image, canvas }`, `{ key, canvas }`) are consistent.
