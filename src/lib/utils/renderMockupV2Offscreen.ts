/**
 * Async wrapper around the v2 mockup pipeline. Loads all template assets
 * (product base, masks, color overlay, shadow/highlight + additionals, zone
 * masks) and returns the composited canvas. Used by the social-media export
 * tool to bake any v2 mockup onto an exported image.
 *
 * Mirrors the legacy `renderMockupOffscreen` signature so the export pipeline
 * can swap implementations cleanly. Defaults all runtime toggles to "enabled"
 * — the social export doesn't expose per-layer controls.
 */

import { runPipeline } from '@/lib/mockups/mockupEngineV2/MockupPipeline';
import { getV2Template } from '@/lib/mockups/mockupEngineV2/templates/templateRegistry';
import type { RepeatType } from '@/lib/tiling/PatternTiler';

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

const imageCache = new Map<string, Promise<HTMLImageElement | null>>();
function cachedLoadImage(src: string): Promise<HTMLImageElement | null> {
  const existing = imageCache.get(src);
  if (existing) return existing;
  const p = loadImage(src);
  imageCache.set(src, p);
  return p;
}

export async function renderMockupV2Offscreen(
  templateId: string,
  patternImage: HTMLImageElement,
  tileWidth: number,
  tileHeight: number,
  repeatType: RepeatType,
  dpi = 300,
): Promise<HTMLCanvasElement> {
  const template = getV2Template(templateId);
  if (!template) {
    throw new Error(`Unknown v2 mockup template: ${templateId}`);
  }

  const productImagePath = template.productBase.type === 'image' ? template.productBase.imagePath : null;
  const productMaskPath = template.productBase.type === 'image' ? template.productBase.maskPath ?? null : null;
  const colorMaskPath = template.colorOverlay?.maskPath ?? null;
  const displacementPath = template.displacementMapPath ?? null;
  const shadowPath = template.shadowPath ?? null;
  const highlightPath = template.highlightPath ?? null;
  const extraShadowPaths = template.additionalShadowPaths ?? [];
  const extraHighlightPaths = template.additionalHighlightPaths ?? [];

  const [
    productBaseImage,
    productMaskImage,
    colorOverlayMaskImage,
    displacementMapImage,
    shadowImage,
    highlightImage,
    zoneMaskResults,
    extraShadowResults,
    extraHighlightResults,
  ] = await Promise.all([
    productImagePath ? cachedLoadImage(productImagePath) : Promise.resolve(null),
    productMaskPath ? cachedLoadImage(productMaskPath) : Promise.resolve(null),
    colorMaskPath ? cachedLoadImage(colorMaskPath) : Promise.resolve(null),
    displacementPath ? cachedLoadImage(displacementPath) : Promise.resolve(null),
    shadowPath ? cachedLoadImage(shadowPath) : Promise.resolve(null),
    highlightPath ? cachedLoadImage(highlightPath) : Promise.resolve(null),
    template.zones
      ? Promise.all(template.zones.map(async (zone) => ({ id: zone.id, img: await cachedLoadImage(zone.maskPath) })))
      : Promise.resolve([] as Array<{ id: string; img: HTMLImageElement | null }>),
    Promise.all(extraShadowPaths.map(p => cachedLoadImage(p))),
    Promise.all(extraHighlightPaths.map(p => cachedLoadImage(p))),
  ]);

  const additionalShadowImages = extraShadowResults.filter((i): i is HTMLImageElement => !!i);
  const additionalHighlightImages = extraHighlightResults.filter((i): i is HTMLImageElement => !!i);

  const zoneMasks: Record<string, HTMLImageElement> = {};
  for (const { id, img } of zoneMaskResults) {
    if (img) zoneMasks[id] = img;
  }

  return runPipeline({
    patternImage,
    template,
    repeatType,
    dpi,
    tileWidth,
    tileHeight,
    zoneMasks: Object.keys(zoneMasks).length > 0 ? zoneMasks : undefined,
    productBaseImage: productBaseImage || undefined,
    productMaskImage: productMaskImage || undefined,
    colorOverlayMaskImage: colorOverlayMaskImage || undefined,
    displacementMapImage: displacementMapImage || undefined,
    shadowImage: shadowImage || undefined,
    additionalShadowImages: additionalShadowImages.length > 0 ? additionalShadowImages : undefined,
    additionalShadowOpacities: template.additionalShadowOpacities,
    highlightImage: highlightImage || undefined,
    additionalHighlightImages: additionalHighlightImages.length > 0 ? additionalHighlightImages : undefined,
    additionalHighlightOpacities: template.additionalHighlightOpacities,
  });
}
