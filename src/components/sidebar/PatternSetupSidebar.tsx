'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';

interface PatternSetupSidebarProps {
  repeatType: 'full-drop' | 'half-drop' | 'half-brick';
  tileWidth: number;
  tileHeight: number;
  dpi: number;
  showTileOutline: boolean;
  onRepeatTypeChange: (type: 'full-drop' | 'half-drop' | 'half-brick') => void;
  onTileWidthChange: (width: number) => void;
  onTileHeightChange: (height: number) => void;
  onDpiChange: (dpi: number) => void;
  onShowTileOutlineChange: (show: boolean) => void;
  onFileUpload: (file: File, preloadedBlob?: Blob) => void;
  onPaste: () => void;
  scalePreviewSize: number | null;
  onScalePreviewChange: (size: number | null) => void;
  isScalePreviewActive: boolean;
  onScalePreviewActiveChange: (active: boolean) => void;
  originalTileWidth: number;
  originalTileHeight: number;
}

export default function PatternSetupSidebar({
  repeatType,
  tileWidth,
  tileHeight,
  dpi,
  showTileOutline,
  onRepeatTypeChange,
  onTileWidthChange,
  onTileHeightChange,
  onDpiChange,
  onShowTileOutlineChange,
  onFileUpload,
  onPaste,
  scalePreviewSize,
  onScalePreviewChange,
  isScalePreviewActive,
  onScalePreviewActiveChange,
  originalTileWidth,
  originalTileHeight,
}: PatternSetupSidebarProps) {
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
    console.log('File selected in sidebar:', file?.name);
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
        console.error('Failed to read file in sidebar:', reader.error);
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
    <aside className="w-72 bg-white border-r border-[#e5e7eb] p-6 overflow-y-auto">
      {/* Repeat Type Section */}
      <div className="mb-8">
        <h2 className="text-xs font-semibold text-[#294051] mb-3 uppercase tracking-wide">
          Repeat Type
        </h2>
        <div className="space-y-2">
          <label className="flex items-center cursor-pointer group">
            <input
              type="radio"
              name="repeatType"
              value="full-drop"
              checked={repeatType === 'full-drop'}
              onChange={(e) => onRepeatTypeChange(e.target.value as 'full-drop')}
              className="mr-2 w-3 h-3 border-slate-600 focus:ring-1"
              style={{ accentColor: '#f1737c' }}
            />
            <span className="text-sm text-[#374151] group-hover:text-[#294051]">
              Full Drop
            </span>
          </label>
          <label className="flex items-center cursor-pointer group">
            <input
              type="radio"
              name="repeatType"
              value="half-drop"
              checked={repeatType === 'half-drop'}
              onChange={(e) => onRepeatTypeChange(e.target.value as 'half-drop')}
              className="mr-2 w-3 h-3 border-[#e5e7eb] focus:ring-1"
              style={{ accentColor: '#f1737c' }}
            />
            <span className="text-sm text-[#374151] group-hover:text-[#294051]">
              Half Drop
            </span>
          </label>
          <label className="flex items-center cursor-pointer group">
            <input
              type="radio"
              name="repeatType"
              value="half-brick"
              checked={repeatType === 'half-brick'}
              onChange={(e) => onRepeatTypeChange(e.target.value as 'half-brick')}
              className="mr-2 w-3 h-3 border-[#e5e7eb] focus:ring-1"
              style={{ accentColor: '#f1737c' }}
            />
            <span className="text-sm text-[#374151] group-hover:text-[#294051]">
              Half Brick
            </span>
          </label>
        </div>
      </div>

      {/* Tile Info Section */}
      <div className="mb-8">
        <h2 className="text-xs font-semibold text-[#294051] mb-3 uppercase tracking-wide">
          Original Tile Size and DPI
        </h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-[#6b7280] mb-1.5">Width (in)</label>
            <input
              type="number"
              value={tileWidth}
              disabled
              className="w-full px-3 py-2 text-sm bg-[#f5f5f5] border border-[#e5e7eb] rounded-md text-[#374151] cursor-not-allowed"
              step="0.1"
            />
          </div>
          <div>
            <label className="block text-xs text-[#6b7280] mb-1.5">Height (in)</label>
            <input
              type="number"
              value={tileHeight}
              disabled
              className="w-full px-3 py-2 text-sm bg-[#f5f5f5] border border-[#e5e7eb] rounded-md text-[#374151] cursor-not-allowed"
              step="0.1"
            />
          </div>
          <div>
            <label className="block text-xs text-[#6b7280] mb-1.5">DPI</label>
            <input
              type="number"
              value={dpi}
              disabled
              className="w-full px-3 py-2 text-sm bg-[#f5f5f5] border border-[#e5e7eb] rounded-md text-[#374151] cursor-not-allowed"
            />
          </div>
        </div>
      </div>

      {/* Scale Preview Section */}
      <div className="mb-8">
        <h2 className="text-xs font-semibold text-[#294051] mb-3 uppercase tracking-wide">
          Preview Your Pattern at a Specific Scale
        </h2>

        <div className="space-y-3">
          {/* Scale Input */}
          <div>
            <label className="block text-xs text-[#6b7280] mb-1.5">
              Longest Side (in)
              {isScalePreviewActive && (
                <span className="ml-2 text-[#f1737c] text-xs">● Active</span>
              )}
            </label>
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
              placeholder={Math.max(originalTileWidth, originalTileHeight).toFixed(1)}
              className="w-full px-3 py-2 text-sm bg-white border border-[#e5e7eb] rounded-md text-[#374151] placeholder-[#9ca3af] focus:outline-none focus:ring-1 focus:ring-[#f1737c] focus:border-[#f1737c]"
            />
            <p className="text-xs text-[#6b7280] mt-1">
              Original: {Math.max(originalTileWidth, originalTileHeight).toFixed(1)}"
            </p>
          </div>

          {/* Preview Info - Shows scaled dimensions */}
          {isScalePreviewActive && scalePreviewSize !== null && (
            <div className="p-3 bg-[#f5f5f5] rounded-md">
              <p className="text-xs text-[#6b7280] mb-1">Preview Scale:</p>
              <p className="text-sm text-[#374151] font-medium">
                {(() => {
                  const longest = Math.max(originalTileWidth, originalTileHeight);
                  const scaleFactor = scalePreviewSize / longest;
                  const previewWidth = (originalTileWidth * scaleFactor).toFixed(1);
                  const previewHeight = (originalTileHeight * scaleFactor).toFixed(1);
                  return `${previewWidth}" × ${previewHeight}"`;
                })()}
              </p>
              <p className="text-xs text-[#6b7280] mt-1">
                ({((scalePreviewSize / Math.max(originalTileWidth, originalTileHeight)) * 100).toFixed(0)}% of original)
              </p>
            </div>
          )}

          {/* Reset Button */}
          {isScalePreviewActive && (
            <button
              onClick={() => {
                onScalePreviewChange(null);
                onScalePreviewActiveChange(false);
              }}
              className="w-full px-3 py-2 text-xs text-[#374151] hover:text-[#1f2937] bg-white hover:bg-[#f5f5f5] border border-[#e5e7eb] rounded-md transition-colors"
            >
              Reset to Original Size
            </button>
          )}
        </div>
      </div>

      {/* Show Tile Outline Toggle */}
      <div className="mb-8">
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={showTileOutline}
            onChange={(e) => onShowTileOutlineChange(e.target.checked)}
            className="mr-2 w-4 h-4 border-[#e5e7eb] rounded focus:ring-1 bg-white"
            style={{ accentColor: '#f1737c' }}
          />
          <span className="text-sm text-[#374151]">Show Tile Outline</span>
        </label>
      </div>

      {/* Upload/Paste Section */}
      <div>
        <h2 className="text-xs font-semibold text-[#294051] mb-3 uppercase tracking-wide">
          Upload Tile
        </h2>
        <div
          className="space-y-2 rounded-md border border-dashed transition-colors"
          style={{
            borderColor: isDragging ? '#f1737c' : '#e5e7eb',
            backgroundColor: isDragging ? '#fff1f2' : 'transparent',
            padding: '10px',
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
              className="block w-full px-4 py-2.5 text-xs font-semibold text-center text-white rounded-md cursor-pointer transition-all duration-200"
              style={{ backgroundColor: '#f1737c' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#ff8a94';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#f1737c';
              }}
            >
              Choose File
            </span>
          </label>
          <p className="text-xs text-[#6b7280] text-center">
            Paste your design by using CMD+V or drag and drop your image onto the canvas
          </p>
          {!isSignedIn && (
            <p className="text-[11px] text-[#f1737c] text-center font-medium">
              Free tests: {freeTestsUsed}/{MAX_FREE_TESTS}
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}

