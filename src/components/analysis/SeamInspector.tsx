'use client';

import { useEffect, useRef, useState } from 'react';

interface SeamInspectorProps {
  image: HTMLImageElement | null;
  isOpen: boolean;
  onClose: () => void;
  repeatType: 'full-drop' | 'half-drop' | 'half-brick';
}

type SeamType = 'horizontal' | 'vertical' | 'intersection';
type SeamSection = 'start' | 'middle' | 'end';

// Helper function to create a 4x4 grid of tiles showing actual repeat
function createTileGrid(
  image: HTMLImageElement,
  repeatType: 'full-drop' | 'half-drop' | 'half-brick'
): HTMLCanvasElement {
  const tileW = image.naturalWidth || image.width;
  const tileH = image.naturalHeight || image.height;
  const gridCols = 4;
  const gridRows = 4;
  
  const gridCanvas = document.createElement('canvas');
  const extraWidth = repeatType === 'half-brick' ? tileW / 2 : 0;
  const extraHeight = repeatType === 'half-drop' ? tileH / 2 : 0;
  gridCanvas.width = tileW * gridCols + extraWidth;
  gridCanvas.height = tileH * gridRows + extraHeight;
  
  const ctx = gridCanvas.getContext('2d')!;
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

      ctx.drawImage(image, x, y, tileW, tileH);
    }
  }
  
  return gridCanvas;
}

