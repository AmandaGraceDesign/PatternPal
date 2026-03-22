import { PatternTiler } from '../../tiling/PatternTiler';
import type { RepeatType } from '../../tiling/PatternTiler';
import type { MockupV2Template, MockupZone, BlendMode } from './templates/types';
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
  /** Pre-loaded zone mask images, keyed by zone id. */
  zoneMasks?: Record<string, HTMLImageElement>;
  /** Pre-loaded product base image (for type: 'image' templates). */
  productBaseImage?: HTMLImageElement;
  /** Pre-loaded single mask image (for single-zone image templates). */
  productMaskImage?: HTMLImageElement;
}

/**
 * Processes a single zone through the pipeline:
 * tile → perspective warp → displacement → mask clip.
 * Returns a full-canvas-sized result with the zone's pattern in position.
 */
function processZone(
  patternImage: HTMLImageElement | HTMLCanvasElement,
  zone: {
    patternArea: { x: number; y: number; width: number; height: number };
    perspective: { topSqueeze: number; bottomSqueeze: number };
    displacement: { intensity: number; wrinkleFreq: number; type: string };
  },
  canvasWidth: number,
  canvasHeight: number,
  physicalWidth: number,
  dpi: number,
  repeatType: RepeatType,
  maskImage?: HTMLImageElement,
): HTMLCanvasElement {
  const { patternArea, perspective, displacement } = zone;

  // --- Stage 1: Tile Pattern ---
  const tileCanvas = document.createElement('canvas');
  tileCanvas.width = patternArea.width;
  tileCanvas.height = patternArea.height;

  const srcW = patternImage instanceof HTMLImageElement
    ? patternImage.naturalWidth : patternImage.width;
  const srcH = patternImage instanceof HTMLImageElement
    ? patternImage.naturalHeight : patternImage.height;

  const scaleFactor = patternArea.width / (physicalWidth * dpi);
  const scaledW = Math.round(srcW * scaleFactor) || 1;
  const scaledH = Math.round(srcH * scaleFactor) || 1;

  const scaledTile = document.createElement('canvas');
  scaledTile.width = scaledW;
  scaledTile.height = scaledH;
  const scaledCtx = scaledTile.getContext('2d')!;
  scaledCtx.drawImage(patternImage, 0, 0, scaledW, scaledH);

  const tileCtx = tileCanvas.getContext('2d')!;
  const tiler = new PatternTiler(tileCtx, patternArea.width, patternArea.height);
  tiler.renderPreScaled(scaledTile, repeatType);

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
    displacement.type as any, displacement.wrinkleFreq
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

  // --- Stage 4: Mask Clip (if mask provided) ---
  if (maskImage) {
    // Extract the portion of the mask that corresponds to this zone's pattern area
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = patternArea.width;
    maskCanvas.height = patternArea.height;
    const maskCtx = maskCanvas.getContext('2d')!;
    maskCtx.drawImage(
      maskImage,
      patternArea.x, patternArea.y, patternArea.width, patternArea.height,
      0, 0, patternArea.width, patternArea.height
    );

    // Convert B/W mask to alpha mask: white (bright) = opaque, black (dark) = transparent
    const maskData = maskCtx.getImageData(0, 0, patternArea.width, patternArea.height);
    const md = maskData.data;
    for (let i = 0; i < md.length; i += 4) {
      const luminance = md[i] * 0.299 + md[i + 1] * 0.587 + md[i + 2] * 0.114;
      md[i] = 255;
      md[i + 1] = 255;
      md[i + 2] = 255;
      md[i + 3] = Math.round(luminance); // white pixels → opaque, black → transparent
    }
    maskCtx.putImageData(maskData, 0, 0);

    // Apply alpha mask to clip pattern
    displacedCtx.globalCompositeOperation = 'destination-in';
    displacedCtx.drawImage(maskCanvas, 0, 0);
    displacedCtx.globalCompositeOperation = 'source-over';
  }

  // Position into full canvas
  const positioned = document.createElement('canvas');
  positioned.width = canvasWidth;
  positioned.height = canvasHeight;
  const posCtx = positioned.getContext('2d')!;
  posCtx.drawImage(displacedCanvas, patternArea.x, patternArea.y);

  return positioned;
}

/**
 * Runs the full mockup rendering pipeline.
 * Supports single-zone (legacy), multi-zone, procedural, and image-based templates.
 */
export function runPipeline(input: PipelineInput): HTMLCanvasElement {
  const { patternImage, template, repeatType, dpi, tileWidth, tileHeight } = input;
  const { canvasSize, lighting, productBase } = template;
  const { width, height } = canvasSize;

  // --- Build product base canvas ---
  const productCanvas = document.createElement('canvas');
  productCanvas.width = width;
  productCanvas.height = height;
  const productCtx = productCanvas.getContext('2d')!;

  if (productBase.type === 'image' && input.productBaseImage) {
    productCtx.drawImage(input.productBaseImage, 0, 0, width, height);
  } else if (productBase.type === 'procedural') {
    generateProductBase(productCtx, width, height, productBase.shape, productBase.brightness);
  }

  // --- Process zones ---
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = width;
  finalCanvas.height = height;
  const finalCtx = finalCanvas.getContext('2d')!;

  // Draw product base first
  finalCtx.drawImage(productCanvas, 0, 0);

  if (template.zones && template.zones.length > 0) {
    // Multi-zone: process each zone independently and composite
    for (const zone of template.zones) {
      const zoneMask = input.zoneMasks?.[zone.id];
      // Use a full-canvas mask image if provided, otherwise fall back to zone maskPath loading
      const maskImg = zoneMask || undefined;

      const zonePhysicalWidth = zone.physicalWidth ?? template.physicalSize.width;
      const zoneResult = processZone(
        patternImage,
        zone,
        width, height,
        zonePhysicalWidth,
        dpi,
        repeatType,
        maskImg,
      );

      // Composite this zone onto the final canvas
      finalCtx.globalCompositeOperation = zone.blend.mode;
      finalCtx.globalAlpha = zone.blend.opacity;
      finalCtx.drawImage(zoneResult, 0, 0);
    }
  } else {
    // Single-zone: use top-level template fields
    const singleMask = input.productMaskImage || undefined;
    const zoneResult = processZone(
      patternImage,
      {
        patternArea: template.patternArea,
        perspective: template.perspective,
        displacement: template.displacement,
      },
      width, height,
      template.physicalSize.width,
      dpi,
      repeatType,
      singleMask,
    );

    finalCtx.globalCompositeOperation = template.blend.mode;
    finalCtx.globalAlpha = template.blend.opacity;
    finalCtx.drawImage(zoneResult, 0, 0);
  }

  // Reset composite state
  finalCtx.globalCompositeOperation = 'source-over';
  finalCtx.globalAlpha = 1;

  // --- Lighting overlay ---
  if (lighting.enabled && lighting.intensity > 0) {
    const lightCanvas = document.createElement('canvas');
    lightCanvas.width = width;
    lightCanvas.height = height;
    const lightCtx = lightCanvas.getContext('2d')!;

    // Extract lighting from the product base (original photo shadows/highlights)
    const prodData = productCtx.getImageData(0, 0, width, height);
    const lightData = lightCtx.createImageData(width, height);
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
    lightCtx.putImageData(lightData, 0, 0);

    finalCtx.globalCompositeOperation = 'soft-light';
    finalCtx.globalAlpha = lighting.intensity;
    finalCtx.drawImage(lightCanvas, 0, 0);
    finalCtx.globalCompositeOperation = 'source-over';
    finalCtx.globalAlpha = 1;
  }

  return finalCanvas;
}
