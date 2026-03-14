'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface SeamInspectorCanvasProps {
  image: HTMLImageElement;
  repeatType: 'full-drop' | 'half-drop' | 'half-brick';
  dpi: number;
  filename: string;
  outlineColor: string;
}

export default function SeamInspectorCanvas({
  image,
  repeatType,
  dpi,
  filename,
  outlineColor,
}: SeamInspectorCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState(200);
  const [showOutline, setShowOutline] = useState(true);
  const [isPanning, setIsPanning] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });
  const dragStartRef = useRef({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

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

  // Render
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

    canvas.width = canvasWidth * safeDpr;
    canvas.height = canvasHeight * safeDpr;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;

    ctx.setTransform(safeDpr, 0, 0, safeDpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    const srcW = image.naturalWidth;
    const srcH = image.naturalHeight;
    const scaledW = srcW * zoomFactor;
    const scaledH = srcH * zoomFactor;

    // Base position: tile (0,0) starts centered in viewport, then offset by pan
    const baseX = (canvasWidth / 2 - scaledW / 2) + panOffset.x;
    const baseY = (canvasHeight / 2 - scaledH / 2) + panOffset.y;

    // Calculate visible tile range
    const startCol = Math.floor(-baseX / scaledW) - 1;
    const endCol = Math.ceil((canvasWidth - baseX) / scaledW);
    const startRow = Math.floor(-baseY / scaledH) - 1;
    const endRow = Math.ceil((canvasHeight - baseY) / scaledH);

    // Draw tiles
    for (let col = startCol; col <= endCol; col++) {
      for (let row = startRow; row <= endRow; row++) {
        let dx = col * scaledW + baseX;
        let dy = row * scaledH + baseY;

        // Apply repeat-type offsets
        if (repeatType === 'half-drop') {
          dy += (((col % 2) + 2) % 2 !== 0) ? scaledH / 2 : 0;
        } else if (repeatType === 'half-brick') {
          dx += (((row % 2) + 2) % 2 !== 0) ? scaledW / 2 : 0;
        }

        // Viewport culling
        if (dx + scaledW <= 0 || dy + scaledH <= 0 || dx >= canvasWidth || dy >= canvasHeight) continue;
        ctx.drawImage(image, 0, 0, srcW, srcH, dx, dy, scaledW, scaledH);
      }
    }

    // Draw outline around tile (0, 0)
    if (showOutline) {
      const outlineX = baseX;
      const outlineY = baseY;

      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([8, 4]);
      ctx.strokeRect(outlineX, outlineY, scaledW, scaledH);
      ctx.setLineDash([]);
    }
  }, [image, zoomLevel, panOffset, showOutline, containerSize, repeatType, dpi, outlineColor]);

  const repeatLabel =
    repeatType === 'full-drop' ? 'Full Drop' :
    repeatType === 'half-drop' ? 'Half Drop' : 'Half Brick';

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#294051]">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-5 py-2.5 bg-[#f8fafc] border-b border-[#e2e8f0] shrink-0">
        <span className="font-bold text-[#294051] text-[15px]">Seam Inspector</span>
        <span className="text-[#9ca3af] text-xs italic">{filename}</span>
        <span className="text-[10px] px-2 py-0.5 rounded bg-[#f0fdf4] text-[#166534] border border-[#bbf7d0]">
          {repeatLabel}
        </span>
        <span className="ml-auto text-[#9ca3af] text-[11px]">
          Drag to pan · Scroll to zoom
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
        onTouchStart={(e) => {
          if (e.touches.length === 1) {
            handlePointerDown(e.touches[0].clientX, e.touches[0].clientY);
          }
        }}
        onTouchMove={(e) => {
          if (e.touches.length === 1) {
            handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
          }
        }}
        onTouchEnd={handlePointerUp}
        onTouchCancel={handlePointerUp}
      >
        <canvas ref={canvasRef} className="absolute inset-0" />

        {/* Floating control — bottom left */}
        <div className="absolute bottom-5 left-5 flex items-center gap-2.5 px-4 py-2 rounded-[10px] bg-white/[0.93] backdrop-blur-[10px] shadow-[0_2px_12px_rgba(0,0,0,0.2)] text-[#374151] text-[12px] select-none">
          <button
            onClick={() => setZoomLevel((z) => clampZoom(z - 25))}
            className="px-2.5 py-1 rounded-md bg-[#e5e7eb] font-bold text-sm hover:bg-[#d1d5db] transition-colors"
            aria-label="Zoom out"
          >
            −
          </button>
          <span className="font-bold min-w-[42px] text-center text-[13px]">
            {Math.round(zoomLevel)}%
          </span>
          <button
            onClick={() => setZoomLevel((z) => clampZoom(z + 25))}
            className="px-2.5 py-1 rounded-md bg-[#e5e7eb] font-bold text-sm hover:bg-[#d1d5db] transition-colors"
            aria-label="Zoom in"
          >
            +
          </button>
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

        {/* Bottom right hint */}
        <div className="absolute bottom-6 right-5 text-[10px] text-white/30">
          ESC or close tab to return
        </div>
      </div>
    </div>
  );
}
