'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useClerk, useUser } from '@clerk/nextjs';
import TopBar from '@/components/layout/TopBar';
import PatternControlsTopBar from '@/components/layout/PatternControlsTopBar';
import PatternPreviewCanvas from '@/components/canvas/PatternPreviewCanvas';
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
  const [tileOutlineColor, setTileOutlineColor] = useState<string>('#38bdf8');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const topBarHeight = 48; // px
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Scale Preview State
  const [scalePreviewSize, setScalePreviewSize] = useState<number | null>(null);
  const [isScalePreviewActive, setIsScalePreviewActive] = useState<boolean>(false);

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

  const handleFileUpload = async (file: File, preloadedBlob?: Blob) => {
    // Use the preloaded blob if the caller already read the file into memory
    // (required for Google Drive / iCloud / Dropbox virtual file handles).
    // Fall back to reading the File directly for local files.
    const localBlob = preloadedBlob ?? await new Promise<Blob>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(new Blob([reader.result as ArrayBuffer], { type: file.type }));
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    }).catch((readError) => {
      console.error('Failed to read file:', readError);
      return null;
    });

    if (!localBlob) return;

    // Now that bytes are safely in memory, check permissions
    if (!canRunFreeTest()) return;

    const softLimitBytes = 15 * 1024 * 1024;
    if (localBlob.size > softLimitBytes) {
      const mb = (localBlob.size / (1024 * 1024)).toFixed(1);
      const proceed = window.confirm(
        `This file is ${mb}MB (over 15MB) and may be slow to process. Continue?`
      );
      if (!proceed) return;
    }

    console.log('File upload started:', file.name);
    setIsLoading(true);

    // Try to extract DPI from image metadata FIRST
    let detectedDpi = dpi; // Use current DPI as fallback
    try {
      console.log('Extracting DPI from file...');
      const extractedDpi = await extractDpiFromFile(localBlob);
      console.log('Extracted DPI:', extractedDpi);

      // Smart DPI detection logic
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
        console.log('Using extracted DPI:', extractedDpi);
      } else if (extractedDpi === 72 || extractedDpi === 96) {
        detectedDpi = 150;
        setDpi(150);
        console.log('Web DPI detected (' + extractedDpi + '), upgrading to 150 DPI for print');
      } else {
        detectedDpi = 150;
        setDpi(150);
        console.log('Unusual or missing DPI (' + (extractedDpi || 'none') + '), defaulting to 150 DPI');
      }
    } catch (error) {
      console.warn('Could not extract DPI from image, using default 150:', error);
      detectedDpi = 150;
      setDpi(150);
    }

    // Load the image from the in-memory blob
    const img = new Image();
    const objectUrl = URL.createObjectURL(localBlob);
    img.onload = () => {
      console.log('Image loaded:', img.width, 'x', img.height);

      const finalDpi = detectedDpi;
      console.log('Using DPI:', finalDpi);

      // Calculate physical dimensions: pixels / DPI = inches
      const detectedWidth = img.width / finalDpi;
      const detectedHeight = img.height / finalDpi;

      console.log('Detected dimensions:', detectedWidth, 'x', detectedHeight, 'inches');

      setTileWidth(detectedWidth);
      setTileHeight(detectedHeight);
      setImage(img);

      // Extract and store original filename (without extension)
      const filenameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
      setOriginalFilename(filenameWithoutExt);

      setIsLoading(false);
      incrementFreeTests();

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
      const reader = new FileReader();
      reader.onload = () => {
        const blob = new Blob([reader.result as ArrayBuffer], { type: file.type });
        handleFileUpload(file, blob);
      };
      reader.onerror = () => {
        handleFileUpload(file);
      };
      reader.readAsArrayBuffer(file);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col bg-[#1a1d23] p-3 sm:p-4"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Floating App Container */}
      <div className="flex flex-col flex-1 min-h-0 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.5),0_4px_12px_rgba(0,0,0,0.3)]">
      {/* Top Bar */}
      <TopBar />
      <Suspense fallback={null}>
        <ResumeUpgradeFromQuery />
      </Suspense>

      {/* Pattern Controls Bar */}
      <PatternControlsTopBar
        repeatType={repeatType}
        tileWidth={tileWidth}
        tileHeight={tileHeight}
        dpi={dpi}
        showTileOutline={showTileOutline}
        tileOutlineColor={tileOutlineColor}
        onRepeatTypeChange={setRepeatType}
        onTileWidthChange={setTileWidth}
        onTileHeightChange={setTileHeight}
        onDpiChange={setDpi}
        onShowTileOutlineChange={setShowTileOutline}
        onTileOutlineColorChange={setTileOutlineColor}
        onFileUpload={handleFileUpload}
        onPaste={() => {}}
        scalePreviewSize={scalePreviewSize}
        onScalePreviewChange={setScalePreviewSize}
        isScalePreviewActive={isScalePreviewActive}
        onScalePreviewActiveChange={setIsScalePreviewActive}
        originalTileWidth={tileWidth}
        originalTileHeight={tileHeight}
        image={image}
        zoom={zoom}
        onZoomChange={setZoom}
        originalFilename={originalFilename}
        canvasRef={canvasRef}
        effectiveTileWidth={getEffectiveDimensions().width}
        effectiveTileHeight={getEffectiveDimensions().height}
        effectiveScaleFactor={getEffectiveDimensions().scaleFactor}
        effectiveScalePreviewActive={isScalePreviewActive && scalePreviewSize !== null}
      />

      {/* Main Content Area: Full-width Canvas */}
      <div className="flex-1 relative min-h-0">
        <div
          className="workspaceWell px-2 pt-2 pb-6 sm:px-3 sm:pt-4 sm:pb-8 lg:px-4 lg:pt-5 lg:pb-10 rounded-b-2xl"
          style={{ minHeight: '100%' }}
        >
          <div className="flex justify-center items-start px-1 sm:px-2 mt-1 mb-4 sm:mt-2 sm:mb-6">
            <div className="w-full max-w-5xl flex items-center gap-4">
              <div className="flex-1 h-px shrink-0 bg-[rgba(255,255,255,0.08)]" aria-hidden />
              <p className="text-sm sm:text-base tracking-[0.2em] text-[rgba(255,255,255,0.66)] uppercase shrink-0">
                PATTERN PREVIEW
              </p>
              <div className="flex-1 h-px shrink-0 bg-[rgba(255,255,255,0.08)]" aria-hidden />
            </div>
          </div>
          <div className="flex justify-center items-start" style={{ padding: '0 20px' }}>
            <PatternPreviewCanvas
              image={image}
              repeatType={repeatType}
              tileWidth={getEffectiveDimensions().width}
              tileHeight={getEffectiveDimensions().height}
              dpi={dpi}
              zoom={zoom}
              showTileOutline={showTileOutline}
              tileOutlineColor={tileOutlineColor}
            />
          </div>
        </div>

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-50 pointer-events-none">
            <div className="text-sm text-white">Loading...</div>
          </div>
        )}
      </div>
      </div>{/* End Floating App Container */}
    </div>
  );
}
