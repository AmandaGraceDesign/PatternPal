'use client';

import { useState, useEffect } from 'react';
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
  const [showTileOutline, setShowTileOutline] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

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
          
          // Try to extract DPI
          let detectedDpi = dpi;
          try {
            const extractedDpi = await extractDpiFromFile(blob);
            if (extractedDpi) {
              detectedDpi = extractedDpi;
              setDpi(extractedDpi);
            }
          } catch (error) {
            console.warn('Could not extract DPI from pasted image:', error);
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
    console.log('File upload started:', file.name);
    setIsLoading(true);
    
    // Try to extract DPI from image metadata FIRST
    let detectedDpi = dpi; // Use current DPI as fallback
    try {
      console.log('Extracting DPI from file...');
      const extractedDpi = await extractDpiFromFile(file);
      console.log('Extracted DPI:', extractedDpi);
      if (extractedDpi) {
        detectedDpi = extractedDpi;
        setDpi(extractedDpi);
      }
    } catch (error) {
      console.warn('Could not extract DPI from image, using default:', error);
    }
    
    // Load the image AFTER DPI detection
    const img = new Image();
    img.onload = () => {
      console.log('Image loaded:', img.width, 'x', img.height);
      // Auto-detect tile dimensions from image using detected DPI
      const finalDpi = detectedDpi || 96; // Fallback to 96 if no DPI detected
      console.log('Using DPI:', finalDpi);
      const detectedWidth = img.width / finalDpi;
      const detectedHeight = img.height / finalDpi;
      console.log('Detected dimensions:', detectedWidth, 'x', detectedHeight, 'inches');
      setTileWidth(detectedWidth);
      setTileHeight(detectedHeight);
      setImage(img);
      setIsLoading(false);
    };
    
    img.onerror = (error) => {
      console.error('Failed to load image:', error);
      setIsLoading(false);
    };
    
    img.src = URL.createObjectURL(file);
  };

  const handlePaste = async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      
      for (const item of clipboardItems) {
        if (item.types.includes('image/png') || item.types.includes('image/jpeg')) {
          const blob = await item.getType('image/png') || await item.getType('image/jpeg');
          if (blob) {
            setIsLoading(true);
            
            // Try to extract DPI
            let detectedDpi = dpi; // Use current DPI as fallback
            try {
              const extractedDpi = await extractDpiFromFile(blob);
              if (extractedDpi) {
                detectedDpi = extractedDpi;
                setDpi(extractedDpi);
              }
            } catch (error) {
              console.warn('Could not extract DPI from pasted image:', error);
            }
            
            // Load the image
            const img = new Image();
            img.onload = () => {
              const finalDpi = detectedDpi || 96; // Fallback to 96 if no DPI detected
              const detectedWidth = img.width / finalDpi;
              const detectedHeight = img.height / finalDpi;
              setTileWidth(detectedWidth);
              setTileHeight(detectedHeight);
              setImage(img);
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
      }
    } catch (error) {
      console.error('Failed to read clipboard:', error);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-900">
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
            onPaste={handlePaste}
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
          />
          
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 z-50 pointer-events-none">
              <div className="text-sm text-slate-300">Loading...</div>
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
          />
        </div>
      </div>
    </div>
  );
}
