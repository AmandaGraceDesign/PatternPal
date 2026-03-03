'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface SeamInspectorProps {
  image: HTMLImageElement | null;
  isOpen: boolean;
  onClose: () => void;
  repeatType: 'full-drop' | 'half-drop' | 'half-brick';
  seamLineColor?: string;
}

type SeamType = 'horizontal' | 'vertical' | 'intersection';
type SeamSection = 'start' | 'middle' | 'end';

// Safe canvas pixel limit — iOS Safari caps at ~16.7M pixels
const MAX_CANVAS_PIXELS = 16_000_000;

// Helper function to create a 4x4 grid of tiles showing actual repeat.
// Automatically downscales the source image if the grid would exceed mobile
// canvas limits, preserving seam-line visual quality while staying safe.
function createTileGrid(
  image: HTMLImageElement,
  repeatType: 'full-drop' | 'half-drop' | 'half-brick'
): { canvas: HTMLCanvasElement; tileW: number; tileH: number } {
  const origW = image.naturalWidth || image.width;
  const origH = image.naturalHeight || image.height;
  const gridCols = 4;
  const gridRows = 4;

  const extraWidth = repeatType === 'half-brick' ? origW / 2 : 0;
  const extraHeight = repeatType === 'half-drop' ? origH / 2 : 0;
  const idealW = origW * gridCols + extraWidth;
  const idealH = origH * gridRows + extraHeight;
  const totalPixels = idealW * idealH;

  // If the grid would exceed the safe limit, scale tile dimensions down
  let tileW = origW;
  let tileH = origH;
  let sourceImage: HTMLImageElement | HTMLCanvasElement = image;

  if (totalPixels > MAX_CANVAS_PIXELS) {
    const scale = Math.sqrt(MAX_CANVAS_PIXELS / totalPixels);
    tileW = Math.round(origW * scale);
    tileH = Math.round(origH * scale);

    // Create a downscaled copy of the image
    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = tileW;
    tmpCanvas.height = tileH;
    const tmpCtx = tmpCanvas.getContext('2d');
    if (tmpCtx) {
      tmpCtx.imageSmoothingEnabled = true;
      tmpCtx.imageSmoothingQuality = 'high';
      tmpCtx.drawImage(image, 0, 0, tileW, tileH);
    }
    sourceImage = tmpCanvas as unknown as HTMLImageElement;
  }

  const gridExtraW = repeatType === 'half-brick' ? tileW / 2 : 0;
  const gridExtraH = repeatType === 'half-drop' ? tileH / 2 : 0;

  const gridCanvas = document.createElement('canvas');
  gridCanvas.width = tileW * gridCols + gridExtraW;
  gridCanvas.height = tileH * gridRows + gridExtraH;

  const ctx = gridCanvas.getContext('2d');
  if (!ctx) return { canvas: gridCanvas, tileW, tileH };
  ctx.imageSmoothingEnabled = false;

  // Draw tiles beyond edges to cover stagger offsets
  for (let row = -1; row <= gridRows; row++) {
    for (let col = -1; col <= gridCols; col++) {
      let x = col * tileW;
      let y = row * tileH;

      if (repeatType === 'half-drop') {
        y += col % 2 === 0 ? 0 : tileH / 2;
      } else if (repeatType === 'half-brick') {
        x += row % 2 === 0 ? 0 : tileW / 2;
      }

      ctx.drawImage(sourceImage, x, y, tileW, tileH);
    }
  }

  return { canvas: gridCanvas, tileW, tileH };
}

