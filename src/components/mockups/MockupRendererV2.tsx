'use client';

import React, { useRef, useEffect, useState } from 'react';
import { runPipeline, ROOT_ZONE_KEY } from '@/lib/mockups/mockupEngineV2/MockupPipeline';
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

  // Drag-to-position: each zone has its own offset, updated live during
  // drag. Pointerdown hit-tests the zone masks to figure out which zone
  // the user clicked — only that zone shifts. (Without hit-testing, the
  // knot mask and the tie body mask would both shift together because
  // the pipeline applies the offset per-zone, but every drag would
  // update every zone.) The pipeline re-renders on every offset change
  // (~50-200ms), so users see slight lag but the visual is correct.
  const [patternOffsets, setPatternOffsets] = useState<Record<string, { x: number; y: number }>>({});
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{
    clientX: number;
    clientY: number;
    pointerId: number;
    zoneKey: string;
    startOffsetX: number;
    startOffsetY: number;
  } | null>(null);
  const wasDragRef = useRef(false);
  // Cache of loaded zone masks, populated after the render-effect resolves.
  // Used by pointerdown hit-testing without re-loading the masks.
  const zoneMasksRef = useRef<Record<string, HTMLImageElement>>({});

  // Reset all zone offsets when the template changes (different mockup selected).
  useEffect(() => {
    setPatternOffsets({});
    setIsDragging(false);
    dragStartRef.current = null;
    zoneMasksRef.current = {};
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
        // Stash for hit-testing on pointerdown.
        zoneMasksRef.current = zoneMasks;

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
          patternOffsetOverrides: Object.keys(patternOffsets).length > 0 ? patternOffsets : undefined,
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
    JSON.stringify(patternOffsets),
    // Stringify array deps so identical contents don't trigger extra renders
    // even when the parent rebuilds the array on each render.
    JSON.stringify(additionalShadowEnableds),
    JSON.stringify(additionalShadowOpacityOverrides),
    JSON.stringify(additionalHighlightEnableds),
    JSON.stringify(additionalHighlightOpacityOverrides),
  ]);

  /** Sample a mask at a canvas-space (cx, cy) coord. Returns a 0-255
   *  'pattern presence' score, handling both B/W (white = pattern) and
   *  alpha (transparent = pattern) mask conventions in one shot. */
  const sampleMask = (mask: HTMLImageElement, cx: number, cy: number, canvasW: number, canvasH: number): number => {
    const maskW = mask.naturalWidth || mask.width;
    const maskH = mask.naturalHeight || mask.height;
    if (!maskW || !maskH) return 0;
    const mx = Math.max(0, Math.min(maskW - 1, Math.floor((cx / canvasW) * maskW)));
    const my = Math.max(0, Math.min(maskH - 1, Math.floor((cy / canvasH) * maskH)));
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    const ctx = c.getContext('2d');
    if (!ctx) return 0;
    ctx.drawImage(mask, mx, my, 1, 1, 0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    const luminance = (d[0] + d[1] + d[2]) / 3;
    const inverseAlpha = 255 - d[3];
    return Math.max(luminance, inverseAlpha);
  };

  /** Figure out which zone owns the pixel at the click point.
   *  Returns ROOT_ZONE_KEY for single-zone templates. */
  const pickZoneAt = (cssX: number, cssY: number): string | null => {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    if (!canvas || !rect || rect.width <= 0) return null;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx = (cssX - rect.left) * scaleX;
    const cy = (cssY - rect.top) * scaleY;

    if (!template.zones || template.zones.length === 0) {
      return ROOT_ZONE_KEY;
    }
    // Iterate REVERSE so the last-drawn (topmost) zone wins.
    for (let i = template.zones.length - 1; i >= 0; i--) {
      const zone = template.zones[i];
      const mask = zoneMasksRef.current[zone.id];
      if (!mask) continue;
      const score = sampleMask(mask, cx, cy, canvas.width, canvas.height);
      if (score > 128) return zone.id;
    }
    // No mask hit — fall back to the first zone so drag still does something.
    return template.zones[0]?.id ?? null;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only primary button / touch / pen — ignore right-click etc.
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const zoneKey = pickZoneAt(e.clientX, e.clientY);
    if (!zoneKey) return;
    const current = patternOffsets[zoneKey] ?? { x: 0, y: 0 };
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      pointerId: e.pointerId,
      zoneKey,
      startOffsetX: current.x,
      startOffsetY: current.y,
    };
    wasDragRef.current = false;
    setIsDragging(true);
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = dragStartRef.current;
    if (!start || start.pointerId !== e.pointerId) return;
    const cssDx = e.clientX - start.clientX;
    const cssDy = e.clientY - start.clientY;
    if (!wasDragRef.current && Math.abs(cssDx) + Math.abs(cssDy) > 5) {
      wasDragRef.current = true;
    }
    if (!wasDragRef.current) return;

    // Convert CSS-space delta to pattern-space (canvas-internal) px and
    // update ONLY the zone that was clicked.
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    if (!canvas || !rect || rect.width <= 0) return;
    const scale = canvas.width / rect.width;
    const maxOffset = template.canvasSize.width;
    const nextX = Math.max(-maxOffset, Math.min(maxOffset, start.startOffsetX + cssDx * scale));
    const nextY = Math.max(-maxOffset, Math.min(maxOffset, start.startOffsetY + cssDy * scale));
    setPatternOffsets(prev => ({
      ...prev,
      [start.zoneKey]: { x: nextX, y: nextY },
    }));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = dragStartRef.current;
    if (!start || start.pointerId !== e.pointerId) return;
    dragStartRef.current = null;
    setIsDragging(false);
    try {
      (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
    } catch {}

    // If pointer barely moved, treat as a click — fire parent onClick.
    if (!wasDragRef.current) onClick?.();
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = dragStartRef.current;
    if (!start || start.pointerId !== e.pointerId) return;
    dragStartRef.current = null;
    setIsDragging(false);
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
        cursor: isDragging ? 'grabbing' : 'grab',
      } : undefined}
    >
      <canvas
        ref={canvasRef}
        className="w-full rounded-lg"
        style={{
          display: 'block',
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
