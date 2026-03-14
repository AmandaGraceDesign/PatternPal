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

export default function SeamInspector({ image, isOpen, onClose, repeatType, seamLineColor = '#38bdf8' }: SeamInspectorProps) {
  const [seamType, setSeamType] = useState<SeamType>('intersection');
  const [zoomLevel, setZoomLevel] = useState<number>(200);
  const [seamSection, setSeamSection] = useState<SeamSection>('middle');
  const [showPinkLines, setShowPinkLines] = useState(true);
  const [renderError, setRenderError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Pan state
  const [isPanning, setIsPanning] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

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

  // Reset pan when changing views
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
      const safeDpr = Math.min(dpr, 2);
      const zoomFactor = zoomLevel / 100;

      const padding = 48;
      const canvasWidth = Math.max(0, containerSize.width - padding);
      const canvasHeight = Math.max(0, containerSize.height - padding);

      canvas.width = canvasWidth * safeDpr;
      canvas.height = canvasHeight * safeDpr;
      canvas.style.width = `${canvasWidth}px`;
      canvas.style.height = `${canvasHeight}px`;

      ctx.setTransform(safeDpr, 0, 0, safeDpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);

      const srcW = image.naturalWidth;
      const srcH = image.naturalHeight;
      const scaledW = srcW * zoomFactor;
      const scaledH = srcH * zoomFactor;

      if (seamType === 'intersection') {
        // Center the view on the intersection of 4 tiles
        const centerX = (canvasWidth / 2) + panOffset.x;
        const centerY = (canvasHeight / 2) + panOffset.y;

        const basePanX = centerX - scaledW;
        const basePanY = centerY - scaledH;

        const startCol = Math.floor(-basePanX / scaledW) - 1;
        const endCol = Math.ceil((canvasWidth - basePanX) / scaledW);
        const startRow = Math.floor(-basePanY / scaledH) - 1;
        const endRow = Math.ceil((canvasHeight - basePanY) / scaledH);

        for (let col = startCol; col <= endCol; col++) {
          for (let row = startRow; row <= endRow; row++) {
            let dx = col * scaledW + basePanX;
            let dy = row * scaledH + basePanY;

            if (repeatType === 'half-drop') {
              dy += (((col % 2) + 2) % 2 !== 0) ? scaledH / 2 : 0;
            } else if (repeatType === 'half-brick') {
              dx += (((row % 2) + 2) % 2 !== 0) ? scaledW / 2 : 0;
            }

            if (dx + scaledW <= 0 || dy + scaledH <= 0 || dx >= canvasWidth || dy >= canvasHeight) continue;
            ctx.drawImage(image, 0, 0, srcW, srcH, dx, dy, scaledW, scaledH);
          }
        }

        // Draw pink crosshair
        if (showPinkLines) {
          ctx.strokeStyle = seamLineColor;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(0, centerY);
          ctx.lineTo(canvasWidth, centerY);
          ctx.moveTo(centerX, 0);
          ctx.lineTo(centerX, canvasHeight);
          ctx.stroke();
        }
      } else if (seamType === 'horizontal') {
        // Section offset along the seam
        const sectionWidth = scaledW / 3;
        const sectionOffset = seamSection === 'start' ? 0 :
                              seamSection === 'middle' ? sectionWidth :
                              sectionWidth * 2;

        // Center view on horizontal seam at the selected section
        const basePanX = (canvasWidth / 2) - sectionOffset - sectionWidth / 2 + panOffset.x;
        const basePanY = (canvasHeight / 2) - scaledH + panOffset.y;

        const startCol = Math.floor(-basePanX / scaledW) - 1;
        const endCol = Math.ceil((canvasWidth - basePanX) / scaledW);
        const startRow = Math.floor(-basePanY / scaledH) - 1;
        const endRow = Math.ceil((canvasHeight - basePanY) / scaledH);

        for (let col = startCol; col <= endCol; col++) {
          for (let row = startRow; row <= endRow; row++) {
            let dx = col * scaledW + basePanX;
            let dy = row * scaledH + basePanY;

            if (repeatType === 'half-brick') {
              dx += (((row % 2) + 2) % 2 !== 0) ? scaledW / 2 : 0;
            }

            if (dx + scaledW <= 0 || dy + scaledH <= 0 || dx >= canvasWidth || dy >= canvasHeight) continue;
            ctx.drawImage(image, 0, 0, srcW, srcH, dx, dy, scaledW, scaledH);
          }
        }

        // Draw pink seam line at the horizontal seam
        if (showPinkLines) {
          const seamY = (canvasHeight / 2) + panOffset.y;
          ctx.strokeStyle = seamLineColor;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(0, seamY);
          ctx.lineTo(canvasWidth, seamY);
          ctx.stroke();
        }
      } else {
        // Vertical seam
        const sectionHeight = scaledH / 3;
        const sectionOffset = seamSection === 'start' ? 0 :
                              seamSection === 'middle' ? sectionHeight :
                              sectionHeight * 2;

        // Center view on vertical seam at the selected section
        const basePanX = (canvasWidth / 2) - scaledW + panOffset.x;
        const basePanY = (canvasHeight / 2) - sectionOffset - sectionHeight / 2 + panOffset.y;

        const startCol = Math.floor(-basePanX / scaledW) - 1;
        const endCol = Math.ceil((canvasWidth - basePanX) / scaledW);
        const startRow = Math.floor(-basePanY / scaledH) - 1;
        const endRow = Math.ceil((canvasHeight - basePanY) / scaledH);

        for (let col = startCol; col <= endCol; col++) {
          for (let row = startRow; row <= endRow; row++) {
            let dx = col * scaledW + basePanX;
            let dy = row * scaledH + basePanY;

            if (repeatType === 'half-drop') {
              dy += (((col % 2) + 2) % 2 !== 0) ? scaledH / 2 : 0;
            }

            if (dx + scaledW <= 0 || dy + scaledH <= 0 || dx >= canvasWidth || dy >= canvasHeight) continue;
            ctx.drawImage(image, 0, 0, srcW, srcH, dx, dy, scaledW, scaledH);
          }
        }

        // Draw pink seam line at the vertical seam
        if (showPinkLines) {
          const seamX = (canvasWidth / 2) + panOffset.x;
          ctx.strokeStyle = seamLineColor;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(seamX, 0);
          ctx.lineTo(seamX, canvasHeight);
          ctx.stroke();
        }
      }

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
                  onClick={() => setZoomLevel(prev => Math.max(100, prev - 25))}
                  className="px-2 sm:px-3 py-1 rounded font-semibold text-xs sm:text-sm bg-[#e5e7eb] text-[#374151] hover:bg-[#d1d5db] transition-colors"
                  aria-label="Zoom out"
                >
                  −
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
                  onClick={() => setZoomLevel(800)}
                  className={`px-2 sm:px-3 py-1 rounded font-semibold text-xs sm:text-sm transition-colors ${
                    Math.abs(zoomLevel - 800) < 10
                      ? 'bg-[#e0c26e] text-white'
                      : 'bg-[#e5e7eb] text-[#374151] hover:bg-[#d1d5db]'
                  }`}
                >
                  800%
                </button>
                <button
                  onClick={() => setZoomLevel(prev => Math.min(800, prev + 25))}
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
