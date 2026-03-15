'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useClerk, useUser } from '@clerk/nextjs';
import TopBar from '@/components/layout/TopBar';
import PatternControlsTopBar from '@/components/layout/PatternControlsTopBar';
import PatternPreviewCanvas from '@/components/canvas/PatternPreviewCanvas';
import { extractDpiFromFile, validateSvgSafety } from '@/lib/utils/imageUtils';
import ResumeSignupFromQuery from './_components/ResumeSignupFromQuery';

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
  const [baseZoom, setBaseZoom] = useState<number>(50);
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);
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

          // Validate SVG safety before processing
          if (blob.type === 'image/svg+xml') {
            try {
              await validateSvgSafety(blob);
            } catch (error) {
              alert(error instanceof Error ? error.message : 'SVG validation failed');
              continue;
            }
          }

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
              if (process.env.NODE_ENV === 'development') {
                console.log('Using extracted DPI from paste:', extractedDpi);
              }
            } else if (extractedDpi === 72 || extractedDpi === 96) {
              detectedDpi = 150;
              setDpi(150);
              if (process.env.NODE_ENV === 'development') {
                console.log('Web DPI detected in paste (' + extractedDpi + '), upgrading to 150 DPI');
              }
            } else {
              detectedDpi = 150;
              setDpi(150);
              if (process.env.NODE_ENV === 'development') {
                console.log('Unusual or missing DPI in paste (' + (extractedDpi || 'none') + '), defaulting to 150 DPI');
              }
            }
          } catch (error) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('Could not extract DPI from pasted image, using default 150:', error);
            }
            detectedDpi = 150;
            setDpi(150);
          }

          // Load the image
          const img = new Image();
          const objectUrl = URL.createObjectURL(blob);
          img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            const finalDpi = detectedDpi || 96;
            const detectedWidth = img.naturalWidth / finalDpi;
            const detectedHeight = img.naturalHeight / finalDpi;
            setTileWidth(detectedWidth);
            setTileHeight(detectedHeight);
            setImage(img);
            setOriginalFilename(null); // Paste doesn't have filename

            // Fit-to-viewport: this becomes the baseline "100%" for the user
            const viewportWidth = window.innerWidth * 0.8;
            const viewportHeight = window.innerHeight * 0.6;
            const fitZoom = Math.min(
              viewportWidth / (detectedWidth * 96),
              viewportHeight / (detectedHeight * 96)
            ) * 100;
            setBaseZoom(Math.max(10, fitZoom));
            setZoom(100);
            setPanX(0);
            setPanY(0);

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

  const handleClearPattern = () => {
    setImage(null);
    setOriginalFilename(null);
    setTileWidth(18);
    setTileHeight(18);
    setDpi(150);
    setZoom(100);
    setBaseZoom(50);
    setPanX(0);
    setPanY(0);
    setRepeatType('full-drop');
    setShowTileOutline(false);
    setTileOutlineColor('#38bdf8');
    setScalePreviewSize(null);
    setIsScalePreviewActive(false);
  };

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

    // Validate SVG safety before processing
    if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
      try {
        await validateSvgSafety(localBlob);
      } catch (error) {
        alert(error instanceof Error ? error.message : 'SVG validation failed');
        return;
      }
    }

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

    if (process.env.NODE_ENV === 'development') {
      console.log('File upload started:', file.name);
    }
    setIsLoading(true);

    // Try to extract DPI from image metadata FIRST
    let detectedDpi = dpi; // Use current DPI as fallback
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('Extracting DPI from file...');
      }
      const extractedDpi = await extractDpiFromFile(localBlob);
      if (process.env.NODE_ENV === 'development') {
        console.log('Extracted DPI:', extractedDpi);
      }

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
        if (process.env.NODE_ENV === 'development') {
          console.log('Using extracted DPI:', extractedDpi);
        }
      } else if (extractedDpi === 72 || extractedDpi === 96) {
        detectedDpi = 150;
        setDpi(150);
        if (process.env.NODE_ENV === 'development') {
          console.log('Web DPI detected (' + extractedDpi + '), upgrading to 150 DPI for print');
        }
      } else {
        detectedDpi = 150;
        setDpi(150);
        if (process.env.NODE_ENV === 'development') {
          console.log('Unusual or missing DPI (' + (extractedDpi || 'none') + '), defaulting to 150 DPI');
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Could not extract DPI from image, using default 150:', error);
      }
      detectedDpi = 150;
      setDpi(150);
    }

    // Load the image from the in-memory blob
    const img = new Image();
    const objectUrl = URL.createObjectURL(localBlob);
    img.onload = () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('Image loaded:', img.naturalWidth, 'x', img.naturalHeight);
      }

      const finalDpi = detectedDpi;
      if (process.env.NODE_ENV === 'development') {
        console.log('Using DPI:', finalDpi);
      }

      // Calculate physical dimensions: pixels / DPI = inches
      const detectedWidth = img.naturalWidth / finalDpi;
      const detectedHeight = img.naturalHeight / finalDpi;

      if (process.env.NODE_ENV === 'development') {
        console.log('Detected dimensions:', detectedWidth, 'x', detectedHeight, 'inches');
      }

      setTileWidth(detectedWidth);
      setTileHeight(detectedHeight);
      setImage(img);

      // Fit-to-viewport: this becomes the baseline "100%" for the user
      const viewportWidth = window.innerWidth * 0.8;
      const viewportHeight = window.innerHeight * 0.6;
      const fitZoom = Math.min(
        viewportWidth / (detectedWidth * 96),
        viewportHeight / (detectedHeight * 96)
      ) * 100;
      setBaseZoom(Math.max(10, fitZoom));
      setZoom(100);
      setPanX(0);
      setPanY(0);

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

  // Clipboard API paste — works on mobile where the global paste event doesn't fire
  const handleClipboardPaste = async () => {
    if (!canRunFreeTest()) return;

    try {
      if (!navigator.clipboard || !navigator.clipboard.read) {
        alert('Clipboard access is not available. Please use the "Upload Pattern" button instead.');
        return;
      }

      const clipboardItems = await navigator.clipboard.read();

      for (const item of clipboardItems) {
        const imageType = item.types.find(t => t.startsWith('image/'));
        if (!imageType) continue;

        const blob = await item.getType(imageType);

        // Validate SVG safety
        if (imageType === 'image/svg+xml') {
          try {
            await validateSvgSafety(blob);
          } catch (error) {
            alert(error instanceof Error ? error.message : 'SVG validation failed');
            return;
          }
        }

        const softLimitBytes = 15 * 1024 * 1024;
        if (blob.size > softLimitBytes) {
          const mb = (blob.size / (1024 * 1024)).toFixed(1);
          const proceed = window.confirm(
            `This file is ${mb}MB (over 15MB) and may be slow to process. Continue?`
          );
          if (!proceed) return;
        }

        setIsLoading(true);

        // DPI detection (same logic as paste handler)
        let detectedDpi = dpi;
        try {
          const extractedDpi = await extractDpiFromFile(blob);
          const isCommonPrintDpi = extractedDpi && (
            extractedDpi === 150 || extractedDpi === 200 ||
            extractedDpi === 300 || extractedDpi === 600
          );

          if (isCommonPrintDpi) {
            detectedDpi = extractedDpi;
            setDpi(extractedDpi);
          } else if (extractedDpi === 72 || extractedDpi === 96) {
            detectedDpi = 150;
            setDpi(150);
          } else {
            detectedDpi = 150;
            setDpi(150);
          }
        } catch {
          detectedDpi = 150;
          setDpi(150);
        }

        const img = new Image();
        const objectUrl = URL.createObjectURL(blob);
        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          const finalDpi = detectedDpi || 96;
          const detectedWidth = img.naturalWidth / finalDpi;
          const detectedHeight = img.naturalHeight / finalDpi;
          setTileWidth(detectedWidth);
          setTileHeight(detectedHeight);
          setImage(img);
          setOriginalFilename(null);
          setIsLoading(false);
          incrementFreeTests();
        };
        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          setIsLoading(false);
          console.error('Failed to load clipboard image');
        };
        img.src = objectUrl;
        return; // Process first image only
      }

      // No image found in clipboard
      alert('No image found in your clipboard. Copy an image first, then try again.');
    } catch (err: unknown) {
      // Permission denied or no clipboard access
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('denied') || msg.includes('permission')) {
        alert('Clipboard permission was denied. Please use the "Upload Pattern" button instead.');
      } else {
        alert('Could not read from clipboard. Please use the "Upload Pattern" button instead.');
      }
      console.error('Clipboard paste error:', err);
    }
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
        <ResumeSignupFromQuery />
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
        onPaste={handleClipboardPaste}
        onClearPattern={handleClearPattern}
        scalePreviewSize={scalePreviewSize}
        onScalePreviewChange={setScalePreviewSize}
        isScalePreviewActive={isScalePreviewActive}
        onScalePreviewActiveChange={setIsScalePreviewActive}
        originalTileWidth={tileWidth}
        originalTileHeight={tileHeight}
        image={image}
        zoom={zoom}
        onZoomChange={setZoom}
        actualZoom={(zoom / 100) * baseZoom}
        originalFilename={originalFilename}
        canvasRef={canvasRef}
        effectiveTileWidth={getEffectiveDimensions().width}
        effectiveTileHeight={getEffectiveDimensions().height}
        effectiveScaleFactor={getEffectiveDimensions().scaleFactor}
        effectiveScalePreviewActive={isScalePreviewActive && scalePreviewSize !== null}
      />

      {/* Main Content Area: Full-width Canvas */}
      <div className="relative">
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
              zoom={(zoom / 100) * baseZoom}
              onZoomChange={isScalePreviewActive && scalePreviewSize !== null ? undefined : (z: number) => setZoom(Math.max(50, Math.min(200, (z / baseZoom) * 100)))}
              panX={panX}
              panY={panY}
              onPanChange={(x: number, y: number) => { setPanX(x); setPanY(y); }}
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
