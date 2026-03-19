/**
 * Offscreen mockup renderer — renders a pattern onto a mockup template
 * using canvas compositing, returning the result as an HTMLCanvasElement.
 *
 * Extracted from MockupRenderer.tsx to enable reuse in the social media
 * export overlay pipeline without mounting a React component.
 */

import { MockupTemplate, MockupType, getMockupTemplate } from '@/lib/mockups/mockupTemplates';
import { PatternTiler, RepeatType } from '@/lib/tiling/PatternTiler';

/** Load an image from a URL, returning a promise. */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

/** Convert a mask image to an alpha mask canvas (same logic as MockupRenderer). */
function createMaskCanvas(
  mask: HTMLImageElement,
  width: number,
  height: number,
  invertAlpha = false,
): HTMLCanvasElement | null {
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = width;
  maskCanvas.height = height;
  const maskCtx = maskCanvas.getContext('2d');
  if (!maskCtx) return null;

  maskCtx.clearRect(0, 0, width, height);
  maskCtx.drawImage(mask, 0, 0, width, height);

  const imageData = maskCtx.getImageData(0, 0, width, height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const originalAlpha = data[i + 3];
    const luminance = (r + g + b) / 3;
    const baseAlpha = originalAlpha < 255 ? originalAlpha : luminance;
    const finalAlpha = invertAlpha ? 255 - baseAlpha : baseAlpha;
    data[i] = 0;
    data[i + 1] = 0;
    data[i + 2] = 0;
    data[i + 3] = finalAlpha;
  }

  maskCtx.putImageData(imageData, 0, 0);
  return maskCanvas;
}

/** Get bounding box of non-transparent pixels in a mask canvas. */
function getMaskBounds(maskCanvas: HTMLCanvasElement) {
  const ctx = maskCanvas.getContext('2d');
  if (!ctx) return null;
  const { width, height } = maskCanvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const threshold = 10;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > threshold) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/** Sample the dominant background color from an image (same as MockupRenderer). */
function extractBackgroundColor(img: HTMLImageElement): string {
  const size = 48;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) return '#ffffff';
  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);
  const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();
  const step = 16;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 10) continue;
    const qr = Math.min(255, Math.round(data[i] / step) * step);
    const qg = Math.min(255, Math.round(data[i + 1] / step) * step);
    const qb = Math.min(255, Math.round(data[i + 2] / step) * step);
    const key = `${qr},${qg},${qb}`;
    const b = buckets.get(key);
    if (b) b.count++; else buckets.set(key, { count: 1, r: qr, g: qg, b: qb });
  }
  let best = { count: 0, r: 255, g: 255, b: 255 };
  for (const b of buckets.values()) if (b.count > best.count) best = b;
  if (best.count === 0) return '#ffffff';
  return '#' + [best.r, best.g, best.b].map(v => v.toString(16).padStart(2, '0')).join('');
}

/**
 * Render a mockup with a pattern applied, returning the result canvas.
 * This replicates the full compositing pipeline from MockupRenderer.
 */
