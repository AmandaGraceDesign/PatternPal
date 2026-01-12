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
  // #region agent log
  if (typeof window !== 'undefined') {
    fetch('http://127.0.0.1:7242/ingest/f37b4cf4-ef5d-4355-935c-d1043bf409fa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PatternPreviewCanvas.tsx:19',message:'COMPONENT RENDER - Props received',data:{hasImage:!!image,imageWidth:image?.width,imageHeight:image?.height,imageNaturalWidth:image?.naturalWidth,imageNaturalHeight:image?.naturalHeight,repeatType,zoom,dpi},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H'})}).catch(()=>{});
  }
  // #endregion
  
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
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/f37b4cf4-ef5d-4355-935c-d1043bf409fa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PatternPreviewCanvas.tsx:59',message:'BEFORE ctx.scale - canvas dimensions',data:{canvasWidth:canvasRef.current.width,canvasHeight:canvasRef.current.height,displaySize,currentDpr,cssWidth:canvasRef.current.style.width,cssHeight:canvasRef.current.style.height},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          
          // Scale context by DPR so all drawing uses display coordinates
          ctx.scale(currentDpr, currentDpr);
          
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/f37b4cf4-ef5d-4355-935c-d1043bf409fa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PatternPreviewCanvas.tsx:61',message:'AFTER ctx.scale - transform applied',data:{transformA:ctx.getTransform().a,transformD:ctx.getTransform().d,transformE:ctx.getTransform().e,transformF:ctx.getTransform().f,scaleApplied:currentDpr},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          
          // Enable high-quality image smoothing
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
        }
        
        console.log('Canvas size set:', displaySize, 'x', displaySize, 'at DPR:', currentDpr, '(internal:', displaySize * currentDpr, ')');
        console.log('Container size set:', containerSize, '(120% of viewport height)');
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/f37b4cf4-ef5d-4355-935c-d1043bf409fa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PatternPreviewCanvas.tsx:85',message:'SETTING CANVAS SIZE STATE',data:{displaySize,canvasSizeWidth:displaySize,canvasSizeHeight:displaySize,containerSize,currentDpr},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'I'})}).catch(()=>{});
        // #endregion
        
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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/f37b4cf4-ef5d-4355-935c-d1043bf409fa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PatternPreviewCanvas.tsx:101',message:'RENDER EFFECT TRIGGERED',data:{hasImage:!!image,imageWidth:image?.width,imageHeight:image?.height,imageNaturalWidth:image?.naturalWidth,imageNaturalHeight:image?.naturalHeight,hasCanvas:!!canvasRef.current,canvasSizeWidth:canvasSize.width,canvasSizeHeight:canvasSize.height,repeatType,zoom,dpi,showTileOutline},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    if (!canvasRef.current || canvasSize.width === 0) {
      console.log('Skipping render - canvas:', !!canvasRef.current, 'canvasSize:', canvasSize);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/f37b4cf4-ef5d-4355-935c-d1043bf409fa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PatternPreviewCanvas.tsx:105',message:'EARLY RETURN - Canvas not ready',data:{hasCanvas:!!canvasRef.current,canvasSizeWidth:canvasSize.width,canvasSizeHeight:canvasSize.height,reason:!canvasRef.current?'no canvas ref':'canvasSize is 0'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      return;
    }

    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/f37b4cf4-ef5d-4355-935c-d1043bf409fa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PatternPreviewCanvas.tsx:109',message:'EARLY RETURN - No canvas context',data:{hasCanvas:!!canvas},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      return;
    }
    
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
    canvasCtx.fillStyle = '#294051'; // navy blue background
    canvasCtx.fillRect(0, 0, canvasSize.width, canvasSize.height);

    if (!image) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/f37b4cf4-ef5d-4355-935c-d1043bf409fa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PatternPreviewCanvas.tsx:127',message:'Starting default pattern rendering',data:{canvasSizeWidth:canvasSize.width,canvasSizeHeight:canvasSize.height,zoom,dpr,repeatType},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      
      // Render seamless default pattern from SVG
      // Using 512x512 as default (power-of-2 works better with scaling)
      // Can be changed to any size if needed: createSeamlessDefaultPattern(256) or createSeamlessDefaultPattern(512)
      const defaultPatternSize = 512; // Changed from 400 to 512 for better scaling compatibility
      createSeamlessDefaultPattern(defaultPatternSize).then((defaultPatternCanvas) => {
        // Check if image was set while async was running (using ref to get current value)
        if (imageRef.current) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/f37b4cf4-ef5d-4355-935c-d1043bf409fa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PatternPreviewCanvas.tsx:160',message:'Default pattern render cancelled - image exists',data:{hasImage:!!imageRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'J'})}).catch(()=>{});
          // #endregion
          return;
        }
        
        // #region agent log
        console.log('🔍 DEFAULT PATTERN - Canvas received:', {
          patternCanvasWidth: defaultPatternCanvas.width,
          patternCanvasHeight: defaultPatternCanvas.height,
          expectedSize: defaultPatternSize,
          sizeMatch: defaultPatternCanvas.width === defaultPatternSize
        });
        fetch('http://127.0.0.1:7242/ingest/f37b4cf4-ef5d-4355-935c-d1043bf409fa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PatternPreviewCanvas.tsx:133',message:'Default pattern canvas received',data:{patternCanvasWidth:defaultPatternCanvas.width,patternCanvasHeight:defaultPatternCanvas.height,expectedSize:defaultPatternSize,sizeMatch:defaultPatternCanvas.width === defaultPatternSize},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        
        const tiler = new PatternTiler(canvas, canvasSize.width, canvasSize.height);
        
        // Use default tile size for pattern (512x512px at 150 DPI = ~3.41x3.41 inches)
        const defaultDpi = 150;
        const defaultTileWidth = defaultPatternSize / defaultDpi; // ~3.41 inches for 512px
        const defaultTileHeight = defaultPatternSize / defaultDpi; // ~3.41 inches for 512px
        
        // Calculate display scale at 50% (0.5)
        const viewZoom = displayZoomToActualZoom(zoom);
        const displayScale = (96 / defaultDpi) * viewZoom * 0.5; // 50% scale
        
        const displayWidth = Math.round(defaultPatternSize * displayScale);
        const displayHeight = Math.round(defaultPatternSize * displayScale);
        
        // #region agent log
        console.log('🔍 DEFAULT PATTERN - Scaling calculation:', {
          zoom,
          viewZoom,
          displayScale,
          originalWidth: defaultPatternSize,
          originalHeight: defaultPatternSize,
          displayWidth,
          displayHeight,
          isFractional: displayWidth !== defaultPatternSize * displayScale,
          dpr,
          potentialIssue: displayWidth < 100 ? 'Tiles too small!' : 'Size OK',
          powerOf2Size: defaultPatternSize
        });
        fetch('http://127.0.0.1:7242/ingest/f37b4cf4-ef5d-4355-935c-d1043bf409fa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PatternPreviewCanvas.tsx:161',message:'Display dimensions calculated',data:{zoom,viewZoom,displayScale,originalWidth:defaultPatternSize,originalHeight:defaultPatternSize,displayWidth,displayHeight,isFractional:displayWidth !== defaultPatternSize * displayScale || displayHeight !== defaultPatternSize * displayScale,dpr,potentialIssue:displayWidth < 100 ? 'Tiles too small' : 'Size OK',powerOf2Size:defaultPatternSize},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        
        setTileDisplaySize({ width: displayWidth, height: displayHeight });
        
        // Create scaled default pattern
        // CRITICAL: PatternTiler uses image.width/height, so we must create the image
        // at displayWidth x displayHeight, NOT displayWidth * dpr
        // Otherwise tiles will be the wrong size and won't align correctly
        const scaledCanvas = document.createElement('canvas');
        scaledCanvas.width = displayWidth; // Use display dimensions, not DPR-scaled
        scaledCanvas.height = displayHeight;
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/f37b4cf4-ef5d-4355-935c-d1043bf409fa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PatternPreviewCanvas.tsx:158',message:'Scaled canvas created',data:{scaledCanvasWidth:scaledCanvas.width,scaledCanvasHeight:scaledCanvas.height,displayWidth,displayHeight,dpr,note:'Using display dimensions not DPR-scaled for PatternTiler'},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        
        const scaledCtx = scaledCanvas.getContext('2d');
        if (scaledCtx) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/f37b4cf4-ef5d-4355-935c-d1043bf409fa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PatternPreviewCanvas.tsx:167',message:'About to scale pattern',data:{imageSmoothingEnabled:true,imageSmoothingQuality:'high',sourceSize:400,destSize:displayWidth},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          
          // Disable image smoothing to preserve crisp edges and ensure seamless tiling
          // Smoothing can blur edges and break seamless alignment
          scaledCtx.imageSmoothingEnabled = false; // Changed from true to preserve edges
          
          // #region agent log
          console.log('🔍 DEFAULT PATTERN - Drawing to scaled canvas:', {
            sourceSize: `${defaultPatternCanvas.width}x${defaultPatternCanvas.height}`,
            destSize: `${displayWidth}x${displayHeight}`,
            imageSmoothingEnabled: false,
            note: 'Disabled smoothing to preserve crisp edges for seamless tiling'
          });
          fetch('http://127.0.0.1:7242/ingest/f37b4cf4-ef5d-4355-935c-d1043bf409fa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PatternPreviewCanvas.tsx:176',message:'About to draw pattern to scaled canvas',data:{sourceWidth:defaultPatternCanvas.width,sourceHeight:defaultPatternCanvas.height,destWidth:displayWidth,destHeight:displayHeight,imageSmoothingEnabled:false,note:'Disabled smoothing for crisp edges'},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          
          // Draw at display size directly (no DPR scaling needed here)
          scaledCtx.drawImage(defaultPatternCanvas, 0, 0, displayWidth, displayHeight);
          
          // #region agent log
          const scaledTop = scaledCtx.getImageData(0, 0, displayWidth, 1);
          const scaledBottom = scaledCtx.getImageData(0, displayHeight - 1, displayWidth, 1);
          fetch('http://127.0.0.1:7242/ingest/f37b4cf4-ef5d-4355-935c-d1043bf409fa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PatternPreviewCanvas.tsx:178',message:'Pattern scaled, checking edge pixels',data:{scaledTopEdgeSample:[...scaledTop.data.slice(0,12)],scaledBottomEdgeSample:[...scaledBottom.data.slice(0,12)],edgesMatchAfterScale:JSON.stringify(scaledTop.data)===JSON.stringify(scaledBottom.data),displayWidth,displayHeight},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
          
          const scaledImg = new Image();
          scaledImg.onload = () => {
            // Check again if image was set during image load
            if (imageRef.current) {
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/f37b4cf4-ef5d-4355-935c-d1043bf409fa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PatternPreviewCanvas.tsx:265',message:'Default pattern image load cancelled - image exists',data:{hasImage:!!imageRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'J'})}).catch(()=>{});
              // #endregion
              return;
            }
            
            // #region agent log
            console.log('🔍 DEFAULT PATTERN - Image loaded for PatternTiler:', {
              defaultPatternCanvasSize: `${defaultPatternCanvas.width}x${defaultPatternCanvas.height}`,
              displayDimensions: `${displayWidth}x${displayHeight}`,
              scaledCanvasSize: `${scaledCanvas.width}x${scaledCanvas.height}`,
              scaledImgNaturalSize: `${scaledImg.naturalWidth}x${scaledImg.naturalHeight}`,
              scaledImgWidth: scaledImg.width,
              scaledImgHeight: scaledImg.height,
              expectedWidth: displayWidth,
              expectedHeight: displayHeight,
              dimensionsMatch: scaledImg.width === displayWidth && scaledImg.height === displayHeight,
              repeatType: repeatType,
              patternTilerWillUse: `w=${scaledImg.width}, h=${scaledImg.height}`,
              SUCCESS: scaledImg.width === displayWidth ? '✅ Dimensions match!' : '❌ DIMENSION MISMATCH!'
            });
            fetch('http://127.0.0.1:7242/ingest/f37b4cf4-ef5d-4355-935c-d1043bf409fa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PatternPreviewCanvas.tsx:187',message:'Scaled image loaded, about to render',data:{scaledImgWidth:scaledImg.width,scaledImgHeight:scaledImg.height,scaledImgNaturalWidth:scaledImg.naturalWidth,scaledImgNaturalHeight:scaledImg.naturalHeight,expectedWidth:displayWidth,expectedHeight:displayHeight,dimensionMatch:scaledImg.width === displayWidth && scaledImg.height === displayHeight,repeatType},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'E'})}).catch(()=>{});
            // #endregion
            
            tiler.render(scaledImg, repeatType);
            
            // Draw tile outline for default pattern if enabled
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
      }).catch((error) => {
        console.error('Failed to load default pattern:', error);
      });
      return;
    }

    // Render actual pattern
    console.log('Rendering pattern...');
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/f37b4cf4-ef5d-4355-935c-d1043bf409fa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PatternPreviewCanvas.tsx:284',message:'RENDERING ACTUAL PATTERN',data:{imageWidth:image.width,imageHeight:image.height,imageNaturalWidth:image.naturalWidth,imageNaturalHeight:image.naturalHeight,imageComplete:image.complete,imageSrc:image.src.substring(0,100),zoom,viewZoom:displayZoomToActualZoom(zoom),canvasSizeWidth:canvasSize.width,canvasSizeHeight:canvasSize.height,dpi},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    
    const tiler = new PatternTiler(canvas, canvasSize.width, canvasSize.height);
    
    // Calculate displayed tile size based on ACTUAL DPI and zoom
    // Don't convert to 96 DPI - use the image's actual DPI
    const viewZoom = displayZoomToActualZoom(zoom);
    // Calculate displayed tile size: just scale the image by viewZoom
    const displayWidth = image.width * viewZoom;
    const displayHeight = image.height * viewZoom;
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/f37b4cf4-ef5d-4355-935c-d1043bf409fa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PatternPreviewCanvas.tsx:293',message:'Calculated display dimensions',data:{viewZoom,displayWidth,displayHeight,imageWidth:image.width,imageHeight:image.height},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    
    // Create a scaled version of the image for tiling
    // Scale intermediate canvas by DPR for better quality on high-DPI displays
    const scaledCanvas = document.createElement('canvas');
    scaledCanvas.width = displayWidth * dpr;
    scaledCanvas.height = displayHeight * dpr;
    
    // Store dimensions immediately for ruler calculations (BEFORE async operations)
    setTileDisplaySize({ width: displayWidth, height: displayHeight });
    
    const scaledCtx = scaledCanvas.getContext('2d');
    
    if (scaledCtx) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/f37b4cf4-ef5d-4355-935c-d1043bf409fa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PatternPreviewCanvas.tsx:219',message:'BEFORE intermediate canvas scaling',data:{scaledCanvasWidth:scaledCanvas.width,scaledCanvasHeight:scaledCanvas.height,displayWidth,displayHeight,dpr,imageNaturalWidth:image.naturalWidth,imageNaturalHeight:image.naturalHeight,imageWidth:image.width,imageHeight:image.height},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      
      // Scale context by DPR
      scaledCtx.scale(dpr, dpr);
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/f37b4cf4-ef5d-4355-935c-d1043bf409fa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PatternPreviewCanvas.tsx:221',message:'AFTER ctx.scale on intermediate canvas',data:{transformA:scaledCtx.getTransform().a,transformD:scaledCtx.getTransform().d,scaleApplied:dpr},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      
      // Enable high-quality image smoothing
      scaledCtx.imageSmoothingEnabled = true;
      scaledCtx.imageSmoothingQuality = 'high';
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/f37b4cf4-ef5d-4355-935c-d1043bf409fa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PatternPreviewCanvas.tsx:229',message:'BEFORE drawImage with width/height params',data:{drawImageParams:'drawImage(image, 0, 0, displayWidth, displayHeight)',displayWidth,displayHeight,imageNaturalWidth:image.naturalWidth,imageNaturalHeight:image.naturalHeight,willScale:displayWidth !== image.naturalWidth || displayHeight !== image.naturalHeight},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      
      // Draw original image to scaled canvas with high quality
      // Draw at display size (context is scaled, so this will render at DPR resolution)
      scaledCtx.drawImage(image, 0, 0, displayWidth, displayHeight);
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/f37b4cf4-ef5d-4355-935c-d1043bf409fa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PatternPreviewCanvas.tsx:229',message:'AFTER drawImage - image drawn with scaling',data:{actualCanvasWidth:scaledCanvas.width,actualCanvasHeight:scaledCanvas.height,drawWidth:displayWidth,drawHeight:displayHeight},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      
      // Create image from canvas - use PNG for lossless quality
      const scaledImg = new Image();
      scaledImg.onload = () => {
        // Check if image was removed while async was running
        if (!imageRef.current) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/f37b4cf4-ef5d-4355-935c-d1043bf409fa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PatternPreviewCanvas.tsx:367',message:'Image render cancelled - image removed',data:{hasImage:!!imageRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'J'})}).catch(()=>{});
          // #endregion
          return;
        }
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/f37b4cf4-ef5d-4355-935c-d1043bf409fa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PatternPreviewCanvas.tsx:229',message:'Scaled image loaded, starting render',data:{displayWidth,displayHeight,repeatType,zoom,showTileOutline,imageWidth:image.width,imageHeight:image.height,dpi},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        
        console.log('Scaled image loaded, rendering pattern...');
        
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
          
          // Calculate pixels per unit using the SAME formula as the ruler
          // This ensures the outline matches the ruler exactly
          const viewZoom = displayZoomToActualZoom(zoom);
          const tileWidthInches = image.width / dpi;
          const displayWidthPixels = image.width * viewZoom;
          const horizontalPixelsPerUnit = displayWidthPixels / tileWidthInches;
          
          const tileHeightInches = image.height / dpi;
          const displayHeightPixels = image.height * viewZoom;
          const verticalPixelsPerUnit = displayHeightPixels / tileHeightInches;
          
          // Use the actual displayed pixel dimensions (same as what PatternTiler uses)
          const outlineWidthPx = displayWidthPixels;
          const outlineHeightPx = displayHeightPixels;
          
          // Calculate outline position to match where PatternTiler actually draws tiles
          // Use the pixel dimensions we just calculated
          const tileW = outlineWidthPx;  // Tile width in pixels (from tileWidth inches)
          const tileH = outlineHeightPx; // Tile height in pixels (from tileHeight inches)
          
          let outlineX = 0;
          let outlineY = 0;
          
          // Match the exact logic PatternTiler uses for positioning
          if (repeatType === 'full-drop') {
            // Full drop: x=0, y=0 -> first tile at (0, 0)
            outlineX = Math.round(0 * tileW);
            outlineY = Math.round(0 * tileH);
          } else if (repeatType === 'half-drop') {
            // Half drop: column 1 (x=1), row -1 with offset
            outlineX = Math.round(1 * tileW);
            const logicalY = (-1 * tileH) + (tileH / 2);
            outlineY = Math.round(logicalY);
            // If negative, find first positive position
            if (outlineY < 0) {
              outlineY = Math.round(tileH / 2);
            }
          } else if (repeatType === 'half-brick') {
            // Half brick: row 1 (y=1), column -1 with offset
            const logicalX = (-1 * tileW) + (tileW / 2);
            outlineX = Math.round(logicalX);
            outlineY = Math.round(1 * tileH);
            // If negative, find first positive position
            if (outlineX < 0) {
              outlineX = Math.round(tileW / 2);
            }
          }
          
          // #region agent log
          console.log('📦 OUTLINE CALCULATION:', {
            tileWidth,
            tileHeight,
            horizontalPixelsPerUnit,
            verticalPixelsPerUnit,
            outlineWidthPx,
            outlineHeightPx,
            tileW,
            tileH,
            outlineX,
            outlineY,
          });
          fetch('http://127.0.0.1:7242/ingest/f37b4cf4-ef5d-4355-935c-d1043bf409fa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PatternPreviewCanvas.tsx:275',message:'Outline calculation (using tileWidth/tileHeight)',data:{tileWidth,tileHeight,horizontalPixelsPerUnit,verticalPixelsPerUnit,outlineWidthPx,outlineHeightPx,tileW,tileH,outlineX,outlineY,repeatType},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
          // #endregion
          
          // Draw hot pink outline
          // Use the calculated pixel dimensions from tileWidth/tileHeight
          canvasCtx.strokeStyle = '#ff1493'; // Hot pink
          canvasCtx.lineWidth = 6;
          canvasCtx.setLineDash([]);
          canvasCtx.strokeRect(outlineX + 3, outlineY + 3, outlineWidthPx - 6, outlineHeightPx - 6);
          
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
  // Calculate pixels per unit for ruler directly from image dimensions
  // This avoids React state timing issues
  const horizontalPixelsPerUnit = image ? (() => {
    const tileWidthInches = image.width / dpi;
    const displayWidthPixels = image.width * displayZoomToActualZoom(zoom);
    const ppu = displayWidthPixels / tileWidthInches;
    console.log('🔢 RULER PPU CALC (HORIZONTAL):', {
      imageWidth: image.width,
      dpi,
      zoom,
      viewZoom: displayZoomToActualZoom(zoom),
      tileWidthInches,
      displayWidthPixels,
      pixelsPerUnit: ppu
    });
    return ppu;
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
      <div className="flex-1 flex flex-col bg-[#294051] overflow-hidden">
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
            className="flex-1 overflow-auto bg-[#294051] relative"
            style={{ minHeight: containerHeight > 0 ? `${containerHeight}px` : 'auto', cursor: isPanning ? 'grabbing' : 'grab' }}
            onWheel={(e) => {
              // Only prevent default if it's a zoom gesture (ctrl/cmd key pressed)
              if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                e.stopPropagation();
                
                if (!canvasRef.current || !image) return;
                
                const rect = canvasRef.current.getBoundingClientRect();
                const scrollContainer = e.currentTarget;
                
                // Get mouse position relative to canvas
                const mouseX = e.clientX - rect.left + scrollContainer.scrollLeft;
                const mouseY = e.clientY - rect.top + scrollContainer.scrollTop;
                
                // Calculate zoom delta - slower sensitivity for pinch zoom
                const zoomDelta = -e.deltaY * 0.05;
                const newZoom = Math.max(0, Math.min(200, zoom + zoomDelta));
                
                // Calculate the new actual zoom
                const newViewZoom = displayZoomToActualZoom(newZoom);
                const currentViewZoom = displayZoomToActualZoom(zoom);
                
                // Calculate new tile size at new zoom
                const newDisplayWidth = image.width * newViewZoom;
                const newDisplayHeight = image.height * newViewZoom;
                
                // Calculate what percentage of the tile the mouse was over
                const currentDisplayWidth = image.width * currentViewZoom;
                const currentDisplayHeight = image.height * currentViewZoom;
                
                const percentX = mouseX / currentDisplayWidth;
                const percentY = mouseY / currentDisplayHeight;
                
                // Calculate where that same percentage should be at new zoom
                const newMouseX = percentX * newDisplayWidth;
                const newMouseY = percentY * newDisplayHeight;
                
                // Calculate scroll adjustment to keep mouse position stable
                const scrollDeltaX = newMouseX - mouseX;
                const scrollDeltaY = newMouseY - mouseY;
                
                // Update zoom
                onZoomChange(newZoom);
                
                // Adjust scroll to keep mouse position centered
                requestAnimationFrame(() => {
                  scrollContainer.scrollLeft += scrollDeltaX;
                  scrollContainer.scrollTop += scrollDeltaY;
                });
              }
              // If not a zoom gesture, allow normal scrolling
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

