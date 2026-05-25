/**
 * Async wrapper around the v2 mockup pipeline. Loads all template assets
 * (product base, masks, color overlay, shadow/highlight + additionals, zone
 * masks) and returns the composited canvas. Used by the social-media export
 * tool to bake any v2 mockup onto an exported image.
 *
 * Mirrors the legacy `renderMockupOffscreen` signature so the export pipeline
 * can swap implementations cleanly. Honors the template's *DefaultEnabled
 * flags (colorOverlayDefaultEnabled, additional{Shadow,Highlight}DefaultEnableds)
 * so the social export matches the mockup view's default visual state — e.g.
 * mens-tie ships with the jacket layers off so the social export shows just
 * the tie. Everything not explicitly defaulted off stays enabled.
 */

import { runPipeline } from '@/lib/mockups/mockupEngineV2/MockupPipeline';
import { getV2Template } from '@/lib/mockups/mockupEngineV2/templates/templateRegistry';
import { scaleTemplate, computeScaleFactor } from '@/lib/mockups/mockupEngineV2/scaleTemplate';
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

/** Swap a full-res /mockups/v2/foo.png path to its 800px medium sibling.
 *  Mirrors the helper in MockupRendererV2. */
function toMediumPath(p: string): string {
  return p.replace('/mockups/v2/', '/mockups/v2/medium/');
}

interface RenderOptions {
  /** Use 800px medium-res layer set instead of full 3000×4500 PNGs. */
  preview?: boolean;
  /** Downscale template canvas so longest side ≤ this px. */
  maxRenderDimension?: number;
}

export async function renderMockupV2Offscreen(
  templateId: string,
  patternImage: HTMLImageElement,
  tileWidth: number,
  tileHeight: number,
  repeatType: RepeatType,
  dpi = 300,
  options: RenderOptions = {},
): Promise<HTMLCanvasElement> {
  const template = getV2Template(templateId);
  if (!template) {
    throw new Error(`Unknown v2 mockup template: ${templateId}`);
  }

  const { preview = false, maxRenderDimension } = options;
  const px = (p: string | null | undefined) => p && preview ? toMediumPath(p) : p;

  const productImagePath = template.productBase.type === 'image' ? px(template.productBase.imagePath) ?? null : null;
  const productMaskPath = template.productBase.type === 'image' ? px(template.productBase.maskPath) ?? null : null;
  const colorMaskPath = px(template.colorOverlay?.maskPath) ?? null;
  const displacementPath = px(template.displacementMapPath) ?? null;
  const shadowPath = px(template.shadowPath) ?? null;
  const highlightPath = px(template.highlightPath) ?? null;
  const extraShadowPaths = (template.additionalShadowPaths ?? []).map((p) => preview ? toMediumPath(p) : p);
  const extraHighlightPaths = (template.additionalHighlightPaths ?? []).map((p) => preview ? toMediumPath(p) : p);

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
      ? Promise.all(template.zones.map(async (zone) => ({ id: zone.id, img: await cachedLoadImage(preview ? toMediumPath(zone.maskPath) : zone.maskPath) })))
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

  // Per-layer enabled flags derived from template defaults. Parallel to the
  // additional{Shadow,Highlight}Images arrays; missing entries default to true.
  const shadowDefaults = template.additionalShadowDefaultEnableds ?? [];
  const highlightDefaults = template.additionalHighlightDefaultEnableds ?? [];
  const additionalShadowEnableds = additionalShadowImages.map((_, i) => shadowDefaults[i] ?? true);
  const additionalHighlightEnableds = additionalHighlightImages.map((_, i) => highlightDefaults[i] ?? true);

  // Optionally downscale the template canvas — saves pipeline work for live
  // social-export previews where the destination is only a few hundred px.
  const scaleFactor = maxRenderDimension ? computeScaleFactor(template, maxRenderDimension) : 1;
  const renderTemplate = scaleFactor < 1 ? scaleTemplate(template, scaleFactor) : template;

  return runPipeline({
    patternImage,
    template: renderTemplate,
    repeatType,
    dpi,
    tileWidth,
    tileHeight,
    zoneMasks: Object.keys(zoneMasks).length > 0 ? zoneMasks : undefined,
    productBaseImage: productBaseImage || undefined,
    productMaskImage: productMaskImage || undefined,
    colorOverlayMaskImage: colorOverlayMaskImage || undefined,
    colorOverlayEnabled: template.colorOverlayDefaultEnabled ?? true,
    displacementMapImage: displacementMapImage || undefined,
    shadowImage: shadowImage || undefined,
    additionalShadowImages: additionalShadowImages.length > 0 ? additionalShadowImages : undefined,
    additionalShadowOpacities: template.additionalShadowOpacities,
    additionalShadowEnableds: additionalShadowEnableds.length > 0 ? additionalShadowEnableds : undefined,
    highlightImage: highlightImage || undefined,
    additionalHighlightImages: additionalHighlightImages.length > 0 ? additionalHighlightImages : undefined,
    additionalHighlightOpacities: template.additionalHighlightOpacities,
    additionalHighlightEnableds: additionalHighlightEnableds.length > 0 ? additionalHighlightEnableds : undefined,
  });
}
