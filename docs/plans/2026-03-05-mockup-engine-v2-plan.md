# Mockup Engine V2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Canvas2D rendering pipeline (perspective warp, displacement mapping, blend compositing) and 11 new product mockup types to PatternPAL Pro.

**Architecture:** New `mockupEngineV2/` module alongside existing mockup system. Pipeline orchestrator calls 4 stage modules sequentially. Template registry defines pre-tuned settings per mockup. New `MockupRendererV2` component used for new types; existing renderer untouched.

**Tech Stack:** TypeScript, Canvas2D API, React (Next.js), existing PatternTiler class.

**Note:** No test framework is configured in this project. Verification is done visually via the dev server. Each task ends with a commit.

---

### Task 1: V2 Type Definitions

**Files:**
- Create: `src/lib/mockups/mockupEngineV2/templates/types.ts`

**Step 1: Create the types file**

```typescript
export type DisplacementType = 'fabric-drape' | 'pillow' | 'flat-surface' | 'cylindrical' | 'vertical-drape' | 'radial-bulge';

export type BlendMode = 'multiply' | 'overlay' | 'soft-light' | 'hard-light' | 'screen' | 'color-burn' | 'source-over';

export type MockupV2Category = 'apparel' | 'home-goods' | 'stationery' | 'accessories';

export interface MockupV2Template {
  id: string;
  name: string;
  description: string;
  category: MockupV2Category;
  canvasSize: { width: number; height: number };
  patternArea: { x: number; y: number; width: number; height: number };
  perspective: { topSqueeze: number; bottomSqueeze: number };
  displacement: { intensity: number; wrinkleFreq: number; type: DisplacementType };
  blend: { mode: BlendMode; opacity: number };
  lighting: { enabled: boolean; intensity: number };
  physicalSize: { width: number; height: number; unit: 'in' | 'cm' };
  productBase: {
    type: 'procedural';
    brightness: number;
    shape: DisplacementType;
  } | {
    type: 'image';
    imagePath: string;
    maskPath?: string;
  };
}
```

**Step 2: Commit**

```bash
git add src/lib/mockups/mockupEngineV2/templates/types.ts
git commit -m "feat(mockup-v2): add type definitions for V2 engine"
```

---

### Task 2: Perspective Warp Stage

**Files:**
- Create: `src/lib/mockups/mockupEngineV2/stages/perspectiveWarp.ts`

**Reference:** POC lines 557-611 (`applyPerspective` function)

**Step 1: Create the perspective warp module**

```typescript
/**
 * Applies perspective warp to a source canvas using strip-subdivision.
 * Divides the canvas into horizontal strips and maps each to a trapezoid
 * defined by topSqueeze and bottomSqueeze values.
 *
 * topSqueeze: pixels to inset from each side at the top (0 = no squeeze)
 * bottomSqueeze: pixels to inset from each side at the bottom (0 = no squeeze)
 */
export function applyPerspective(
  srcCanvas: HTMLCanvasElement,
  destCtx: CanvasRenderingContext2D,
  width: number,
  height: number,
  topSqueeze: number,
  bottomSqueeze: number
): void {
  destCtx.clearRect(0, 0, width, height);

  // Skip if no perspective needed
  if (topSqueeze === 0 && bottomSqueeze === 0) {
    destCtx.drawImage(srcCanvas, 0, 0);
    return;
  }

  // Four corners of destination quadrilateral
  const tl = [topSqueeze, topSqueeze * 0.5];
  const tr = [width - topSqueeze, topSqueeze * 0.5];
  const bl = [bottomSqueeze, height - bottomSqueeze * 0.5];
  const br = [width - bottomSqueeze, height - bottomSqueeze * 0.5];

  // Subdivide into horizontal strips for smooth perspective
  const strips = 40;
  for (let i = 0; i < strips; i++) {
    const t0 = i / strips;
    const t1 = (i + 1) / strips;

    // Interpolate left and right edges
    const l0x = tl[0] + (bl[0] - tl[0]) * t0;
    const l0y = tl[1] + (bl[1] - tl[1]) * t0;
    const r0x = tr[0] + (br[0] - tr[0]) * t0;
    const r0y = tr[1] + (br[1] - tr[1]) * t0;

    const l1x = tl[0] + (bl[0] - tl[0]) * t1;
    const l1y = tl[1] + (bl[1] - tl[1]) * t1;
    const r1x = tr[0] + (br[0] - tr[0]) * t1;
    const r1y = tr[1] + (br[1] - tr[1]) * t1;

    // Source strip
    const sy = Math.round(t0 * height);
    const sh = Math.round((t1 - t0) * height) + 1;

    destCtx.save();
    destCtx.beginPath();
    destCtx.moveTo(l0x, l0y);
    destCtx.lineTo(r0x, r0y);
    destCtx.lineTo(r1x, r1y);
    destCtx.lineTo(l1x, l1y);
    destCtx.closePath();
    destCtx.clip();

    const stripWidth = r0x - l0x;
    const scaleX = stripWidth / width;
    const skewAngle = Math.atan2(r0y - l0y, r0x - l0x);

    destCtx.setTransform(scaleX, Math.sin(skewAngle) * scaleX, 0, (l1y - l0y) / sh, l0x, l0y);
    destCtx.drawImage(srcCanvas, 0, sy, width, sh, 0, 0, width, sh);
    destCtx.restore();
  }
  destCtx.setTransform(1, 0, 0, 1, 0, 0);
}
```

