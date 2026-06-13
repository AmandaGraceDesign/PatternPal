'use client';

import React, { useRef, useEffect, useState, useMemo } from 'react';
import { runPipeline, ROOT_ZONE_KEY } from '@/lib/mockups/mockupEngineV2/MockupPipeline';
import { scaleTemplate, computeScaleFactor } from '@/lib/mockups/mockupEngineV2/scaleTemplate';
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
  /** Max pixel dimension (longest side) the pipeline should render at. When set
   *  and smaller than the template's canvas, the template is downscaled before
   *  rendering — saves a large amount of per-pixel work for gallery thumbnails.
   *  Default undefined = full template resolution. */
  maxRenderDimension?: number;
  /** When true, swap every `/mockups/v2/foo.png` asset path to
   *  `/mockups/v2/medium/foo.png` — the 800px pre-generated layer set used by
   *  the gallery. Full 3000×4500 PNGs (5-25 MB each) are 28× larger and
   *  crashed iPad Safari when the gallery loaded ~125 layers at once. Tweak
   *  view leaves this false to keep full fidelity. */
  preview?: boolean;
  /** Fires once each time the render pipeline updates the canvas. Used by the
   *  tweak-mockup modal to coordinate a "render small for display, regenerate
   *  full-res before download" flow. */
  onRenderComplete?: () => void;
  /** When true, scale the canvas's CSS display to fit BOTH the parent's width
   *  AND the viewport height (max 60vh), preserving aspect ratio. Used by the
   *  tweak-mockup modal so a 2:3 portrait canvas (900px tall at 600px wide)
   *  no longer overflows iPad landscape's ~680px content area. Default false
   *  preserves the `w-full` behavior needed by gallery cards. */
  fitContainer?: boolean;
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
 * Module-level LRU cache of image loads, keyed by URL. Templates re-render
 * frequently (every scale, opacity, or color tweak); without this cache each
 * render re-decodes every PNG (some 10-15 MB), which dominates render time.
 *
 * Bounded to prevent the gallery modal from accumulating decoded PNGs — at
 * full res ~125 layers × 54 MB RGBA would crash iPad Safari (~1.5 GB per-tab
 * memory limit). With the medium-res layer set (≤800px, ~200 KB on disk,
 * ~2.5 MB RGBA), 100 entries comfortably hold every gallery layer at once
 * AND leaves room for a tweak-view full-res load. Eviction is LRU via Map
 * insertion order: re-inserting on hit moves the entry to the tail.
 */
const IMAGE_CACHE_MAX = 100;

/** Swap a full-res `/mockups/v2/foo.png` path to the 800px medium variant
 *  `/mockups/v2/medium/foo.png`. Only used when MockupRendererV2's `preview`
 *  prop is true (gallery cards). */
function toMediumPath(p: string): string {
  return p.replace('/mockups/v2/', '/mockups/v2/medium/');
}
const imageCache = new Map<string, Promise<HTMLImageElement | null>>();

/**
 * Single reused 1×1 canvas for mask hit-testing (see sampleMask). Allocating a
 * fresh canvas + 2d context on every pointerdown sample is needless churn —
 * sampling is synchronous, so one module-level sampler serves all callers.
 * `willReadFrequently` hints the browser to keep the backing store readable
 * (we getImageData on every sample).
 */
let hitTestCtx: CanvasRenderingContext2D | null = null;
function getHitTestCtx(): CanvasRenderingContext2D | null {
  if (!hitTestCtx) {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    hitTestCtx = c.getContext('2d', { willReadFrequently: true });
  }
  return hitTestCtx;
}

function cachedLoadImage(src: string): Promise<HTMLImageElement | null> {
  const existing = imageCache.get(src);
  if (existing) {
    // Refresh recency: delete + re-insert moves to the tail of insertion order.
    imageCache.delete(src);
    imageCache.set(src, existing);
    return existing;
  }
  const p = loadImage(src);
  imageCache.set(src, p);
  // Evict oldest entries (head of insertion order) until under cap.
  while (imageCache.size > IMAGE_CACHE_MAX) {
    const oldest = imageCache.keys().next().value;
    if (oldest === undefined) break;
    imageCache.delete(oldest);
  }
  return p;
}

