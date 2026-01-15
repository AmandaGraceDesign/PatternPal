'use client';

import { useState, useEffect, useRef } from 'react';
import TopBar from '@/components/layout/TopBar';
import PatternSetupSidebar from '@/components/sidebar/PatternSetupSidebar';
import PatternPreviewCanvas from '@/components/canvas/PatternPreviewCanvas';
import ActionsSidebar from '@/components/sidebar/ActionsSidebar';
import { extractDpiFromFile } from '@/lib/utils/imageUtils';

export default function Home() {
  const [repeatType, setRepeatType] = useState<'full-drop' | 'half-drop' | 'half-brick'>('full-drop');
  const [tileWidth, setTileWidth] = useState<number>(18);
  const [tileHeight, setTileHeight] = useState<number>(18);
  const [dpi, setDpi] = useState<number>(150);
  const [zoom, setZoom] = useState<number>(100);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [originalFilename, setOriginalFilename] = useState<string | null>(null);
  const [showTileOutline, setShowTileOutline] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Handle paste from clipboard globally
  useEffect(() => {
    const handlePasteEvent = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (!blob) continue;

          setIsLoading(true);

          // Try to extract DPI with smart detection
          let detectedDpi = dpi;
          try {
            const extractedDpi = await extractDpiFromFile(blob);

            // Smart DPI detection logic (same as file upload)
            // Common print DPI values: 150, 200, 300, 600
            const isCommonPrintDpi = extractedDpi && (
              extractedDpi === 150 ||
              extractedDpi === 200 ||
              extractedDpi === 300 ||
              extractedDpi === 600
            );

            if (isCommonPrintDpi) {
              detectedDpi = extractedDpi;
              setDpi(extractedDpi);
              console.log('Using extracted DPI from paste:', extractedDpi);
            } else if (extractedDpi === 72 || extractedDpi === 96) {
              detectedDpi = 150;
              setDpi(150);
              console.log('Web DPI detected in paste (' + extractedDpi + '), upgrading to 150 DPI');
            } else {
              detectedDpi = 150;
              setDpi(150);
              console.log('Unusual or missing DPI in paste (' + (extractedDpi || 'none') + '), defaulting to 150 DPI');
            }
          } catch (error) {
            console.warn('Could not extract DPI from pasted image, using default 150:', error);
            detectedDpi = 150;
            setDpi(150);
          }
          
          // Load the image
          const img = new Image();
          img.onload = () => {
            const finalDpi = detectedDpi || 96;
            const detectedWidth = img.width / finalDpi;
            const detectedHeight = img.height / finalDpi;
            setTileWidth(detectedWidth);
            setTileHeight(detectedHeight);
            setImage(img);
            setOriginalFilename(null); // Paste doesn't have filename
            setIsLoading(false);
          };
          
          img.onerror = () => {
            setIsLoading(false);
            console.error('Failed to load pasted image');
          };
          
          img.src = URL.createObjectURL(blob);
          break;
        }
      }
    };

    window.addEventListener('paste', handlePasteEvent);
    return () => window.removeEventListener('paste', handlePasteEvent);
  }, [dpi]);

  const handleFileUpload = async (file: File) => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/f37b4cf4-ef5d-4355-935c-d1043bf409fa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/page.tsx:72',message:'File upload started',data:{fileName:file.name,fileSize:file.size,fileType:file.type,currentDpi:dpi},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'M'})}).catch(()=>{});
    // #endregion
    
    console.log('File upload started:', file.name);
    setIsLoading(true);
    
    // Try to extract DPI from image metadata FIRST
    let detectedDpi = dpi; // Use current DPI as fallback
    try {
      console.log('Extracting DPI from file...');
      const extractedDpi = await extractDpiFromFile(file);
      console.log('Extracted DPI:', extractedDpi);

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/f37b4cf4-ef5d-4355-935c-d1043bf409fa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/page.tsx:80',message:'DPI extraction result',data:{extractedDpi,fallbackDpi:dpi,willUse:extractedDpi||dpi},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'N'})}).catch(()=>{});
      // #endregion

      // Smart DPI detection logic
      // Common print DPI values: 150, 200, 300, 600
      const isCommonPrintDpi = extractedDpi && (
        extractedDpi === 150 ||
        extractedDpi === 200 ||
        extractedDpi === 300 ||
        extractedDpi === 600
      );

      if (isCommonPrintDpi) {
        // Common print DPI detected - use it
        detectedDpi = extractedDpi;
        setDpi(extractedDpi);
        console.log('Using extracted DPI:', extractedDpi);
      } else if (extractedDpi === 72 || extractedDpi === 96) {
        // Web/screen DPI detected - upgrade to minimum print DPI
        detectedDpi = 150;
        setDpi(150);
        console.log('Web DPI detected (' + extractedDpi + '), upgrading to 150 DPI for print');
      } else {
        // Unusual DPI (like 512) or no DPI - default to 150 (minimum for Easyscale)
        detectedDpi = 150;
        setDpi(150);
        console.log('Unusual or missing DPI (' + (extractedDpi || 'none') + '), defaulting to 150 DPI');
      }
    } catch (error) {
      console.warn('Could not extract DPI from image, using default 150:', error);
      detectedDpi = 150;
      setDpi(150);
    }
    
    // Load the image AFTER DPI detection
    const img = new Image();
    img.onload = () => {
      console.log('Image loaded:', img.width, 'x', img.height);
      
      // Auto-detect tile dimensions from image using detected DPI
      // Always use detectedDpi (which is now guaranteed to be set)
      const finalDpi = detectedDpi;
      console.log('Using DPI:', finalDpi);
      
      // Calculate physical dimensions: pixels / DPI = inches
      const detectedWidth = img.width / finalDpi;
      const detectedHeight = img.height / finalDpi;
      
      console.log('Detected dimensions:', detectedWidth, 'x', detectedHeight, 'inches');
      console.log('Calculation: width =', img.width, '/', finalDpi, '=', detectedWidth);
      console.log('Calculation: height =', img.height, '/', finalDpi, '=', detectedHeight);
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/f37b4cf4-ef5d-4355-935c-d1043bf409fa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/page.tsx:95',message:'Calculating tile dimensions',data:{imageWidth:img.width,imageHeight:img.height,finalDpi,detectedWidth,detectedHeight},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'O'})}).catch(()=>{});
      // #endregion
      
      // Set the tile dimensions - these will update the input fields
      setTileWidth(detectedWidth);
      setTileHeight(detectedHeight);
      setImage(img);
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/f37b4cf4-ef5d-4355-935c-d1043bf409fa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/page.tsx:132',message:'IMAGE STATE SET',data:{imageWidth:img.width,imageHeight:img.height,imageNaturalWidth:img.naturalWidth,imageNaturalHeight:img.naturalHeight,imageComplete:img.complete,imageSrc:img.src.substring(0,100),tileWidth:detectedWidth,tileHeight:detectedHeight,dpi:finalDpi},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
      // #endregion
      
      // Extract and store original filename (without extension)
      const filenameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
      setOriginalFilename(filenameWithoutExt);
      
      setIsLoading(false);
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/f37b4cf4-ef5d-4355-935c-d1043bf409fa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/page.tsx:105',message:'Tile dimensions set',data:{tileWidth:detectedWidth,tileHeight:detectedHeight,dpi:finalDpi},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'P'})}).catch(()=>{});
      // #endregion
    };
    
    img.onerror = (error) => {
      console.error('Failed to load image:', error);
      setIsLoading(false);
    };
    
    img.src = URL.createObjectURL(file);
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Top Bar */}
      <TopBar />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Pattern Setup */}
        <div className="hidden md:block">
          <PatternSetupSidebar
            repeatType={repeatType}
            tileWidth={tileWidth}
            tileHeight={tileHeight}
            dpi={dpi}
            showTileOutline={showTileOutline}
            onRepeatTypeChange={setRepeatType}
            onTileWidthChange={setTileWidth}
            onTileHeightChange={setTileHeight}
            onDpiChange={setDpi}
            onShowTileOutlineChange={setShowTileOutline}
            onFileUpload={handleFileUpload}
          />
        </div>

        {/* Center - Pattern Preview Canvas */}
        <div className="relative flex-1 min-w-0">
          <PatternPreviewCanvas
            image={image}
            repeatType={repeatType}
            tileWidth={tileWidth}
            tileHeight={tileHeight}
            dpi={dpi}
            zoom={zoom}
            showTileOutline={showTileOutline}
            onZoomChange={setZoom}
            canvasRef={canvasRef}
          />
          {/* #region agent log */}
          {(()=>{fetch('http://127.0.0.1:7242/ingest/f37b4cf4-ef5d-4355-935c-d1043bf409fa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/page.tsx:234',message:'PatternPreviewCanvas props',data:{hasImage:!!image,imageWidth:image?.width,imageHeight:image?.height,imageNaturalWidth:image?.naturalWidth,imageNaturalHeight:image?.naturalHeight,imageComplete:image?.complete,repeatType,zoom,dpi,showTileOutline},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});return null;})()}
          {/* #endregion */}
          
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-50 pointer-events-none">
              <div className="text-sm text-gray-900">Loading...</div>
            </div>
          )}
        </div>

        {/* Right Sidebar - Actions */}
        <div className="flex-shrink-0">
          <ActionsSidebar
            image={image}
            dpi={dpi}
            tileWidth={tileWidth}
            tileHeight={tileHeight}
            repeatType={repeatType}
            zoom={zoom}
            originalFilename={originalFilename}
            canvasRef={canvasRef}
          />
        </div>
      </div>
    </div>
  );
}