**Step 2: Commit**

```bash
git add src/lib/mockups/mockupEngineV2/stages/perspectiveWarp.ts
git commit -m "feat(mockup-v2): add perspective warp stage"
```

---

### Task 3: Displacement Map Stage

**Files:**
- Create: `src/lib/mockups/mockupEngineV2/stages/displacementMap.ts`

**Reference:** POC lines 516-672 (`generateDisplacementMap` and `applyDisplacement`)

**Step 1: Create the displacement map module**

This file exports two functions:
1. `generateDisplacementMap` — procedurally creates a grayscale displacement map based on product type
2. `applyDisplacement` — uses the map to warp source pixels with bilinear interpolation

```typescript
import { DisplacementType } from '../templates/types';

/**
 * Generates a procedural grayscale displacement map.
 * 128 = neutral (no displacement), 0 = max negative, 255 = max positive.
 */
export function generateDisplacementMap(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  type: DisplacementType,
  freq: number
): void {
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      let val = 128;

      switch (type) {
        case 'fabric-drape':
          val = 128
            + Math.sin(x * freq * 0.02) * 60
            + Math.sin(y * freq * 0.008 + x * 0.01) * 30
            + Math.cos((x + y) * freq * 0.005) * 20;
          break;
        case 'pillow':
        case 'radial-bulge': {
          const cx = width / 2, cy = height / 2;
          const dx = (x - cx) / cx, dy = (y - cy) / cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          val = 128
            + Math.sin(dist * freq * 0.8) * 50 * (1 - dist)
            + Math.sin(x * freq * 0.015) * 20
            + Math.cos(y * freq * 0.015) * 20;
          break;
        }
        case 'vertical-drape':
          val = 128
            + Math.sin(x * freq * 0.025) * 50
            + Math.sin(y * freq * 0.003 + x * 0.005) * 15
            + Math.cos(x * freq * 0.04) * 10;
          break;
        case 'cylindrical':
          val = 128
            + Math.sin((x / width) * Math.PI * freq * 0.5) * 40
            + Math.cos(y * freq * 0.01) * 10;
          break;
        case 'flat-surface':
        default:
          val = 128
            + Math.sin(x * freq * 0.03) * 10
            + Math.sin(y * freq * 0.03) * 10
            + (Math.random() - 0.5) * 8;
          break;
      }

      val = Math.max(0, Math.min(255, Math.round(val)));
      data[i] = val;
      data[i + 1] = val;
      data[i + 2] = val;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

/**
 * Applies displacement mapping to warp source pixels.
 * Uses bilinear interpolation for smooth results.
 */
export function applyDisplacement(
  srcCanvas: HTMLCanvasElement,
  dispCanvas: HTMLCanvasElement,
  destCtx: CanvasRenderingContext2D,
  width: number,
  height: number,
  scale: number
): void {
  if (scale === 0) {
    destCtx.drawImage(srcCanvas, 0, 0);
    return;
  }

  const srcCtx = srcCanvas.getContext('2d')!;
  const dispCtx = dispCanvas.getContext('2d')!;

  const srcData = srcCtx.getImageData(0, 0, width, height);
  const dispData = dispCtx.getImageData(0, 0, width, height);
  const outData = destCtx.createImageData(width, height);

  const src = srcData.data;
  const disp = dispData.data;
  const out = outData.data;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;

      const dx = ((disp[i] - 128) / 128) * scale;
      const dy = ((disp[i + 1] - 128) / 128) * scale;

      const sx = x + dx;
      const sy = y + dy;

      // Bilinear interpolation
      const x0 = Math.max(0, Math.min(width - 1, Math.floor(sx)));
      const y0 = Math.max(0, Math.min(height - 1, Math.floor(sy)));
      const x1 = Math.min(width - 1, x0 + 1);
      const y1 = Math.min(height - 1, y0 + 1);
      const fx = sx - x0;
      const fy = sy - y0;

      const i00 = (y0 * width + x0) * 4;
      const i10 = (y0 * width + x1) * 4;
      const i01 = (y1 * width + x0) * 4;
      const i11 = (y1 * width + x1) * 4;

      for (let c = 0; c < 4; c++) {
        out[i + c] = Math.round(
          src[i00 + c] * (1 - fx) * (1 - fy) +
          src[i10 + c] * fx * (1 - fy) +
          src[i01 + c] * (1 - fx) * fy +
          src[i11 + c] * fx * fy
        );
      }
    }
  }

  destCtx.putImageData(outData, 0, 0);
}
```

