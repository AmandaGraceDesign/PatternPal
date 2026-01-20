'use client';

import { useEffect, useRef, useState } from 'react';
import { PatternTiler, RepeatType } from '@/lib/tiling/PatternTiler';
import Ruler from './Ruler';

interface PatternPreviewCanvasProps {
  image: HTMLImageElement | null;
  repeatType: RepeatType;
  tileWidth: number;
  tileHeight: number;
  dpi: number;
  zoom: number;
  showTileOutline: boolean;
  onZoomChange: (zoom: number) => void;
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
}: PatternPreviewCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [tileDisplaySize, setTileDisplaySize] = useState({ width: 0, height: 0 });
  const [dpr, setDpr] = useState(1);
  const [containerHeight, setContainerHeight] = useState(0);

  // Set device pixel ratio and canvas size
  useEffect(() => {
    const currentDpr = window.devicePixelRatio || 1;
    // Use ref or move to callback to avoid setState in effect
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
  // Use a linear scale for smooth zooming
  const displayZoomToActualZoom = (displayValue: number): number => {
    // Linear mapping: 0% -> 0.02x, 100% -> 0.2x, 200% -> 0.4x
    // This gives smooth, predictable zoom behavior with smaller default size
    return (displayValue / 100) * 0.2;
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
    // Get current DPR
    const currentDpr = window.devicePixelRatio || 1;
    
    // Reset transform and apply DPR scale
    canvasCtx.setTransform(1, 0, 0, 1, 0, 0);
    canvasCtx.scale(currentDpr, currentDpr);
    
    // Ensure high-quality rendering settings
    canvasCtx.imageSmoothingEnabled = true;
    canvasCtx.imageSmoothingQuality = 'high';
    
    // Clear canvas (using display coordinates since context is scaled)
    canvasCtx.fillStyle = '#0f172a'; // slate-900
    canvasCtx.fillRect(0, 0, canvasSize.width, canvasSize.height);

    if (!image) {
      // Render placeholder pattern
      const placeholderImg = new Image();
      placeholderImg.onload = () => {
        const tiler = new PatternTiler(canvas, canvasSize.width, canvasSize.height);
        
        // Use default tile size for placeholder (18x18 inches at 150 DPI)
        const defaultDpi = 150;
        const defaultTileWidth = 18;
        const defaultTileHeight = 18;
        const placeholderWidth = defaultTileWidth * defaultDpi; // 2700px
        const placeholderHeight = defaultTileHeight * defaultDpi; // 2700px
        
        // Calculate display scale at 50% (0.5)
        const viewZoom = displayZoomToActualZoom(zoom);
        const displayScale = (96 / defaultDpi) * viewZoom * 0.5; // 50% scale
        
        const displayWidth = Math.round(placeholderWidth * displayScale);
        const displayHeight = Math.round(placeholderHeight * displayScale);
        setTileDisplaySize({ width: displayWidth, height: displayHeight });
        
        // Create scaled placeholder - scale by DPR for better quality
        const scaledCanvas = document.createElement('canvas');
        scaledCanvas.width = displayWidth * dpr;
        scaledCanvas.height = displayHeight * dpr;
        
        const scaledCtx = scaledCanvas.getContext('2d');
        if (scaledCtx) {
          // Scale context by DPR
          scaledCtx.scale(dpr, dpr);
          
          scaledCtx.imageSmoothingEnabled = true;
          scaledCtx.imageSmoothingQuality = 'high';
          scaledCtx.drawImage(placeholderImg, 0, 0, displayWidth, displayHeight);
          
          const scaledImg = new Image();
          scaledImg.onload = () => {
            tiler.render(scaledImg, repeatType);
            
            // Draw tile outline for placeholder if enabled
            if (showTileOutline) {
              // Re-apply DPR scaling
              const currentDpr = window.devicePixelRatio || 1;
              canvasCtx.setTransform(1, 0, 0, 1, 0, 0);
              canvasCtx.scale(currentDpr, currentDpr);
              
              canvasCtx.imageSmoothingEnabled = true;
              canvasCtx.imageSmoothingQuality = 'high';

              // Tile outline always starts at (0, 0) and shows the actual tile size
              // regardless of repeat type
              const outlineX = 0;
              const outlineY = 0;

              // Draw hot pink outline
              canvasCtx.strokeStyle = '#ff1493'; // Hot pink
              canvasCtx.lineWidth = 6;
              canvasCtx.setLineDash([]);
              canvasCtx.strokeRect(outlineX + 3, outlineY + 3, displayWidth - 6, displayHeight - 6);
            }
          };
          scaledImg.src = scaledCanvas.toDataURL('image/png');
        }
      };
      placeholderImg.src = '/placeholder-pattern.svg';
      return;
    }

    // Render actual pattern
    console.log('Rendering pattern...');
    const tiler = new PatternTiler(canvas, canvasSize.width, canvasSize.height);

    // Calculate display size based on physical tile dimensions and zoom
    // The tile should be displayed at a size where tileWidth inches = displayWidth pixels
    const viewZoom = displayZoomToActualZoom(zoom);

    // Calculate how many pixels should represent the physical tile dimensions at current zoom
    // Using the same calculation as the ruler: displayPixels = tileInches * pixelsPerInch
    // At zoom 100%, we want the tile to appear at its physical size relative to screen DPI (96)
    // So pixelsPerInch at zoom 100% = 96
    const pixelsPerInch = 96 * viewZoom;

    const displayWidth = Math.round(tileWidth * pixelsPerInch);
    const displayHeight = Math.round(tileHeight * pixelsPerInch);

    console.log('🎯 DISPLAY SIZE CALC:', {
      tileWidth,
      tileHeight,
      dpi,
      zoom,
      viewZoom,
      pixelsPerInch,
      displayWidth,
      displayHeight,
      imageWidth: image.width,
      imageHeight: image.height,
      imageDPI: dpi,
      devicePixelRatio: dpr,
    });

    // Create a scaled version of the image for tiling
    // DON'T scale by DPR here - PatternTiler uses image.width/height directly
    // The main canvas handles DPR scaling, not the tile image
    const scaledCanvas = document.createElement('canvas');
    scaledCanvas.width = displayWidth;
    scaledCanvas.height = displayHeight;

    const scaledCtx = scaledCanvas.getContext('2d');

    if (scaledCtx) {
      // Enable high-quality image smoothing
      scaledCtx.imageSmoothingEnabled = true;
      scaledCtx.imageSmoothingQuality = 'high';

      // Draw original image scaled to display size
      scaledCtx.drawImage(image, 0, 0, displayWidth, displayHeight);
      
      // Create image from canvas - use PNG for lossless quality
      const scaledImg = new Image();
      scaledImg.onload = () => {
        // #region agent log
        // #endregion
        
        console.log('Scaled image loaded, rendering pattern...');
        // Store tile display size in callback to avoid setState in effect
        setTileDisplaySize({ width: displayWidth, height: displayHeight });
        
        // Re-apply DPR scaling before rendering pattern (in case it was reset)
        const currentDpr = window.devicePixelRatio || 1;
        canvasCtx.setTransform(1, 0, 0, 1, 0, 0);
        canvasCtx.scale(currentDpr, currentDpr);
        canvasCtx.imageSmoothingEnabled = true;
        canvasCtx.imageSmoothingQuality = 'high';
        
        // Render the tiled pattern
        tiler.render(scaledImg, repeatType);
        
        // #region agent log
        // #endregion
        
        // #region agent log
        // #endregion
        
        // Draw tile outline if enabled (after pattern is rendered)
        // Draw synchronously to ensure it happens every render and uses current values
        if (showTileOutline) {
          // #region agent log
          // #endregion
          
          // Re-apply DPR scaling to ensure it's correct after PatternTiler.render()
          // PatternTiler might have modified the context, so we need to ensure our transform is correct
          const currentDpr = window.devicePixelRatio || 1;
          canvasCtx.setTransform(1, 0, 0, 1, 0, 0);
          canvasCtx.scale(currentDpr, currentDpr);
          canvasCtx.imageSmoothingEnabled = true;
          canvasCtx.imageSmoothingQuality = 'high';
          
          // Tile outline always starts at (0, 0) and shows the actual tile size
          // regardless of repeat type
          const outlineX = 0;
          const outlineY = 0;
          
          // #region agent log
          // #endregion
          
          // #region agent log
          // #endregion
          
          // Draw hot pink outline
          canvasCtx.strokeStyle = '#ff1493'; // Hot pink
          canvasCtx.lineWidth = 6;
          canvasCtx.setLineDash([]);
          canvasCtx.strokeRect(outlineX + 3, outlineY + 3, displayWidth - 6, displayHeight - 6);
          
          // #region agent log
          // #endregion
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
  // tileDisplaySize is the scaled tile size in pixels on screen
  // To convert to inches: divide by 96 (screen DPI)
  // pixelsPerUnit = pixels per inch = 96 (since screen is 96 DPI)
  // But we need to account for the scaled tile size
  // If scaled tile is displayWidth pixels, that represents scaledTileInches = displayWidth / 96
  // So pixelsPerUnit should be: displayWidth / scaledTileInches = 96
  // But wait - the ruler needs to know how many pixels = 1 inch in the current view
  
  // Actually, the ruler's pixelsPerUnit should be: how many screen pixels = 1 inch
  // Since screen is 96 DPI, 1 inch = 96 pixels always
  // But the ruler is showing the pattern's coordinate system, not screen coordinates
  
  // Let me think: if the pattern tile is scaled, we want the ruler to show inches based on the scaled size
  // If original tile is 8" and we zoom to 200%, the scaled tile is 16" in the pattern space
  // The ruler should show 0, 16, 32, 48... not 0, 8, 16, 24
  
  // So pixelsPerUnit = tileDisplaySize.width / scaledTileInches
  // scaledTileInches = originalTileInches * zoomFactor
  // But zoomFactor is not simple - it's viewZoom
  
  // Actually, simpler: tileDisplaySize.width is the pixel size of the scaled tile
  // To get inches: divide by 96
  // But we want pixelsPerUnit such that the ruler shows the right scale
  // If tileDisplaySize.width pixels = scaledTileInches inches
  // Then pixelsPerUnit = tileDisplaySize.width / scaledTileInches
  
  // But we need scaledTileInches. How do we get that?
  // We have: originalTileInches = image.width / dpi
  // We have: viewZoom = displayZoomToActualZoom(zoom)
  // We have: displayScale = (96 / dpi) * viewZoom
  // We have: displayWidth = image.width * displayScale = image.width * (96 / dpi) * viewZoom
  // So: displayWidth / 96 = (image.width / dpi) * viewZoom = originalTileInches * viewZoom = scaledTileInches
  
  // So: scaledTileInches = tileDisplaySize.width / 96
  // And: pixelsPerUnit = tileDisplaySize.width / scaledTileInches = tileDisplaySize.width / (tileDisplaySize.width / 96) = 96
  
  // That doesn't make sense. Let me reconsider.
  
  // The ruler shows inches. The pattern is scaled. 
  // If the pattern tile is 8" original and we zoom 2x, it becomes 16" in display
  // The ruler should show 0, 16, 32, 48...
  // So 1 inch on the ruler = ? pixels on screen
  
  // If 16" of pattern = tileDisplaySize.width pixels
  // Then 1" of pattern = tileDisplaySize.width / 16 pixels
  // So pixelsPerUnit = tileDisplaySize.width / scaledTileInches
  
  // scaledTileInches = originalTileInches * zoomMultiplier
  // But zoomMultiplier is not viewZoom directly...
  
  // Calculate pixels per unit for ruler
  // This must match exactly how we scale the pattern image
  // At zoom 100%, we want 96 pixels per inch (screen DPI)
  // Then multiply by viewZoom to get the actual pixels per inch at current zoom
  const viewZoom = displayZoomToActualZoom(zoom);
  const pixelsPerInch = 96 * viewZoom;

  const horizontalPixelsPerUnit = image ? pixelsPerInch : 96;
  const verticalPixelsPerUnit = image ? pixelsPerInch : 96;

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Header with Zoom Slider */}
      <div className="h-12 border-b border-[#e5e7eb] px-6 flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          <label className="text-xs text-[#294051] whitespace-nowrap">
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
        <div className="flex border-b border-[#cdcdcd]">
          <div className="w-[30px] h-[30px] bg-[#cdcdcd] border-r border-[#cdcdcd]" />
          <div className="flex-1 overflow-hidden">
            {tileDisplaySize.width > 0 && image ? (
              <Ruler
                orientation="horizontal"
                length={canvasSize.width}
                scale={1}
                unit="in"
                pixelsPerUnit={horizontalPixelsPerUnit}
              />
            ) : (
              <div className="h-[30px] bg-[#cdcdcd]" />
            )}
          </div>
        </div>

        {/* Canvas with left ruler */}
        <div className="flex flex-1 overflow-auto">
          <div className="w-[30px] overflow-hidden border-r border-[#cdcdcd]">
            {tileDisplaySize.height > 0 && image ? (
              <Ruler
                orientation="vertical"
                length={canvasSize.height}
                scale={1}
                unit="in"
                pixelsPerUnit={verticalPixelsPerUnit}
              />
            ) : (
              <div className="w-[30px] bg-[#cdcdcd]" />
            )}
          </div>
          <div
            className="flex-1 overflow-auto bg-white relative"
            style={{ minHeight: containerHeight > 0 ? `${containerHeight}px` : 'auto' }}
          >
            {/* Canvas - always rendered */}
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

