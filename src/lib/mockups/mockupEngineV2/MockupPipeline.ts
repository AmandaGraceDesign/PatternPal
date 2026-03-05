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