export async function renderMockupOffscreen(
  templateId: MockupType,
  patternImage: HTMLImageElement,
  tileWidth: number,
  tileHeight: number,
  repeatType: RepeatType,
): Promise<HTMLCanvasElement> {
  const template = getMockupTemplate(templateId);
  const isOnesie = template.id === 'onesie';
  const isWrappingPaper = template.id === 'wrapping-paper';

  // Load all required images in parallel
  const mockupImage = await loadImage(template.image || template.templateImage);
  const maskImage = template.maskImage ? await loadImage(template.maskImage) : null;

  let colorMaskImage: HTMLImageElement | null = null;
  let shadowMaskImage: HTMLImageElement | null = null;
  let highlightMaskImage: HTMLImageElement | null = null;

  if (isOnesie) {
    colorMaskImage = await loadImage('/mockups/onesie_mask_color.png');
  } else if (isWrappingPaper) {
    [colorMaskImage, shadowMaskImage, highlightMaskImage] = await Promise.all([
      loadImage('/mockups/wrapping_paper_bow_mask.png'),
      loadImage('/mockups/wrapping_paper_shadow.png'),
      loadImage('/mockups/wrapping_paper_highlight.png'),
    ]);
  }

  // Create output canvas at mockup image size
  const canvas = document.createElement('canvas');
  canvas.width = mockupImage.width;
  canvas.height = mockupImage.height;
  const ctx = canvas.getContext('2d')!;

  // Draw base mockup
  ctx.drawImage(mockupImage, 0, 0);

  if ((isOnesie || isWrappingPaper) && !maskImage) return canvas;

  const patternArea = template.patternArea;
  const physW = template.physicalDimensions?.width ?? null;
  const physH = template.physicalDimensions?.height ?? null;

  // Calculate tile display size
  let scaledPW: number;
  let scaledPH: number;

  if (physW && physH) {
    let visW = patternArea.width;
    let visH = patternArea.height;
    if (maskImage) {
      const mc = createMaskCanvas(maskImage, patternArea.width, patternArea.height);
      if (mc) {
        const bounds = getMaskBounds(mc);
        if (bounds) { visW = bounds.width; visH = bounds.height; }
      }
    }
    const repeatsX = physW / tileWidth;
    const repeatsY = physH / tileHeight;
    const baseTW = visW / repeatsX;
    const baseTH = visH / repeatsY;
    const tileAspect = tileHeight !== 0 ? tileWidth / tileHeight : 1;
    // Lock tile aspect (same as MockupRenderer with scalePreviewActive or wallpaper)
    const widthFromH = baseTH * tileAspect;
    scaledPW = Math.min(baseTW, widthFromH);
    scaledPH = scaledPW / tileAspect;
  } else {
    scaledPW = patternArea.width / 2;
    scaledPH = patternArea.height / 2;
  }

  // Create pattern canvas
  const patternCanvas = document.createElement('canvas');
  patternCanvas.width = patternArea.width;
  patternCanvas.height = patternArea.height;
  const patternCtx = patternCanvas.getContext('2d')!;
  patternCtx.clearRect(0, 0, patternArea.width, patternArea.height);

  // Scale pattern tile and render tiled
  const scaledTileCanvas = document.createElement('canvas');
  scaledTileCanvas.width = scaledPW;
  scaledTileCanvas.height = scaledPH;
  const scaledTileCtx = scaledTileCanvas.getContext('2d')!;
  scaledTileCtx.imageSmoothingEnabled = true;
  scaledTileCtx.imageSmoothingQuality = 'high';
  scaledTileCtx.drawImage(patternImage, 0, 0, scaledPW, scaledPH);

  // Convert to image for PatternTiler (it expects HTMLImageElement)
  const scaledImg = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = scaledTileCanvas.toDataURL('image/png');
  });

  const tiler = new PatternTiler(patternCtx, patternArea.width, patternArea.height);
  tiler.renderPreScaled(scaledImg, repeatType);

  // Compositing — mirrors MockupRenderer logic exactly
  const blendModeMap: Record<string, GlobalCompositeOperation> = {
    normal: 'source-over',
    multiply: 'multiply',
    overlay: 'overlay',
    'soft-light': 'soft-light',
  };

  ctx.save();

  const needsMultiplyMask = template.blendMode === 'multiply' && maskImage;

  if (needsMultiplyMask) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = patternCanvas.width;
    tempCanvas.height = patternCanvas.height;
    const tempCtx = tempCanvas.getContext('2d')!;

    // Copy base mockup pattern area
    tempCtx.drawImage(
      mockupImage,
      patternArea.x, patternArea.y, patternCanvas.width, patternCanvas.height,
      0, 0, patternCanvas.width, patternCanvas.height,
    );

    if (isOnesie || isWrappingPaper) {
      // Pattern layer with mask
      const patternLayer = document.createElement('canvas');
      patternLayer.width = patternCanvas.width;
      patternLayer.height = patternCanvas.height;
      const plCtx = patternLayer.getContext('2d')!;
      plCtx.drawImage(patternCanvas, 0, 0);
      const patternMask = createMaskCanvas(maskImage!, patternArea.width, patternArea.height, false);
      if (patternMask) {
        plCtx.globalCompositeOperation = 'destination-in';
        plCtx.drawImage(patternMask, 0, 0);
      } else if (isOnesie) {
        ctx.restore();
        return canvas;
      }

      // Color layer
      if (colorMaskImage) {
        const colorLayer = document.createElement('canvas');
        colorLayer.width = patternCanvas.width;
        colorLayer.height = patternCanvas.height;
        const clCtx = colorLayer.getContext('2d')!;
        const colorMask = createMaskCanvas(colorMaskImage, patternArea.width, patternArea.height, false);

        // Shading (wrapping paper & onesie)
        const shadingLayer = document.createElement('canvas');
        shadingLayer.width = patternCanvas.width;
        shadingLayer.height = patternCanvas.height;
        const slCtx = shadingLayer.getContext('2d')!;
        slCtx.drawImage(
          mockupImage,
          patternArea.x, patternArea.y, patternCanvas.width, patternCanvas.height,
          0, 0, patternCanvas.width, patternCanvas.height,
        );
        const sd = slCtx.getImageData(0, 0, shadingLayer.width, shadingLayer.height);
        const d = sd.data;
        const contrast = 1.45;
        const lift = 12;
        for (let i = 0; i < d.length; i += 4) {
          const lum = (d[i] + d[i + 1] + d[i + 2]) / 3;
          const boosted = Math.min(255, Math.max(0, (lum - 128) * contrast + 128 + lift));
          d[i] = boosted;
          d[i + 1] = boosted;
          d[i + 2] = boosted;
        }
        slCtx.putImageData(sd, 0, 0);
        if (colorMask) {
          slCtx.globalCompositeOperation = 'destination-in';
          slCtx.drawImage(colorMask, 0, 0);
        }
        clCtx.clearRect(0, 0, colorLayer.width, colorLayer.height);
        clCtx.fillStyle = extractBackgroundColor(patternImage);
        clCtx.fillRect(0, 0, colorLayer.width, colorLayer.height);
        clCtx.globalCompositeOperation = 'multiply';
        clCtx.drawImage(shadingLayer, 0, 0);
        if (colorMask) {
          clCtx.globalCompositeOperation = 'destination-in';
          clCtx.drawImage(colorMask, 0, 0);
        }

        tempCtx.globalCompositeOperation = 'multiply';
        tempCtx.globalAlpha = 0.9;
        tempCtx.drawImage(colorLayer, 0, 0);
      }

      // Shadow (wrapping paper only)
      if (isWrappingPaper && shadowMaskImage) {
        const sl = document.createElement('canvas');
        sl.width = patternCanvas.width;
        sl.height = patternCanvas.height;
        const slc = sl.getContext('2d')!;
        slc.fillStyle = '#000000';
        slc.fillRect(0, 0, sl.width, sl.height);
        const sm = createMaskCanvas(shadowMaskImage, patternArea.width, patternArea.height, false);
        if (sm) { slc.globalCompositeOperation = 'destination-in'; slc.drawImage(sm, 0, 0); }
        tempCtx.globalCompositeOperation = 'multiply';
        tempCtx.globalAlpha = 0.25;
        tempCtx.drawImage(sl, 0, 0);
      }

      // Highlight (wrapping paper only)
      if (isWrappingPaper && highlightMaskImage) {
        const hl = document.createElement('canvas');
        hl.width = patternCanvas.width;
        hl.height = patternCanvas.height;
        const hlc = hl.getContext('2d')!;
        hlc.fillStyle = '#ffffff';
        hlc.fillRect(0, 0, hl.width, hl.height);
        const hm = createMaskCanvas(highlightMaskImage, patternArea.width, patternArea.height, false);
        if (hm) { hlc.globalCompositeOperation = 'destination-in'; hlc.drawImage(hm, 0, 0); }
        tempCtx.globalCompositeOperation = 'screen';
        tempCtx.globalAlpha = 0.48;
        tempCtx.drawImage(hl, 0, 0);
      }

      // Pattern overlay
      tempCtx.globalCompositeOperation = 'multiply';
      tempCtx.globalAlpha = template.id === 'wrapping-paper' ? 1 : (template.opacity ?? 1);
      tempCtx.drawImage(patternLayer, 0, 0);
    } else {
      // Non-onesie/wrapping-paper multiply + mask
      tempCtx.globalCompositeOperation = 'multiply';
      tempCtx.globalAlpha = template.opacity ?? 1;
      tempCtx.drawImage(patternCanvas, 0, 0);
    }

    // Apply mask (non-onesie/wrapping-paper)
    if (!isOnesie && !isWrappingPaper) {
      tempCtx.globalCompositeOperation = 'destination-out';
      tempCtx.globalAlpha = 1;
      tempCtx.drawImage(maskImage!, 0, 0, patternArea.width, patternArea.height);
    }

    // Draw final result
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = template.id === 'wrapping-paper' ? (template.opacity ?? 1) : 1;
    ctx.drawImage(tempCanvas, patternArea.x, patternArea.y);

  } else if (maskImage) {
    // Has mask but no multiply
    if (isOnesie || isWrappingPaper) {
      if (colorMaskImage) {
        const colorLayer = document.createElement('canvas');
        colorLayer.width = patternCanvas.width;
        colorLayer.height = patternCanvas.height;
        const clCtx = colorLayer.getContext('2d')!;
        clCtx.fillStyle = extractBackgroundColor(patternImage);
        clCtx.fillRect(0, 0, colorLayer.width, colorLayer.height);
        const cm = createMaskCanvas(colorMaskImage, patternArea.width, patternArea.height, false);
        if (cm) { clCtx.globalCompositeOperation = 'destination-in'; clCtx.drawImage(cm, 0, 0); }
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        ctx.drawImage(colorLayer, patternArea.x, patternArea.y);
      }
      const pm = createMaskCanvas(maskImage, patternArea.width, patternArea.height);
      if (pm) {
        patternCtx.globalCompositeOperation = 'destination-in';
        patternCtx.drawImage(pm, 0, 0);
      } else if (isOnesie) {
        ctx.restore();
        return canvas;
      }
    } else {
      patternCtx.globalCompositeOperation = 'destination-out';
      patternCtx.drawImage(maskImage, 0, 0, patternArea.width, patternArea.height);
    }
    ctx.globalCompositeOperation = blendModeMap[template.blendMode || 'normal'] || 'source-over';
    ctx.globalAlpha = template.opacity ?? 1;
    ctx.drawImage(patternCanvas, patternArea.x, patternArea.y);

  } else {
    // No mask — direct blend
    ctx.globalCompositeOperation = blendModeMap[template.blendMode || 'normal'] || 'source-over';
    ctx.globalAlpha = template.opacity ?? 1;
    ctx.drawImage(patternCanvas, patternArea.x, patternArea.y);
  }

  ctx.restore();
  return canvas;
}