/**
 * Warm the module image cache for every layer a template will need, so the
 * eventual render decodes nothing cold. Fire-and-forget (errors resolve to null
 * inside cachedLoadImage).
 *
 * `preview: true` warms the ≤800px medium set — cheap, used to pre-heat on
 * gallery hover so opening a mockup paints instantly. Omit it to warm the full
 * 3000×4500 set used by download: calling this when the modal opens means the
 * full-res download capture no longer blocks the main thread decoding ~50-80MB
 * of PNGs synchronously.
 */
export function preloadTemplateImages(template: MockupV2Template, opts?: { preview?: boolean }): void {
  const preview = opts?.preview ?? false;
  const conv = (p: string | null | undefined): string | null =>
    p ? (preview ? toMediumPath(p) : p) : null;
  const paths: Array<string | null> = [
    template.productBase.type === 'image' ? conv(template.productBase.imagePath) : null,
    template.productBase.type === 'image' ? conv(template.productBase.maskPath) : null,
    conv(template.colorOverlay?.maskPath),
    conv(template.displacementMapPath),
    conv(template.shadowPath),
    conv(template.highlightPath),
    ...(template.additionalShadowPaths ?? []).map(conv),
    ...(template.additionalHighlightPaths ?? []).map(conv),
    ...(template.zones ?? []).map(z => conv(z.maskPath)),
  ];
  for (const p of paths) {
    if (p) void cachedLoadImage(p);
  }
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
  maxRenderDimension,
  preview = false,
  fitContainer = false,
  onRenderComplete,
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
  // rAF coalescing for pointermove → setState. Without this, a single drag
  // gesture fires 60+ pointermoves/sec, each scheduling a setState + render
  // effect + pipeline cancel. Coalescing to one update per animation frame
  // matches the display refresh and is essentially free for the user.
  const pendingDragOffsetRef = useRef<{ zoneKey: string; x: number; y: number } | null>(null);
  const dragRafIdRef = useRef<number | null>(null);
  // Cache of loaded zone masks, populated after the render-effect resolves.
  // Used by pointerdown hit-testing without re-loading the masks.
  const zoneMasksRef = useRef<Record<string, HTMLImageElement>>({});

  // Render-effect dep signatures. These objects/arrays are rebuilt by the
  // parent on (or near) every render; stringifying them gives the effect a
  // value-stable dependency so identical contents don't re-fire the pipeline.
  // Memoized so the stringify only re-runs when the source reference changes —
  // once the parent hands down stable (useMemo'd) props, these skip entirely.
  const patternOffsetsSig = useMemo(() => JSON.stringify(patternOffsets), [patternOffsets]);
  const additionalShadowEnabledsSig = useMemo(() => JSON.stringify(additionalShadowEnableds), [additionalShadowEnableds]);
  const additionalShadowOpacityOverridesSig = useMemo(() => JSON.stringify(additionalShadowOpacityOverrides), [additionalShadowOpacityOverrides]);
  const additionalHighlightEnabledsSig = useMemo(() => JSON.stringify(additionalHighlightEnableds), [additionalHighlightEnableds]);
  const additionalHighlightOpacityOverridesSig = useMemo(() => JSON.stringify(additionalHighlightOpacityOverrides), [additionalHighlightOpacityOverrides]);

  // Reset all zone offsets when the template changes (different mockup selected).
  useEffect(() => {
    setPatternOffsets({});
    setIsDragging(false);
    dragStartRef.current = null;
    zoneMasksRef.current = {};
    if (dragRafIdRef.current !== null) {
      cancelAnimationFrame(dragRafIdRef.current);
      dragRafIdRef.current = null;
    }
    pendingDragOffsetRef.current = null;
  }, [template]);

  useEffect(() => {
    if (!patternImage || !canvasRef.current) return;

    let cancelled = false;
    setIsRendering(true);

    // While actively dragging (drag-to-position), drop to medium-res sources
    // and a small render canvas so each pointermove re-render is ~50× cheaper
    // than full 3000×4500 pipeline work — kills the 3-5s drag lag on iPad.
    // On pointerup, isDragging flips false and this same effect re-fires
    // (isDragging is in deps), giving a full-quality final render.
    const effPreview = isDragging ? true : preview;
    // 700px keeps the pipeline ~15× cheaper than full-res while reading as
    // "soft" rather than "pixelated" once upscaled into a ~600px display box.
    // Tested as a safe ceiling for iPad — going higher starts to lag drag.
    const effMaxDim = isDragging ? 700 : maxRenderDimension;
    const scaleFactor = effMaxDim ? computeScaleFactor(template, effMaxDim) : 1;
    const renderTemplate = scaleFactor < 1 ? scaleTemplate(template, scaleFactor) : template;

    (async () => {
      try {
        // Load all template assets in parallel (cached after first load).
        // In preview mode (or while dragging), swap every path to its
        // medium-res sibling.
        const px = (p: string | null | undefined) =>
          p && effPreview ? toMediumPath(p) : p;
        const productImagePath = template.productBase.type === 'image' ? px(template.productBase.imagePath) ?? null : null;
        const productMaskPath = template.productBase.type === 'image' ? px(template.productBase.maskPath) ?? null : null;
        const colorMaskPath = px(template.colorOverlay?.maskPath) ?? null;
        const displacementPath = px(template.displacementMapPath) ?? null;
        const shadowPath = px(template.shadowPath) ?? null;
        const highlightPath = px(template.highlightPath) ?? null;
        const extraShadowPaths = (template.additionalShadowPaths ?? []).map((p) => effPreview ? toMediumPath(p) : p);
        const extraHighlightPaths = (template.additionalHighlightPaths ?? []).map((p) => effPreview ? toMediumPath(p) : p);

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
        // Stash for hit-testing on pointerdown.
        zoneMasksRef.current = zoneMasks;

        if (cancelled) return;

        const resultCanvas = runPipeline({
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
          // Offsets are stored in FULL template-space px (see handlePointerMove).
          // When rendering at a downscaled renderTemplate, scale offsets down to
          // match — otherwise the pipeline interprets template-px as renderTemplate-px
          // and the drag-time shift looks ~7× bigger than what gets persisted at full-res.
          patternOffsetOverrides: Object.keys(patternOffsets).length > 0
            ? Object.fromEntries(
                Object.entries(patternOffsets).map(([k, v]) =>
                  [k, { x: v.x * scaleFactor, y: v.y * scaleFactor }]
                )
              )
            : undefined,
        });

        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;

        // In fitContainer mode (tweak modal), keep the DISPLAY canvas at the
        // template's full intrinsic size so iPad Safari doesn't ignore our
        // `aspect-ratio` CSS during low-res drag renders. Gallery thumbnails
        // and other callsites use resultCanvas dims directly — forcing the
        // full template size everywhere would allocate ~54MB per 3000×4500
        // template, crashing the tab when the gallery mounts ~30 thumbnails.
        if (fitContainer) {
          const targetW = template.canvasSize.width;
          const targetH = template.canvasSize.height;
          if (canvas.width !== targetW) canvas.width = targetW;
          if (canvas.height !== targetH) canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = isDragging ? 'medium' : 'high';
          ctx.clearRect(0, 0, targetW, targetH);
          ctx.drawImage(resultCanvas, 0, 0, targetW, targetH);
        } else {
          canvas.width = resultCanvas.width;
          canvas.height = resultCanvas.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          ctx.drawImage(resultCanvas, 0, 0);
        }
      } catch (err) {
        console.error('MockupRendererV2 render error:', err);
      } finally {
        if (!cancelled) {
          setIsRendering(false);
          onRenderComplete?.();
        }
      }
    })();

    return () => { cancelled = true; };
  }, [
    patternImage, template, tileWidth, tileHeight, dpi, repeatType,
    colorOverride, shadowOpacityOverride, highlightOpacityOverride,
    shadowEnabled, highlightEnabled, colorOverlayEnabled,
    maxRenderDimension, preview, isDragging,
    // Value-stable signatures (memoized above) so identical contents don't
    // re-fire the pipeline even when the parent rebuilds the source arrays.
    patternOffsetsSig,
    additionalShadowEnabledsSig,
    additionalShadowOpacityOverridesSig,
    additionalHighlightEnabledsSig,
    additionalHighlightOpacityOverridesSig,
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
    const ctx = getHitTestCtx();
    if (!ctx) return 0;
    // Clear first — the sampler is reused, and a transparent mask pixel drawn
    // over a previous opaque sample would otherwise composite incorrectly.
    ctx.clearRect(0, 0, 1, 1);
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

    // Convert CSS-space delta to FULL TEMPLATE px and update ONLY the zone
    // that was clicked. Using template.canvasSize.width (not canvas.width)
    // keeps the stored offset in a render-scale-independent unit, so the
    // value computed during a cheap drag render still applies correctly
    // when the full-res render fires on pointer-up.
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    if (!canvas || !rect || rect.width <= 0) return;
    const scale = template.canvasSize.width / rect.width;
    const maxOffset = template.canvasSize.width;
    const nextX = Math.max(-maxOffset, Math.min(maxOffset, start.startOffsetX + cssDx * scale));
    const nextY = Math.max(-maxOffset, Math.min(maxOffset, start.startOffsetY + cssDy * scale));

    // Coalesce — overwrite the pending target and schedule one rAF.
    pendingDragOffsetRef.current = { zoneKey: start.zoneKey, x: nextX, y: nextY };
    if (dragRafIdRef.current === null) {
      dragRafIdRef.current = requestAnimationFrame(() => {
        dragRafIdRef.current = null;
        const pending = pendingDragOffsetRef.current;
        if (!pending) return;
        setPatternOffsets(prev => ({ ...prev, [pending.zoneKey]: { x: pending.x, y: pending.y } }));
      });
    }
  };

  const flushPendingDrag = () => {
    if (dragRafIdRef.current !== null) {
      cancelAnimationFrame(dragRafIdRef.current);
      dragRafIdRef.current = null;
    }
    const pending = pendingDragOffsetRef.current;
    if (pending) {
      pendingDragOffsetRef.current = null;
      setPatternOffsets(prev => ({ ...prev, [pending.zoneKey]: { x: pending.x, y: pending.y } }));
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = dragStartRef.current;
    if (!start || start.pointerId !== e.pointerId) return;
    dragStartRef.current = null;
    setIsDragging(false);
    try {
      (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
    } catch {}

    // Make sure the final offset gets applied even if rAF is still pending.
    flushPendingDrag();

    // If pointer barely moved, treat as a click — fire parent onClick.
    if (!wasDragRef.current) onClick?.();
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = dragStartRef.current;
    if (!start || start.pointerId !== e.pointerId) return;
    dragStartRef.current = null;
    setIsDragging(false);
    if (dragRafIdRef.current !== null) {
      cancelAnimationFrame(dragRafIdRef.current);
      dragRafIdRef.current = null;
    }
    pendingDragOffsetRef.current = null;
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
        className={fitContainer ? "rounded-lg" : "w-full rounded-lg"}
        style={{
          display: 'block',
          userSelect: dragEnabled ? 'none' : undefined,
          ...(fitContainer ? {
            // aspect-ratio + width:100% locks the canvas DISPLAY size to the
            // template's intended aspect, regardless of the pipeline's current
            // intrinsic pixel size. Means low-res renders during drag don't
            // collapse the display box — they just look briefly blurry.
            width: '100%',
            aspectRatio: `${template.canvasSize.width} / ${template.canvasSize.height}`,
            maxHeight: '60vh',
            height: 'auto',
          } : {}),
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
