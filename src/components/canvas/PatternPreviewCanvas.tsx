'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { PatternTiler, RepeatType } from '@/lib/tiling/PatternTiler';
import Ruler from './Ruler';

interface PatternPreviewCanvasProps {
  image: HTMLImageElement | null;
  repeatType: RepeatType;
  tileWidth: number;
  tileHeight: number;
  dpi: number;
  zoom: number;
  onZoomChange?: (newZoom: number) => void;
  panX: number;
  panY: number;
  onPanChange?: (x: number, y: number) => void;
  showTileOutline: boolean;
  tileOutlineColor?: string;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export default function PatternPreviewCanvas({
  image,
  repeatType,
  tileWidth,
  tileHeight,
  dpi,
  zoom,
  onZoomChange,
  panX,
  panY,
  onPanChange,
  showTileOutline,
  tileOutlineColor = '#38bdf8',
  isFullscreen = false,
  onToggleFullscreen,
}: PatternPreviewCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null); // double-buffer to eliminate zoom flash
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [dpr, setDpr] = useState(1);
  const [rulerUnit, setRulerUnit] = useState<'in' | 'cm' | 'px'>('in');

  // Pan state
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const panOriginRef = useRef({ x: 0, y: 0 });
  const rafPanRef = useRef<number | null>(null);

