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
              
              // For Full Drop: tiles are on a perfect grid starting at 0,0
              let outlineX = 0;
              let outlineY = 0;
              
              // For Half Drop: columns alternate with vertical offset
              if (repeatType === 'half-drop') {
                outlineX = displayWidth;
                outlineY = displayHeight / 2;
              }
              
              // For Half Brick: rows alternate with horizontal offset
              if (repeatType === 'half-brick') {
                outlineX = displayWidth / 2;
                outlineY = displayHeight;
              }
              
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
        fetch('http://127.0.0.1:7242/ingest/f37b4cf4-ef5d-4355-935c-d1043bf409fa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PatternPreviewCanvas.tsx:229',message:'Scaled image loaded, starting render',data:{displayWidth,displayHeight,repeatType,zoom,showTileOutline,imageWidth:image.width,imageHeight:image.height,dpi},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
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
        fetch('http://127.0.0.1:7242/ingest/f37b4cf4-ef5d-4355-935c-d1043bf409fa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PatternPreviewCanvas.tsx:246',message:'Pattern tiled, checking context state',data:{showTileOutline,transformA:canvasCtx.getTransform().a,transformD:canvasCtx.getTransform().d,transformE:canvasCtx.getTransform().e,transformF:canvasCtx.getTransform().f},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
        // #endregion
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/f37b4cf4-ef5d-4355-935c-d1043bf409fa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PatternPreviewCanvas.tsx:234',message:'Pattern tiled, about to draw outline',data:{showTileOutline},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        
        // Draw tile outline if enabled (after pattern is rendered)
        // Draw synchronously to ensure it happens every render and uses current values
        if (showTileOutline) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/f37b4cf4-ef5d-4355-935c-d1043bf409fa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PatternPreviewCanvas.tsx:238',message:'Drawing tile outline',data:{showTileOutline,repeatType,displayWidth,displayHeight,zoom,canvasSizeWidth:canvasSize.width,canvasSizeHeight:canvasSize.height},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          
          // Re-apply DPR scaling to ensure it's correct after PatternTiler.render()
          // PatternTiler might have modified the context, so we need to ensure our transform is correct
          const currentDpr = window.devicePixelRatio || 1;
          canvasCtx.setTransform(1, 0, 0, 1, 0, 0);
          canvasCtx.scale(currentDpr, currentDpr);
          canvasCtx.imageSmoothingEnabled = true;
          canvasCtx.imageSmoothingQuality = 'high';
          
          // Calculate outline position to match where PatternTiler actually draws tiles
          // PatternTiler uses scaledImg.width and scaledImg.height (which equals displayWidth/Height)
          const tileW = displayWidth;  // Scaled image width = tile width
          const tileH = displayHeight; // Scaled image height = tile height
          
          let outlineX = 0;
          let outlineY = 0;
          
          // Match the exact logic PatternTiler uses for positioning
          if (repeatType === 'full-drop') {
            // Full drop: x=0, y=0 -> first tile at (0, 0)
            outlineX = Math.round(0 * tileW);
            outlineY = Math.round(0 * tileH);
          } else if (repeatType === 'half-drop') {
            // Half drop: column 1 (x=1), row -1 with offset
            // x0 = Math.round(1 * tileW) = tileW
            // logicalY = (-1 * tileH) + (tileH / 2) = -tileH/2
            // y0 = Math.round(-tileH/2)
            // If negative, we want the first visible tile, which would be at y=0 for column 0
            // For column 1, first visible is at approximately tileH/2
            outlineX = Math.round(1 * tileW);
            const logicalY = (-1 * tileH) + (tileH / 2);
            outlineY = Math.round(logicalY);
            // If negative, find first positive position
            if (outlineY < 0) {
              outlineY = Math.round(tileH / 2);
            }
          } else if (repeatType === 'half-brick') {
            // Half brick: row 1 (y=1), column -1 with offset
            // y0 = Math.round(1 * tileH) = tileH
            // logicalX = (-1 * tileW) + (tileW / 2) = -tileW/2
            // x0 = Math.round(-tileW/2)
            // If negative, we want the first visible tile, which would be at x=0 for row 0
            // For row 1, first visible is at approximately tileW/2
            const logicalX = (-1 * tileW) + (tileW / 2);
            outlineX = Math.round(logicalX);
            outlineY = Math.round(1 * tileH);
            // If negative, find first positive position
            if (outlineX < 0) {
              outlineX = Math.round(tileW / 2);
            }
          }
          
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/f37b4cf4-ef5d-4355-935c-d1043bf409fa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PatternPreviewCanvas.tsx:275',message:'Outline position calculation details',data:{repeatType,tileW,tileH,outlineX,outlineY,displayWidth,displayHeight},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
          // #endregion
          
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/f37b4cf4-ef5d-4355-935c-d1043bf409fa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PatternPreviewCanvas.tsx:260',message:'Outline position calculated',data:{outlineX,outlineY,displayWidth,displayHeight,repeatType,currentDpr},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          
          // Draw hot pink outline
          canvasCtx.strokeStyle = '#ff1493'; // Hot pink
          canvasCtx.lineWidth = 6;
          canvasCtx.setLineDash([]);
          canvasCtx.strokeRect(outlineX + 3, outlineY + 3, displayWidth - 6, displayHeight - 6);
          
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/f37b4cf4-ef5d-4355-935c-d1043bf409fa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PatternPreviewCanvas.tsx:270',message:'Outline drawn',data:{outlineX:outlineX+3,outlineY:outlineY+3,outlineWidth:displayWidth-6,outlineHeight:displayHeight-6,transformAfterA:canvasCtx.getTransform().a,transformAfterD:canvasCtx.getTransform().d},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
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
    <div className="flex-1 flex flex-col bg-slate-900">
      {/* Header with Zoom Slider */}
      <div className="h-12 border-b border-slate-700 px-6 flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          <label className="text-xs text-slate-300 whitespace-nowrap">
            Zoom: {Math.round(zoom)}%
          </label>
          <div className="flex items-center gap-2 flex-1">
            <span className="text-xs text-slate-400 whitespace-nowrap">0%</span>
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
              className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer"
              style={{ accentColor: '#f1737c' }}
            />
            <span className="text-xs text-slate-400 whitespace-nowrap">200%</span>
          </div>
        </div>
      </div>

      {/* Canvas Preview Area with Rulers */}
      <div className="flex-1 flex flex-col bg-slate-800 overflow-hidden">
        {/* Top ruler */}
        <div className="flex border-b border-slate-700">
          <div className="w-[30px] h-[30px] bg-slate-700 border-r border-slate-600" />
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
              <div className="h-[30px] bg-slate-700" />
            )}
          </div>
        </div>
        
        {/* Canvas with left ruler */}
        <div className="flex flex-1 overflow-auto">
          <div className="w-[30px] overflow-hidden border-r border-slate-700">
            {tileDisplaySize.height > 0 && image ? (
              <Ruler
                orientation="vertical"
                length={canvasSize.height}
                scale={1}
                unit="in"
                pixelsPerUnit={verticalPixelsPerUnit}
              />
            ) : (
              <div className="w-[30px] bg-slate-700" />
            )}
          </div>
          <div 
            className="flex-1 overflow-auto bg-slate-900 relative"
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

