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
  /** Pre-loaded extra shadow overlays stacked on top of shadowImage, each at multiply. */
  additionalShadowImages?: HTMLImageElement[];
  /** Per-additional-shadow opacities (parallel array). */
  additionalShadowOpacities?: number[];
  /** Pre-loaded highlight overlay (RGBA, canvas-sized). Composited soft-light on top. */
  highlightImage?: HTMLImageElement;
  /** Pre-loaded extra highlight overlays stacked on top of highlightImage, each at soft-light. */
  additionalHighlightImages?: HTMLImageElement[];
  /** Per-additional-highlight opacities (parallel array). */
  additionalHighlightOpacities?: number[];
  /** Runtime override for shadow opacity. Wins over template.shadowOpacity. */
  shadowOpacityOverride?: number;
  /** Runtime override for highlight opacity. Wins over template.highlightOpacity. */
  highlightOpacityOverride?: number;
  /** Runtime toggle for primary shadow layer. When false, that layer is skipped. Default true. */
  shadowEnabled?: boolean;
  /** Runtime toggle for primary highlight layer. When false, that layer is skipped. Default true. */
  highlightEnabled?: boolean;
  /** Per-additional-shadow opacity overrides (parallel to additionalShadowImages).
   *  Falls back to additionalShadowOpacities → shadowOpacity default. */
  additionalShadowOpacityOverrides?: number[];
  /** Per-additional-shadow toggles (parallel to additionalShadowImages). When false, that layer is skipped. */
  additionalShadowEnableds?: boolean[];
  /** Per-additional-highlight opacity overrides (parallel to additionalHighlightImages). */
  additionalHighlightOpacityOverrides?: number[];
  /** Per-additional-highlight toggles (parallel to additionalHighlightImages). */
  additionalHighlightEnableds?: boolean[];
  /** Runtime toggle for color overlay layer. When false, color overlay is skipped. Default true. */
  colorOverlayEnabled?: boolean;
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
    } else if (offsetX !== 0 || offsetY !== 0) {
      // No rotation, but a phase shift is wanted (e.g. knot zone vs tie body).
      // Tile to a padded oversized canvas, then draw it shifted into the zone.
      const offsetPad = Math.max(Math.abs(offsetX), Math.abs(offsetY));
      const overW = patternArea.width + 2 * offsetPad;
      const overH = patternArea.height + 2 * offsetPad;
      const oversized = document.createElement('canvas');
      oversized.width = overW;
      oversized.height = overH;
      const overTiler = new PatternTiler(oversized.getContext('2d')!, overW, overH);
      overTiler.renderPreScaled(scaledTile, repeatType);
      tileCtx.drawImage(oversized, -offsetPad + offsetX, -offsetPad + offsetY);
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
        patternAngle: template.patternAngle,
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
  // Applied BEFORE lighting so the accent color gets the same lighting treatment
  // as the rest of the mockup (matches V1 compositing order).
  if (template.colorOverlay && input.colorOverlayMaskImage && input.colorOverlayEnabled !== false) {
    const overlayMask = input.colorOverlayMaskImage;
    const accentColor = input.colorOverride
      ?? (template.colorOverlay.defaultColor === 'auto'
        ? extractDominantColor(patternImage)
        : template.colorOverlay.defaultColor);

    // Convert overlay mask to alpha mask, handling both formats
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = width;
    maskCanvas.height = height;
    const maskCtx = maskCanvas.getContext('2d')!;
    maskCtx.drawImage(overlayMask, 0, 0, width, height);
    const maskData = maskCtx.getImageData(0, 0, width, height);
    const md = maskData.data;
    const overlayTotal = md.length / 4;
    let overlayTransparent = 0;
    for (let i = 3; i < md.length; i += 4) {
      if (md[i] < 10) overlayTransparent++;
    }
    const isOverlayAlphaMask = overlayTransparent / overlayTotal > 0.1;
    for (let i = 0; i < md.length; i += 4) {
      let finalAlpha: number;
      if (isOverlayAlphaMask) {
        finalAlpha = md[i + 3];
      } else {
        finalAlpha = Math.round((md[i] + md[i + 1] + md[i + 2]) / 3);
      }
      md[i] = 0; md[i + 1] = 0; md[i + 2] = 0;
      md[i + 3] = finalAlpha;
    }
    maskCtx.putImageData(maskData, 0, 0);

    // Extract shading from product base (contrast-boosted luminance)
    const shadingLayer = document.createElement('canvas');
    shadingLayer.width = width;
    shadingLayer.height = height;
    const shadingCtx = shadingLayer.getContext('2d')!;
    shadingCtx.drawImage(productCanvas, 0, 0);
    const shadingData = shadingCtx.getImageData(0, 0, width, height);
    const sd = shadingData.data;
    const contrast = 1.15;
    for (let i = 0; i < sd.length; i += 4) {
      const lum = (sd[i] + sd[i + 1] + sd[i + 2]) / 3;
      const boosted = Math.min(255, Math.max(0, (lum - 128) * contrast + 128));
      sd[i] = boosted;
      sd[i + 1] = boosted;
      sd[i + 2] = boosted;
    }
    shadingCtx.putImageData(shadingData, 0, 0);
    shadingCtx.globalCompositeOperation = 'destination-in';
    shadingCtx.drawImage(maskCanvas, 0, 0);

    // Build color layer: accent color × shading, masked to accent region
    const colorLayer = document.createElement('canvas');
    colorLayer.width = width;
    colorLayer.height = height;
    const colorCtx = colorLayer.getContext('2d')!;
    colorCtx.fillStyle = accentColor;
    colorCtx.fillRect(0, 0, width, height);
    colorCtx.globalCompositeOperation = 'multiply';
    colorCtx.drawImage(shadingLayer, 0, 0);
    colorCtx.globalCompositeOperation = 'destination-in';
    colorCtx.drawImage(maskCanvas, 0, 0);

    // Multiply blends accent color into the photo — preserves shadows/folds
    finalCtx.globalCompositeOperation = 'multiply';
    finalCtx.globalAlpha = 1;
    finalCtx.drawImage(colorLayer, 0, 0);

    // Gentle soft-light pass from original photo to restore subtle highlights
    const photoHighlightLayer = document.createElement('canvas');
    photoHighlightLayer.width = width;
    photoHighlightLayer.height = height;
    const phCtx = photoHighlightLayer.getContext('2d')!;
    phCtx.drawImage(productCanvas, 0, 0);
    phCtx.globalCompositeOperation = 'destination-in';
    phCtx.drawImage(maskCanvas, 0, 0);

    finalCtx.globalCompositeOperation = 'soft-light';
    finalCtx.globalAlpha = 0.3;
    finalCtx.drawImage(photoHighlightLayer, 0, 0);
    finalCtx.globalCompositeOperation = 'source-over';
    finalCtx.globalAlpha = 1;
  }

  // --- Lighting overlay ---
  // Suppressed when an explicit highlight overlay is provided — the highlight PNG
  // already encodes the photo's lighting intent, so we don't want to double-light.
  if (lighting.enabled && lighting.intensity > 0 && !input.highlightImage && !input.additionalHighlightImages?.length) {
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
  // Primary and additional shadow layers are toggled INDEPENDENTLY so multi-region
  // templates (e.g. mens-tie / jacket) can show/hide each shadow region separately.
  {
    const shadowDefault = template.shadowOpacity ?? 0.5;
    if (input.shadowImage && input.shadowEnabled !== false) {
      finalCtx.globalCompositeOperation = 'multiply';
      finalCtx.globalAlpha = input.shadowOpacityOverride ?? shadowDefault;
      finalCtx.drawImage(input.shadowImage, 0, 0, width, height);
    }
    if (input.additionalShadowImages) {
      for (let i = 0; i < input.additionalShadowImages.length; i++) {
        if (input.additionalShadowEnableds?.[i] === false) continue;
        const op = input.additionalShadowOpacityOverrides?.[i]
          ?? input.additionalShadowOpacities?.[i]
          ?? shadowDefault;
        finalCtx.globalCompositeOperation = 'multiply';
        finalCtx.globalAlpha = op;
        finalCtx.drawImage(input.additionalShadowImages[i], 0, 0, width, height);
      }
    }
    finalCtx.globalCompositeOperation = 'source-over';
    finalCtx.globalAlpha = 1;
  }

  // --- Highlight overlay (soft-light, top of stack) ---
  {
    const highlightDefault = template.highlightOpacity ?? 0.5;
    if (input.highlightImage && input.highlightEnabled !== false) {
      finalCtx.globalCompositeOperation = 'soft-light';
      finalCtx.globalAlpha = input.highlightOpacityOverride ?? highlightDefault;
      finalCtx.drawImage(input.highlightImage, 0, 0, width, height);
    }
    if (input.additionalHighlightImages) {
      for (let i = 0; i < input.additionalHighlightImages.length; i++) {
        if (input.additionalHighlightEnableds?.[i] === false) continue;
        const op = input.additionalHighlightOpacityOverrides?.[i]
          ?? input.additionalHighlightOpacities?.[i]
          ?? highlightDefault;
        finalCtx.globalCompositeOperation = 'soft-light';
        finalCtx.globalAlpha = op;
        finalCtx.drawImage(input.additionalHighlightImages[i], 0, 0, width, height);
      }
    }
    finalCtx.globalCompositeOperation = 'source-over';
    finalCtx.globalAlpha = 1;
  }

  return finalCanvas;
}
