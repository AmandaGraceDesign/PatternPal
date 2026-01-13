'use client';

import { useEffect, useRef, useState } from 'react';
import { PatternTiler, RepeatType } from '@/lib/tiling/PatternTiler';
import Ruler from './Ruler';
import { createSeamlessDefaultPattern } from '@/lib/utils/imageUtils';

interface PatternPreviewCanvasProps {
  image: HTMLImageElement | null;
  repeatType: RepeatType;
  tileWidth: number;
  tileHeight: number;
  dpi: number;
  zoom: number;
  showTileOutline: boolean;
  onZoomChange: (zoom: number) => void;
  canvasRef?: React.RefObject<HTMLCanvasElement>;
}

export default function PatternPreviewCanvas({
  image,
  repeatType,
  tileWidth,
  tileHeight,
  dpi,
  zoom,
  showTileOutline,
  onZoomChange,
  canvasRef: externalCanvasRef,
}: PatternPreviewCanvasProps) {
  const internalCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = externalCanvasRef || internalCanvasRef;
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [tileDisplaySize, setTileDisplaySize] = useState({ width: 0, height: 0 });
  const [dpr, setDpr] = useState(1);
  const [containerHeight, setContainerHeight] = useState(0);
  const imageRef = useRef<HTMLImageElement | null>(null);
  
  // Keep ref in sync with image prop
  useEffect(() => {
    imageRef.current = image;
  }, [image]);
  
  // Panning state
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Set device pixel ratio and canvas size
  useEffect(() => {
    const currentDpr = window.devicePixelRatio || 1;
    const updateCanvasSize = () => {
      setDpr(currentDpr);
      if (canvasRef.current) {
        const viewportHeight = window.innerHeight;
        
        // Canvas (pattern repeat area) is 110% of viewport height
        const displaySize = Math.round(viewportHeight * 1.1);
        
        // Container (background area) is 120% of viewport height for padding
        const containerSize = Math.round(viewportHeight * 1.2);
        
        const ctx = canvasRef.current.getContext('2d');
        
        // Set canvas internal size (scaled by DPR for high-DPI displays)
        canvasRef.current.width = displaySize * currentDpr;
        canvasRef.current.height = displaySize * currentDpr;
        
        // Set canvas display size (CSS) to logical size
        canvasRef.current.style.width = `${displaySize}px`;
        canvasRef.current.style.height = `${displaySize}px`;
        
        if (ctx) {
          // Scale context by DPR so all drawing uses display coordinates
          ctx.scale(currentDpr, currentDpr);
          
          // Enable high-quality image smoothing
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
        }
        
        console.log('Canvas size set:', displaySize, 'x', displaySize, 'at DPR:', currentDpr, '(internal:', displaySize * currentDpr, ')');
        console.log('Container size set:', containerSize, '(120% of viewport height)');
        
        setCanvasSize({ width: displaySize, height: displaySize });
        setContainerHeight(containerSize);
      }
    };
    
    // Initialize immediately
    updateCanvasSize();
    
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, []);

  // Convert display zoom (0-200) to actual zoom
  const displayZoomToActualZoom = (displayValue: number): number => {
    if (displayValue <= 100) {
      return 0.01 + (displayValue / 100) * 0.14;
    } else {
      return 0.15 + ((displayValue - 100) / 100) * 4.85;
    }
  };

  // Render pattern with zoom
  useEffect(() => {
    if (!canvasRef.current || canvasSize.width === 0) {
      console.log('Skipping render - canvas:', !!canvasRef.current, 'canvasSize:', canvasSize);
      return;
    }

    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) return;
    
    // Re-apply DPR scaling (in case context was reset)
    const currentDpr = window.devicePixelRatio || 1;
    
    // Reset transform and apply DPR scale
    canvasCtx.setTransform(1, 0, 0, 1, 0, 0);
    canvasCtx.scale(currentDpr, currentDpr);
    
    // Ensure high-quality rendering settings
    canvasCtx.imageSmoothingEnabled = true;
    canvasCtx.imageSmoothingQuality = 'high';
    
    // Clear canvas (using display coordinates since context is scaled)
    canvasCtx.fillStyle = '#ffffff'; // white background
    canvasCtx.fillRect(0, 0, canvasSize.width, canvasSize.height);

    if (!image) {
      // Render seamless default pattern from JPG
      const defaultPatternSize = 800;
      createSeamlessDefaultPattern(defaultPatternSize).then((defaultPatternCanvas) => {
        // Check if image was set while async was running
        if (imageRef.current) return;
        
        console.log('🔍 DEFAULT PATTERN - Canvas received:', {
          patternCanvasWidth: defaultPatternCanvas.width,
          patternCanvasHeight: defaultPatternCanvas.height,
        });
        
        const tiler = new PatternTiler(canvas, canvasSize.width, canvasSize.height);
        
        // Get the container size (viewport), not canvas size
        const viewportWidth = window.innerWidth;
        const tilesAcross = 5;
        const baseTileSize = Math.round(viewportWidth / tilesAcross);

        // Apply zoom to tile size
        const viewZoom = displayZoomToActualZoom(zoom);
        // Make default pattern 10% larger on page load
        const displayWidth = Math.round(baseTileSize * viewZoom * 1.1);
        const displayHeight = displayWidth; // Keep square

        console.log('🔍 DEFAULT PATTERN - Calculated size:', {
          viewportWidth,
          canvasWidth: canvasSize.width,
          tilesAcross,
          baseTileSize,
          viewZoom,
          displayWidth,
          displayHeight,
        });
        
        setTileDisplaySize({ width: displayWidth, height: displayHeight });
        
        // Scale the 800x800 pattern down to displayWidth x displayHeight
        const scaledCanvas = document.createElement('canvas');
        scaledCanvas.width = displayWidth;
        scaledCanvas.height = displayHeight;
        
        const scaledCtx = scaledCanvas.getContext('2d');
        if (scaledCtx) {
          // Use nearest-neighbor to preserve seamless edges
          scaledCtx.imageSmoothingEnabled = false;
          scaledCtx.drawImage(defaultPatternCanvas, 0, 0, displayWidth, displayHeight);
          
          const patternImg = new Image();
          patternImg.onload = () => {
            // Check again if image was set during image load
            if (imageRef.current) return;
            
            console.log('🔍 DEFAULT PATTERN - Image loaded:', {
              imgWidth: patternImg.width,
              imgHeight: patternImg.height,
            });
            
            tiler.render(patternImg, repeatType);
            
            // Draw tile outline for default pattern if enabled
            if (showTileOutline) {
              const currentDpr = window.devicePixelRatio || 1;
              canvasCtx.setTransform(1, 0, 0, 1, 0, 0);
              canvasCtx.scale(currentDpr, currentDpr);
              
              canvasCtx.imageSmoothingEnabled = true;
              canvasCtx.imageSmoothingQuality = 'high';
              
              let outlineX = 0;
              let outlineY = 0;
              
              if (repeatType === 'half-drop') {
                outlineX = displayWidth;
                outlineY = displayHeight / 2;
              }
              
              if (repeatType === 'half-brick') {
                outlineX = displayWidth / 2;
                outlineY = displayHeight;
              }
              
              canvasCtx.strokeStyle = '#ff1493';
              canvasCtx.lineWidth = 6;
              canvasCtx.setLineDash([]);
              canvasCtx.strokeRect(outlineX + 3, outlineY + 3, displayWidth - 6, displayHeight - 6);
            }
          };
          patternImg.src = scaledCanvas.toDataURL('image/png');
        }
      }).catch((error) => {
        console.error('Failed to load default pattern:', error);
      });
      return;
    }

    // Render actual pattern
    console.log('Rendering pattern...');
    
    const tiler = new PatternTiler(canvas, canvasSize.width, canvasSize.height);
    
    // Calculate displayed tile size based on ACTUAL DPI and zoom
    const viewZoom = displayZoomToActualZoom(zoom);
    const displayWidth = image.width * viewZoom;
    const displayHeight = image.height * viewZoom;
    
    // Create a scaled version of the image for tiling
    const scaledCanvas = document.createElement('canvas');
    scaledCanvas.width = displayWidth * dpr;
    scaledCanvas.height = displayHeight * dpr;
    
    // Store dimensions immediately for ruler calculations
    setTileDisplaySize({ width: displayWidth, height: displayHeight });
    
    const scaledCtx = scaledCanvas.getContext('2d');
    
    if (scaledCtx) {
      // Scale context by DPR
      scaledCtx.scale(dpr, dpr);
      
      // Enable high-quality image smoothing
      scaledCtx.imageSmoothingEnabled = true;
      scaledCtx.imageSmoothingQuality = 'high';
      
      // Draw original image to scaled canvas with high quality
      scaledCtx.drawImage(image, 0, 0, displayWidth, displayHeight);
      
      // Create image from canvas
      const scaledImg = new Image();
      scaledImg.onload = () => {
        // Check if image was removed while async was running
        if (!imageRef.current) return;
        
        console.log('Scaled image loaded, rendering pattern...');
        
        // Re-apply DPR scaling before rendering pattern
        const currentDpr = window.devicePixelRatio || 1;
        canvasCtx.setTransform(1, 0, 0, 1, 0, 0);
        canvasCtx.scale(currentDpr, currentDpr);
        canvasCtx.imageSmoothingEnabled = true;
        canvasCtx.imageSmoothingQuality = 'high';
        
        // Render the tiled pattern
        tiler.render(scaledImg, repeatType);
        
        // Draw tile outline if enabled
        if (showTileOutline) {
          // Re-apply DPR scaling
          const currentDpr = window.devicePixelRatio || 1;
          canvasCtx.setTransform(1, 0, 0, 1, 0, 0);
          canvasCtx.scale(currentDpr, currentDpr);
          canvasCtx.imageSmoothingEnabled = true;
          canvasCtx.imageSmoothingQuality = 'high';
          
          // Calculate pixels per unit using the SAME formula as the ruler
          const viewZoom = displayZoomToActualZoom(zoom);
          const tileWidthInches = image.width / dpi;
          const displayWidthPixels = image.width * viewZoom;
          
          const tileHeightInches = image.height / dpi;
          const displayHeightPixels = image.height * viewZoom;
          
          // Use the actual displayed pixel dimensions
          const outlineWidthPx = displayWidthPixels;
          const outlineHeightPx = displayHeightPixels;
          
          // Calculate outline position
          const tileW = outlineWidthPx;
          const tileH = outlineHeightPx;
          
          let outlineX = 0;
          let outlineY = 0;
          
          // Match the exact logic PatternTiler uses for positioning
          if (repeatType === 'full-drop') {
            outlineX = Math.round(0 * tileW);
            outlineY = Math.round(0 * tileH);
          } else if (repeatType === 'half-drop') {
            outlineX = Math.round(1 * tileW);
            const logicalY = (-1 * tileH) + (tileH / 2);
            outlineY = Math.round(logicalY);
            if (outlineY < 0) {
              outlineY = Math.round(tileH / 2);
            }
          } else if (repeatType === 'half-brick') {
            const logicalX = (-1 * tileW) + (tileW / 2);
            outlineX = Math.round(logicalX);
            outlineY = Math.round(1 * tileH);
            if (outlineX < 0) {
              outlineX = Math.round(tileW / 2);
            }
          }
          
          // Draw hot pink outline
          canvasCtx.strokeStyle = '#ff1493';
          canvasCtx.lineWidth = 6;
          canvasCtx.setLineDash([]);
          canvasCtx.strokeRect(outlineX + 3, outlineY + 3, outlineWidthPx - 6, outlineHeightPx - 6);
        }
      };
      
      scaledImg.onerror = (error) => {
        console.error('Failed to load scaled image:', error);
      };
      
      // Use PNG for lossless quality
      scaledImg.src = scaledCanvas.toDataURL('image/png');
    }
  }, [image, repeatType, zoom, dpi, showTileOutline, canvasSize, dpr]);

  // Calculate pixels per unit for ruler
  const horizontalPixelsPerUnit = image ? (() => {
    const tileWidthInches = image.width / dpi;
    const displayWidthPixels = image.width * displayZoomToActualZoom(zoom);
    return displayWidthPixels / tileWidthInches;
  })() : 96;
  
  const verticalPixelsPerUnit = image ? (() => {
    const tileHeightInches = image.height / dpi;
    const displayHeightPixels = image.height * displayZoomToActualZoom(zoom);
    return displayHeightPixels / tileHeightInches;
  })() : 96;

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Header with Zoom Slider */}
      <div className="h-12 border-b border-[#e5e7eb] px-6 flex items-center justify-between bg-white">
        <div className="flex items-center gap-4 flex-1">
          <label className="text-xs text-[#374151] font-semibold whitespace-nowrap">
            Zoom: {Math.round(zoom)}%
          </label>
          <div className="flex items-center gap-2 flex-1">
            <span className="text-xs text-[#6b7280] whitespace-nowrap">0%</span>
            <input
              type="range"
              min="0"
              max="200"
              step="1"
              value={Math.max(0, Math.min(200, zoom))}
              onChange={(e) => {
                const newZoom = parseInt(e.target.value);
                onZoomChange(Math.max(0, Math.min(200, newZoom)));
              }}
              className="flex-1 h-1.5 bg-[#e5e7eb] rounded-lg appearance-none cursor-pointer"
              style={{ accentColor: '#f1737c' }}
            />
            <span className="text-xs text-[#6b7280] whitespace-nowrap">200%</span>
          </div>
        </div>
      </div>

      {/* Canvas Preview Area with Rulers */}
      <div className="flex-1 flex flex-col bg-white overflow-hidden">
        {/* Top ruler */}
        <div className="flex border-b border-[#e5e7eb]">
          <div className="w-[30px] h-[30px] bg-[#e5e7eb] border-r border-[#d1d5db]" />
          <div className="flex-1 overflow-hidden">
            {image ? (
              <Ruler
                orientation="horizontal"
                length={canvasSize.width}
                scale={1}
                unit="in"
                pixelsPerUnit={horizontalPixelsPerUnit}
              />
            ) : (
              <div className="h-[30px] bg-[#e5e7eb]" />
            )}
          </div>
        </div>
        
        {/* Canvas with left ruler */}
        <div className="flex flex-1 overflow-auto">
          <div className="w-[30px] overflow-hidden border-r border-[#d1d5db]">
            {image ? (
              <Ruler
                orientation="vertical"
                length={canvasSize.height}
                scale={1}
                unit="in"
                pixelsPerUnit={verticalPixelsPerUnit}
              />
            ) : (
              <div className="w-[30px] bg-[#e5e7eb]" />
            )}
          </div>
          <div 
            className="flex-1 overflow-auto bg-white relative"
            style={{ minHeight: containerHeight > 0 ? `${containerHeight}px` : 'auto', cursor: isPanning ? 'grabbing' : 'grab' }}
            onWheel={(e) => {
              if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                e.stopPropagation();
                
                if (!canvasRef.current || !image) return;
                
                const rect = canvasRef.current.getBoundingClientRect();
                const scrollContainer = e.currentTarget;
                
                const mouseX = e.clientX - rect.left + scrollContainer.scrollLeft;
                const mouseY = e.clientY - rect.top + scrollContainer.scrollTop;
                
                const zoomDelta = -e.deltaY * 0.05;
                const newZoom = Math.max(0, Math.min(200, zoom + zoomDelta));
                
                const newViewZoom = displayZoomToActualZoom(newZoom);
                const currentViewZoom = displayZoomToActualZoom(zoom);
                
                const newDisplayWidth = image.width * newViewZoom;
                const newDisplayHeight = image.height * newViewZoom;
                
                const currentDisplayWidth = image.width * currentViewZoom;
                const currentDisplayHeight = image.height * currentViewZoom;
                
                const percentX = mouseX / currentDisplayWidth;
                const percentY = mouseY / currentDisplayHeight;
                
                const newMouseX = percentX * newDisplayWidth;
                const newMouseY = percentY * newDisplayHeight;
                
                const scrollDeltaX = newMouseX - mouseX;
                const scrollDeltaY = newMouseY - mouseY;
                
                onZoomChange(newZoom);
                
                requestAnimationFrame(() => {
                  scrollContainer.scrollLeft += scrollDeltaX;
                  scrollContainer.scrollTop += scrollDeltaY;
                });
              }
            }}
            onMouseDown={(e) => {
              const scrollContainer = e.currentTarget;
              setIsPanning(true);
              setPanStart({
                x: e.clientX + scrollContainer.scrollLeft,
                y: e.clientY + scrollContainer.scrollTop,
              });
            }}
            onMouseMove={(e) => {
              const scrollContainer = e.currentTarget;
              
              if (!isPanning) return;
              const dx = panStart.x - e.clientX;
              const dy = panStart.y - e.clientY;
              scrollContainer.scrollLeft = dx;
              scrollContainer.scrollTop = dy;
            }}
            onMouseLeave={() => {
              setIsPanning(false);
            }}
            onMouseUp={() => {
              setIsPanning(false);
            }}
          >
            <canvas
              ref={canvasRef}
              className="block"
            />
          </div>
        </div>
      </div>
    </div>
  );
}