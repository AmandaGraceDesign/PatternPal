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
  /** User-chosen accent color for trim/bow. When absent, auto-detect from pattern. */
  colorOverride?: string | null;
  /** Runtime override for shadow overlay opacity (0..1). When absent, uses template default. */
  shadowOpacityOverride?: number | null;
  /** Runtime override for highlight overlay opacity (0..1). When absent, uses template default. */
  highlightOpacityOverride?: number | null;
  /** Runtime toggle for the PRIMARY shadow layer. When false, that layer is skipped. */
  shadowEnabled?: boolean;
  /** Runtime toggle for the PRIMARY highlight layer. When false, that layer is skipped. */
  highlightEnabled?: boolean;
  /** Per-additional-shadow toggles (parallel to template.additionalShadowPaths). */
  additionalShadowEnableds?: boolean[];
  /** Per-additional-shadow opacity overrides (0..1). */
  additionalShadowOpacityOverrides?: number[];
  /** Per-additional-highlight toggles. */
  additionalHighlightEnableds?: boolean[];
  /** Per-additional-highlight opacity overrides (0..1). */
  additionalHighlightOpacityOverrides?: number[];
  /** Runtime toggle for color overlay. When false, color overlay layer is skipped. */
  colorOverlayEnabled?: boolean;
}

/** Loads an image from a URL path, returns null on failure. */
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Module-level cache of in-flight and resolved image loads, keyed by URL.
 * Templates re-render frequently (every scale, opacity, or color tweak); without
 * this cache each render re-decodes every PNG (some 10-15 MB), which dominates
 * render time. The cache holds the Promise so concurrent callers de-dupe too.
 */
const imageCache = new Map<string, Promise<HTMLImageElement | null>>();
function cachedLoadImage(src: string): Promise<HTMLImageElement | null> {
  const existing = imageCache.get(src);
  if (existing) return existing;
  const p = loadImage(src);
  imageCache.set(src, p);
  return p;
}

export default function MockupRendererV2({
  template,
  patternImage,
  tileWidth,
  tileHeight,
  dpi,
  repeatType,
  onClick,
  colorOverride,
  shadowOpacityOverride,
  highlightOpacityOverride,
  shadowEnabled,
  highlightEnabled,
  additionalShadowEnableds,
  additionalShadowOpacityOverrides,
  additionalHighlightEnableds,
  additionalHighlightOpacityOverrides,
  colorOverlayEnabled,
}: MockupRendererV2Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRendering, setIsRendering] = useState(false);

  useEffect(() => {
    if (!patternImage || !canvasRef.current) return;

    let cancelled = false;
    setIsRendering(true);

    (async () => {
      try {
        // Load all template assets in parallel (cached after first load).
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

        if (cancelled) return;

        const resultCanvas = runPipeline({
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
          colorOverride: colorOverride ?? undefined,
          displacementMapImage: displacementMapImage || undefined,
          shadowImage: shadowImage || undefined,
          additionalShadowImages: additionalShadowImages.length > 0 ? additionalShadowImages : undefined,
          additionalShadowOpacities: template.additionalShadowOpacities,
          highlightImage: highlightImage || undefined,
          additionalHighlightImages: additionalHighlightImages.length > 0 ? additionalHighlightImages : undefined,
          additionalHighlightOpacities: template.additionalHighlightOpacities,
          shadowOpacityOverride: shadowOpacityOverride ?? undefined,
          highlightOpacityOverride: highlightOpacityOverride ?? undefined,
          shadowEnabled: shadowEnabled,
          highlightEnabled: highlightEnabled,
          additionalShadowEnableds,
          additionalShadowOpacityOverrides,
          additionalHighlightEnableds,
          additionalHighlightOpacityOverrides,
          colorOverlayEnabled,
        });

        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;

        canvas.width = resultCanvas.width;
        canvas.height = resultCanvas.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(resultCanvas, 0, 0);
      } catch (err) {
        console.error('MockupRendererV2 render error:', err);
      } finally {
        if (!cancelled) setIsRendering(false);
      }
    })();

    return () => { cancelled = true; };
  }, [
    patternImage, template, tileWidth, tileHeight, dpi, repeatType,
    colorOverride, shadowOpacityOverride, highlightOpacityOverride,
    shadowEnabled, highlightEnabled, colorOverlayEnabled,
    // Stringify array deps so identical contents don't trigger extra renders
    // even when the parent rebuilds the array on each render.
    JSON.stringify(additionalShadowEnableds),
    JSON.stringify(additionalShadowOpacityOverrides),
    JSON.stringify(additionalHighlightEnableds),
    JSON.stringify(additionalHighlightOpacityOverrides),
  ]);

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