export default function SeamInspector({ image, isOpen, onClose, repeatType, seamLineColor = '#38bdf8' }: SeamInspectorProps) {
  const [seamType, setSeamType] = useState<SeamType>('intersection');
  const [zoomLevel, setZoomLevel] = useState<number>(200); // Continuous zoom (percentage)
  const [seamSection, setSeamSection] = useState<SeamSection>('middle');
  const [showPinkLines, setShowPinkLines] = useState(true);
  const [renderError, setRenderError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Pan state (in screen pixels, converted to source pixels when rendering)
  const [isPanning, setIsPanning] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Touch pan handlers
  const handlePointerDown = useCallback((clientX: number, clientY: number) => {
    setIsPanning(true);
    setDragStart({ x: clientX, y: clientY });
    setPanStart(panOffset);
  }, [panOffset]);

  const handlePointerMove = useCallback((clientX: number, clientY: number) => {
    if (!isPanning) return;
    const deltaX = clientX - dragStart.x;
    const deltaY = clientY - dragStart.y;
    setPanOffset({
      x: panStart.x + deltaX,
      y: panStart.y + deltaY
    });
  }, [isPanning, dragStart, panStart]);

  const handlePointerUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  // Keyboard navigation
  useEffect(() => {
    const handleArrows = (e: KeyboardEvent) => {
      if (!isOpen || seamType === 'intersection') return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setSeamSection(prev =>
          prev === 'middle' ? 'start' : prev === 'end' ? 'middle' : prev
        );
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setSeamSection(prev =>
          prev === 'middle' ? 'end' : prev === 'start' ? 'middle' : prev
        );
      }
    };

    window.addEventListener('keydown', handleArrows);
    return () => window.removeEventListener('keydown', handleArrows);
  }, [isOpen, seamType]);

  // Measure container size
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [isOpen]);

  // Reset pan when changing views (but not when toggling pink lines)
  useEffect(() => {
    setPanOffset({ x: 0, y: 0 });
  }, [seamType, zoomLevel, seamSection]);

  // Clear error when settings change
  useEffect(() => {
    setRenderError(null);
  }, [seamType, zoomLevel, seamSection, image, repeatType]);

  // Render seam view
  useEffect(() => {
    if (!image || !canvasRef.current || !isOpen || containerSize.width === 0 || containerSize.height === 0) return;

    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      // Cap DPR to avoid exceeding canvas limits on high-DPI mobile screens
      const safeDpr = Math.min(dpr, 2);
      const zoomFactor = zoomLevel / 100;

      // Canvas fills available container area (accounting for padding)
      const padding = 48; // 24px padding on each side
      const canvasWidth = Math.max(0, containerSize.width - padding);
      const canvasHeight = Math.max(0, containerSize.height - padding);

      canvas.width = canvasWidth * safeDpr;
      canvas.height = canvasHeight * safeDpr;
      canvas.style.width = `${canvasWidth}px`;
      canvas.style.height = `${canvasHeight}px`;

      ctx.setTransform(safeDpr, 0, 0, safeDpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);

      if (seamType === 'intersection') {
        const { canvas: gridCanvas, tileW, tileH } = createTileGrid(image, repeatType);

        // Fill the entire view with a repeated grid, centered on the top-left corner intersection
        const pattern = ctx.createPattern(gridCanvas, 'repeat');
        if (pattern && typeof pattern.setTransform === 'function') {
          try {
            const centerX = (canvasWidth / 2) + panOffset.x;
            const centerY = (canvasHeight / 2) + panOffset.y;
            const offsetX = centerX - (tileW * zoomFactor);
            const offsetY = centerY - (tileH * zoomFactor);

            pattern.setTransform(
              new DOMMatrix()
                .translate(offsetX, offsetY)
                .scale(zoomFactor)
            );
            ctx.fillStyle = pattern;
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);
          } catch {
            // DOMMatrix/setTransform failed — fall through to manual tiling
            renderManualTiling(ctx, gridCanvas, tileW, tileH, canvasWidth, canvasHeight, zoomFactor, panOffset);
          }
        } else {
          renderManualTiling(ctx, gridCanvas, tileW, tileH, canvasWidth, canvasHeight, zoomFactor, panOffset);
        }

        // Draw pink crosshair aligned with the tiled pattern intersection
        if (showPinkLines) {
          ctx.strokeStyle = seamLineColor;
          ctx.lineWidth = 3;
          const crossX = (canvasWidth / 2) + panOffset.x;
          const crossY = (canvasHeight / 2) + panOffset.y;
          ctx.beginPath();
          ctx.moveTo(0, crossY);
          ctx.lineTo(canvasWidth, crossY);
          ctx.moveTo(crossX, 0);
          ctx.lineTo(crossX, canvasHeight);
          ctx.stroke();
        }
      } else if (seamType === 'horizontal') {
        const { canvas: gridCanvas, tileW, tileH } = createTileGrid(image, repeatType);

        // Source dimensions based on zoom (higher zoom = smaller source region)
        const sourceWidth = canvasWidth / zoomFactor;
        const sourceHeight = canvasHeight / zoomFactor;

        // Calculate which section to show
        const sectionWidth = tileW / 3;
        const baseSourceX = seamSection === 'start' ? 0 :
                           seamSection === 'middle' ? sectionWidth :
                           sectionWidth * 2;

        // Horizontal seam is at y = tileH in the grid
        // Center the view on the seam, apply pan offset
        const sourceX = baseSourceX - (sourceWidth - sectionWidth) / 2 - panOffset.x / zoomFactor;
        const clampedSourceX = Math.max(0, Math.min(sourceX, gridCanvas.width - sourceWidth));
        const sourceY = tileH - sourceHeight / 2 - panOffset.y / zoomFactor;
        const clampedSourceY = Math.max(0, Math.min(sourceY, gridCanvas.height - sourceHeight));

        // Draw from grid to fill entire canvas
        ctx.drawImage(
          gridCanvas,
          clampedSourceX, clampedSourceY, sourceWidth, sourceHeight,
          0, 0, canvasWidth, canvasHeight
        );

        // Draw pink seam line locked to pattern seam
        if (showPinkLines) {
          ctx.strokeStyle = seamLineColor;
          ctx.lineWidth = 3;
          const seamSourceY = tileH;
          const seamScreenY = ((seamSourceY - clampedSourceY) / sourceHeight) * canvasHeight;
          ctx.beginPath();
          ctx.moveTo(0, seamScreenY);
          ctx.lineTo(canvasWidth, seamScreenY);
          ctx.stroke();
        }

      } else {
        // Vertical seam
        const { canvas: gridCanvas, tileW, tileH } = createTileGrid(image, repeatType);

        // Source dimensions based on zoom (higher zoom = smaller source region)
        const sourceWidth = canvasWidth / zoomFactor;
        const sourceHeight = canvasHeight / zoomFactor;

        // Calculate which section to show
        const sectionHeight = tileH / 3;
        const baseSourceY = seamSection === 'start' ? 0 :
                           seamSection === 'middle' ? sectionHeight :
                           sectionHeight * 2;

        // Vertical seam is at x = tileW in the grid
        // Center the view on the seam, apply pan offset
        const sourceX = tileW - sourceWidth / 2 - panOffset.x / zoomFactor;
        const clampedSourceX = Math.max(0, Math.min(sourceX, gridCanvas.width - sourceWidth));
        const sourceY = baseSourceY - (sourceHeight - sectionHeight) / 2 - panOffset.y / zoomFactor;
        const clampedSourceY = Math.max(0, Math.min(sourceY, gridCanvas.height - sourceHeight));

        // Draw from grid to fill entire canvas
        ctx.drawImage(
          gridCanvas,
          clampedSourceX, clampedSourceY, sourceWidth, sourceHeight,
          0, 0, canvasWidth, canvasHeight
        );

        // Draw pink seam line locked to pattern seam
        if (showPinkLines) {
          ctx.strokeStyle = seamLineColor;
          ctx.lineWidth = 3;
          const seamSourceX = tileW;
          const seamScreenX = ((seamSourceX - clampedSourceX) / sourceWidth) * canvasWidth;
          ctx.beginPath();
          ctx.moveTo(seamScreenX, 0);
          ctx.lineTo(seamScreenX, canvasHeight);
          ctx.stroke();
        }
      }

      // Clear any previous error on successful render
      setRenderError(null);
    } catch (err) {
      console.error('Seam Inspector render error:', err);
      setRenderError('Unable to render seam view. Try reducing the zoom level or using a smaller image.');
    }
  }, [image, seamType, zoomLevel, seamSection, showPinkLines, repeatType, isOpen, containerSize, panOffset, seamLineColor]);

  if (!isOpen || !image) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl flex flex-col w-[95vw] h-[95vh] sm:w-[90vw] sm:h-[90vh] lg:w-[80vw] lg:h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-[#e5e7eb]">
          <h2 className="text-lg sm:text-xl font-bold text-[#294051]">Seam Inspector</h2>
          <button
            onClick={onClose}
            className="text-[#6b7280] hover:text-[#374151] text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Controls */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-[#e5e7eb] space-y-3 sm:space-y-4">
          {/* View Description */}
          <div className="bg-[#f5f5f5] p-2 sm:p-3 rounded-lg">
            <p className="text-xs sm:text-sm text-[#294051] font-medium">
              {seamType === 'intersection' &&
                '4-Corner Intersection: Shows where all four tiles meet. Pink crosshair marks the seam intersection.'}
              {seamType === 'horizontal' &&
                'Top/Bottom Seam: Inspecting where top and bottom edges meet.'}
              {seamType === 'vertical' &&
                'Left/Right Seam: Inspecting where left and right edges meet.'}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-start lg:gap-6">
            {/* Left column: Zoom + seam lines */}
            <div className="flex flex-col gap-2 sm:gap-3 lg:flex-1">
              {/* Show Pink Lines Toggle */}
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPinkLines}
                    onChange={(e) => setShowPinkLines(e.target.checked)}
                    className="w-4 h-4 rounded border-[#d1d5db] focus:ring-2 focus:ring-[#e0c26e]/20"
                    style={{ accentColor: '#e0c26e' }}
                  />
                  <span className="text-xs sm:text-sm font-semibold text-[#374151]">
                    Show Seam Lines
                  </span>
                </label>
              </div>

              {/* Zoom Controls */}
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="text-xs sm:text-sm font-semibold text-[#374151]">Zoom:</span>
                <button
                  onClick={() => setZoomLevel(prev => Math.max(50, prev - 25))}
                  className="px-2 sm:px-3 py-1 rounded font-semibold text-xs sm:text-sm bg-[#e5e7eb] text-[#374151] hover:bg-[#d1d5db] transition-colors"
                  aria-label="Zoom out"
                >
                  −
                </button>
                <button
                  onClick={() => setZoomLevel(50)}
                  className={`px-2 sm:px-3 py-1 rounded font-semibold text-xs sm:text-sm transition-colors ${
                    Math.abs(zoomLevel - 50) < 10
                      ? 'bg-[#e0c26e] text-white'
                      : 'bg-[#e5e7eb] text-[#374151] hover:bg-[#d1d5db]'
                  }`}
                >
                  50%
                </button>
                <button
                  onClick={() => setZoomLevel(100)}
                  className={`px-2 sm:px-3 py-1 rounded font-semibold text-xs sm:text-sm transition-colors ${
                    Math.abs(zoomLevel - 100) < 10
                      ? 'bg-[#e0c26e] text-white'
                      : 'bg-[#e5e7eb] text-[#374151] hover:bg-[#d1d5db]'
                  }`}
                >
                  100%
                </button>
                <button
                  onClick={() => setZoomLevel(200)}
                  className={`px-2 sm:px-3 py-1 rounded font-semibold text-xs sm:text-sm transition-colors ${
                    Math.abs(zoomLevel - 200) < 10
                      ? 'bg-[#e0c26e] text-white'
                      : 'bg-[#e5e7eb] text-[#374151] hover:bg-[#d1d5db]'
                  }`}
                >
                  200%
                </button>
                <button
                  onClick={() => setZoomLevel(400)}
                  className={`px-2 sm:px-3 py-1 rounded font-semibold text-xs sm:text-sm transition-colors ${
                    Math.abs(zoomLevel - 400) < 10
                      ? 'bg-[#e0c26e] text-white'
                      : 'bg-[#e5e7eb] text-[#374151] hover:bg-[#d1d5db]'
                  }`}
                >
                  400%
                </button>
                <button
                  onClick={() => setZoomLevel(prev => Math.min(400, prev + 25))}
                  className="px-2 sm:px-3 py-1 rounded font-semibold text-xs sm:text-sm bg-[#e5e7eb] text-[#374151] hover:bg-[#d1d5db] transition-colors"
                  aria-label="Zoom in"
                >
                  +
                </button>
                <span className="text-xs sm:text-sm text-[#6b7280] ml-1 sm:ml-2">
                  {Math.round(zoomLevel)}%
                </span>
              </div>
            </div>

            {/* Right column: View + advanced options */}
            <div className="flex flex-col gap-2 lg:flex-1">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setSeamType('intersection');
                    setSeamSection('middle');
                  }}
                  className={`flex-1 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
                    seamType === 'intersection'
                      ? 'bg-[#e0c26e] text-white'
                      : 'bg-[#e5e7eb] text-[#374151] hover:bg-[#d1d5db]'
                  }`}
                >
                  4-Corner Intersection (Recommended)
                </button>
              </div>
              <details className="text-sm">
                <summary className="cursor-pointer text-[#6b7280] hover:text-[#374151] text-xs sm:text-sm font-medium">
                  Advanced: Individual Seam Inspection
                </summary>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => {
                      setSeamType('horizontal');
                      setSeamSection('middle');
                    }}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
                      seamType === 'horizontal'
                        ? 'bg-[#e0c26e] text-white'
                        : 'bg-[#e5e7eb] text-[#374151] hover:bg-[#d1d5db]'
                    }`}
                  >
                    Top/Bottom
                  </button>
                  <button
                    onClick={() => {
                      setSeamType('vertical');
                      setSeamSection('middle');
                    }}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
                      seamType === 'vertical'
                        ? 'bg-[#e0c26e] text-white'
                        : 'bg-[#e5e7eb] text-[#374151] hover:bg-[#d1d5db]'
                    }`}
                  >
                    Left/Right
                  </button>
                </div>
              </details>
            </div>
          </div>
        </div>

        {/* Canvas Container */}
        <div
          ref={containerRef}
          className="flex-1 bg-[#294051] flex items-center justify-center p-3 sm:p-6 overflow-hidden relative"
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
          <canvas ref={canvasRef} className="block shadow-lg" />
          {renderError && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#294051]/90 p-6">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 max-w-sm text-center">
                <p className="text-sm text-orange-700 font-medium">{renderError}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-t border-[#e5e7eb]">
          <div className="bg-blue-50 border border-blue-200 p-2 sm:p-3 rounded-lg">
            <p className="text-xs sm:text-sm text-blue-900">
              <strong>What to look for:</strong> Perfect seams show no visible breaks or misalignment where tiles meet.
              {seamType === 'intersection' && ' Check all four quadrants where the tile lines cross.'}
              {' '}Drag to pan, use zoom controls to inspect closely.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Manual tiling fallback when DOMMatrix/setTransform is unavailable
function renderManualTiling(
  ctx: CanvasRenderingContext2D,
  gridCanvas: HTMLCanvasElement,
  tileW: number,
  tileH: number,
  canvasWidth: number,
  canvasHeight: number,
  zoomFactor: number,
  panOffset: { x: number; y: number }
) {
  const gridW = gridCanvas.width;
  const gridH = gridCanvas.height;
  const scaledGridW = gridW * zoomFactor;
  const scaledGridH = gridH * zoomFactor;

  const baseOffsetX = (canvasWidth / 2) + panOffset.x - (tileW * zoomFactor);
  const baseOffsetY = (canvasHeight / 2) + panOffset.y - (tileH * zoomFactor);

  const startTileX = Math.floor((0 - baseOffsetX) / scaledGridW) - 1;
  const startTileY = Math.floor((0 - baseOffsetY) / scaledGridH) - 1;
  const tilesNeededX = Math.ceil(canvasWidth / scaledGridW) + 2;
  const tilesNeededY = Math.ceil(canvasHeight / scaledGridH) + 2;

  for (let ty = startTileY; ty < startTileY + tilesNeededY; ty++) {
    for (let tx = startTileX; tx < startTileX + tilesNeededX; tx++) {
      const screenX = baseOffsetX + (tx * scaledGridW);
      const screenY = baseOffsetY + (ty * scaledGridH);
      ctx.drawImage(gridCanvas, screenX, screenY, scaledGridW, scaledGridH);
    }
  }
}
