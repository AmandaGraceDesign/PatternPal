'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useClerk, useUser } from '@clerk/nextjs';
import TopBar from '@/components/layout/TopBar';
import PatternSetupSidebar from '@/components/sidebar/PatternSetupSidebar';
import PatternPreviewCanvas from '@/components/canvas/PatternPreviewCanvas';
import ActionsSidebar from '@/components/sidebar/ActionsSidebar';
import { extractDpiFromFile } from '@/lib/utils/imageUtils';
import ResumeUpgradeFromQuery from './_components/ResumeUpgradeFromQuery';

export default function Home() {
  const { isSignedIn } = useUser();
  const { openSignIn } = useClerk();
  const FREE_TESTS_KEY = 'pp_free_tests_used';
  const MAX_FREE_TESTS = 3;
  const [repeatType, setRepeatType] = useState<'full-drop' | 'half-drop' | 'half-brick'>('full-drop');
  const [tileWidth, setTileWidth] = useState<number>(18);
  const [tileHeight, setTileHeight] = useState<number>(18);
  const [dpi, setDpi] = useState<number>(150);
  const [zoom, setZoom] = useState<number>(100);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [originalFilename, setOriginalFilename] = useState<string | null>(null);
  const [showTileOutline, setShowTileOutline] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [portalReady, setPortalReady] = useState(false);
  const topBarHeight = 48; // px
  const sidebarContentWidth = 288; // 18rem
  const toggleBarWidth = 32; // 2rem
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Scale Preview State
  const [scalePreviewSize, setScalePreviewSize] = useState<number | null>(null);
  const [isScalePreviewActive, setIsScalePreviewActive] = useState<boolean>(false);
  const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState<boolean>(false);
  const [isRightSidebarCollapsed, setIsRightSidebarCollapsed] = useState<boolean>(false);

  // Calculate scaled dimensions based on longest side input
  const getScaledDimensions = (longestSide: number) => {
    const originalLongest = Math.max(tileWidth, tileHeight);
    const scaleFactor = longestSide / originalLongest;

    return {
      width: tileWidth * scaleFactor,
      height: tileHeight * scaleFactor,
      scaleFactor: scaleFactor
    };
  };

  // Get effective dimensions for rendering (original or scaled)
  const getEffectiveDimensions = () => {
    if (isScalePreviewActive && scalePreviewSize !== null) {
      return getScaledDimensions(scalePreviewSize);
    }
    return {
      width: tileWidth,
      height: tileHeight,
      scaleFactor: 1
    };
  };

  const canRunFreeTest = () => {
    if (isSignedIn) return true;
    const count = Number(localStorage.getItem(FREE_TESTS_KEY) || '0');
    if (count >= MAX_FREE_TESTS) {
      openSignIn?.();
      return false;
    }
    return true;
  };

  const incrementFreeTests = () => {
    if (isSignedIn) return;
    const count = Number(localStorage.getItem(FREE_TESTS_KEY) || '0');
    localStorage.setItem(FREE_TESTS_KEY, String(count + 1));
    window.dispatchEvent(new Event('pp_free_tests_updated'));
  };

  // Handle paste from clipboard globally
  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    const handlePasteEvent = async (e: ClipboardEvent) => {
      if (!canRunFreeTest()) return;
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (!blob) continue;

          const softLimitBytes = 15 * 1024 * 1024;
          if (blob.size > softLimitBytes) {
            const mb = (blob.size / (1024 * 1024)).toFixed(1);
            const proceed = window.confirm(
              `This file is ${mb}MB (over 15MB) and may be slow to process. Continue?`
            );
            if (!proceed) continue;
          }

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
          const objectUrl = URL.createObjectURL(blob);
          img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            const finalDpi = detectedDpi || 96;
            const detectedWidth = img.width / finalDpi;
            const detectedHeight = img.height / finalDpi;
            setTileWidth(detectedWidth);
            setTileHeight(detectedHeight);
            setImage(img);
            setOriginalFilename(null); // Paste doesn't have filename
            setIsLoading(false);
            incrementFreeTests();
          };
          
          img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            setIsLoading(false);
            console.error('Failed to load pasted image');
          };
          
          img.src = objectUrl;
          break;
        }
      }
    };

    window.addEventListener('paste', handlePasteEvent);
    return () => window.removeEventListener('paste', handlePasteEvent);
  }, [dpi, isSignedIn, openSignIn]);

  const handleFileUpload = async (file: File) => {
    if (!canRunFreeTest()) return;
    const softLimitBytes = 15 * 1024 * 1024;
    if (file.size > softLimitBytes) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      const proceed = window.confirm(
        `This file is ${mb}MB (over 15MB) and may be slow to process. Continue?`
      );
      if (!proceed) return;
    }

    // #region agent log
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
    const objectUrl = URL.createObjectURL(file);
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
      // #endregion
      
      // Set the tile dimensions - these will update the input fields
      setTileWidth(detectedWidth);
      setTileHeight(detectedHeight);
      setImage(img);
      
      // #region agent log
      // #endregion
      
      // Extract and store original filename (without extension)
      const filenameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
      setOriginalFilename(filenameWithoutExt);
      
      setIsLoading(false);
      incrementFreeTests();
      
      // #region agent log
      // #endregion

      URL.revokeObjectURL(objectUrl);
    };
    
    img.onerror = (error) => {
      URL.revokeObjectURL(objectUrl);
      console.error('Failed to load image:', error);
      setIsLoading(false);
    };
    img.src = objectUrl;
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      handleFileUpload(file);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col bg-white"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Top Bar */}
      <TopBar />
      <Suspense fallback={null}>
        <ResumeUpgradeFromQuery />
      </Suspense>

      {/* Main Content Area */}
      <div
        className="flex-1 flex overflow-hidden min-h-0"
        style={{ height: `calc(100vh - ${topBarHeight}px)` }}
      >
        {/* Left Sidebar - Pattern Setup */}
        <div
          className="relative flex-shrink-0 h-full min-h-0 border-r border-[#e5e7eb]"
          style={{
            overflow: 'visible',
            width: isLeftSidebarCollapsed
              ? `${toggleBarWidth}px`
              : `${sidebarContentWidth + toggleBarWidth}px`,
          }}
        >
          {!isLeftSidebarCollapsed && (
            <div style={{ width: `${sidebarContentWidth}px` }}>
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
                onPaste={() => {}}
                scalePreviewSize={scalePreviewSize}
                onScalePreviewChange={setScalePreviewSize}
                isScalePreviewActive={isScalePreviewActive}
                onScalePreviewActiveChange={setIsScalePreviewActive}
                originalTileWidth={tileWidth}
                originalTileHeight={tileHeight}
              />
            </div>
          )}
        </div>

        {/* Center - Pattern Preview Canvas */}
        <div className="relative flex-1 min-w-0">
          <PatternPreviewCanvas
            image={image}
            repeatType={repeatType}
            tileWidth={getEffectiveDimensions().width}
            tileHeight={getEffectiveDimensions().height}
            dpi={dpi}
            zoom={zoom}
            showTileOutline={showTileOutline}
            onZoomChange={setZoom}
            scalePreviewActive={isScalePreviewActive && scalePreviewSize !== null}
          />
          {/* #region agent log */}
          {null}
          {/* #endregion */}
          
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-50 pointer-events-none">
              <div className="text-sm text-gray-900">Loading...</div>
            </div>
          )}
        </div>

        {/* Right Sidebar - Actions */}
        <div
          className="relative flex-shrink-0 h-full min-h-0 border-l border-[#e5e7eb]"
          style={{
            overflow: 'visible',
            width: isRightSidebarCollapsed
              ? `${toggleBarWidth}px`
              : `${sidebarContentWidth + toggleBarWidth}px`,
          }}
        >
          {!isRightSidebarCollapsed && (
            <div style={{ width: `${sidebarContentWidth}px`, marginLeft: `${toggleBarWidth}px` }}>
              <Suspense fallback={null}>
                <ActionsSidebar
                  image={image}
                  dpi={dpi}
                  tileWidth={getEffectiveDimensions().width}
                  tileHeight={getEffectiveDimensions().height}
                  repeatType={repeatType}
                  zoom={zoom}
                  originalFilename={originalFilename}
                  canvasRef={canvasRef}
                  scaleFactor={getEffectiveDimensions().scaleFactor}
                  scalePreviewActive={isScalePreviewActive && scalePreviewSize !== null}
                />
              </Suspense>
            </div>
          )}
        </div>
      </div>
      {portalReady &&
        createPortal(
          <>
            <div
              className="fixed z-40 bg-[#cdcdcd] border-l border-[#c4c4c4] pointer-events-none"
              style={{
                top: `${topBarHeight}px`,
                bottom: 0,
                width: `${toggleBarWidth}px`,
                left: isLeftSidebarCollapsed ? 0 : sidebarContentWidth,
              }}
            />
            <button
              type="button"
              onClick={() => setIsLeftSidebarCollapsed((prev) => !prev)}
              className="fixed top-1/2 -translate-y-1/2 z-50 w-6 h-10 flex items-center justify-center bg-white border border-[#e5e7eb] rounded-full shadow-sm text-xs text-[#374151]"
              style={{
                left: isLeftSidebarCollapsed
                  ? '4px'
                  : `${sidebarContentWidth + toggleBarWidth / 2 - 12}px`,
              }}
              aria-label={isLeftSidebarCollapsed ? 'Expand left sidebar' : 'Collapse left sidebar'}
            >
              {isLeftSidebarCollapsed ? '▶' : '◀'}
            </button>
            <div
              className="fixed z-40 bg-[#cdcdcd] border-r border-[#c4c4c4] pointer-events-none"
              style={{
                top: `${topBarHeight}px`,
                bottom: 0,
                width: `${toggleBarWidth}px`,
                right: isRightSidebarCollapsed ? 0 : sidebarContentWidth,
              }}
            />
            <button
              type="button"
              onClick={() => setIsRightSidebarCollapsed((prev) => !prev)}
              className="fixed top-1/2 -translate-y-1/2 z-50 w-6 h-10 flex items-center justify-center bg-white border border-[#e5e7eb] rounded-full shadow-sm text-xs text-[#374151]"
              style={{
                right: isRightSidebarCollapsed
                  ? '4px'
                  : `${sidebarContentWidth + toggleBarWidth / 2 - 12}px`,
              }}
              aria-label={isRightSidebarCollapsed ? 'Expand right sidebar' : 'Collapse right sidebar'}
            >
              {isRightSidebarCollapsed ? '◀' : '▶'}
            </button>
          </>,
          document.body
        )}
    </div>
  );
}
