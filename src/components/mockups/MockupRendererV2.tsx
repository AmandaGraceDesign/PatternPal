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
  /** When true, pointer drag on the canvas shifts the pattern tiles (drag-to-position).
   *  Default false so gallery thumbnails keep their plain click behaviour. */
  dragEnabled?: boolean;
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
  dragEnabled = false,
}: MockupRendererV2Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isRendering, setIsRendering] = useState(false);

  // Drag-to-position: committed offset triggers a real pipeline re-render;
  // liveDelta is applied as a CSS transform during drag for 60fps feedback.
  const [committedOffset, setCommittedOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [liveDelta, setLiveDelta] = useState<{ x: number; y: number } | null>(null);
  const dragStartRef = useRef<{ clientX: number; clientY: number; pointerId: number } | null>(null);
  const wasDragRef = useRef(false);

  // Reset position when the template changes (different mockup selected).
  useEffect(() => {
    setCommittedOffset({ x: 0, y: 0 });
    setLiveDelta(null);
    dragStartRef.current = null;
  }, [template]);

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
          patternOffsetOverride: (committedOffset.x !== 0 || committedOffset.y !== 0)
            ? committedOffset
            : undefined,
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
    committedOffset.x, committedOffset.y,
    // Stringify array deps so identical contents don't trigger extra renders
    // even when the parent rebuilds the array on each render.
    JSON.stringify(additionalShadowEnableds),
    JSON.stringify(additionalShadowOpacityOverrides),
    JSON.stringify(additionalHighlightEnableds),
    JSON.stringify(additionalHighlightOpacityOverrides),
  ]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only primary button / touch / pen — ignore right-click etc.
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    dragStartRef.current = { clientX: e.clientX, clientY: e.clientY, pointerId: e.pointerId };
    wasDragRef.current = false;
    setLiveDelta({ x: 0, y: 0 });
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = dragStartRef.current;
    if (!start || start.pointerId !== e.pointerId) return;
    const dx = e.clientX - start.clientX;
    const dy = e.clientY - start.clientY;
    if (!wasDragRef.current && Math.abs(dx) + Math.abs(dy) > 5) {
      wasDragRef.current = true;
    }
    setLiveDelta({ x: dx, y: dy });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = dragStartRef.current;
    if (!start || start.pointerId !== e.pointerId) return;
    const cssDx = e.clientX - start.clientX;
    const cssDy = e.clientY - start.clientY;
    dragStartRef.current = null;
    try {
      (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
    } catch {}

    if (wasDragRef.current) {
      // Convert CSS-space drag to pattern-space (canvas-internal) pixels.
      const canvas = canvasRef.current;
      const rect = canvas?.getBoundingClientRect();
      if (canvas && rect && rect.width > 0) {
        const scale = canvas.width / rect.width;
        // Clamp committed offset to ±template canvas width to bound the
        // oversized canvas allocation in the rotation/offset branch.
        const maxOffset = template.canvasSize.width;
        setCommittedOffset(prev => ({
          x: Math.max(-maxOffset, Math.min(maxOffset, prev.x + cssDx * scale)),
          y: Math.max(-maxOffset, Math.min(maxOffset, prev.y + cssDy * scale)),
        }));
      }
      setLiveDelta(null);
    } else {
      // Treated as a click — fire parent onClick (gallery thumbnail behaviour).
      setLiveDelta(null);
      onClick?.();
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = dragStartRef.current;
    if (!start || start.pointerId !== e.pointerId) return;
    dragStartRef.current = null;
    setLiveDelta(null);
  };

  return (
    <div
      ref={wrapperRef}
      className={dragEnabled ? 'relative' : 'relative cursor-pointer'}
      onClick={dragEnabled ? undefined : onClick}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={dragEnabled ? handlePointerDown : undefined}
      onPointerMove={dragEnabled ? handlePointerMove : undefined}
      onPointerUp={dragEnabled ? handlePointerUp : undefined}
      onPointerCancel={dragEnabled ? handlePointerCancel : undefined}
      style={dragEnabled ? {
        touchAction: 'none',
        cursor: liveDelta ? 'grabbing' : 'grab',
      } : undefined}
    >
      <canvas
        ref={canvasRef}
        className="w-full rounded-lg"
        style={{
          display: 'block',
          transform: dragEnabled && liveDelta ? `translate(${liveDelta.x}px, ${liveDelta.y}px)` : undefined,
          willChange: dragEnabled && liveDelta ? 'transform' : undefined,
          userSelect: dragEnabled ? 'none' : undefined,
        }}
        onDragStart={(e) => e.preventDefault()}
      />
      {isRendering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg pointer-events-none">
          <span className="text-white text-sm">Rendering...</span>
        </div>
      )}
    </div>
  );
}