**Step 2: Commit**

```bash
git add src/lib/mockups/mockupEngineV2/stages/displacementMap.ts
git commit -m "feat(mockup-v2): add displacement map stage with 6 procedural types"
```

---

### Task 4: Blend Composite Stage

**Files:**
- Create: `src/lib/mockups/mockupEngineV2/stages/blendComposite.ts`

**Reference:** POC lines 486-513 (`generateProductBase`), lines 675-693 (`createLightingLayer`), and lines 696-789 (final composite)

**Step 1: Create the blend composite module**

This file exports three functions:
1. `generateProductBase` — creates a procedural product surface with shading
2. `createLightingLayer` — derives a luminance-based lighting layer from the product base
3. `compositeResult` — blends the displaced pattern onto the product base with lighting

```typescript
import { BlendMode, DisplacementType } from '../templates/types';

/**
 * Generates a procedural product base with shading.
 */
export function generateProductBase(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  shape: DisplacementType,
  brightness: number
): void {
  const grad = ctx.createRadialGradient(
    width * 0.5, height * 0.4, width * 0.1,
    width * 0.5, height * 0.5, width * 0.7
  );
  grad.addColorStop(0, `rgb(${brightness}, ${brightness}, ${brightness})`);
  const dim = Math.round(brightness * 0.6);
  grad.addColorStop(1, `rgb(${dim}, ${dim}, ${Math.round(brightness * 0.65)})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  if (shape === 'fabric-drape' || shape === 'vertical-drape') {
    for (let i = 0; i < 5; i++) {
      const x = (width / 5) * i + width * 0.1;
      const foldGrad = ctx.createLinearGradient(x - 30, 0, x + 30, 0);
      foldGrad.addColorStop(0, 'rgba(0,0,0,0.1)');
      foldGrad.addColorStop(0.5, 'rgba(255,255,255,0.08)');
      foldGrad.addColorStop(1, 'rgba(0,0,0,0.1)');
      ctx.fillStyle = foldGrad;
      ctx.fillRect(0, 0, width, height);
    }
  } else if (shape === 'pillow' || shape === 'radial-bulge') {
    const pillowGrad = ctx.createRadialGradient(
      width * 0.5, height * 0.5, width * 0.15,
      width * 0.5, height * 0.5, width * 0.5
    );
    pillowGrad.addColorStop(0, 'rgba(255,255,255,0.15)');
    pillowGrad.addColorStop(0.7, 'rgba(0,0,0,0)');
    pillowGrad.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = pillowGrad;
    ctx.fillRect(0, 0, width, height);
  } else if (shape === 'cylindrical') {
    const cylGrad = ctx.createLinearGradient(0, 0, width, 0);
    cylGrad.addColorStop(0, 'rgba(0,0,0,0.2)');
    cylGrad.addColorStop(0.3, 'rgba(255,255,255,0.1)');
    cylGrad.addColorStop(0.5, 'rgba(255,255,255,0.15)');
    cylGrad.addColorStop(0.7, 'rgba(255,255,255,0.1)');
    cylGrad.addColorStop(1, 'rgba(0,0,0,0.2)');
    ctx.fillStyle = cylGrad;
    ctx.fillRect(0, 0, width, height);
  }
}

/**
 * Creates a luminance-based lighting layer from the product base.
 */
export function createLightingLayer(
  productCanvas: HTMLCanvasElement,
  destCtx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  const prodCtx = productCanvas.getContext('2d')!;
  const prodData = prodCtx.getImageData(0, 0, width, height);
  const lightData = destCtx.createImageData(width, height);

  for (let i = 0; i < prodData.data.length; i += 4) {
    const lum = Math.round(
      prodData.data[i] * 0.299 +
      prodData.data[i + 1] * 0.587 +
      prodData.data[i + 2] * 0.114
    );
    lightData.data[i] = lum;
    lightData.data[i + 1] = lum;
    lightData.data[i + 2] = lum;
    lightData.data[i + 3] = 255;
  }
  destCtx.putImageData(lightData, 0, 0);
}

/**
 * Composites the displaced pattern onto the product base with blend mode and lighting.
 */
