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
