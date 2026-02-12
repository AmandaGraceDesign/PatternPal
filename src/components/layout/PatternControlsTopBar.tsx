'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useUser } from '@clerk/nextjs';
import ActionsSidebar from '@/components/sidebar/ActionsSidebar';

interface PatternControlsTopBarProps {
  repeatType: 'full-drop' | 'half-drop' | 'half-brick';
  tileWidth: number;
  tileHeight: number;
  dpi: number;
  showTileOutline: boolean;
  tileOutlineColor: string;
  onRepeatTypeChange: (type: 'full-drop' | 'half-drop' | 'half-brick') => void;
  onTileWidthChange: (width: number) => void;
  onTileHeightChange: (height: number) => void;
  onDpiChange: (dpi: number) => void;
  onShowTileOutlineChange: (show: boolean) => void;
  onTileOutlineColorChange: (color: string) => void;
  onFileUpload: (file: File, preloadedBlob?: Blob) => void;
  onPaste: () => void;
  scalePreviewSize: number | null;
  onScalePreviewChange: (size: number | null) => void;
  isScalePreviewActive: boolean;
  onScalePreviewActiveChange: (active: boolean) => void;
  originalTileWidth: number;
  originalTileHeight: number;
  // Advanced Tools flyout props (forwarded to ActionsSidebar)
  image: HTMLImageElement | null;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  originalFilename: string | null;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  effectiveTileWidth: number;
  effectiveTileHeight: number;
  effectiveScaleFactor: number;
  effectiveScalePreviewActive: boolean;
}

