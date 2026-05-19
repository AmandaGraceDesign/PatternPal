import { PatternTiler } from '../../tiling/PatternTiler';
import type { RepeatType } from '../../tiling/PatternTiler';
import type { MockupV2Template, MockupZone, BlendMode } from './templates/types';
import { applyPerspective } from './stages/perspectiveWarp';
import { generateDisplacementMap, applyDisplacement } from './stages/displacementMap';
import { generateProductBase, compositeResult } from './stages/blendComposite';

/** Extract dominant background color from a pattern image (same approach as V1). */
export function extractDominantColor(img: HTMLImageElement | HTMLCanvasElement): string {
  const sampleSize = 48;
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = sampleSize;
  tempCanvas.height = sampleSize;
  const tempCtx = tempCanvas.getContext('2d');
  if (!tempCtx) return '#ffffff';

  tempCtx.drawImage(img, 0, 0, sampleSize, sampleSize);
  const { data } = tempCtx.getImageData(0, 0, sampleSize, sampleSize);

  const step = 16;
  const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 10) continue;
    const qr = Math.min(255, Math.round(data[i] / step) * step);
    const qg = Math.min(255, Math.round(data[i + 1] / step) * step);
    const qb = Math.min(255, Math.round(data[i + 2] / step) * step);
    const key = `${qr},${qg},${qb}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.count++;
    else buckets.set(key, { count: 1, r: qr, g: qg, b: qb });
  }

  let best = { count: 0, r: 255, g: 255, b: 255 };
  for (const b of buckets.values()) {
    if (b.count > best.count) best = b;
  }
  if (best.count === 0) return '#ffffff';
  return '#' + [best.r, best.g, best.b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.startsWith('#') ? hex.slice(1) : hex;
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  return {
    r: parseInt(full.slice(0, 2), 16) || 0,
    g: parseInt(full.slice(2, 4), 16) || 0,
    b: parseInt(full.slice(4, 6), 16) || 0,
  };
}

/** RGB → HSL. h in degrees [0,360), s and l in [0,1]. */
function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: h * 60, s, l };
}

/** HSL → RGB. h in degrees, s and l in [0,1]. */
function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const hn = ((h % 360) + 360) % 360 / 360;
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: Math.round(hue2rgb(p, q, hn + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, hn) * 255),
    b: Math.round(hue2rgb(p, q, hn - 1 / 3) * 255),
  };
}

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
  /** Pre-loaded color overlay mask image (for accent regions like trim/bow). */
  colorOverlayMaskImage?: HTMLImageElement;
  /** User-chosen accent color override. When absent, auto-detect from pattern. */
  colorOverride?: string | null;
  /** Pre-loaded photo-based displacement map (grayscale, canvas-sized). */
  displacementMapImage?: HTMLImageElement;
  /** Pre-loaded shadow overlay (RGBA, canvas-sized). Composited multiply on top. */
  shadowImage?: HTMLImageElement;
  /** Pre-loaded highlight overlay (RGBA, canvas-sized). Composited soft-light on top. */
  highlightImage?: HTMLImageElement;
  /** Runtime override for shadow opacity. Wins over template.shadowOpacity. */
  shadowOpacityOverride?: number;
  /** Runtime override for highlight opacity. Wins over template.highlightOpacity. */
  highlightOpacityOverride?: number;
  /** Runtime toggle for shadow layer. When false, shadow is skipped entirely. Default true. */
  shadowEnabled?: boolean;
  /** Runtime toggle for highlight layer. When false, highlight is skipped entirely. Default true. */
  highlightEnabled?: boolean;
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
    perspective: { topSqueeze: number; bottomSqueeze: number; rightSqueeze?: number };
    displacement: { intensity: number; wrinkleFreq: number; type: string };
    foreshorten?: number;
    patternAngle?: number;
    patternOffset?: { x: number; y: number };
  },
  canvasWidth: number,
  canvasHeight: number,
  physicalWidth: number,
  tileWidthInches: number,
  tileHeightInches: number,
  repeatType: RepeatType,
  maskImage?: HTMLImageElement,
  /** Pre-tiled canvas covering sharedPatternArea. When provided, zone extracts its
   *  sub-region instead of tiling independently — gives continuous pattern across zones. */
  sharedTiledCanvas?: HTMLCanvasElement,
  sharedPatternArea?: { x: number; y: number; width: number; height: number },
  /** Photo-based displacement map (full canvas size). When provided, the zone's
   *  sub-region is extracted instead of generating procedural displacement. */
  displacementMapImage?: HTMLImageElement,
): HTMLCanvasElement {
  const { patternArea, perspective, displacement } = zone;

  // --- Stage 1: Tile Pattern ---
  const tileCanvas = document.createElement('canvas');
  tileCanvas.width = patternArea.width;
  tileCanvas.height = patternArea.height;
  const tileCtx = tileCanvas.getContext('2d')!;

  if (sharedTiledCanvas && sharedPatternArea) {
    // Extract this zone's sub-region from the shared tile
    const offsetX = patternArea.x - sharedPatternArea.x;
    const offsetY = patternArea.y - sharedPatternArea.y;
    const foreshortenFactor = zone.foreshorten ?? 1;
    // When foreshortened, sample more vertical rows and compress into zone height
    const sampleHeight = Math.round(patternArea.height * foreshortenFactor);
    tileCtx.drawImage(
      sharedTiledCanvas,
      offsetX, offsetY, patternArea.width, sampleHeight,
      0, 0, patternArea.width, patternArea.height
    );
  } else {
    // Scale tile to physically accurate size:
    // How many tiles fit across the mockup's physical width?
    const repeatsX = physicalWidth / tileWidthInches;
    // Each tile occupies this many pixels in the pattern area
    const scaledW = Math.round(patternArea.width / repeatsX) || 1;
    // Maintain tile aspect ratio
    const tileAspect = tileWidthInches / tileHeightInches;
    const scaledH = Math.round(scaledW / tileAspect) || 1;

    const scaledTile = document.createElement('canvas');
    scaledTile.width = scaledW;
    scaledTile.height = scaledH;
    const scaledCtx = scaledTile.getContext('2d')!;
    scaledCtx.drawImage(patternImage, 0, 0, scaledW, scaledH);

    const angleDeg = zone.patternAngle ?? 0;
    const offsetX = zone.patternOffset?.x ?? 0;
    const offsetY = zone.patternOffset?.y ?? 0;
    if (angleDeg !== 0) {
      // Tile to an oversized canvas (sqrt(2)x + offset padding) so rotation +
      // optional pre-rotation pattern shift both have full coverage, then draw
      // the rotated result into the patternArea-sized tileCanvas.
      const offsetPad = Math.max(Math.abs(offsetX), Math.abs(offsetY));
      const over = Math.ceil(Math.SQRT2 * Math.max(patternArea.width, patternArea.height) + 2 * offsetPad);
      const oversized = document.createElement('canvas');
      oversized.width = over;
      oversized.height = over;
      const overCtx = oversized.getContext('2d')!;
      const overTiler = new PatternTiler(overCtx, over, over);
      overTiler.renderPreScaled(scaledTile, repeatType);

      tileCtx.save();
      tileCtx.translate(patternArea.width / 2, patternArea.height / 2);
      tileCtx.rotate((angleDeg * Math.PI) / 180);
      tileCtx.drawImage(oversized, -over / 2 + offsetX, -over / 2 + offsetY);
      tileCtx.restore();
    } else {
      const tiler = new PatternTiler(tileCtx, patternArea.width, patternArea.height);
      tiler.renderPreScaled(scaledTile, repeatType);
    }
  }

  // --- Stage 2: Perspective Warp ---
  const perspCanvas = document.createElement('canvas');
  perspCanvas.width = patternArea.width;
  perspCanvas.height = patternArea.height;
  const perspCtx = perspCanvas.getContext('2d')!;
  applyPerspective(
    tileCanvas, perspCtx,
    patternArea.width, patternArea.height,
    perspective.topSqueeze, perspective.bottomSqueeze,
    perspective.rightSqueeze ?? 0,
  );

  // --- Stage 3: Displacement ---
  const dispMapCanvas = document.createElement('canvas');
  dispMapCanvas.width = patternArea.width;
  dispMapCanvas.height = patternArea.height;
  const dispMapCtx = dispMapCanvas.getContext('2d')!;
  if (displacementMapImage) {
    // Photo-based: extract zone's sub-region from the full-canvas displacement map
    dispMapCtx.drawImage(
      displacementMapImage,
      patternArea.x, patternArea.y, patternArea.width, patternArea.height,
      0, 0, patternArea.width, patternArea.height,
    );
  } else {
    // Procedural fallback
    generateDisplacementMap(
      dispMapCtx,
      patternArea.width, patternArea.height,
      displacement.type as any, displacement.wrinkleFreq
    );
  }

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
    // If mask matches canvas size, extract the zone's sub-region.
    // If mask is a different size (e.g. 832 vs 1024), scale the full mask to fit.
    const maskW = maskImage.naturalWidth || maskImage.width;
    const maskH = maskImage.naturalHeight || maskImage.height;
    if (maskW >= patternArea.x + patternArea.width && maskH >= patternArea.y + patternArea.height) {
      maskCtx.drawImage(
        maskImage,
        patternArea.x, patternArea.y, patternArea.width, patternArea.height,
        0, 0, patternArea.width, patternArea.height
      );
    } else {
      // Mask is smaller or differently sized — scale full mask to pattern area
      maskCtx.drawImage(maskImage, 0, 0, patternArea.width, patternArea.height);
    }

    // Convert mask to alpha mask, handling both formats:
    // - B/W masks (onesie, tshirt-dress zones): white = pattern area → use luminance as alpha
    // - Alpha masks (fabric-swatch, pillow, journal): transparent = pattern area → invert alpha
    // Detection: if >10% of pixels are fully transparent, it's an alpha-based mask.
    // B/W masks may have a few anti-aliased edge pixels but the bulk is opaque.
    const maskData = maskCtx.getImageData(0, 0, patternArea.width, patternArea.height);
    const md = maskData.data;
    const totalPixels = md.length / 4;
    let transparentCount = 0;
    for (let i = 3; i < md.length; i += 4) {
      if (md[i] < 10) transparentCount++;
    }
    const isAlphaMask = transparentCount / totalPixels > 0.1;
    for (let i = 0; i < md.length; i += 4) {
      const originalAlpha = md[i + 3];
      let finalAlpha: number;
      if (isAlphaMask) {
        // Alpha mask: transparent = show pattern, opaque = hide pattern → invert
        finalAlpha = 255 - originalAlpha;
      } else {
        // B/W mask: white = show pattern, black = hide → use luminance
        const luminance = md[i] * 0.299 + md[i + 1] * 0.587 + md[i + 2] * 0.114;
        finalAlpha = Math.round(luminance);
      }
      md[i] = 255;
      md[i + 1] = 255;
      md[i + 2] = 255;
      md[i + 3] = finalAlpha;
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
    // Pre-tile shared pattern if sharedPatternArea is defined (continuous pattern across zones)
    let sharedTiledCanvas: HTMLCanvasElement | undefined;
    if (template.sharedPatternArea) {
      const spa = template.sharedPatternArea;
      sharedTiledCanvas = document.createElement('canvas');
      sharedTiledCanvas.width = spa.width;
      sharedTiledCanvas.height = spa.height;

      const repeatsX = template.physicalSize.width / tileWidth;
      const scaledW = Math.round(spa.width / repeatsX) || 1;
      const tileAspect = tileWidth / tileHeight;
      const scaledH = Math.round(scaledW / tileAspect) || 1;

      const scaledTile = document.createElement('canvas');
      scaledTile.width = scaledW;
      scaledTile.height = scaledH;
      scaledTile.getContext('2d')!.drawImage(patternImage, 0, 0, scaledW, scaledH);

      const sharedCtx = sharedTiledCanvas.getContext('2d')!;
      const sharedTiler = new PatternTiler(sharedCtx, spa.width, spa.height);
      sharedTiler.renderPreScaled(scaledTile, repeatType);
    }

    // Multi-zone: process each zone and composite
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
        tileWidth,
        tileHeight,
        repeatType,
        maskImg,
        sharedTiledCanvas,
        template.sharedPatternArea,
        input.displacementMapImage,
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
      tileWidth,
      tileHeight,
      repeatType,
      singleMask,
      undefined,
      undefined,
      input.displacementMapImage,
    );

    finalCtx.globalCompositeOperation = template.blend.mode;
    finalCtx.globalAlpha = template.blend.opacity;
    finalCtx.drawImage(zoneResult, 0, 0);
  }

  // Reset composite state
  finalCtx.globalCompositeOperation = 'source-over';
  finalCtx.globalAlpha = 1;

  // --- Color overlay (accent regions like trim, bows) ---
  // Photoshop-style "Hue/Saturation with Colorize + lightness offset":
  // 1. Take the chosen color's target H, S, L.
  // 2. Sample the masked region's average L from the underlying photo.
  // 3. For each masked pixel: force H and S to target, shift L by
  //    (target_L − region_avg_L). L variance (texture/folds) is preserved.
  // Avoids 'multiply' (muddy darkening) and 'color' blend (fluorescent
  // blowout on bright neutrals) by recomputing the pixel in HSL space.
  if (template.colorOverlay && input.colorOverlayMaskImage) {
    const overlayMask = input.colorOverlayMaskImage;
    const accentColor = input.colorOverride
      ?? (template.colorOverlay.defaultColor === 'auto'
        ? extractDominantColor(patternImage)
        : template.colorOverlay.defaultColor);

    const targetRgb = hexToRgb(accentColor);
    const targetHsl = rgbToHsl(targetRgb.r, targetRgb.g, targetRgb.b);
    // Lightness-aware saturation roll-off: bright targets (pastels) get
    // desaturated so they don't render as neon trim. Dark targets keep
    // full saturation, so the dark-olive-on-cream case still pops.
    const effectiveS = targetHsl.s * (1 - 0.7 * Math.max(0, targetHsl.l - 0.4));

    // Rasterize overlay mask at canvas size
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = width;
    maskCanvas.height = height;
    const maskCtx = maskCanvas.getContext('2d')!;
    maskCtx.drawImage(overlayMask, 0, 0, width, height);
    const maskRaw = maskCtx.getImageData(0, 0, width, height).data;

    // Detect alpha-based vs B/W mask format
    let overlayTransparent = 0;
    for (let i = 3; i < maskRaw.length; i += 4) {
      if (maskRaw[i] < 10) overlayTransparent++;
    }
    const isOverlayAlphaMask = overlayTransparent / (maskRaw.length / 4) > 0.1;

    // Underlying photo pixels feed both the avg-L sample and the per-pixel L
    const prodRaw = productCtx.getImageData(0, 0, width, height).data;

    // Pass 1: weighted average L of the masked region from the photo
    let totalL = 0, totalWeight = 0;
    for (let i = 0; i < maskRaw.length; i += 4) {
      const maskAlpha = isOverlayAlphaMask
        ? maskRaw[i + 3]
        : (maskRaw[i] + maskRaw[i + 1] + maskRaw[i + 2]) / 3;
      if (maskAlpha < 10) continue;
      const { l } = rgbToHsl(prodRaw[i], prodRaw[i + 1], prodRaw[i + 2]);
      const w = maskAlpha / 255;
      totalL += l * w;
      totalWeight += w;
    }
    const avgL = totalWeight > 0 ? totalL / totalWeight : 0.5;
    const lOffset = targetHsl.l - avgL;

    // Pass 2: build the recolored layer
    const colorizedCanvas = document.createElement('canvas');
    colorizedCanvas.width = width;
    colorizedCanvas.height = height;
    const colorizedCtx = colorizedCanvas.getContext('2d')!;
    const out = colorizedCtx.createImageData(width, height);
    const od = out.data;
    for (let i = 0; i < maskRaw.length; i += 4) {
      const maskAlpha = isOverlayAlphaMask
        ? maskRaw[i + 3]
        : (maskRaw[i] + maskRaw[i + 1] + maskRaw[i + 2]) / 3;
      if (maskAlpha < 1) continue;
      const { l } = rgbToHsl(prodRaw[i], prodRaw[i + 1], prodRaw[i + 2]);
      const newL = Math.max(0, Math.min(1, l + lOffset));
      const { r, g, b } = hslToRgb(targetHsl.h, effectiveS, newL);
      od[i] = r;
      od[i + 1] = g;
      od[i + 2] = b;
      od[i + 3] = Math.round(maskAlpha);
    }
    colorizedCtx.putImageData(out, 0, 0);

    // Replace the photo's pixels in the accent region
    finalCtx.globalCompositeOperation = 'source-over';
    finalCtx.globalAlpha = 1;
    finalCtx.drawImage(colorizedCanvas, 0, 0);
  }

  // --- Lighting overlay ---
  // Suppressed when an explicit highlight overlay is provided — the highlight PNG
  // already encodes the photo's lighting intent, so we don't want to double-light.
  if (lighting.enabled && lighting.intensity > 0 && !input.highlightImage) {
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

  // --- Shadow overlay (multiply, top of stack) ---
  if (input.shadowImage && input.shadowEnabled !== false) {
    finalCtx.globalCompositeOperation = 'multiply';
    finalCtx.globalAlpha = input.shadowOpacityOverride ?? template.shadowOpacity ?? 0.5;
    finalCtx.drawImage(input.shadowImage, 0, 0, width, height);
    finalCtx.globalCompositeOperation = 'source-over';
    finalCtx.globalAlpha = 1;
  }

  // --- Highlight overlay (soft-light, top of stack) ---
  if (input.highlightImage && input.highlightEnabled !== false) {
    finalCtx.globalCompositeOperation = 'soft-light';
    finalCtx.globalAlpha = input.highlightOpacityOverride ?? template.highlightOpacity ?? 0.5;
    finalCtx.drawImage(input.highlightImage, 0, 0, width, height);
    finalCtx.globalCompositeOperation = 'source-over';
    finalCtx.globalAlpha = 1;
  }

  return finalCanvas;
}