export default function SeamInspector({ image, isOpen, onClose, repeatType }: SeamInspectorProps) {
  const [seamType, setSeamType] = useState<SeamType>('intersection');
  const [zoomLevel, setZoomLevel] = useState<number>(200); // Continuous zoom (percentage)
  const [seamSection, setSeamSection] = useState<SeamSection>('middle');
  const [showPinkLines, setShowPinkLines] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  
  // Pan state (in screen pixels, converted to source pixels when rendering)
  const [isPanning, setIsPanning] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

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

  // Render seam view
  useEffect(() => {
    if (!image || !canvasRef.current || !isOpen || containerSize.width === 0 || containerSize.height === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const zoomFactor = zoomLevel / 100;

    // Canvas fills available container area (accounting for padding)
    const padding = 48; // 24px padding on each side
    const canvasWidth = Math.max(0, containerSize.width - padding);
    const canvasHeight = Math.max(0, containerSize.height - padding);

    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    if (seamType === 'intersection') {
      // Create 2x2 grid showing actual repeat
      const gridCanvas = createTileGrid(image, repeatType);
      const tileW = image.naturalWidth || image.width;
      const tileH = image.naturalHeight || image.height;

      // Fill the entire view with a repeated grid, centered on the top-left corner intersection
      const pattern = ctx.createPattern(gridCanvas, 'repeat');
      if (pattern && typeof pattern.setTransform === 'function') {
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
      } else {
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

      // Draw pink crosshair aligned with the tiled pattern intersection
      if (showPinkLines) {
        ctx.strokeStyle = '#ff1493';
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
      // Create 2x2 grid
      const gridCanvas = createTileGrid(image, repeatType);
      const tileW = image.naturalWidth || image.width;
      const tileH = image.naturalHeight || image.height;
      
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
      
      // Draw pink seam line at center
      if (showPinkLines) {
        ctx.strokeStyle = '#ff1493';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, canvasHeight / 2);
        ctx.lineTo(canvasWidth, canvasHeight / 2);
        ctx.stroke();
      }
      
    } else {
      // Vertical seam
      const gridCanvas = createTileGrid(image, repeatType);
      const tileW = image.naturalWidth || image.width;
      const tileH = image.naturalHeight || image.height;
      
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
      
      // Draw pink seam line at center
      if (showPinkLines) {
        ctx.strokeStyle = '#ff1493';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(canvasWidth / 2, 0);
        ctx.lineTo(canvasWidth / 2, canvasHeight);
        ctx.stroke();
      }
    }
  }, [image, seamType, zoomLevel, seamSection, showPinkLines, repeatType, isOpen, containerSize, panOffset]);

  if (!isOpen || !image) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl flex flex-col"
        style={{ width: '80vw', height: '80vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5e7eb]">
          <h2 className="text-xl font-bold text-[#294051]">Seam Inspector</h2>
          <button
            onClick={onClose}
            className="text-[#6b7280] hover:text-[#374151] text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Controls */}
        <div className="px-6 py-4 border-b border-[#e5e7eb] space-y-4">
          {/* View Description */}
          <div className="bg-[#f5f5f5] p-3 rounded-lg">
            <p className="text-sm text-[#294051] font-medium">
              {seamType === 'intersection' &&
                '4-Corner Intersection: Shows where all four tiles meet. Pink crosshair marks the seam intersection.'}
              {seamType === 'horizontal' &&
                'Top/Bottom Seam: Inspecting where top and bottom edges meet.'}
              {seamType === 'vertical' &&
                'Left/Right Seam: Inspecting where left and right edges meet.'}
            </p>
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
            {/* Left column: Zoom + seam lines */}
            <div className="flex flex-col gap-3 lg:flex-1">
              {/* Show Pink Lines Toggle */}
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPinkLines}
                    onChange={(e) => setShowPinkLines(e.target.checked)}
                    className="w-4 h-4 rounded border-[#d1d5db] focus:ring-2 focus:ring-[#f1737c]/20"
                    style={{ accentColor: '#f1737c' }}
                  />
                  <span className="text-sm font-semibold text-[#374151]">
                    Show Seam Lines
                  </span>
                </label>
              </div>

              {/* Zoom Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-[#374151]">Zoom:</span>
                <button
                  onClick={() => setZoomLevel(prev => Math.max(100, prev - 25))}
                  className="px-3 py-1 rounded font-semibold bg-[#e5e7eb] text-[#374151] hover:bg-[#d1d5db] transition-colors"
                  aria-label="Zoom out"
                >
                  −
                </button>
                <button
                  onClick={() => setZoomLevel(100)}
                  className={`px-3 py-1 rounded font-semibold transition-colors ${
                    Math.abs(zoomLevel - 100) < 10
                      ? 'bg-[#f1737c] text-white'
                      : 'bg-[#e5e7eb] text-[#374151] hover:bg-[#d1d5db]'
                  }`}
                >
                  100%
                </button>
                <button
                  onClick={() => setZoomLevel(200)}
                  className={`px-3 py-1 rounded font-semibold transition-colors ${
                    Math.abs(zoomLevel - 200) < 10
                      ? 'bg-[#f1737c] text-white'
                      : 'bg-[#e5e7eb] text-[#374151] hover:bg-[#d1d5db]'
                  }`}
                >
                  200%
                </button>
                <button
                  onClick={() => setZoomLevel(400)}
                  className={`px-3 py-1 rounded font-semibold transition-colors ${
                    Math.abs(zoomLevel - 400) < 10
                      ? 'bg-[#f1737c] text-white'
                      : 'bg-[#e5e7eb] text-[#374151] hover:bg-[#d1d5db]'
                  }`}
                >
                  400%
                </button>
                <button
                  onClick={() => setZoomLevel(prev => Math.min(400, prev + 25))}
                  className="px-3 py-1 rounded font-semibold bg-[#e5e7eb] text-[#374151] hover:bg-[#d1d5db] transition-colors"
                  aria-label="Zoom in"
                >
                  +
                </button>
                <span className="text-sm text-[#6b7280] ml-2">
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
                  className={`flex-1 px-4 py-2.5 rounded-lg font-semibold transition-colors ${
                    seamType === 'intersection'
                      ? 'bg-[#f1737c] text-white'
                      : 'bg-[#e5e7eb] text-[#374151] hover:bg-[#d1d5db]'
                  }`}
                >
                  4-Corner Intersection (Recommended)
                </button>
              </div>
              <details className="text-sm">
                <summary className="cursor-pointer text-[#6b7280] hover:text-[#374151] font-medium">
                  Advanced: Individual Seam Inspection
                </summary>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => {
                      setSeamType('horizontal');
                      setSeamSection('middle');
                    }}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      seamType === 'horizontal'
                        ? 'bg-[#f1737c] text-white'
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
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      seamType === 'vertical'
                        ? 'bg-[#f1737c] text-white'
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
          className="flex-1 bg-[#294051] flex items-center justify-center p-6 overflow-hidden"
          style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
          onMouseDown={(e) => {
            setIsPanning(true);
            setDragStart({ x: e.clientX, y: e.clientY });
            setPanStart(panOffset);
          }}
          onMouseMove={(e) => {
            if (!isPanning) return;
            const deltaX = e.clientX - dragStart.x;
            const deltaY = e.clientY - dragStart.y;
            setPanOffset({
              x: panStart.x + deltaX,
              y: panStart.y + deltaY
            });
          }}
          onMouseUp={() => setIsPanning(false)}
          onMouseLeave={() => setIsPanning(false)}
        >
          <canvas ref={canvasRef} className="block shadow-lg" />
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#e5e7eb]">
          <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
            <p className="text-sm text-blue-900">
              <strong>💡 What to look for:</strong> Perfect seams show no visible breaks or misalignment where tiles meet.
              {seamType === 'intersection' && ' Check all four quadrants where the pink lines cross.'}
              {' '}Drag to pan, use zoom controls to inspect closely.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
