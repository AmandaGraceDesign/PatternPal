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
  /** Runtime toggle for shadow layer. When false, shadow is skipped entirely. */
  shadowEnabled?: boolean;
  /** Runtime toggle for highlight layer. When false, highlight is skipped entirely. */
  highlightEnabled?: boolean;
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
}: MockupRendererV2Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRendering, setIsRendering] = useState(false);

  useEffect(() => {
    if (!patternImage || !canvasRef.current) return;

    let cancelled = false;
    setIsRendering(true);

    (async () => {
      try {
        // Load product base image if template uses image type
        let productBaseImage: HTMLImageElement | null = null;
        if (template.productBase.type === 'image') {
          productBaseImage = await loadImage(template.productBase.imagePath);
        }

        // Load single mask if defined on image product base
        let productMaskImage: HTMLImageElement | null = null;
        if (template.productBase.type === 'image' && template.productBase.maskPath) {
          productMaskImage = await loadImage(template.productBase.maskPath);
        }

        // Load color overlay mask if template has one
        let colorOverlayMaskImage: HTMLImageElement | null = null;
        if (template.colorOverlay?.maskPath) {
          colorOverlayMaskImage = await loadImage(template.colorOverlay.maskPath);
        }

        // Load photo-based displacement map if template has one
        let displacementMapImage: HTMLImageElement | null = null;
        if (template.displacementMapPath) {
          displacementMapImage = await loadImage(template.displacementMapPath);
        }

        // Load shadow overlay if template has one
        let shadowImage: HTMLImageElement | null = null;
        if (template.shadowPath) {
          shadowImage = await loadImage(template.shadowPath);
        }

        // Load highlight overlay if template has one
        let highlightImage: HTMLImageElement | null = null;
        if (template.highlightPath) {
          highlightImage = await loadImage(template.highlightPath);
        }

        // Load zone masks if template has zones
        const zoneMasks: Record<string, HTMLImageElement> = {};
        if (template.zones) {
          const maskLoads = template.zones.map(async (zone) => {
            const img = await loadImage(zone.maskPath);
            if (img) zoneMasks[zone.id] = img;
          });
          await Promise.all(maskLoads);
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
          highlightImage: highlightImage || undefined,
          shadowOpacityOverride: shadowOpacityOverride ?? undefined,
          highlightOpacityOverride: highlightOpacityOverride ?? undefined,
          shadowEnabled: shadowEnabled,
          highlightEnabled: highlightEnabled,
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
  }, [patternImage, template, tileWidth, tileHeight, dpi, repeatType, colorOverride, shadowOpacityOverride, highlightOpacityOverride, shadowEnabled, highlightEnabled]);

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
