'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import type { RepeatType } from '@/lib/analysis/seamAnalyzer';
import { createSeamViewCanvas, type SeamView } from '@/lib/analysis/seamInspectorUtils';

interface SeamInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  canvas: HTMLCanvasElement | null;
  repeatType: RepeatType;
}

export default function SeamInspectorModal({
  isOpen,
  onClose,
  canvas,
  repeatType,
}: SeamInspectorModalProps) {
  const [seamView, setSeamView] = useState<SeamView>('horizontal');
  const [zoomLevel, setZoomLevel] = useState<2 | 4 | 8>(2); // Default 200%
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [seamPosition, setSeamPosition] = useState(50); // Start at middle (50%)
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Reset pan position when zoom level or seam view changes
  useEffect(() => {
    setPanPosition({ x: 0, y: 0 });
  }, [zoomLevel, seamView]);

  // Generate seam view canvas
  const seamViewCanvas = useMemo(() => {
    if (!canvas) return null;
    
    // Use fixed canvas dimensions that will fit in the modal
    // Modal is 80vw × 80vh, content area is roughly 80vw × (80vh - header - footer)
    // Estimate: ~80vw × ~70vh for the canvas area
    const canvasWidth = Math.floor(window.innerWidth * 0.8 * 0.95);
    const canvasHeight = Math.floor(window.innerHeight * 0.8 * 0.75);
    
    return createSeamViewCanvas(
      canvas,
      repeatType,
      seamView,
      zoomLevel,
      seamPosition,
      panPosition,
      canvasWidth,
      canvasHeight
    );
  }, [canvas, repeatType, seamView, zoomLevel, seamPosition, panPosition]);

  // Render to canvas when view changes
  useEffect(() => {
    if (canvasRef.current && seamViewCanvas) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        canvasRef.current.width = seamViewCanvas.width;
        canvasRef.current.height = seamViewCanvas.height;
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        ctx.drawImage(seamViewCanvas, 0, 0);
      }
    }
  }, [seamViewCanvas]);

  // Mouse events for panning
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY
    });
    setPanStart(panPosition);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    
    setPanPosition({
      x: panStart.x + deltaX,
      y: panStart.y + deltaY
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Navigation along seam
  const handleNavigateSeam = (direction: 'left' | 'right' | 'up' | 'down') => {
    const step = 5; // Move 5% per click
    
    if (seamView === 'horizontal') {
      if (direction === 'left') {
        setSeamPosition(Math.max(0, seamPosition - step));
      } else if (direction === 'right') {
        setSeamPosition(Math.min(100, seamPosition + step));
      }
    } else {
      if (direction === 'up') {
        setSeamPosition(Math.max(0, seamPosition - step));
      } else if (direction === 'down') {
        setSeamPosition(Math.min(100, seamPosition + step));
      }
    }
  };

  // Keyboard support
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      
      if (seamView === 'horizontal') {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          handleNavigateSeam('left');
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          handleNavigateSeam('right');
        }
      } else {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          handleNavigateSeam('up');
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          handleNavigateSeam('down');
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, seamView, seamPosition, onClose]);

  if (!isOpen || !canvas) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-2xl w-[80vw] h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-4">
            {/* Seam View Selector */}
            <div className="flex gap-2">
              <button
                onClick={() => setSeamView('horizontal')}
                className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
                  seamView === 'horizontal'
                    ? 'bg-[#f1737c] text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Top/Bottom Seam
              </button>
              <button
                onClick={() => setSeamView('vertical')}
                className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
                  seamView === 'vertical'
                    ? 'bg-[#f1737c] text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Left/Right Seam
              </button>
            </div>

            {/* Zoom Controls */}
            <div className="flex gap-2">
              <button
                onClick={() => setZoomLevel(2)}
                className={`px-3 py-2 rounded-md text-sm font-semibold transition-colors ${
                  zoomLevel === 2
                    ? 'bg-[#f1737c] text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                200%
              </button>
              <button
                onClick={() => setZoomLevel(4)}
                className={`px-3 py-2 rounded-md text-sm font-semibold transition-colors ${
                  zoomLevel === 4
                    ? 'bg-[#f1737c] text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                400%
              </button>
              <button
                onClick={() => setZoomLevel(8)}
                className={`px-3 py-2 rounded-md text-sm font-semibold transition-colors ${
                  zoomLevel === 8
                    ? 'bg-[#f1737c] text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                800%
              </button>
            </div>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 relative overflow-hidden">
          {/* Navigation Arrows */}
          {seamView === 'horizontal' ? (
            <>
              <button
                onClick={() => handleNavigateSeam('left')}
                disabled={seamPosition <= 0}
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-[#f1737c] text-white p-2 rounded-full hover:bg-[#ff8a94] transition-colors disabled:opacity-50 disabled:cursor-not-allowed z-10"
                aria-label="Move left along seam"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={() => handleNavigateSeam('right')}
                disabled={seamPosition >= 100}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-[#f1737c] text-white p-2 rounded-full hover:bg-[#ff8a94] transition-colors disabled:opacity-50 disabled:cursor-not-allowed z-10"
                aria-label="Move right along seam"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => handleNavigateSeam('up')}
                disabled={seamPosition <= 0}
                className="absolute top-4 left-1/2 -translate-x-1/2 bg-[#f1737c] text-white p-2 rounded-full hover:bg-[#ff8a94] transition-colors disabled:opacity-50 disabled:cursor-not-allowed z-10"
                aria-label="Move up along seam"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </button>
              <button
                onClick={() => handleNavigateSeam('down')}
                disabled={seamPosition >= 100}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[#f1737c] text-white p-2 rounded-full hover:bg-[#ff8a94] transition-colors disabled:opacity-50 disabled:cursor-not-allowed z-10"
                aria-label="Move down along seam"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </>
          )}

          {/* Canvas */}
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className={`w-full h-full ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            style={{ touchAction: 'none' }}
          />
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200">
          <p className="text-sm text-gray-600 text-center">
            💡 Look for color breaks or pattern misalignment at the seam line
          </p>
        </div>
      </div>
    </div>
  );
}