export function compositeResult(
  finalCtx: CanvasRenderingContext2D,
  productCanvas: HTMLCanvasElement,
  patternCanvas: HTMLCanvasElement,
  width: number,
  height: number,
  blendMode: BlendMode,
  opacity: number,
  lightingEnabled: boolean,
  lightingIntensity: number
): void {
  // Draw product base
  finalCtx.drawImage(productCanvas, 0, 0);

  // Composite pattern with blend mode
  finalCtx.globalCompositeOperation = blendMode;
  finalCtx.globalAlpha = opacity;
  finalCtx.drawImage(patternCanvas, 0, 0, width, height);

  // Add lighting layer
  if (lightingEnabled && lightingIntensity > 0) {
    const lightCanvas = document.createElement('canvas');
    lightCanvas.width = width;
    lightCanvas.height = height;
    const lightCtx = lightCanvas.getContext('2d')!;
    createLightingLayer(productCanvas, lightCtx, width, height);

    finalCtx.globalCompositeOperation = 'soft-light';
    finalCtx.globalAlpha = lightingIntensity;
    finalCtx.drawImage(lightCanvas, 0, 0);
  }

  // Reset
  finalCtx.globalCompositeOperation = 'source-over';
  finalCtx.globalAlpha = 1;
}
```

**Step 2: Commit**

```bash
git add src/lib/mockups/mockupEngineV2/stages/blendComposite.ts
git commit -m "feat(mockup-v2): add blend composite stage with product base and lighting"
```

---

### Task 5: Pipeline Orchestrator

**Files:**
- Create: `src/lib/mockups/mockupEngineV2/MockupPipeline.ts`

**Step 1: Create the pipeline orchestrator**

This ties all 4 stages together. It takes a pattern image + template config and produces a final composited canvas.

```typescript
import { PatternTiler } from '../../tiling/PatternTiler';
import type { RepeatType } from '../../tiling/PatternTiler';
import type { MockupV2Template } from './templates/types';
import { applyPerspective } from './stages/perspectiveWarp';
import { generateDisplacementMap, applyDisplacement } from './stages/displacementMap';
import { generateProductBase, compositeResult } from './stages/blendComposite';

export interface PipelineInput {
  patternImage: HTMLImageElement | HTMLCanvasElement;
  template: MockupV2Template;
  repeatType: RepeatType;
  dpi: number;
  tileWidth: number;
  tileHeight: number;
}

/**
 * Runs the full 4-stage mockup rendering pipeline.
 * Returns the final composited canvas.
 */
export function runPipeline(input: PipelineInput): HTMLCanvasElement {
  const { patternImage, template, repeatType, dpi, tileWidth, tileHeight } = input;
  const { canvasSize, patternArea, perspective, displacement, blend, lighting, productBase } = template;
  const { width, height } = canvasSize;

  // --- Stage 1: Tile Pattern ---
  const tileCanvas = document.createElement('canvas');
  tileCanvas.width = patternArea.width;
  tileCanvas.height = patternArea.height;

  // Scale pattern based on physical dimensions
  const physW = template.physicalSize.width;
  const patternInchesW = tileWidth / dpi;
  const scaleFactor = (patternArea.width / physW) * patternInchesW;
  const scaledW = Math.round(patternImage instanceof HTMLImageElement
    ? patternImage.naturalWidth * (patternArea.width / (physW * dpi))
    : patternImage.width * (patternArea.width / (physW * dpi)));
  const scaledH = Math.round(patternImage instanceof HTMLImageElement
    ? patternImage.naturalHeight * (patternArea.width / (physW * dpi))
    : patternImage.height * (patternArea.width / (physW * dpi)));

  // Create a scaled tile canvas
  const scaledTile = document.createElement('canvas');
  scaledTile.width = scaledW || 1;
  scaledTile.height = scaledH || 1;
  const scaledCtx = scaledTile.getContext('2d')!;
  scaledCtx.drawImage(patternImage, 0, 0, scaledW, scaledH);

  // Tile onto pattern area
  const tiler = new PatternTiler(tileCanvas, patternArea.width, patternArea.height);
  tiler.render(scaledTile, repeatType);

  // --- Stage 2: Perspective Warp ---
  const perspCanvas = document.createElement('canvas');
  perspCanvas.width = patternArea.width;
  perspCanvas.height = patternArea.height;
  const perspCtx = perspCanvas.getContext('2d')!;
  applyPerspective(
    tileCanvas, perspCtx,
    patternArea.width, patternArea.height,
    perspective.topSqueeze, perspective.bottomSqueeze
  );

  // --- Stage 3: Displacement ---
  const dispMapCanvas = document.createElement('canvas');
  dispMapCanvas.width = patternArea.width;
  dispMapCanvas.height = patternArea.height;
  const dispMapCtx = dispMapCanvas.getContext('2d')!;
  generateDisplacementMap(
    dispMapCtx,
    patternArea.width, patternArea.height,
    displacement.type, displacement.wrinkleFreq
  );

  const displacedCanvas = document.createElement('canvas');
  displacedCanvas.width = patternArea.width;
  displacedCanvas.height = patternArea.height;
  const displacedCtx = displacedCanvas.getContext('2d')!;
  applyDisplacement(
    perspCanvas, dispMapCanvas, displacedCtx,
    patternArea.width, patternArea.height,
    displacement.intensity
  );

  // --- Stage 4: Blend Composite ---
  // Create product base at full canvas size
  const productCanvas = document.createElement('canvas');
  productCanvas.width = width;
  productCanvas.height = height;
  const productCtx = productCanvas.getContext('2d')!;

  if (productBase.type === 'procedural') {
    generateProductBase(productCtx, width, height, productBase.shape, productBase.brightness);
  }
  // TODO: 'image' type — load product photo and draw to productCanvas

  // Position displaced pattern into correct area on full-size canvas
  const positionedPattern = document.createElement('canvas');
  positionedPattern.width = width;
  positionedPattern.height = height;
  const posCtx = positionedPattern.getContext('2d')!;
  posCtx.drawImage(displacedCanvas, patternArea.x, patternArea.y);

  // Final composite
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = width;
  finalCanvas.height = height;
  const finalCtx = finalCanvas.getContext('2d')!;

  compositeResult(
    finalCtx, productCanvas, positionedPattern,
    width, height,
    blend.mode, blend.opacity,
    lighting.enabled, lighting.intensity
  );

  return finalCanvas;
}
```

**Step 2: Commit**

```bash
git add src/lib/mockups/mockupEngineV2/MockupPipeline.ts
git commit -m "feat(mockup-v2): add pipeline orchestrator connecting all 4 stages"
```

---

### Task 6: Template Registry (All 11 New Mockup Types)

**Files:**
- Create: `src/lib/mockups/mockupEngineV2/templates/templateRegistry.ts`

**Step 1: Create the registry with all 11 templates**

Each template has pre-tuned perspective, displacement, blend, and lighting settings. Values are starting points that can be refined visually.

```typescript
import { MockupV2Template } from './types';