export default function PatternControlsTopBar({
  repeatType,
  tileWidth,
  tileHeight,
  dpi,
  showTileOutline,
  tileOutlineColor,
  onRepeatTypeChange,
  onTileWidthChange,
  onTileHeightChange,
  onDpiChange,
  onShowTileOutlineChange,
  onTileOutlineColorChange,
  onFileUpload,
  onPaste,
  scalePreviewSize,
  onScalePreviewChange,
  isScalePreviewActive,
  onScalePreviewActiveChange,
  originalTileWidth,
  originalTileHeight,
  image,
  zoom,
  onZoomChange,
  originalFilename,
  canvasRef,
  effectiveTileWidth,
  effectiveTileHeight,
  effectiveScaleFactor,
  effectiveScalePreviewActive,
}: PatternControlsTopBarProps) {
  const { isSignedIn } = useUser();
  const FREE_TESTS_KEY = 'pp_free_tests_used';
  const MAX_FREE_TESTS = 3;
  const [freeTestsUsed, setFreeTestsUsed] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isAdvancedToolsOpen, setIsAdvancedToolsOpen] = useState(false);
  const advancedToolsRef = useRef<HTMLDivElement>(null);

  // Close flyout on click outside or Escape key
  useEffect(() => {
    if (!isAdvancedToolsOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        advancedToolsRef.current &&
        !advancedToolsRef.current.contains(e.target as Node)
      ) {
        setIsAdvancedToolsOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsAdvancedToolsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isAdvancedToolsOpen]);

  useEffect(() => {
    const readFreeTests = () => {
      const count = Number(localStorage.getItem(FREE_TESTS_KEY) || '0');
      setFreeTestsUsed(Math.min(count, MAX_FREE_TESTS));
    };

    readFreeTests();
    const handleStorage = (event: StorageEvent) => {
      if (event.key === FREE_TESTS_KEY) readFreeTests();
    };
    const handleCustomUpdate = () => readFreeTests();

    window.addEventListener('storage', handleStorage);
    window.addEventListener('pp_free_tests_updated', handleCustomUpdate);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('pp_free_tests_updated', handleCustomUpdate);
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputEl = e.target;
    const file = inputEl.files?.[0];
    console.log('File selected in controls bar:', file?.name);
    if (file) {
      // Read the file into memory IMMEDIATELY in this event handler.
      // Network-mounted files (Google Drive, iCloud, Dropbox) use virtual
      // file handles that go stale if we wait even one async tick.
      // IMPORTANT: Do NOT reset inputEl.value until the read finishes —
      // clearing it can invalidate the file handle on FUSE filesystems.
      const reader = new FileReader();
      reader.onload = () => {
        const blob = new Blob([reader.result as ArrayBuffer], { type: file.type });
        inputEl.value = ''; // Reset only after bytes are captured
        onFileUpload(file, blob);
      };
      reader.onerror = () => {
        console.error('Failed to read file in controls bar:', reader.error);
        inputEl.value = '';
        onFileUpload(file);
      };
      reader.readAsArrayBuffer(file);
    } else {
      console.log('No file selected');
      inputEl.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        const blob = new Blob([reader.result as ArrayBuffer], { type: file.type });
        onFileUpload(file, blob);
      };
      reader.onerror = () => {
        onFileUpload(file);
      };
      reader.readAsArrayBuffer(file);
    }
  };

  return (
    <div className="relative z-50 w-full bg-[#3a3d44] px-5 py-4 shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
      <div className="grid grid-cols-2 gap-4 lg:flex lg:flex-wrap lg:items-start">
        {/* Upload Tile Section */}
        <div
          className="min-w-0 col-span-2 lg:col-span-1 lg:min-w-[240px] space-y-2 rounded-lg transition-colors"
          style={{
            borderColor: isDragging ? '#e0c26e' : 'transparent',
            backgroundColor: isDragging ? 'rgba(224,194,110,0.1)' : 'transparent',
            border: isDragging ? '2px dashed #e0c26e' : '2px dashed transparent',
            padding: '4px',
          }}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <label className="block">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <span
              className="inline-flex w-full max-w-[220px] justify-center px-5 py-2.5 text-sm font-semibold text-white rounded-lg cursor-pointer transition-all duration-200"
              style={{ backgroundColor: '#e0c26e' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#e8d28e';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#e0c26e';
              }}
            >
              Upload Pattern
            </span>
          </label>
          <p className="text-[11px] text-white text-left max-w-[220px] leading-snug">
            Or paste with Cmd+V, or drag and drop your image onto the canvas.
          </p>
          {!isSignedIn && (
            <p className="text-[11px] text-[#e0c26e] text-left font-medium">
              Free tests: {freeTestsUsed}/{MAX_FREE_TESTS}
            </p>
          )}
        </div>

        {/* Repeat Type Section */}
        <div className="min-w-0 border-l border-white/20 pl-4 lg:min-w-[200px]">
          <h2 className="text-xs font-semibold text-white mb-2 uppercase tracking-wide">
            Repeat Type
          </h2>
          <div className="flex flex-col gap-2 text-sm">
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="repeatType"
                value="full-drop"
                checked={repeatType === 'full-drop'}
                onChange={(e) => onRepeatTypeChange(e.target.value as 'full-drop')}
                className="mr-2 w-3 h-3 border-slate-600 focus:ring-1"
                style={{ accentColor: '#e0c26e' }}
              />
              <span className="text-sm text-white">Full Drop</span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="repeatType"
                value="half-drop"
                checked={repeatType === 'half-drop'}
                onChange={(e) => onRepeatTypeChange(e.target.value as 'half-drop')}
                className="mr-2 w-3 h-3 border-[#e5e7eb] focus:ring-1"
                style={{ accentColor: '#e0c26e' }}
              />
              <span className="text-sm text-white">Half Drop</span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="repeatType"
                value="half-brick"
                checked={repeatType === 'half-brick'}
                onChange={(e) => onRepeatTypeChange(e.target.value as 'half-brick')}
                className="mr-2 w-3 h-3 border-[#e5e7eb] focus:ring-1"
                style={{ accentColor: '#e0c26e' }}
              />
              <span className="text-sm text-white">Half Brick</span>
            </label>
          </div>
        </div>

        {/* Scale Preview Section */}
        <div className="min-w-0 border-l border-white/20 pl-4 lg:min-w-[260px]">
          <h2 className="text-xs font-semibold text-white mb-2 uppercase tracking-wide">
            Scale Preview
          </h2>
          <div className="space-y-2">
            <p className="text-[11px] text-white">
              Preview your pattern at a specific scale
            </p>
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={scalePreviewSize ?? ''}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                if (isNaN(value) || e.target.value === '') {
                  onScalePreviewChange(null);
                  onScalePreviewActiveChange(false);
                } else {
                  onScalePreviewChange(value);
                  onScalePreviewActiveChange(true);
                }
              }}
              placeholder={`${Math.max(originalTileWidth, originalTileHeight).toFixed(1)}"`}
              className="w-full px-3 py-2 text-xs bg-white/10 border border-white/20 rounded-md text-white placeholder-white/70 focus:outline-none focus:ring-1 focus:ring-[#e0c26e] focus:border-[#e0c26e]"
            />
            {isScalePreviewActive && scalePreviewSize !== null && (
              <div className="text-[11px] text-white">
                Preview size: {(() => {
                  const longest = Math.max(originalTileWidth, originalTileHeight);
                  const scaleFactor = scalePreviewSize / longest;
                  const previewWidth = (originalTileWidth * scaleFactor).toFixed(1);
                  const previewHeight = (originalTileHeight * scaleFactor).toFixed(1);
                  return `${previewWidth}" × ${previewHeight}"`;
                })()}
              </div>
            )}
            {isScalePreviewActive && (
              <button
                onClick={() => {
                  onScalePreviewChange(null);
                  onScalePreviewActiveChange(false);
                }}
                className="px-3 py-1.5 text-[11px] text-white hover:text-white bg-white/10 hover:bg-white/20 border border-white/20 rounded-md transition-colors"
              >
                Reset to Original
              </button>
            )}
          </div>
        </div>

        {/* Zoom Section */}
        <div className="min-w-0 border-l border-white/20 pl-4 lg:min-w-[240px]">
          <h2 className="text-xs font-semibold text-white mb-2 uppercase tracking-wide">
            Zoom: {Math.round(zoom)}%
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-white whitespace-nowrap">0%</span>
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
              disabled={effectiveScalePreviewActive}
              className={`zoom-slider flex-1 h-1.5 rounded-lg appearance-none ${
                effectiveScalePreviewActive ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
              }`}
              style={{
                background: effectiveScalePreviewActive
                  ? 'rgba(255,255,255,0.2)'
                  : `linear-gradient(to right, #e0c26e 0%, #e0c26e ${(Math.max(0, Math.min(200, zoom)) / 200) * 100}%, rgba(255,255,255,0.2) ${(Math.max(0, Math.min(200, zoom)) / 200) * 100}%, rgba(255,255,255,0.2) 100%)`,
              }}
            />
            <span className="text-xs text-white whitespace-nowrap">200%</span>
          </div>
          {effectiveScalePreviewActive && (
            <span className="text-[11px] text-white italic mt-1 block">
              Zoom locked by scale preview
            </span>
          )}
          <span className="text-[11px] text-white mt-1 block">
            Original Tile: {originalTileWidth.toFixed(1)}&quot; × {originalTileHeight.toFixed(1)}&quot;, {dpi}dpi
          </span>
        </div>

        {/* Options Section */}
        <div className="min-w-0 border-l border-white/20 pl-4 lg:min-w-[160px]">
          <h2 className="text-xs font-semibold text-white mb-2 uppercase tracking-wide">
            Options
          </h2>
          <div className="space-y-2">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={showTileOutline}
                onChange={(e) => onShowTileOutlineChange(e.target.checked)}
                className="mr-2 w-4 h-4 border-white/20 rounded focus:ring-1 bg-white/10"
                style={{ accentColor: '#e0c26e' }}
              />
              <span className="text-sm text-white">Show Tile Outline</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={tileOutlineColor}
                onChange={(e) => onTileOutlineColorChange(e.target.value)}
                className="h-7 w-10 rounded border border-white/20 bg-white/10 cursor-pointer"
                aria-label="Tile outline color"
              />
              <span className="text-xs text-white">Outline color</span>
            </div>
          </div>
        </div>

        {/* Advanced Tools Section */}
        <div
          className="relative min-w-0 border-l border-white/20 pl-4"
          ref={advancedToolsRef}
        >
          <h2 className="text-xs font-semibold text-white mb-2 uppercase tracking-wide">
            Tools
          </h2>
          <button
            onClick={() => setIsAdvancedToolsOpen((prev) => !prev)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white rounded-md transition-all duration-200"
            style={{ backgroundColor: '#e0c26e' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#c9a94e';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#e0c26e';
            }}
          >
            {/* 2x2 grid icon */}
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect x="1" y="1" width="5" height="5" rx="1" fill="#1a1d23" />
              <rect x="10" y="1" width="5" height="5" rx="1" fill="#1a1d23" />
              <rect x="1" y="10" width="5" height="5" rx="1" fill="#1a1d23" />
              <rect x="10" y="10" width="5" height="5" rx="1" fill="#1a1d23" />
            </svg>
            Advanced Tools
            <svg
              className={`w-3 h-3 transition-transform ${isAdvancedToolsOpen ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Flyout Panel */}
          {isAdvancedToolsOpen && (
            <div
              className="absolute top-full right-0 mt-2 z-50 bg-white border border-[#e5e7eb] rounded-lg shadow-xl overflow-y-auto"
              style={{ width: '320px', maxHeight: '70vh' }}
            >
              <Suspense fallback={null}>
                <ActionsSidebar
                  image={image}
                  dpi={dpi}
                  tileWidth={effectiveTileWidth}
                  tileHeight={effectiveTileHeight}
                  repeatType={repeatType}
                  zoom={zoom}
                  originalFilename={originalFilename}
                  canvasRef={canvasRef}
                  scaleFactor={effectiveScaleFactor}
                  scalePreviewActive={effectiveScalePreviewActive}
                  tileOutlineColor={tileOutlineColor}
                />
              </Suspense>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
