'use client';

import { useEffect, useRef, useState } from 'react';
import { MockupTemplate } from '@/lib/mockups/mockupTemplates';
import { PatternTiler, RepeatType } from '@/lib/tiling/PatternTiler';

interface MockupRendererProps {
  template: MockupTemplate;
  patternImage: HTMLImageElement | null;
  patternDataUrl?: string;
  tileWidth: number;
  tileHeight: number;
  dpi: number;
  repeatType: RepeatType;
  zoom?: number;
  onClick?: () => void;
}

export default function MockupRenderer({
  template,
  patternImage,
  tileWidth,
  tileHeight,
  dpi,
  repeatType,
  zoom,
  onClick,
}: MockupRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [mockupImage, setMockupImage] = useState<HTMLImageElement | null>(null);
  const [maskImage, setMaskImage] = useState<HTMLImageElement | null>(null);
  const [colorMaskImage, setColorMaskImage] = useState<HTMLImageElement | null>(null);
  const isOnesie = template.id === 'onesie';

  const createMaskCanvas = (mask: HTMLImageElement, width: number, height: number) => {
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = width;
    maskCanvas.height = height;
    const maskCtx = maskCanvas.getContext('2d');
    if (!maskCtx) return null;

    maskCtx.clearRect(0, 0, width, height);
    maskCtx.drawImage(mask, 0, 0, width, height);

    const imageData = maskCtx.getImageData(0, 0, width, height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const luminance = (r + g + b) / 3;

      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = luminance;
    }

    maskCtx.putImageData(imageData, 0, 0);
    return maskCanvas;
  };

  const extractBackgroundColor = (img: HTMLImageElement): string => {
    const sampleSize = 48;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = sampleSize;
    tempCanvas.height = sampleSize;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return '#ffffff';

    tempCtx.drawImage(img, 0, 0, sampleSize, sampleSize);
    const { data } = tempCtx.getImageData(0, 0, sampleSize, sampleSize);

    const buildHistogram = (minLuminance: number) => {
      const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();
      const step = 16;

      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a < 10) continue;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const luminance = (r + g + b) / 3;
        if (luminance < minLuminance) continue;

        const qr = Math.min(255, Math.round(r / step) * step);
        const qg = Math.min(255, Math.round(g / step) * step);
        const qb = Math.min(255, Math.round(b / step) * step);
        const key = `${qr},${qg},${qb}`;

        const bucket = buckets.get(key);
        if (bucket) {
          bucket.count += 1;
        } else {
          buckets.set(key, { count: 1, r: qr, g: qg, b: qb });
        }
      }

      return buckets;
    };

    const pickDominant = (buckets: Map<string, { count: number; r: number; g: number; b: number }>) => {
      let best = { count: 0, r: 255, g: 255, b: 255 };
      for (const bucket of buckets.values()) {
        if (bucket.count > best.count) {
          best = bucket;
        }
      }
      return best;
    };

    // Pass 1: favor lighter tones
    let buckets = buildHistogram(180);
    let best = pickDominant(buckets);

    // Pass 2: fallback to dominant color without luminance filter
    if (best.count === 0) {
      buckets = buildHistogram(0);
      best = pickDominant(buckets);
    }

    if (best.count === 0) return '#ffffff';

    return (
      '#' +
      [best.r, best.g, best.b].map((v) => v.toString(16).padStart(2, '0')).join('')
    );
  };

  // Load mockup base image
  useEffect(() => {
    const img = new Image();
    img.onload = () => setMockupImage(img);
    img.src = template.image || template.templateImage;
  }, [template]);

  // Load mask image if present
  useEffect(() => {
    if (template.maskImage) {
      const img = new Image();
      img.onload = () => setMaskImage(img);
      img.src = template.maskImage;
    } else {
      setMaskImage(null);
    }
  }, [template]);

  // Load color mask for onesie only
  useEffect(() => {
    if (isOnesie) {
      const img = new Image();
      img.onload = () => setColorMaskImage(img);
      img.src = '/mockups/onesie_mask_color.png';
    } else {
      setColorMaskImage(null);
    }
  }, [isOnesie]);

  // Render pattern on mockup
  useEffect(() => {
    // #region agent log
    // #endregion
    
    const canvas = canvasRef.current;
    if (!canvas || !mockupImage || !patternImage || template.approach !== 'canvas') {
      return;
    }

    setIsRendering(true);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setIsRendering(false);
      return;
    }

    // Set canvas size to match mockup image
    canvas.width = mockupImage.width;
    canvas.height = mockupImage.height;

    // #region agent log
    // #endregion

    // Draw base mockup image
    ctx.drawImage(mockupImage, 0, 0);

    if (isOnesie && (!maskImage || !colorMaskImage)) {
      setIsRendering(false);
      return;
    }

    // Calculate pattern scale based on DPI conversion
    // Pattern is at 'dpi' DPI, but we want to display it at screen resolution (96 DPI)
    // Then scale it to fit nicely in the pattern area
    const patternArea = template.patternArea;
    
    // Convert display zoom (0-200) to actual zoom (same as PatternPreviewCanvas)
    const displayZoomToActualZoom = (displayValue: number): number => {
      if (displayValue <= 100) {
        return 0.01 + (displayValue / 100) * 0.14;
      } else {
        return 0.15 + ((displayValue - 100) / 100) * 4.85;
      }
    };
    
    // Get actual zoom from display zoom
    const viewZoom = displayZoomToActualZoom(zoom || 100);
    
    // #region agent log
    // #endregion
    
    // Convert pattern dimensions from its DPI to screen DPI (96), then apply zoom
    const patternScreenWidth = patternImage.width * (96 / dpi) * viewZoom;
    const patternScreenHeight = patternImage.height * (96 / dpi) * viewZoom;
    
    // #region agent log
    // #endregion
    
    // Calculate base scale to fit pattern area (at zoom = 1.0, which is viewZoom = 0.15)
    // This gives us a base size that fits nicely in the pattern area
    const basePatternScreenWidth = patternImage.width * (96 / dpi);
    const basePatternScreenHeight = patternImage.height * (96 / dpi);
    const baseScale = Math.min(
      patternArea.width / basePatternScreenWidth / 2, // Half the width
      patternArea.height / basePatternScreenHeight / 2 // Half the height
    );
    
    // Apply zoom to the base scale - zoom affects the final pattern size
    // viewZoom is relative to the base zoom (0.15 at display zoom 100)
    // So we need to scale by viewZoom / 0.15 to get the relative zoom
    const baseZoom = 0.15; // The zoom at display zoom 100
    const zoomMultiplier = viewZoom / baseZoom;
    const targetScale = baseScale * zoomMultiplier;
    
    // Calculate scaled pattern dimensions for tiling
    const scaledPatternWidth = basePatternScreenWidth * targetScale;
    const scaledPatternHeight = basePatternScreenHeight * targetScale;
    
    // #region agent log
    // #endregion

    // Create a temporary canvas for the pattern
    // Use the exact dimensions of the pattern area
    const patternCanvas = document.createElement('canvas');
    patternCanvas.width = patternArea.width;
    patternCanvas.height = patternArea.height;
    const patternCtx = patternCanvas.getContext('2d');
    
    if (!patternCtx) {
      setIsRendering(false);
      return;
    }

    // #region agent log
    // #endregion

    // Fill background (transparent for now, will be masked)
    patternCtx.clearRect(0, 0, patternArea.width, patternArea.height);

    // Render tiled pattern
    const tiler = new PatternTiler(patternCanvas, patternArea.width, patternArea.height);
    
    // Scale the pattern image to the appropriate size for tiling
    const tileDisplayWidth = scaledPatternWidth;
    const tileDisplayHeight = scaledPatternHeight;
    
    // Create scaled pattern image
    const scaledPatternCanvas = document.createElement('canvas');
    scaledPatternCanvas.width = tileDisplayWidth;
    scaledPatternCanvas.height = tileDisplayHeight;
    const scaledPatternCtx = scaledPatternCanvas.getContext('2d');
    
    if (scaledPatternCtx) {
      scaledPatternCtx.imageSmoothingEnabled = true;
      scaledPatternCtx.imageSmoothingQuality = 'high';
      scaledPatternCtx.drawImage(patternImage, 0, 0, tileDisplayWidth, tileDisplayHeight);
      
      const scaledPatternImg = new Image();
      scaledPatternImg.onload = () => {
        // Render the tiled pattern
        tiler.render(scaledPatternImg, repeatType);

        // Apply blend mode and opacity
        ctx.save();
        
        // #region agent log
        // #endregion
        
        // Map blend mode to canvas composite operation
        const blendModeMap: Record<string, GlobalCompositeOperation> = {
          'normal': 'source-over',
          'multiply': 'multiply',
          'overlay': 'overlay',
          'soft-light': 'soft-light',
        };
        
        // Special handling for multiply + mask: multiply first, then mask
        const needsMultiplyMask = template.blendMode === 'multiply' && maskImage;
        
        if (needsMultiplyMask) {
          // #region agent log
          // #endregion
          
          // Create temp canvas for multiply blend + mask
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = patternCanvas.width;
          tempCanvas.height = patternCanvas.height;
          const tempCtx = tempCanvas.getContext('2d');
          
          if (!tempCtx) {
            setIsRendering(false);
            ctx.restore();
            return;
          }
          
          // Step 1: Copy pattern area from base mockup to temp canvas
          tempCtx.drawImage(
            mockupImage,
            patternArea.x, patternArea.y,
            patternCanvas.width, patternCanvas.height,
            0, 0,
            patternCanvas.width, patternCanvas.height
          );
          
          if (isOnesie && colorMaskImage) {
            // Onesie: build color + pattern layers and composite
            const colorLayer = document.createElement('canvas');
            colorLayer.width = patternCanvas.width;
            colorLayer.height = patternCanvas.height;
            const colorCtx = colorLayer.getContext('2d');
            if (colorCtx) {
              colorCtx.fillStyle = extractBackgroundColor(patternImage);
              colorCtx.fillRect(0, 0, colorLayer.width, colorLayer.height);
              colorCtx.globalCompositeOperation = 'destination-in';
              const colorMaskCanvas = createMaskCanvas(colorMaskImage, patternArea.width, patternArea.height);
              if (colorMaskCanvas) {
                colorCtx.drawImage(colorMaskCanvas, 0, 0);
              }
            }

            const patternLayer = document.createElement('canvas');
            patternLayer.width = patternCanvas.width;
            patternLayer.height = patternCanvas.height;
            const patternLayerCtx = patternLayer.getContext('2d');
            if (patternLayerCtx) {
              patternLayerCtx.drawImage(patternCanvas, 0, 0);
              patternLayerCtx.globalCompositeOperation = 'destination-in';
              const patternMaskCanvas = createMaskCanvas(maskImage, patternArea.width, patternArea.height);
              if (patternMaskCanvas) {
                patternLayerCtx.drawImage(patternMaskCanvas, 0, 0);
              }
            }

            tempCtx.globalCompositeOperation = 'multiply';
            tempCtx.globalAlpha = 1;
            tempCtx.drawImage(colorLayer, 0, 0);

            tempCtx.globalCompositeOperation = 'multiply';
            tempCtx.globalAlpha = template.opacity ?? 1;
            tempCtx.drawImage(patternLayer, 0, 0);
          } else {
            // Step 2: Apply multiply blend between base and pattern
            tempCtx.globalCompositeOperation = 'multiply';
            tempCtx.globalAlpha = template.opacity ?? 1;
            tempCtx.drawImage(patternCanvas, 0, 0);
          }
          
          // #region agent log
          // #endregion
          
          // Step 3: Apply mask to the multiplied result (non-onesie only)
          if (!isOnesie) {
            tempCtx.globalCompositeOperation = 'destination-out';
            tempCtx.globalAlpha = 1;
            tempCtx.drawImage(maskImage, 0, 0, patternArea.width, patternArea.height);
          }
          
          // #region agent log
          // #endregion
          
          // Step 4: Draw final result to main canvas (no blend mode needed)
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = 1;
          ctx.drawImage(tempCanvas, patternArea.x, patternArea.y);
          
        } else if (maskImage) {
          // Has mask but no multiply - apply mask to pattern canvas first
          // #region agent log
          // #endregion
          
          if (isOnesie && colorMaskImage) {
            const colorLayer = document.createElement('canvas');
            colorLayer.width = patternCanvas.width;
            colorLayer.height = patternCanvas.height;
            const colorCtx = colorLayer.getContext('2d');
            if (colorCtx) {
              colorCtx.fillStyle = extractBackgroundColor(patternImage);
              colorCtx.fillRect(0, 0, colorLayer.width, colorLayer.height);
              colorCtx.globalCompositeOperation = 'destination-in';
              const colorMaskCanvas = createMaskCanvas(colorMaskImage, patternArea.width, patternArea.height);
              if (colorMaskCanvas) {
                colorCtx.drawImage(colorMaskCanvas, 0, 0);
              }
              ctx.globalCompositeOperation = 'source-over';
              ctx.globalAlpha = 1;
              ctx.drawImage(colorLayer, patternArea.x, patternArea.y);
            }

            patternCtx.globalCompositeOperation = 'destination-in';
            const patternMaskCanvas = createMaskCanvas(maskImage, patternArea.width, patternArea.height);
            if (patternMaskCanvas) {
              patternCtx.drawImage(patternMaskCanvas, 0, 0);
            }
          } else {
            // Black areas hide pattern, transparent/white areas show pattern
            patternCtx.globalCompositeOperation = 'destination-out';
            patternCtx.drawImage(maskImage, 0, 0, patternArea.width, patternArea.height);
          }

          // Then apply blend mode
          ctx.globalCompositeOperation = blendModeMap[template.blendMode || 'normal'] || 'source-over';
          ctx.globalAlpha = template.opacity ?? 1;
          ctx.drawImage(patternCanvas, patternArea.x, patternArea.y);
          
        } else {
          // No mask - direct blend
          ctx.globalCompositeOperation = blendModeMap[template.blendMode || 'normal'] || 'source-over';
          ctx.globalAlpha = template.opacity ?? 1;
          ctx.drawImage(patternCanvas, patternArea.x, patternArea.y);
        }
        
        // #region agent log
        // #endregion
        
        ctx.restore();
        setIsRendering(false);
      };
      
      scaledPatternImg.onerror = () => {
        setIsRendering(false);
      };
      
      scaledPatternImg.src = scaledPatternCanvas.toDataURL('image/png');
    } else {
      setIsRendering(false);
    }
  }, [template, mockupImage, maskImage, colorMaskImage, patternImage, tileWidth, tileHeight, dpi, repeatType, zoom]);

  // Prevent right-click and image copying
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    return false;
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.preventDefault();
    return false;
  };

  // For CSS approach or when no pattern, show static image
  if (template.approach === 'css' || !patternImage || !mockupImage) {
    return (
      <div
        className="relative aspect-square bg-white border border-[#92afa5]/30 rounded-md overflow-hidden cursor-pointer group select-none"
        onClick={onClick}
        onContextMenu={handleContextMenu}
        onDragStart={handleDragStart}
        style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
      >
        <img
          src={template.image || template.templateImage}
          alt={template.name}
          className="w-full h-full object-contain pointer-events-none"
          draggable={false}
          onContextMenu={handleContextMenu}
          onDragStart={handleDragStart}
        />
        <div className="absolute inset-0 bg-white/0 group-hover:bg-white/20 transition-colors flex items-center justify-center pointer-events-none">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="text-[10px] text-[#705046] text-center px-2">{template.name}</div>
          </div>
        </div>
      </div>
    );
  }

  // Canvas approach - render pattern on mockup
  return (
    <div
      className="relative aspect-square bg-white border border-[#92afa5]/30 rounded-md overflow-hidden cursor-pointer group select-none"
      onClick={onClick}
      onContextMenu={handleContextMenu}
      onDragStart={handleDragStart}
      style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full object-contain pointer-events-none mockup-canvas"
        style={{ maxWidth: '100%', height: 'auto' }}
        draggable={false}
        onContextMenu={handleContextMenu}
        onDragStart={handleDragStart}
      />
      {isRendering && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/50 pointer-events-none">
          <div className="text-[10px] text-[#705046]">Rendering...</div>
        </div>
      )}
      <div className="absolute inset-0 bg-white/0 group-hover:bg-white/20 transition-colors flex items-center justify-center pointer-events-none">
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="text-[10px] text-[#705046] text-center px-2">{template.name}</div>
        </div>
      </div>
    </div>
  );
}