export const mockupV2Templates: Record<string, MockupV2Template> = {
  // ─── Apparel ───
  'tshirt-dress': {
    id: 'tshirt-dress',
    name: "Children's T-Shirt Dress",
    description: 'A-line children\'s t-shirt dress with flowing fabric',
    category: 'apparel',
    canvasSize: { width: 800, height: 1000 },
    patternArea: { x: 200, y: 120, width: 400, height: 600 },
    perspective: { topSqueeze: 35, bottomSqueeze: 5 },
    displacement: { intensity: 14, wrinkleFreq: 7, type: 'fabric-drape' },
    blend: { mode: 'multiply', opacity: 0.85 },
    lighting: { enabled: true, intensity: 0.25 },
    physicalSize: { width: 14, height: 22, unit: 'in' },
    productBase: { type: 'procedural', brightness: 210, shape: 'fabric-drape' },
  },
  'womens-skirt': {
    id: 'womens-skirt',
    name: "Women's Skirt",
    description: 'A-line skirt with fabric drape',
    category: 'apparel',
    canvasSize: { width: 800, height: 900 },
    patternArea: { x: 150, y: 80, width: 500, height: 700 },
    perspective: { topSqueeze: 40, bottomSqueeze: 10 },
    displacement: { intensity: 16, wrinkleFreq: 8, type: 'fabric-drape' },
    blend: { mode: 'multiply', opacity: 0.85 },
    lighting: { enabled: true, intensity: 0.3 },
    physicalSize: { width: 20, height: 24, unit: 'in' },
    productBase: { type: 'procedural', brightness: 200, shape: 'fabric-drape' },
  },

  // ─── Home Goods ───
  'tablecloth': {
    id: 'tablecloth',
    name: 'Tablecloth',
    description: 'Tablecloth draped over a table surface',
    category: 'home-goods',
    canvasSize: { width: 900, height: 700 },
    patternArea: { x: 50, y: 50, width: 800, height: 600 },
    perspective: { topSqueeze: 20, bottomSqueeze: 0 },
    displacement: { intensity: 10, wrinkleFreq: 5, type: 'fabric-drape' },
    blend: { mode: 'multiply', opacity: 0.88 },
    lighting: { enabled: true, intensity: 0.2 },
    physicalSize: { width: 60, height: 40, unit: 'in' },
    productBase: { type: 'procedural', brightness: 220, shape: 'fabric-drape' },
  },
  'curtain': {
    id: 'curtain',
    name: 'Curtain',
    description: 'Hanging curtain panel with vertical draping',
    category: 'home-goods',
    canvasSize: { width: 600, height: 1000 },
    patternArea: { x: 50, y: 30, width: 500, height: 940 },
    perspective: { topSqueeze: 0, bottomSqueeze: 0 },
    displacement: { intensity: 18, wrinkleFreq: 6, type: 'vertical-drape' },
    blend: { mode: 'multiply', opacity: 0.85 },
    lighting: { enabled: true, intensity: 0.35 },
    physicalSize: { width: 42, height: 84, unit: 'in' },
    productBase: { type: 'procedural', brightness: 200, shape: 'vertical-drape' },
  },
  'blanket': {
    id: 'blanket',
    name: 'Blanket',
    description: 'Soft throw blanket with gentle folds',
    category: 'home-goods',
    canvasSize: { width: 900, height: 800 },
    patternArea: { x: 50, y: 50, width: 800, height: 700 },
    perspective: { topSqueeze: 10, bottomSqueeze: 5 },
    displacement: { intensity: 12, wrinkleFreq: 5, type: 'fabric-drape' },
    blend: { mode: 'multiply', opacity: 0.87 },
    lighting: { enabled: true, intensity: 0.25 },
    physicalSize: { width: 50, height: 60, unit: 'in' },
    productBase: { type: 'procedural', brightness: 215, shape: 'fabric-drape' },
  },
  'nursery-wall': {
    id: 'nursery-wall',
    name: 'Nursery Wall',
    description: 'Nursery room scene with wallpaper applied to wall',
    category: 'home-goods',
    canvasSize: { width: 1000, height: 800 },
    patternArea: { x: 50, y: 30, width: 900, height: 550 },
    perspective: { topSqueeze: 0, bottomSqueeze: 0 },
    displacement: { intensity: 4, wrinkleFreq: 3, type: 'flat-surface' },
    blend: { mode: 'multiply', opacity: 0.90 },
    lighting: { enabled: true, intensity: 0.15 },
    physicalSize: { width: 120, height: 96, unit: 'in' },
    productBase: { type: 'procedural', brightness: 240, shape: 'flat-surface' },
  },

  // ─── Stationery ───
  'gift-bag': {
    id: 'gift-bag',
    name: 'Gift Bag',
    description: 'Paper gift bag with pattern',
    category: 'stationery',
    canvasSize: { width: 700, height: 900 },
    patternArea: { x: 100, y: 100, width: 500, height: 650 },
    perspective: { topSqueeze: 25, bottomSqueeze: 0 },
    displacement: { intensity: 6, wrinkleFreq: 4, type: 'flat-surface' },
    blend: { mode: 'multiply', opacity: 0.90 },
    lighting: { enabled: true, intensity: 0.2 },
    physicalSize: { width: 10, height: 13, unit: 'in' },
    productBase: { type: 'procedural', brightness: 230, shape: 'flat-surface' },
  },
  'wallpaper-roll': {
    id: 'wallpaper-roll',
    name: 'Wallpaper Roll',
    description: 'Wallpaper roll partially unrolled',
    category: 'stationery',
    canvasSize: { width: 700, height: 900 },
    patternArea: { x: 100, y: 50, width: 500, height: 800 },
    perspective: { topSqueeze: 15, bottomSqueeze: 5 },
    displacement: { intensity: 8, wrinkleFreq: 10, type: 'cylindrical' },
    blend: { mode: 'multiply', opacity: 0.88 },
    lighting: { enabled: true, intensity: 0.3 },
    physicalSize: { width: 20, height: 33, unit: 'in' },
    productBase: { type: 'procedural', brightness: 235, shape: 'cylindrical' },
  },

  // ─── Accessories ───
  'silk-scarf': {
    id: 'silk-scarf',
    name: 'Silk Scarf',
    description: 'Flowing silk scarf with drape',
    category: 'accessories',
    canvasSize: { width: 800, height: 800 },
    patternArea: { x: 80, y: 80, width: 640, height: 640 },
    perspective: { topSqueeze: 20, bottomSqueeze: 15 },
    displacement: { intensity: 15, wrinkleFreq: 7, type: 'fabric-drape' },
    blend: { mode: 'multiply', opacity: 0.82 },
    lighting: { enabled: true, intensity: 0.35 },
    physicalSize: { width: 36, height: 36, unit: 'in' },
    productBase: { type: 'procedural', brightness: 210, shape: 'fabric-drape' },
  },
  'phone-case': {
    id: 'phone-case',
    name: 'Phone Case',
    description: 'Smartphone case with slight curve',
    category: 'accessories',
    canvasSize: { width: 500, height: 900 },
    patternArea: { x: 60, y: 100, width: 380, height: 650 },
    perspective: { topSqueeze: 8, bottomSqueeze: 5 },
    displacement: { intensity: 5, wrinkleFreq: 12, type: 'radial-bulge' },
    blend: { mode: 'multiply', opacity: 0.90 },
    lighting: { enabled: true, intensity: 0.2 },
    physicalSize: { width: 3, height: 6, unit: 'in' },
    productBase: { type: 'procedural', brightness: 225, shape: 'radial-bulge' },
  },
  'desk-mat': {
    id: 'desk-mat',
    name: 'Desk Mat',
    description: 'Large desk mat / mouse pad',
    category: 'accessories',
    canvasSize: { width: 1000, height: 500 },
    patternArea: { x: 50, y: 40, width: 900, height: 420 },
    perspective: { topSqueeze: 10, bottomSqueeze: 0 },
    displacement: { intensity: 3, wrinkleFreq: 4, type: 'flat-surface' },
    blend: { mode: 'multiply', opacity: 0.92 },
    lighting: { enabled: true, intensity: 0.15 },
    physicalSize: { width: 35, height: 16, unit: 'in' },
    productBase: { type: 'procedural', brightness: 60, shape: 'flat-surface' },
  },
};

