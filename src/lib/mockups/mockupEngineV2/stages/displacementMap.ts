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
