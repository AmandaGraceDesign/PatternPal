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
  scalePreviewActive?: boolean;
  onClick?: () => void;
  colorOverride?: string | null;
  scaleFactor?: number; // Scale factor for proportional mockup rendering (1 = original size)
}

export default function MockupRenderer({
  template,
  patternImage,
  tileWidth,
  tileHeight,
  dpi,
  repeatType,
  zoom,
  scalePreviewActive = false,
  onClick,
  colorOverride,
  scaleFactor = 1,
}: MockupRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [mockupImage, setMockupImage] = useState<HTMLImageElement | null>(null);
  const [maskImage, setMaskImage] = useState<HTMLImageElement | null>(null);
  const [colorMaskImage, setColorMaskImage] = useState<HTMLImageElement | null>(null);
  const isOnesie = template.id === 'onesie';
  const isWrappingPaper = template.id === 'wrapping-paper';

  const createMaskCanvas = (
    mask: HTMLImageElement,
    width: number,
    height: number,
    invertAlpha = false
  ) => {
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
      const originalAlpha = data[i + 3];

      // Calculate luminance from RGB
      const luminance = (r + g + b) / 3;

      // For RGBA masks: if the original alpha is meaningful (not fully opaque),
      // use the original alpha. Otherwise, use luminance.
      // White areas (high luminance) = show pattern, Black areas (low luminance) = hide pattern
      const baseAlpha = originalAlpha < 255 ? originalAlpha : luminance;
      const finalAlpha = invertAlpha ? 255 - baseAlpha : baseAlpha;

      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = finalAlpha;
    }

    maskCtx.putImageData(imageData, 0, 0);
    return maskCanvas;
  };

  const getMaskBounds = (maskCanvas: HTMLCanvasElement) => {
    const ctx = maskCanvas.getContext('2d');
    if (!ctx) return null;

    const { width, height } = maskCanvas;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const alphaThreshold = 10;

    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const alpha = data[(y * width + x) * 4 + 3];
        if (alpha > alphaThreshold) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX < minX || maxY < minY) return null;

    return {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    };
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

    // Get the most common color from the entire image (no luminance filter)
    // This gives the true dominant/background color
    const buckets = buildHistogram(0);
    const best = pickDominant(buckets);

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
      img.src = `${template.maskImage}?v=${Date.now()}`;
    } else {
      setMaskImage(null);
    }
  }, [template]);

  // Load color mask for onesie and wrapping paper bow
  useEffect(() => {
    if (isOnesie || isWrappingPaper) {
      const img = new Image();
      const maskPath = isWrappingPaper
        ? `/mockups/wrapping_paper_bow_mask.png?v=${Date.now()}`
        : `/mockups/onesie_mask_color.png?v=${Date.now()}`;
      img.onload = () => setColorMaskImage(img);
      img.src = maskPath;
    } else {
      setColorMaskImage(null);
    }
  }, [isOnesie, isWrappingPaper, template.id]);

  // Render pattern on mockup
  useEffect(() => {
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

    if ((isOnesie || isWrappingPaper) && !maskImage) {
      setIsRendering(false);
      return;
    }

    // Calculate pattern scale based on DPI conversion
    // Pattern is at 'dpi' DPI, but we want to display it at screen resolution (96 DPI)
    // Then scale it to fit nicely in the pattern area
    const patternArea = template.patternArea;
    
    // Get mockup physical dimensions for proportional scaling
    const mockupPhysicalWidth = template.physicalDimensions?.width ?? null;
    const mockupPhysicalHeight = template.physicalDimensions?.height ?? null;

    let scaledPatternWidth: number;
    let scaledPatternHeight: number;

    const zoomMultiplier = scalePreviewActive ? 1 : (zoom ?? 100) / 100;

    // If mockup has physical dimensions, use them for realistic scaling
    if (mockupPhysicalWidth && mockupPhysicalHeight) {
      let visibleWidthPx = patternArea.width;
      let visibleHeightPx = patternArea.height;

      if (maskImage) {
        const maskCanvas = createMaskCanvas(maskImage, patternArea.width, patternArea.height);
        if (maskCanvas) {
          const bounds = getMaskBounds(maskCanvas);
          if (bounds) {
            visibleWidthPx = bounds.width;
            visibleHeightPx = bounds.height;
          }
        }
      }

      // Calculate how many pattern repeats fit on mockup based on physical dimensions
      const repeatsX = mockupPhysicalWidth / tileWidth;
      const repeatsY = mockupPhysicalHeight / tileHeight;

      // Calculate the pixel size each tile should be on the mockup
      // This is independent of the original pattern image resolution
      const baseTileWidth = visibleWidthPx / repeatsX;
      const baseTileHeight = visibleHeightPx / repeatsY;
      const tileAspect = tileHeight !== 0 ? tileWidth / tileHeight : 1;

      if (scalePreviewActive) {
        // Lock tile aspect when scale preview is active (no squish)
        const widthFromHeight = baseTileHeight * tileAspect;
        scaledPatternWidth = Math.min(baseTileWidth, widthFromHeight);
        scaledPatternHeight = scaledPatternWidth / tileAspect;
      } else {
        scaledPatternWidth = baseTileWidth * zoomMultiplier;
        scaledPatternHeight = baseTileHeight * zoomMultiplier;
      }

    } else {
      // Fallback: default to 2 tiles across/down without using zoom
      scaledPatternWidth = (patternArea.width / 2) * zoomMultiplier;
      scaledPatternHeight = (patternArea.height / 2) * zoomMultiplier;
    }

    
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
          
          if (isOnesie || isWrappingPaper) {
            // Build color + pattern layers and composite
            const patternLayer = document.createElement('canvas');
            patternLayer.width = patternCanvas.width;
            patternLayer.height = patternCanvas.height;
            const patternLayerCtx = patternLayer.getContext('2d');
            if (patternLayerCtx) {
              patternLayerCtx.drawImage(patternCanvas, 0, 0);
              const patternMaskCanvas = createMaskCanvas(
                maskImage,
                patternArea.width,
                patternArea.height,
                false
              );
              if (patternMaskCanvas) {
                patternLayerCtx.globalCompositeOperation = 'destination-in';
                patternLayerCtx.drawImage(patternMaskCanvas, 0, 0);
              } else if (isOnesie) {
                // Onesie requires a valid mask; abort render to avoid blank output
                setIsRendering(false);
                ctx.restore();
                return;
              }
            }

            if (colorMaskImage) {
              const colorLayer = document.createElement('canvas');
              colorLayer.width = patternCanvas.width;
              colorLayer.height = patternCanvas.height;
              const colorCtx = colorLayer.getContext('2d');
              if (colorCtx) {
                const colorMaskCanvas = createMaskCanvas(
                  colorMaskImage,
                  patternArea.width,
                  patternArea.height,
                  false
                );
                if (isWrappingPaper) {
                  const shadingLayer = document.createElement('canvas');
                  shadingLayer.width = patternCanvas.width;
                  shadingLayer.height = patternCanvas.height;
                  const shadingCtx = shadingLayer.getContext('2d');
                  if (shadingCtx) {
                    shadingCtx.drawImage(
                      mockupImage,
                      patternArea.x,
                      patternArea.y,
                      patternCanvas.width,
                      patternCanvas.height,
                      0,
                      0,
                      patternCanvas.width,
                      patternCanvas.height
                    );
                    const shadingData = shadingCtx.getImageData(
                      0,
                      0,
                      shadingLayer.width,
                      shadingLayer.height
                    );
                    const data = shadingData.data;
                    for (let i = 0; i < data.length; i += 4) {
                      const luminance = (data[i] + data[i + 1] + data[i + 2]) / 3;
                      data[i] = luminance;
                      data[i + 1] = luminance;
                      data[i + 2] = luminance;
                    }
                    shadingCtx.putImageData(shadingData, 0, 0);
                    if (colorMaskCanvas) {
                      shadingCtx.globalCompositeOperation = 'destination-in';
                      shadingCtx.drawImage(colorMaskCanvas, 0, 0);
                    }
                    colorCtx.clearRect(0, 0, colorLayer.width, colorLayer.height);
                    colorCtx.fillStyle = colorOverride || extractBackgroundColor(patternImage);
                    colorCtx.fillRect(0, 0, colorLayer.width, colorLayer.height);
                    colorCtx.globalCompositeOperation = 'multiply';
                    colorCtx.drawImage(shadingLayer, 0, 0);
                    if (colorMaskCanvas) {
                      colorCtx.globalCompositeOperation = 'destination-in';
                      colorCtx.drawImage(colorMaskCanvas, 0, 0);
                    }
                  }
                } else {
                  colorCtx.fillStyle = colorOverride || extractBackgroundColor(patternImage);
                  colorCtx.fillRect(0, 0, colorLayer.width, colorLayer.height);
                  if (colorMaskCanvas) {
                    colorCtx.globalCompositeOperation = 'destination-in';
                    colorCtx.drawImage(colorMaskCanvas, 0, 0);
                  }
                }
              }

              tempCtx.globalCompositeOperation = 'multiply';
              tempCtx.globalAlpha = 0.9;
              tempCtx.drawImage(colorLayer, 0, 0);
            }

            tempCtx.globalCompositeOperation = 'multiply';
            const patternAlpha = template.id === 'wrapping-paper' ? 1 : (template.opacity ?? 1);
            tempCtx.globalAlpha = patternAlpha;
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
          if (!isOnesie && !isWrappingPaper) {
            tempCtx.globalCompositeOperation = 'destination-out';
            tempCtx.globalAlpha = 1;
            tempCtx.drawImage(maskImage, 0, 0, patternArea.width, patternArea.height);
          }
          
          // #region agent log
          // #endregion
          
          // Step 4: Draw final result to main canvas (no blend mode needed)
          ctx.globalCompositeOperation = 'source-over';
          const overlayAlpha = template.id === 'wrapping-paper' ? (template.opacity ?? 1) : 1;
          ctx.globalAlpha = overlayAlpha;
          ctx.drawImage(tempCanvas, patternArea.x, patternArea.y);
          
        } else if (maskImage) {
          // Has mask but no multiply - apply mask to pattern canvas first
          // #region agent log
          // #endregion
          
          if (isOnesie || isWrappingPaper) {
            if (colorMaskImage) {
              const colorLayer = document.createElement('canvas');
              colorLayer.width = patternCanvas.width;
              colorLayer.height = patternCanvas.height;
              const colorCtx = colorLayer.getContext('2d');
              if (colorCtx) {
                colorCtx.fillStyle = colorOverride || extractBackgroundColor(patternImage);
                colorCtx.fillRect(0, 0, colorLayer.width, colorLayer.height);
                const colorMaskCanvas = createMaskCanvas(colorMaskImage, patternArea.width, patternArea.height);
                if (colorMaskCanvas) {
                  colorCtx.globalCompositeOperation = 'destination-in';
                  colorCtx.drawImage(colorMaskCanvas, 0, 0);
                }
                ctx.globalCompositeOperation = 'source-over';
                ctx.globalAlpha = 1;
                ctx.drawImage(colorLayer, patternArea.x, patternArea.y);
              }
            }

            const patternMaskCanvas = createMaskCanvas(maskImage, patternArea.width, patternArea.height);
            if (patternMaskCanvas) {
              patternCtx.globalCompositeOperation = 'destination-in';
              patternCtx.drawImage(patternMaskCanvas, 0, 0);
            } else if (isOnesie) {
              setIsRendering(false);
              ctx.restore();
              return;
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
  }, [template, mockupImage, maskImage, colorMaskImage, patternImage, tileWidth, tileHeight, dpi, repeatType, zoom, colorOverride, scaleFactor, scalePreviewActive, isOnesie, isWrappingPaper]);

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
