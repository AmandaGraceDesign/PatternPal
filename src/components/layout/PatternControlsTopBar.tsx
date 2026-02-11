'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';

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
}: PatternControlsTopBarProps) {
  const { isSignedIn } = useUser();
  const FREE_TESTS_KEY = 'pp_free_tests_used';
  const MAX_FREE_TESTS = 3;
  const [freeTestsUsed, setFreeTestsUsed] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

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
    <div className="w-full bg-white border-b border-[#e5e7eb] px-4 py-3">
      <div className="grid grid-cols-2 gap-4 lg:flex lg:flex-wrap lg:items-start">
        {/* Upload Tile Section */}
        <div className="min-w-0 col-span-2 lg:col-span-1 lg:min-w-[240px]">
          <h2 className="text-xs font-semibold text-[#294051] mb-2 uppercase tracking-wide">
            Upload Tile
          </h2>
          <div
            className="space-y-2 rounded-md border border-dashed transition-colors"
            style={{
              borderColor: isDragging ? '#e0c26e' : '#e5e7eb',
              backgroundColor: isDragging ? '#fff1f2' : 'transparent',
              padding: '8px',
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
                className="inline-flex w-auto px-3 py-1.5 md:py-2 text-[11px] md:text-xs font-semibold text-center text-white rounded-md cursor-pointer transition-all duration-200"
                style={{ backgroundColor: '#e0c26e' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#e8d28e';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#e0c26e';
                }}
              >
                Choose File
              </span>
            </label>
            <p className="text-[11px] text-[#6b7280] text-left max-w-[260px] leading-snug">
              Paste your design with Cmd+V, or drag and drop your image onto the canvas.
            </p>
            {!isSignedIn && (
              <p className="text-[11px] text-[#e0c26e] text-center font-medium">
                Free tests: {freeTestsUsed}/{MAX_FREE_TESTS}
              </p>
            )}
          </div>
        </div>

        {/* Repeat Type Section */}
        <div className="min-w-0 border-l border-[#cdcdcd] pl-4 lg:min-w-[200px]">
          <h2 className="text-xs font-semibold text-[#294051] mb-2 uppercase tracking-wide">
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
              <span className="text-sm text-[#374151]">Full Drop</span>
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
              <span className="text-sm text-[#374151]">Half Drop</span>
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
              <span className="text-sm text-[#374151]">Half Brick</span>
            </label>
          </div>
        </div>

        {/* Scale Preview Section */}
        <div className="min-w-0 border-l border-[#cdcdcd] pl-4 lg:min-w-[260px]">
          <h2 className="text-xs font-semibold text-[#294051] mb-2 uppercase tracking-wide">
            Scale Preview
          </h2>
          <div className="space-y-2">
            <p className="text-[11px] text-[#6b7280]">
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
              className="w-full px-3 py-2 text-xs bg-white border border-[#e5e7eb] rounded-md text-[#374151] placeholder-[#9ca3af] focus:outline-none focus:ring-1 focus:ring-[#e0c26e] focus:border-[#e0c26e]"
            />
            {isScalePreviewActive && scalePreviewSize !== null && (
              <div className="text-[11px] text-[#6b7280]">
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
                className="px-3 py-1.5 text-[11px] text-[#374151] hover:text-[#1f2937] bg-white hover:bg-[#f5f5f5] border border-[#e5e7eb] rounded-md transition-colors"
              >
                Reset to Original
              </button>
            )}
          </div>
        </div>

        {/* Options Section */}
        <div className="min-w-0 border-l border-[#cdcdcd] pl-4 lg:min-w-[160px]">
          <h2 className="text-xs font-semibold text-[#294051] mb-2 uppercase tracking-wide">
            Options
          </h2>
          <div className="space-y-2">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={showTileOutline}
                onChange={(e) => onShowTileOutlineChange(e.target.checked)}
                className="mr-2 w-4 h-4 border-[#e5e7eb] rounded focus:ring-1 bg-white"
                style={{ accentColor: '#e0c26e' }}
              />
              <span className="text-sm text-[#374151]">Show Tile Outline</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={tileOutlineColor}
                onChange={(e) => onTileOutlineColorChange(e.target.value)}
                className="h-7 w-10 rounded border border-[#e5e7eb] bg-white cursor-pointer"
                aria-label="Tile outline color"
              />
              <span className="text-xs text-[#6b7280]">Outline color</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