export function getV2Template(id: string): MockupV2Template | undefined {
  return mockupV2Templates[id];
}

export function getAllV2Templates(): MockupV2Template[] {
  return Object.values(mockupV2Templates);
}

export function getV2TemplatesByCategory(category: string): MockupV2Template[] {
  return Object.values(mockupV2Templates).filter(t => t.category === category);
}

export function getAllV2Categories(): string[] {
  return [...new Set(Object.values(mockupV2Templates).map(t => t.category))];
}
```

**Step 2: Commit**

```bash
git add src/lib/mockups/mockupEngineV2/templates/templateRegistry.ts
git commit -m "feat(mockup-v2): add template registry with all 11 mockup types"
```

---

### Task 7: MockupRendererV2 Component

**Files:**
- Create: `src/components/mockups/MockupRendererV2.tsx`

**Context:** This component mirrors the existing `MockupRenderer.tsx` interface but uses the V2 pipeline internally. It must accept the same key props so the gallery can render both V1 and V2 mockups interchangeably.

**Step 1: Create the V2 renderer component**

```tsx
'use client';

import React, { useRef, useEffect, useState } from 'react';
import { runPipeline } from '@/lib/mockups/mockupEngineV2/MockupPipeline';
import type { MockupV2Template } from '@/lib/mockups/mockupEngineV2/templates/types';
import type { RepeatType } from '@/lib/tiling/PatternTiler';

