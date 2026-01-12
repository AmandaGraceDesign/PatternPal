'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import type { SeamAnalysisResult, RepeatType, EdgeComparison } from '@/lib/analysis/seamAnalyzer';
import { createSeamIntersectionView, createTileGridCanvas } from '@/lib/analysis/seamAnalyzer';

interface SeamAnalyzerModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: SeamAnalysisResult;
  repeatType: RepeatType;
  canvas: HTMLCanvasElement | null;
  showOverlay: boolean;
  overlayCanvas: HTMLCanvasElement | null;
  onShowOverlay: () => void;
  onShowProblemAreas: () => void;
}

export default function SeamAnalyzerModal({
  isOpen,
  onClose,
  analysis,
  repeatType,
  canvas,
  showOverlay,
  overlayCanvas,
  onShowOverlay,
  onShowProblemAreas,
}: SeamAnalyzerModalProps) {
  const [showFullView, setShowFullView] = useState(false);
  const [showPinkLines, setShowPinkLines] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(4); // Default 400%
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Create grid canvas once (can be cached)
  const gridCanvas = useMemo(() => {
    if (!canvas) return null;
    return createTileGridCanvas(canvas, repeatType);
  }, [canvas, repeatType]);
  
  // Get tile dimensions from canvas
  const tileWidth = canvas?.width || 0;
  const tileHeight = canvas?.height || 0;
  
  // Reset pan position when zoom level changes
  useEffect(() => {
    setPanPosition({ x: 0, y: 0 });
  }, [zoomLevel]);

  // Generate seam intersection view - ALWAYS show proof view, regardless of score
  const zoomedCornerCanvas = useMemo(() => {
    if (!gridCanvas) return null;
    return createSeamIntersectionView(gridCanvas, panPosition, tileWidth, tileHeight, repeatType, showPinkLines, zoomLevel);
  }, [gridCanvas, panPosition, tileWidth, tileHeight, repeatType, showPinkLines, zoomLevel]);
  
  // Render to canvas when zoomed view changes
  useEffect(() => {
    if (canvasRef.current && zoomedCornerCanvas) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        ctx.drawImage(zoomedCornerCanvas, 0, 0);
      }
    }
  }, [zoomedCornerCanvas]);
  
  // Mouse events
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY
    });
    setPanStart(panPosition);
  };
  
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !gridCanvas) return;
    
    // Calculate pan delta from mouse movement
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    
    // Apply delta to initial pan position
    const newX = panStart.x + deltaX;
    const newY = panStart.y + deltaY;
    
    // Constrain panning to bounds
    // Grid is gridCanvas.width pixels, we're viewing sourceSize pixels (before zoom)
    // We can pan by at most (gridCanvas.width - sourceSize) / 2 in grid pixels
    // Convert to screen pixels: multiply by zoom
    const canvasSize = 800;
    const sourceSize = canvasSize / zoomLevel;
    const maxPanX = (gridCanvas.width - sourceSize) * zoomLevel / 2;
    const maxPanY = (gridCanvas.height - sourceSize) * zoomLevel / 2;
    
    setPanPosition({
      x: Math.max(-maxPanX, Math.min(maxPanX, newX)),
      y: Math.max(-maxPanY, Math.min(maxPanY, newY))
    });
  };
  
  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  // Touch events for iPad
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({
      x: touch.clientX,
      y: touch.clientY
    });
    setPanStart(panPosition);
  };
  
  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDragging || !gridCanvas) return;
    e.preventDefault(); // Prevent scrolling
    const touch = e.touches[0];
    
    // Calculate pan delta from touch movement
    const deltaX = touch.clientX - dragStart.x;
    const deltaY = touch.clientY - dragStart.y;
    
    // Apply delta to initial pan position
    const newX = panStart.x + deltaX;
    const newY = panStart.y + deltaY;
    
    // Constrain panning to bounds
    // Grid is gridCanvas.width pixels, we're viewing sourceSize pixels (before zoom)
    // We can pan by at most (gridCanvas.width - sourceSize) / 2 in grid pixels
    // Convert to screen pixels: multiply by zoom
    const canvasSize = 800;
    const sourceSize = canvasSize / zoomLevel;
    const maxPanX = (gridCanvas.width - sourceSize) * zoomLevel / 2;
    const maxPanY = (gridCanvas.height - sourceSize) * zoomLevel / 2;
    
    setPanPosition({
      x: Math.max(-maxPanX, Math.min(maxPanX, newX)),
      y: Math.max(-maxPanY, Math.min(maxPanY, newY))
    });
  };
  
  const handleTouchEnd = () => {
    setIsDragging(false);
  };
  
  // Keyboard arrow key support
  useEffect(() => {
    if (!isOpen || showFullView || !showOverlay) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        const step = 10; // pixels to move
        setPanPosition(prev => {
          if (!gridCanvas) return prev;
          const canvasSize = 800;
          const sourceSize = canvasSize / zoomLevel;
          const maxPanX = (gridCanvas.width - sourceSize) * zoomLevel / 2;
          const maxPanY = (gridCanvas.height - sourceSize) * zoomLevel / 2;
          
          let newX = prev.x;
          let newY = prev.y;
          
          switch(e.key) {
            case 'ArrowLeft':
              newX = Math.max(-maxPanX, prev.x - step);
              break;
            case 'ArrowRight':
              newX = Math.min(maxPanX, prev.x + step);
              break;
            case 'ArrowUp':
              newY = Math.max(-maxPanY, prev.y - step);
              break;
            case 'ArrowDown':
              newY = Math.min(maxPanY, prev.y + step);
              break;
          }
          
          return { x: newX, y: newY };
        });
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showFullView, showOverlay, gridCanvas, zoomLevel]);
  
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getRepeatLabel = (type: RepeatType) => {
    switch (type) {
      case 'fulldrop': return 'Full Drop';
      case 'halfdrop': return 'Half Drop';
      case 'halfbrick': return 'Half Brick';
    }
  };

  const getSeamQualityLabel = (edge: EdgeComparison): string => {
    if (edge.avgDifference === 0) return '✅ Seamless';
    if (edge.avgDifference < 10) return '✅ Seamless';
    if (edge.avgDifference < 30) return '⚠️ Nearly seamless';
    return '❌ Seam issues';
  };

  const getSeamQualityDetail = (edge: EdgeComparison): string => {
    if (edge.avgDifference < 10) {
      return 'Perfect for printing! Any tiny differences won\'t be visible at normal viewing distance.';
    }
    if (edge.avgDifference < 30) {
      return 'Minor issues detected. Use the zoom view below to inspect seams closely.';
    }
    return 'Visible seam detected. Edges need adjustment before printing.';
  };

  const calculateOverallScore = (
    topBottom: EdgeComparison,
    leftRight: EdgeComparison
  ): number => {
    // Score should be 90+ if both edges are good (< 10 difference)
    let score = 100;
    score -= topBottom.avgDifference;
    score -= leftRight.avgDifference;
    return Math.max(0, Math.min(100, Math.round(score)));
  };

  const getStarRating = (score: number): string => {
    if (score >= 90) return '⭐⭐⭐⭐⭐';
    if (score >= 70) return '⭐⭐⭐⭐';
    if (score >= 50) return '⭐⭐⭐';
    if (score >= 30) return '⭐⭐';
    return '⭐';
  };

  const getActionableAdvice = (overallScore: number): string => {
    if (overallScore >= 90) {
      return '✅ Seamless! Ready to upload to Spoonflower.';
    }
    if (overallScore >= 70) {
      return '⚠️ Nearly seamless. Inspect the zoomed view to check for minor issues.';
    }
    return '❌ Seam issues detected. Recommend fixing edges before printing.';
  };

  const overallScore = calculateOverallScore(analysis.topBottom, analysis.leftRight);
  const stars = getStarRating(overallScore);

  return (
    <div 
      className="fixed inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg p-6 w-[80vw] h-[80vh] border border-[#e5e7eb] shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-[#294051]">Seam Analysis Results</h2>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-medium">
              {getRepeatLabel(repeatType)}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          {/* Results */}
          <div className="space-y-2 text-sm">
            {repeatType === 'fulldrop' && (
              <>
                <div className="p-2 bg-white rounded border border-[#e5e7eb] shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-[#294051]">Top ↕ Bottom:</span>
                    <span className={analysis.topBottom.avgDifference < 10 ? 'text-emerald-400 text-xs font-medium' : analysis.topBottom.avgDifference < 30 ? 'text-yellow-400 text-xs font-medium' : 'text-red-400 text-xs font-medium'}>
                      {getSeamQualityLabel(analysis.topBottom)}
                    </span>
                  </div>
                  <p className="text-xs text-[#374151] mt-1">
                    {getSeamQualityDetail(analysis.topBottom)}
                  </p>
                </div>
                
                <div className="p-2 bg-white rounded border border-[#e5e7eb] shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-[#294051]">Left ↔ Right:</span>
                    <span className={analysis.leftRight.avgDifference < 10 ? 'text-emerald-400 text-xs font-medium' : analysis.leftRight.avgDifference < 30 ? 'text-yellow-400 text-xs font-medium' : 'text-red-400 text-xs font-medium'}>
                      {getSeamQualityLabel(analysis.leftRight)}
                    </span>
                  </div>
                  <p className="text-xs text-[#374151] mt-1">
                    {getSeamQualityDetail(analysis.leftRight)}
                  </p>
                </div>
              </>
            )}

            {repeatType === 'halfdrop' && (
              <>
                <div className="p-2 bg-white rounded border border-[#e5e7eb] shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-[#294051]">Top ↕ Bottom:</span>
                    <span className={analysis.topBottom.avgDifference < 10 ? 'text-emerald-400 text-xs font-medium' : analysis.topBottom.avgDifference < 30 ? 'text-yellow-400 text-xs font-medium' : 'text-red-400 text-xs font-medium'}>
                      {getSeamQualityLabel(analysis.topBottom)}
                    </span>
                  </div>
                  <p className="text-xs text-[#374151] mt-1">
                    {getSeamQualityDetail(analysis.topBottom)}
                  </p>
                </div>
                
                <div className="p-2 bg-white rounded border border-[#e5e7eb] shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-[#294051]">Left ↔ Right <span className="text-[#374151]">(offset)</span>:</span>
                    <span className={analysis.leftRight.avgDifference < 10 ? 'text-emerald-400 text-xs font-medium' : analysis.leftRight.avgDifference < 30 ? 'text-yellow-400 text-xs font-medium' : 'text-red-400 text-xs font-medium'}>
                      {getSeamQualityLabel(analysis.leftRight)}
                    </span>
                  </div>
                  <p className="text-xs text-[#374151] mt-1">
                    {getSeamQualityDetail(analysis.leftRight)}
                  </p>
                </div>
              </>
            )}

            {repeatType === 'halfbrick' && (
              <>
                <div className="p-2 bg-white rounded border border-[#e5e7eb] shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-[#294051]">Top ↕ Bottom <span className="text-[#374151]">(offset)</span>:</span>
                    <span className={analysis.topBottom.avgDifference < 10 ? 'text-emerald-400 text-xs font-medium' : analysis.topBottom.avgDifference < 30 ? 'text-yellow-400 text-xs font-medium' : 'text-red-400 text-xs font-medium'}>
                      {getSeamQualityLabel(analysis.topBottom)}
                    </span>
                  </div>
                  <p className="text-xs text-[#374151] mt-1">
                    {getSeamQualityDetail(analysis.topBottom)}
                  </p>
                </div>
                
                <div className="p-2 bg-white rounded border border-[#e5e7eb] shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-[#294051]">Left ↔ Right:</span>
                    <span className={analysis.leftRight.avgDifference < 10 ? 'text-emerald-400 text-xs font-medium' : analysis.leftRight.avgDifference < 30 ? 'text-yellow-400 text-xs font-medium' : 'text-red-400 text-xs font-medium'}>
                      {getSeamQualityLabel(analysis.leftRight)}
                    </span>
                  </div>
                  <p className="text-xs text-[#374151] mt-1">
                    {getSeamQualityDetail(analysis.leftRight)}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Overall score */}
          <div className="p-3 bg-white rounded border border-[#e5e7eb] shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-[#294051]">Overall Quality:</span>
              <span className="text-sm font-bold text-[#294051]">
                {overallScore}/100 {stars}
              </span>
            </div>
            <div className="w-full bg-[#e5e7eb] rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all ${
                  overallScore >= 90 ? 'bg-emerald-500' :
                  overallScore >= 70 ? 'bg-yellow-500' :
                  'bg-red-500'
                }`}
                style={{ width: `${overallScore}%` }}
              />
            </div>
            <div className="text-xs mt-2 text-[#374151]">
              {getActionableAdvice(overallScore)}
            </div>
          </div>

          {/* Success message - shown when seamless (score >= 90) */}
          {overallScore >= 90 && (
            <div className="p-3 bg-emerald-100 border border-emerald-300 rounded">
              <p className="text-xs font-medium text-emerald-700">
                ✅ Perfect seamless {getRepeatLabel(repeatType).toLowerCase()} pattern!
              </p>
              <p className="text-xs text-emerald-600 mt-1">
                Ready to upload to Spoonflower or print-on-demand sites.
              </p>
            </div>
          )}

          {/* Issues Detected section - only shown when score < 90 */}
          {overallScore < 90 && !analysis.isPerfect && (
            <div className="p-3 bg-orange-100 border border-orange-300 rounded">
              <p className="text-xs font-medium text-orange-700 mb-2">⚠️ Issues Detected:</p>
              <ul className="text-xs text-orange-800 space-y-1">
                {!analysis.topBottom.match && (
                  <li>
                    • {analysis.topBottom.problemAreas.length} pixel{analysis.topBottom.problemAreas.length !== 1 ? 's' : ''} mismatched on 
                    {repeatType === 'halfbrick' ? ' top/bottom (offset) seam' : ' top/bottom seam'}
                  </li>
                )}
                {!analysis.leftRight.match && (
                  <li>
                    • {analysis.leftRight.problemAreas.length} pixel{analysis.leftRight.problemAreas.length !== 1 ? 's' : ''} mismatched on 
                    {repeatType === 'halfdrop' ? ' left/right (offset) seam' : ' left/right seam'}
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Show overlay button for highlighting problems - only when score < 90 */}
          {overallScore < 90 && (
            <button
              onClick={() => setShowPinkLines(!showPinkLines)}
              className="w-full px-4 py-2 text-white rounded mt-2 text-sm font-semibold transition-colors"
              style={{ backgroundColor: '#f1737c' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#ff8a94';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#f1737c';
              }}
            >
              {showPinkLines ? 'Hide Problem Highlights' : 'Show Problem Highlights'}
            </button>
          )}

          {/* Full view with highlights - only when showOverlay is true */}
          {showOverlay && overlayCanvas && showFullView && (
            <div className="space-y-3">
              <div className="border border-[#e5e7eb] rounded p-2 bg-white shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-[#294051]">
                    Full pattern view with highlights
                  </p>
                  <button
                    onClick={() => setShowFullView(false)}
                    className="text-xs px-2 py-1 rounded transition-colors text-white font-semibold"
                    style={{ backgroundColor: '#f1737c' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#ff8a94';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#f1737c';
                    }}
                  >
                    Show Zoomed View
                  </button>
                </div>
                <img 
                  src={overlayCanvas.toDataURL()} 
                  alt="Seam problems highlighted"
                  className="w-full h-auto border border-[#e5e7eb] rounded"
                />
                <p className="text-xs text-[#6b7280] mt-2">
                  💗 Pink lines show where tile edges connect
                </p>
              </div>
            </div>
          )}

          {/* Proof view - ALWAYS show, regardless of score */}
          {zoomedCornerCanvas && !showFullView && (
            <div className="space-y-3">
              <div className="border border-[#e5e7eb] rounded p-2 bg-white shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-[#294051]">
                      Viewing seam at {zoomLevel * 100}% zoom - Click and drag to move
                    </p>
                    <button
                      onClick={() => {
                        setShowFullView(true);
                        onClose();
                      }}
                      className="text-xs px-2 py-1 rounded transition-colors text-white font-semibold"
                      style={{ backgroundColor: '#f1737c' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#ff8a94';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#f1737c';
                      }}
                    >
                      Show Full View
                    </button>
                  </div>
                  
                  {/* Zoom controls and Show Lines checkbox */}
                  <div className="flex items-center gap-4 mb-4">
                    <span className="text-sm text-[#374151]">Zoom:</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setZoomLevel(2)}
                        className={`px-3 py-1 rounded text-sm transition-all duration-200 font-semibold ${
                          zoomLevel === 2 
                            ? 'bg-[#f1737c] text-white shadow-md' 
                            : 'bg-[#f1737c]/70 text-white hover:bg-[#f1737c]/85'
                        }`}
                      >
                        200%
                      </button>
                      <button
                        onClick={() => setZoomLevel(4)}
                        className={`px-3 py-1 rounded text-sm transition-all duration-200 font-semibold ${
                          zoomLevel === 4 
                            ? 'bg-[#f1737c] text-white shadow-md' 
                            : 'bg-[#f1737c]/70 text-white hover:bg-[#f1737c]/85'
                        }`}
                      >
                        400%
                      </button>
                      <button
                        onClick={() => setZoomLevel(8)}
                        className={`px-3 py-1 rounded text-sm transition-all duration-200 font-semibold ${
                          zoomLevel === 8 
                            ? 'bg-[#f1737c] text-white shadow-md' 
                            : 'bg-[#f1737c]/70 text-white hover:bg-[#f1737c]/85'
                        }`}
                      >
                        800%
                      </button>
                    </div>
                    
                    {/* Show Lines checkbox */}
                    <label className="flex items-center gap-2 text-sm text-[#374151] font-medium ml-auto cursor-pointer transition-all duration-200 hover:text-[#294051]">
                      <input
                        type="checkbox"
                        checked={showPinkLines}
                        onChange={(e) => setShowPinkLines(e.target.checked)}
                        className="w-4 h-4 rounded border-[#d1d5db] focus:ring-2 focus:ring-[#f1737c]/20"
                        style={{ accentColor: '#f1737c' }}
                      />
                      💗 Show Lines
                    </label>
                  </div>
                  
                  <div className="border border-[#e5e7eb] rounded bg-white overflow-hidden">
                    <canvas
                      ref={canvasRef}
                      width={800}
                      height={800}
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                      onTouchStart={handleTouchStart}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleTouchEnd}
                      className={`block border border-[#e5e7eb] ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                      style={{ 
                        touchAction: 'none',
                        maxWidth: '100%',
                        height: 'auto',
                        background: 'white'
                      }}
                    />
                  </div>
                  <p className="text-xs text-[#6b7280] mt-2">
                    {showPinkLines && (
                      <>
                        💗 Pink lines show where tile edges connect<br />
                      </>
                    )}
                    🖱️ Click and drag to inspect any area<br />
                    ⌨️ Use arrow keys for precise adjustments
                  </p>
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
