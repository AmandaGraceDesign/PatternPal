'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface SeamInspectorCanvasProps {
  image: HTMLImageElement;
  repeatType: 'full-drop' | 'half-drop' | 'half-brick';
  dpi: number;
  filename: string;
  outlineColor: string;
  onBack?: () => void;
}

export default function SeamInspectorCanvas({
  image,
  repeatType,
  dpi,
  filename,
  outlineColor,
  onBack,
}: SeamInspectorCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null); // double-buffer to eliminate zoom flash
  const containerRef = useRef<HTMLDivElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState(200);
  const [showOutline, setShowOutline] = useState(true);
  const [isPanning, setIsPanning] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });
  const dragStartRef = useRef({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Draggable floating control
  const [controlPos, setControlPos] = useState({ x: 20, y: -1 }); // y=-1 = use bottom:20
  const [isDraggingControl, setIsDraggingControl] = useState(false);
  const controlRef = useRef<HTMLDivElement>(null);
  const controlDragStartRef = useRef({ x: 0, y: 0 });
  const controlPosStartRef = useRef({ x: 0, y: 0 });

  // Pinch-to-zoom state (stores start values so zoom anchor is non-incremental — no stale state)
  const pinchRef = useRef<{
    startDist: number;
    startZoom: number;
    startPanX: number;
    startPanY: number;
    startMidX: number;
    startMidY: number;
  } | null>(null);

  // Refs for current state — lets the non-passive touch listener read fresh values without re-attaching
  const zoomRef = useRef(zoomLevel);
  const panRef = useRef(panOffset);
  useEffect(() => { zoomRef.current = zoomLevel; }, [zoomLevel]);
  useEffect(() => { panRef.current = panOffset; }, [panOffset]);

  // Clamp zoom to 25-800
  const clampZoom = (z: number) => Math.max(25, Math.min(800, z));

  // Measure container
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Pointer handlers for panning
  const handlePointerDown = useCallback(
    (clientX: number, clientY: number) => {
      setIsPanning(true);
      dragStartRef.current = { x: clientX, y: clientY };
      panStartRef.current = { ...panOffset };
    },
    [panOffset]
  );

  const handlePointerMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!isPanning) return;
      setPanOffset({
        x: panStartRef.current.x + (clientX - dragStartRef.current.x),
        y: panStartRef.current.y + (clientY - dragStartRef.current.y),
      });
    },
    [isPanning]
  );

  const handlePointerUp = useCallback(() => setIsPanning(false), []);

  // Floating control drag handlers
  const handleControlPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDraggingControl(true);
    controlDragStartRef.current = { x: e.clientX, y: e.clientY };

    // On first drag, measure real viewport position from DOM to switch from bottom- to top-anchored
    // position:fixed coords are viewport-relative, matching getBoundingClientRect()
    let startPos = { ...controlPos };
    if (controlPos.y === -1 && controlRef.current) {
      const controlRect = controlRef.current.getBoundingClientRect();
      startPos = { x: controlRect.left, y: controlRect.top };
      setControlPos(startPos);
    }
    controlPosStartRef.current = startPos;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [controlPos]);

  const handleControlPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingControl) return;
    e.stopPropagation();
    setControlPos({
      x: controlPosStartRef.current.x + (e.clientX - controlDragStartRef.current.x),
      y: controlPosStartRef.current.y + (e.clientY - controlDragStartRef.current.y),
    });
  }, [isDraggingControl]);

  const handleControlPointerUp = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    setIsDraggingControl(false);
  }, []);

  // Refs so the touch useEffect (attached once) always calls fresh callbacks
  const pointerDownRef = useRef(handlePointerDown);
  const pointerMoveRef = useRef(handlePointerMove);
  const pointerUpRef = useRef(handlePointerUp);
  useEffect(() => { pointerDownRef.current = handlePointerDown; }, [handlePointerDown]);
  useEffect(() => { pointerMoveRef.current = handlePointerMove; }, [handlePointerMove]);
  useEffect(() => { pointerUpRef.current = handlePointerUp; }, [handlePointerUp]);

  // Non-passive touch listeners — lets e.preventDefault() work for pinch, and fixes anchor math
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const rect = el.getBoundingClientRect();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchRef.current = {
          startDist: Math.hypot(dx, dy),
          startZoom: zoomRef.current,
          startPanX: panRef.current.x,
          startPanY: panRef.current.y,
          startMidX: (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left,
          startMidY: (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top,
        };
        setIsPanning(false);
      } else if (e.touches.length === 1) {
        pointerDownRef.current(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault(); // block browser page-zoom during pinch
        const rect = el.getBoundingClientRect();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const scale = dist / pinchRef.current.startDist;
        const newZoom = clampZoom(pinchRef.current.startZoom * scale);

        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
        const { startZoom, startPanX, startPanY, startMidX, startMidY } = pinchRef.current;

        // Non-incremental anchor: keep the world point that was under startMid now under currentMid
        // Derived from: (mid - containerCenter - newPan) / newZoom = (startMid - containerCenter - startPan) / startZoom
        const newPanX = midX - rect.width / 2 - (newZoom / startZoom) * (startMidX - rect.width / 2 - startPanX);
        const newPanY = midY - rect.height / 2 - (newZoom / startZoom) * (startMidY - rect.height / 2 - startPanY);

        setPanOffset({ x: newPanX, y: newPanY });
        setZoomLevel(newZoom);
      } else if (e.touches.length === 1 && !pinchRef.current) {
        pointerMoveRef.current(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinchRef.current = null;
      if (e.touches.length === 0) pointerUpRef.current();
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
  }, []); // attached once — reads state via refs

  // Scroll-wheel zoom (10% steps, anchored to cursor)
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -10 : 10;
      const newZoom = clampZoom(zoomLevel + delta);
      if (newZoom === zoomLevel) return;

      // Anchor zoom to cursor position
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) {
        setZoomLevel(newZoom);
        return;
      }

      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      const scale = newZoom / zoomLevel;
      setPanOffset((prev) => ({
        x: cursorX - scale * (cursorX - prev.x),
        y: cursorY - scale * (cursorY - prev.y),
      }));
      setZoomLevel(newZoom);
    },
    [zoomLevel]
  );

  // Attach wheel listener (needs { passive: false })
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Resize canvas only when container dimensions change (not on zoom/pan — avoids the solid-color flash)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || containerSize.width === 0 || containerSize.height === 0) return;
    const safeDpr = Math.min(window.devicePixelRatio || 1, 2);
    const newW = containerSize.width * safeDpr;
    const newH = containerSize.height * safeDpr;
    if (canvas.width !== newW || canvas.height !== newH) {
      canvas.width = newW;
      canvas.height = newH;
      canvas.style.width = `${containerSize.width}px`;
      canvas.style.height = `${containerSize.height}px`;
    }
  }, [containerSize]);

  // Render — double-buffered to eliminate the navy flash between clear and tile draw
  useEffect(() => {
    if (!canvasRef.current || containerSize.width === 0 || containerSize.height === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const deviceDpr = window.devicePixelRatio || 1;
    const safeDpr = Math.min(deviceDpr, 2);
    const zoomFactor = (zoomLevel / 100) * (96 / dpi);
    const canvasWidth = containerSize.width;
    const canvasHeight = containerSize.height;

    // Reuse offscreen canvas — resize only when needed
    if (!offscreenRef.current) offscreenRef.current = document.createElement('canvas');
    const offscreen = offscreenRef.current;
    const pixelW = canvasWidth * safeDpr;
    const pixelH = canvasHeight * safeDpr;
    if (offscreen.width !== pixelW || offscreen.height !== pixelH) {
      offscreen.width = pixelW;
      offscreen.height = pixelH;
    }
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) return;

    offCtx.setTransform(safeDpr, 0, 0, safeDpr, 0, 0);
    offCtx.imageSmoothingEnabled = true;
    offCtx.imageSmoothingQuality = 'high';
    // Fill background so no transparency flash if tiles don't cover edge pixels
    offCtx.fillStyle = '#ffffff';
    offCtx.fillRect(0, 0, canvasWidth, canvasHeight);

    const srcW = image.naturalWidth;
    const srcH = image.naturalHeight;
    const scaledW = Math.ceil(srcW * zoomFactor);
    const scaledH = Math.ceil(srcH * zoomFactor);

    const baseX = Math.round((canvasWidth / 2) + panOffset.x);
    const baseY = Math.round((canvasHeight / 2) + panOffset.y);

    const startCol = Math.floor(-baseX / scaledW) - 1;
    const endCol = Math.ceil((canvasWidth - baseX) / scaledW);
    const startRow = Math.floor(-baseY / scaledH) - 1;
    const endRow = Math.ceil((canvasHeight - baseY) / scaledH);

    for (let col = startCol; col <= endCol; col++) {
      for (let row = startRow; row <= endRow; row++) {
        let dx = Math.round(col * scaledW + baseX);
        let dy = Math.round(row * scaledH + baseY);

        if (repeatType === 'half-drop') {
          dy += (((col % 2) + 2) % 2 !== 0) ? Math.round(scaledH / 2) : 0;
        } else if (repeatType === 'half-brick') {
          dx += (((row % 2) + 2) % 2 !== 0) ? Math.round(scaledW / 2) : 0;
        }

        if (dx + scaledW <= 0 || dy + scaledH <= 0 || dx >= canvasWidth || dy >= canvasHeight) continue;
        offCtx.drawImage(image, 0, 0, srcW, srcH, dx, dy, scaledW, scaledH);
      }
    }

    if (showOutline) {
      offCtx.strokeStyle = outlineColor;
      offCtx.lineWidth = 2.5;
      offCtx.setLineDash([8, 4]);
      offCtx.strokeRect(baseX, baseY, scaledW, scaledH);
      offCtx.setLineDash([]);
    }

    // Blit complete frame to visible canvas in one operation — no intermediate blank state
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(offscreen, 0, 0);
  }, [image, zoomLevel, panOffset, showOutline, containerSize, repeatType, dpi, outlineColor]);

  const repeatLabel =
    repeatType === 'full-drop' ? 'Full Drop' :
    repeatType === 'half-drop' ? 'Half Drop' : 'Half Brick';

  return (
    <div ref={outerRef} className="relative flex flex-col h-screen w-screen overflow-hidden bg-[#294051]">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-5 py-2.5 bg-[#f8fafc] border-b border-[#e2e8f0] shrink-0">
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-[#294051] text-[13px] font-semibold hover:text-[#1e3040] transition-colors"
            aria-label="Back to editor"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 12L6 8l4-4" />
            </svg>
            Back
          </button>
        )}
        <span className="font-bold text-[#294051] text-[15px]">Seam Inspector</span>
        <span className="text-[#9ca3af] text-xs italic">{filename}</span>
        <span className="text-[10px] px-2 py-0.5 rounded bg-[#f0fdf4] text-[#166534] border border-[#bbf7d0]">
          {repeatLabel}
        </span>
        <span className="ml-auto text-[#9ca3af] text-[11px] hidden sm:block">
          Drag to pan · Scroll or pinch to zoom
        </span>
      </div>

      {/* Canvas container */}
      <div
        ref={containerRef}
        className="flex-1 relative"
        style={{ cursor: isPanning ? 'grabbing' : 'grab', touchAction: 'none' }}
        onMouseDown={(e) => handlePointerDown(e.clientX, e.clientY)}
        onMouseMove={(e) => handlePointerMove(e.clientX, e.clientY)}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
      >
        <canvas ref={canvasRef} className="absolute inset-0" />
      </div>

      {/* Floating control — position:fixed so iOS Safari's canvas GPU layer can't paint over it */}
      <div
        ref={controlRef}
        className="fixed flex items-center gap-2.5 rounded-[10px] bg-white/[0.93] backdrop-blur-[10px] shadow-[0_2px_12px_rgba(0,0,0,0.2)] text-[#374151] text-[12px] select-none"
        style={{
          left: controlPos.x,
          top: controlPos.y === -1 ? undefined : controlPos.y,
          bottom: controlPos.y === -1 ? 20 : undefined,
          zIndex: 20,
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onMouseMove={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div
          className="flex items-center justify-center px-1.5 py-2 cursor-grab active:cursor-grabbing rounded-l-[10px] hover:bg-black/5 transition-colors"
          onPointerDown={handleControlPointerDown}
          onPointerMove={handleControlPointerMove}
          onPointerUp={handleControlPointerUp}
          onPointerCancel={handleControlPointerUp}
          style={{ touchAction: 'none' }}
        >
          <svg width="6" height="14" viewBox="0 0 6 14" fill="currentColor" className="text-[#9ca3af]">
            <circle cx="1.5" cy="1.5" r="1.2" /><circle cx="4.5" cy="1.5" r="1.2" />
            <circle cx="1.5" cy="5" r="1.2" /><circle cx="4.5" cy="5" r="1.2" />
            <circle cx="1.5" cy="8.5" r="1.2" /><circle cx="4.5" cy="8.5" r="1.2" />
            <circle cx="1.5" cy="12" r="1.2" /><circle cx="4.5" cy="12" r="1.2" />
          </svg>
        </div>
        <div className="flex items-center gap-2.5 pr-4 py-2">
          <button
            onClick={() => setZoomLevel((z) => clampZoom(z - 25))}
            className="px-2.5 py-1 rounded-md bg-[#e5e7eb] font-bold text-sm hover:bg-[#d1d5db] transition-colors"
            aria-label="Zoom out"
          >−</button>
          <span className="font-bold min-w-[42px] text-center text-[13px]">
            {Math.round(zoomLevel)}%
          </span>
          <button
            onClick={() => setZoomLevel((z) => clampZoom(z + 25))}
            className="px-2.5 py-1 rounded-md bg-[#e5e7eb] font-bold text-sm hover:bg-[#d1d5db] transition-colors"
            aria-label="Zoom in"
          >+</button>
          <span className="text-[#d1d5db] mx-0.5">|</span>
          <label className="flex items-center gap-1.5 cursor-pointer text-[12px]">
            <input
              type="checkbox"
              checked={showOutline}
              onChange={(e) => setShowOutline(e.target.checked)}
              className="w-4 h-4 rounded border-[#d1d5db]"
              style={{ accentColor: '#e0c26e' }}
            />
            Outline
          </label>
        </div>
      </div>
    </div>
  );
}