interface MockupRendererV2Props {
  template: MockupV2Template;
  patternImage: HTMLImageElement | null;
  tileWidth: number;
  tileHeight: number;
  dpi: number;
  repeatType: RepeatType;
  onClick?: () => void;
}

export default function MockupRendererV2({
  template,
  patternImage,
  tileWidth,
  tileHeight,
  dpi,
  repeatType,
  onClick,
}: MockupRendererV2Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRendering, setIsRendering] = useState(false);

  useEffect(() => {
    if (!patternImage || !canvasRef.current) return;

    setIsRendering(true);

    // Use requestAnimationFrame to avoid blocking paint
    requestAnimationFrame(() => {
      try {
        const resultCanvas = runPipeline({
          patternImage,
          template,
          repeatType,
          dpi,
          tileWidth,
          tileHeight,
        });

        const canvas = canvasRef.current;
        if (!canvas) return;

        canvas.width = resultCanvas.width;
        canvas.height = resultCanvas.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(resultCanvas, 0, 0);
      } catch (err) {
        console.error('MockupRendererV2 render error:', err);
      } finally {
        setIsRendering(false);
      }
    });
  }, [patternImage, template, tileWidth, tileHeight, dpi, repeatType]);

  return (
    <div
      className="relative cursor-pointer"
      onClick={onClick}
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas
        ref={canvasRef}
        className="w-full rounded-lg"
        style={{ display: 'block' }}
        onDragStart={(e) => e.preventDefault()}
      />
      {isRendering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
          <span className="text-white text-sm">Rendering...</span>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/mockups/MockupRendererV2.tsx
git commit -m "feat(mockup-v2): add MockupRendererV2 component"
```

---

### Task 8: Update MockupGalleryModal with Category Tabs

**Files:**
- Modify: `src/components/mockups/MockupGalleryModal.tsx`

**Context:** The current gallery shows 6 mockup types in a flat grid. We need to:
1. Add the V2 templates alongside existing ones
2. Add category filter tabs
3. Use MockupRendererV2 for V2 types, existing MockupRenderer for V1 types

**Step 1: Read the current file to get exact code**

Read `src/components/mockups/MockupGalleryModal.tsx` and note the current imports and component structure.

**Step 2: Update the gallery modal**

Add these changes to `MockupGalleryModal.tsx`:

1. Import V2 types and renderer:
```tsx
import MockupRendererV2 from './MockupRendererV2';
import { getAllV2Templates } from '@/lib/mockups/mockupEngineV2/templates/templateRegistry';
import type { MockupV2Template } from '@/lib/mockups/mockupEngineV2/templates/types';
```

2. Add category state:
```tsx
const [activeCategory, setActiveCategory] = useState<string>('all');
```

3. Build combined mockup list:
```tsx
const v2Templates = getAllV2Templates();
const categories = ['all', 'apparel', 'home-goods', 'stationery', 'accessories', 'classic'];
const categoryLabels: Record<string, string> = {
  'all': 'All',
  'apparel': 'Apparel',
  'home-goods': 'Home Goods',
  'stationery': 'Stationery',
  'accessories': 'Accessories',
  'classic': 'Classic',
};
```

4. Add category tab bar in the modal header (after the title, before the grid):
```tsx
<div className="flex gap-2 px-4 pb-3 overflow-x-auto">
  {categories.map((cat) => (
    <button
      key={cat}
      onClick={() => setActiveCategory(cat)}
      className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
        activeCategory === cat
          ? 'bg-[#e94560] text-white'
          : 'bg-[#0f3460] text-[#a0a0c0] hover:text-white'
      }`}
    >
      {categoryLabels[cat]}
    </button>
  ))}
</div>
```

5. Render V1 mockups (filtered by category — show when 'all' or 'classic'):
```tsx
{(activeCategory === 'all' || activeCategory === 'classic') &&
  MOCKUP_TYPES.map((type) => (
    // existing MockupRenderer rendering code
  ))
}
```

6. Render V2 mockups (filtered by active category):
```tsx
{v2Templates
  .filter(t => activeCategory === 'all' || t.category === activeCategory)
  .map((template) => (
    <div key={template.id} className="cursor-pointer">
      <MockupRendererV2
        template={template}
        patternImage={image}
        tileWidth={tileWidth}
        tileHeight={tileHeight}
        dpi={dpi}
        repeatType={repeatType}
        onClick={() => onSelectMockup(template.id)}
      />
      <p className="text-center text-xs text-[#a0a0c0] mt-1">{template.name}</p>
      <p className="text-center text-[10px] text-[#666]">
        {template.physicalSize.width}×{template.physicalSize.height}"
      </p>
    </div>
  ))
}
```

**Step 3: Commit**

```bash
git add src/components/mockups/MockupGalleryModal.tsx
git commit -m "feat(mockup-v2): update gallery with category tabs and V2 mockups"
```

---

### Task 9: Barrel Export and Final Wiring

**Files:**
- Create: `src/lib/mockups/mockupEngineV2/index.ts`

**Step 1: Create barrel export**

```typescript
export { runPipeline } from './MockupPipeline';
export type { PipelineInput } from './MockupPipeline';
export type { MockupV2Template, MockupV2Category, DisplacementType, BlendMode } from './templates/types';
export { mockupV2Templates, getV2Template, getAllV2Templates, getV2TemplatesByCategory, getAllV2Categories } from './templates/templateRegistry';
```

**Step 2: Commit**

```bash
git add src/lib/mockups/mockupEngineV2/index.ts
git commit -m "feat(mockup-v2): add barrel export for V2 engine"
```

---

### Task 10: Visual Verification

**Step 1: Start the dev server**

```bash
npm run dev
```

**Step 2: Open the app and upload a pattern**

Navigate to localhost:3000, upload a test pattern tile.

**Step 3: Open the mockup gallery**

Click the Mockups button. Verify:
- Category tabs appear (All, Apparel, Home Goods, Stationery, Accessories, Classic)
- "All" tab shows both old and new mockups
- "Classic" tab shows only the 8 original mockups
- Other tabs filter to their V2 categories
- V2 mockups render with visible perspective warping and displacement effects
- Clicking tabs filters correctly

**Step 4: Visual quality check**

For each new mockup type, verify:
- Pattern tiles correctly within the pattern area
- Perspective warp looks natural (not too extreme)
- Displacement adds fabric-like texture (not glitchy)
- Blend mode composites pattern realistically onto the product base
- Lighting adds subtle depth

**Step 5: Adjust template parameters if needed**

If any mockup looks wrong, adjust the pre-tuned values in `templateRegistry.ts`:
- `perspective.topSqueeze` / `bottomSqueeze` — change warp intensity
- `displacement.intensity` — more/less fabric wrinkling
- `displacement.wrinkleFreq` — tighter/looser wrinkle pattern
- `blend.opacity` — pattern strength
- `lighting.intensity` — depth effect strength

**Step 6: Final commit**

```bash
git add -A
git commit -m "feat(mockup-v2): tune mockup template parameters after visual review"
```

---

## Task Summary

| Task | Description | Est. |
|------|-------------|------|
| 1 | V2 Type Definitions | 3 min |
| 2 | Perspective Warp Stage | 5 min |
| 3 | Displacement Map Stage | 5 min |
| 4 | Blend Composite Stage | 5 min |
| 5 | Pipeline Orchestrator | 5 min |
| 6 | Template Registry (11 types) | 5 min |
| 7 | MockupRendererV2 Component | 5 min |
| 8 | Update Gallery with Category Tabs | 10 min |
| 9 | Barrel Export | 2 min |
| 10 | Visual Verification & Tuning | 15 min |