  // Pinch-to-zoom state
  const pinchRef = useRef<{ startDist: number; startZoom: number } | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if (e.pointerType === 'touch') return; // single-finger touch scrolls the page, not the canvas
    setIsPanning(true);
    panStartRef.current = { x: e.clientX, y: e.clientY };
    panOriginRef.current = { x: panX, y: panY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [panX, panY]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanning || !onPanChange) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    if (rafPanRef.current !== null) cancelAnimationFrame(rafPanRef.current);
    rafPanRef.current = requestAnimationFrame(() => {
      onPanChange(panOriginRef.current.x + dx, panOriginRef.current.y + dy);
      rafPanRef.current = null;
    });
  }, [isPanning, onPanChange]);

  const handlePointerUp = useCallback(() => {
    setIsPanning(false);
    if (rafPanRef.current !== null) {
      cancelAnimationFrame(rafPanRef.current);
      rafPanRef.current = null;
    }
  }, []);

  // Pinch-to-zoom via non-passive listeners so preventDefault works
  // (React synthetic touch events are passive and cannot preventDefault)
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || !onZoomChange) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchRef.current = { startDist: Math.hypot(dx, dy), startZoom: zoom };
        setIsPanning(false);
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault(); // block browser page-zoom during pinch
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const scale = dist / pinchRef.current.startDist;
        const newZoom = Math.max(1, pinchRef.current.startZoom * scale);
        onZoomChange(newZoom);
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinchRef.current = null;
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [zoom, onZoomChange]);

  // Wheel zoom handler (ctrl/cmd + scroll = zoom)
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || !onZoomChange) return;

    const handleWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      e.stopPropagation();
      const delta = -e.deltaY * 0.5;
      const newZoom = Math.max(1, zoom + delta);
      onZoomChange(newZoom);
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [zoom, onZoomChange]);

  // Set device pixel ratio and canvas size
  useEffect(() => {
    const currentDpr = window.devicePixelRatio || 1;
    const updateCanvasSize = () => {
      setDpr(currentDpr);
      if (canvasRef.current) {
        const container = scrollContainerRef.current;
        const displayWidth = container
          ? Math.round(container.clientWidth)
          : Math.round(window.innerWidth);

        // Height: based on tile dimensions to show several rows, so
        // the page scrolls to reveal more pattern
        let displayHeight: number;
        if (image) {
          const sf = (zoom / 100) * (96 * tileWidth / image.naturalWidth);
          const scaledTileH = image.naturalHeight * sf;
          const minRows = Math.max(3, Math.ceil(window.innerHeight * 0.8 / scaledTileH) + 2);
          displayHeight = Math.round(Math.max(window.innerHeight * 0.6, scaledTileH * minRows));
        } else {
          displayHeight = Math.round(window.innerHeight * 0.6);
        }

        const ctx = canvasRef.current.getContext('2d');

        canvasRef.current.width = displayWidth * currentDpr;
        canvasRef.current.height = displayHeight * currentDpr;

        canvasRef.current.style.width = `${displayWidth}px`;
        canvasRef.current.style.height = `${displayHeight}px`;

        if (ctx) {
          ctx.scale(currentDpr, currentDpr);
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
        }

        setCanvasSize({ width: displayWidth, height: displayHeight });
      }
    };

    requestAnimationFrame(updateCanvasSize);

    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, [image, dpi, tileWidth]); // zoom intentionally excluded — zoom only affects render, not canvas size

  // Render pattern
  useEffect(() => {
    if (!canvasRef.current || canvasSize.width === 0) return;

    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) return;

    let cancelled = false;
    let rafId: number | undefined;

    const currentDpr = window.devicePixelRatio || 1;

    canvasCtx.setTransform(1, 0, 0, 1, 0, 0);
    canvasCtx.scale(currentDpr, currentDpr);
    canvasCtx.imageSmoothingEnabled = true;
    canvasCtx.imageSmoothingQuality = 'high';

    if (!image) {
      // Render placeholder pattern (unchanged — small image, no pixelation concern)
      const placeholderImg = new Image();
      placeholderImg.onload = () => {
        if (cancelled) return;

        const defaultDpi = 150;
        const defaultTileWidth = 18;
        const placeholderWidth = placeholderImg.width;
        const placeholderHeight = placeholderImg.height;

        // Scale placeholder to appear as 18" tile at current zoom
        const scaleFactor = (zoom / 100) * (96 / defaultDpi);
        const targetSize = defaultTileWidth * defaultDpi;
        const displayScale = (targetSize / placeholderWidth) * scaleFactor * 0.5;

        const displayWidth = Math.round(placeholderWidth * displayScale);
        const displayHeight = Math.round(placeholderHeight * displayScale);

        const scaledCanvas = document.createElement('canvas');
        scaledCanvas.width = displayWidth * dpr;
        scaledCanvas.height = displayHeight * dpr;

        const scaledCtx = scaledCanvas.getContext('2d');
        if (scaledCtx) {
          scaledCtx.fillStyle = '#ffffff';
          scaledCtx.fillRect(0, 0, scaledCanvas.width, scaledCanvas.height);
          scaledCtx.scale(dpr, dpr);
          scaledCtx.imageSmoothingEnabled = true;
          scaledCtx.imageSmoothingQuality = 'high';
          scaledCtx.drawImage(placeholderImg, 0, 0, displayWidth, displayHeight);

          rafId = requestAnimationFrame(() => {
            if (cancelled) return;
            const scaledImg = new Image();
            scaledImg.onload = () => {
              if (cancelled) return;
              canvasCtx.setTransform(1, 0, 0, 1, 0, 0);
              canvasCtx.scale(currentDpr, currentDpr);
              canvasCtx.fillStyle = '#0f172a';
              canvasCtx.fillRect(0, 0, canvasSize.width, canvasSize.height);

              // Use old tiling for placeholder (it's a small pre-scaled image)
              const cols = Math.ceil(canvasSize.width / displayWidth) + 2;
              const rows = Math.ceil(canvasSize.height / displayHeight) + 2;
              for (let x = -1; x < cols; x++) {
                for (let y = -1; y < rows; y++) {
                  canvasCtx.drawImage(scaledImg, x * displayWidth, y * displayHeight, displayWidth, displayHeight);
                }
              }

              if (showTileOutline) {
                canvasCtx.strokeStyle = tileOutlineColor;
                canvasCtx.lineWidth = 6;
                canvasCtx.setLineDash([]);
                canvasCtx.strokeRect(3, 3, displayWidth - 6, displayHeight - 6);
              }
            };
            scaledImg.src = scaledCanvas.toDataURL('image/png');
          });
        }
      };
      placeholderImg.src = '/place_design_here.jpg';
      return () => { cancelled = true; if (rafId !== undefined) cancelAnimationFrame(rafId); };
    }

    // --- Viewport-based rendering from full-res source — double-buffered to eliminate flash ---
    const scaleFactor = (zoom / 100) * (96 * tileWidth / image.naturalWidth);

    // Reuse offscreen canvas — resize only when needed
    if (!offscreenRef.current) offscreenRef.current = document.createElement('canvas');
    const offscreen = offscreenRef.current;
    const pixelW = canvasSize.width * currentDpr;
    const pixelH = canvasSize.height * currentDpr;
    if (offscreen.width !== pixelW || offscreen.height !== pixelH) {
      offscreen.width = pixelW;
      offscreen.height = pixelH;
    }
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) return () => { cancelled = true; };

    offCtx.setTransform(1, 0, 0, 1, 0, 0);
    offCtx.scale(currentDpr, currentDpr);
    offCtx.imageSmoothingEnabled = true;
    offCtx.imageSmoothingQuality = 'high';

    const tiler = new PatternTiler(offCtx, canvasSize.width, canvasSize.height);
    tiler.render(image, repeatType, scaleFactor, panX, panY);

    if (showTileOutline) {
      const outlineW = Math.ceil(image.naturalWidth * scaleFactor);
      const outlineH = Math.ceil(image.naturalHeight * scaleFactor);

      offCtx.strokeStyle = tileOutlineColor;
      offCtx.lineWidth = 6;
      offCtx.setLineDash([]);

      const col = Math.floor(-panX / outlineW);
      const row = Math.floor(-panY / outlineH);

      let ox = Math.round(col * outlineW + panX);
      let oy = Math.round(row * outlineH + panY);

      if (repeatType === 'half-drop') {
        oy += (((col % 2) + 2) % 2 !== 0) ? Math.round(outlineH / 2) : 0;
      } else if (repeatType === 'half-brick') {
        ox += (((row % 2) + 2) % 2 !== 0) ? Math.round(outlineW / 2) : 0;
      }

      offCtx.strokeRect(ox + 3, oy + 3, outlineW - 6, outlineH - 6);
    }

    // Blit complete frame to visible canvas in one operation — no intermediate blank state
    canvasCtx.setTransform(1, 0, 0, 1, 0, 0);
    canvasCtx.drawImage(offscreen, 0, 0);

    return () => { cancelled = true; if (rafId !== undefined) cancelAnimationFrame(rafId); };
  }, [image, repeatType, tileWidth, tileHeight, zoom, dpi, showTileOutline, tileOutlineColor, canvasSize, dpr, panX, panY]);

  // Calculate pixels per unit for ruler
  const effectiveDpi = image ? image.naturalWidth / tileWidth : dpi;
  const scaleFactor = (zoom / 100) * (96 / effectiveDpi);
  const pixelsPerInch = (zoom / 100) * 96;
  const pixelsPerPixel = scaleFactor;

  const getPixelsPerUnit = (unit: 'in' | 'cm' | 'px') => {
    if (unit === 'in') return pixelsPerInch;
    if (unit === 'cm') return pixelsPerInch / 2.54;
    return pixelsPerPixel;
  };

  const horizontalUnitValue = getPixelsPerUnit(rulerUnit);
  const verticalUnitValue = getPixelsPerUnit(rulerUnit);

  return (
    <div className={`flex flex-col w-full bg-[#0f172a] ${isFullscreen ? 'h-full' : 'rounded-2xl mt-3 shadow-[0_12px_40px_rgba(0,0,0,0.5),0_4px_12px_rgba(0,0,0,0.3)]'}`}>
      {!isFullscreen && (
        <div className="flex items-center justify-end gap-2 p-2 text-xs bg-[#111827] border-b border-[#2d3340] text-white">
          <span className="text-slate-300">Ruler unit:</span>
          {['in', 'cm', 'px'].map((unit) => (
            <button
              key={unit}
              onClick={() => setRulerUnit(unit as 'in' | 'cm' | 'px')}
              className={`rounded border px-2 py-1 ${rulerUnit === unit ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-800 border-slate-600 text-slate-200 hover:bg-slate-700'}`}
            >
              {unit}
            </button>
          ))}
        </div>
      )}
        {/* Top ruler */}
        {!isFullscreen && (
          <div className="flex border-b border-[#3a3d44]">
            <div className="w-[30px] h-[30px] bg-[#3a3d44] border-r border-[#3a3d44]" />
            <div className="flex-1 overflow-hidden">
              {image ? (
                <Ruler
                  orientation="horizontal"
                  length={canvasSize.width}
                  scale={1}
                  unit={rulerUnit}
                  pixelsPerUnit={horizontalUnitValue}
                />
              ) : (
                <div className="h-[30px] bg-[#3a3d44]" />
              )}
            </div>
          </div>
        )}

        {/* Canvas with left ruler */}
        <div className={`flex ${isFullscreen ? 'flex-1' : ''}`}>
          {!isFullscreen && (
            <div className="w-[30px] overflow-hidden border-r border-[#3a3d44]">
              {image ? (
                <Ruler
                  orientation="vertical"
                  length={canvasSize.height}
                  scale={1}
                  unit={rulerUnit}
                  pixelsPerUnit={verticalUnitValue}
                />
              ) : (
                <div className="w-[30px] bg-[#3a3d44]" />
              )}
            </div>
          )}
          <div
            ref={scrollContainerRef}
            className={`flex-1 overflow-hidden bg-[#0f172a] relative ${isFullscreen ? 'h-full' : ''}`}
            style={{
              touchAction: 'pan-x pan-y', // single-finger scrolls the page; pinch handled via non-passive listeners
              cursor: isPanning ? 'grabbing' : 'grab',
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <canvas
              ref={canvasRef}
              className="block"
            />
            {/* Fullscreen toggle button */}
            {onToggleFullscreen && (
              <button
                onClick={onToggleFullscreen}
                title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                className={`${isFullscreen ? 'fixed' : 'absolute'} top-3 right-3 z-10 w-9 h-9 rounded-lg flex items-center justify-center transition-opacity hover:opacity-100`}
                style={{
                  background: 'rgba(255, 255, 255, 0.75)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  border: '1px solid rgba(0, 0, 0, 0.12)',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.15)',
                  opacity: 0.85,
                }}
              >
                {isFullscreen ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 14h6v6m10-10h-6V4m0 6l7-7M3 21l7-7" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                  </svg>
                )}
              </button>
            )}
          </div>
        </div>
    </div>
  );
}
