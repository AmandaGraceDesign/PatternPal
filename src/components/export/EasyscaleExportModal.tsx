'use client';

import { useState, useEffect } from 'react';
import { generateScaledExport, ScaledExportConfig } from '@/lib/utils/exportScaled';
import { calculateOriginalSize, detectOriginalDPI } from '@/lib/utils/imageScaler';

interface EasyscaleExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  image: HTMLImageElement | null;
  currentDPI: number;
  repeatType: 'full-drop' | 'half-drop' | 'half-brick';
  originalFilename: string | null;
  isPro?: boolean;
}

const PRESET_SIZES = [2, 4, 6, 8, 10, 12, 18, 24];
const FREE_USER_SIZES = [8, 12]; // Free users limited to 8" and 12"

// Map UI repeat types to export format
function mapRepeatType(repeatType: 'full-drop' | 'half-drop' | 'half-brick'): string {
  switch (repeatType) {
    case 'full-drop':
      return 'fulldrop';
    case 'half-drop':
      return 'halfdrop';
    case 'half-brick':
      return 'halfbrick';
  }
}

export default function EasyscaleExportModal({
  isOpen,
  onClose,
  image,
  currentDPI,
  repeatType,
  originalFilename,
  isPro = false,
}: EasyscaleExportModalProps) {
  const [selectedSizes, setSelectedSizes] = useState<number[]>([]);
  const [selectedDPI, setSelectedDPI] = useState<150 | 300>(isPro ? 300 : 150);
  const [format, setFormat] = useState<'png' | 'jpg' | 'tif'>(isPro ? 'png' : 'jpg');
  const [includeOriginal, setIncludeOriginal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSize, setCurrentSize] = useState<{ width: number; height: number } | null>(null);
  const [customSizeInput, setCustomSizeInput] = useState<string>('');

  // Calculate the maximum exportable size (in inches) without upscaling
  // Based on the image's actual pixel dimensions and the target DPI
  const getMaxExportSize = (targetDPI: number): number => {
    if (!image) return 0;
    const longestPixelSide = Math.max(image.naturalWidth, image.naturalHeight);
    return longestPixelSide / targetDPI;
  };

  const maxExportSize = getMaxExportSize(selectedDPI);

  // Check if a size would cause upscaling/pixelation
  const isSizeAllowed = (size: number): boolean => {
    return size <= maxExportSize;
  };

  // Calculate current size when image or DPI changes
  useEffect(() => {
    if (image && currentDPI) {
      const size = calculateOriginalSize(image, currentDPI);
      setCurrentSize({ width: size.width, height: size.height });

      // If original DPI is less than 300 and user has 300 selected, switch to 150
      if (currentDPI < 300 && selectedDPI === 300) {
        setSelectedDPI(150);
      }
    } else {
      setCurrentSize(null);
    }
  }, [image, currentDPI]);

  // Auto-deselect sizes that become invalid when DPI changes
  useEffect(() => {
    if (!image) return;
    const maxSize = getMaxExportSize(selectedDPI);
    setSelectedSizes(prev => prev.filter(size => size <= maxSize));
  }, [selectedDPI, image]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleSizeToggle = (size: number) => {
    // Block sizes that would cause upscaling
    if (!isSizeAllowed(size)) return;

    if (!isPro) {
      // Free users can select up to 2 sizes (8" and 12" only)
      setSelectedSizes((prev) => {
        if (prev.includes(size)) {
          return prev.filter((s) => s !== size);
        } else if (prev.length < 2) {
          return [...prev, size];
        } else {
          // If already 2 selected, replace the first one
          return [prev[1], size];
        }
      });
    } else {
      setSelectedSizes((prev) =>
        prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]
      );
    }
  };

  const handleExport = async () => {
    if (!image || selectedSizes.length === 0) {
      setError('Please select at least one size to export.');
      return;
    }

    // Final safety check: block any sizes that would cause pixelation
    const invalidSizes = selectedSizes.filter(size => !isSizeAllowed(size));
    if (invalidSizes.length > 0) {
      setError(`Cannot export ${invalidSizes.join('", "')}\" — would cause pixelation. Max size at ${selectedDPI} DPI is ${maxExportSize.toFixed(1)}".`);
      setSelectedSizes(prev => prev.filter(size => isSizeAllowed(size)));
      return;
    }

    setIsExporting(true);
    setError(null);

    try {
      const config: ScaledExportConfig = {
        image,
        selectedSizes,
        selectedDPI,
        format,
        repeatType: mapRepeatType(repeatType),
        includeOriginal,
        originalDPI: currentDPI,
        originalFilename,
      };

      await generateScaledExport(config);
      
      // Close modal after successful export
      setTimeout(() => {
        onClose();
        setIsExporting(false);
      }, 500);
    } catch (err) {
      console.error('Export error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate export. Please try again.');
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  const fileCount = selectedSizes.length + (includeOriginal ? 1 : 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="relative max-w-2xl w-full max-h-[90vh] bg-white rounded-lg shadow-2xl overflow-hidden border border-[#92afa5]/30"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#92afa5]/30 flex items-center justify-between bg-[#e0c26e]">
          <h3 className="text-sm font-semibold text-white">Easyscale Export</h3>
          <button
            onClick={onClose}
            className="text-[#705046] hover:text-[#294051] transition-all duration-200"
            aria-label="Close"
            disabled={isExporting}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-auto max-h-[calc(90vh-120px)]">
          {!image ? (
            <div className="text-center py-8">
              <p className="text-sm text-[#6b7280]">No pattern loaded. Please upload a pattern first.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Current Pattern Info */}
              <div className="p-4 bg-[#f5f5f5] rounded-md border border-[#e5e7eb]">
                <h4 className="text-xs font-semibold text-[#294051] mb-2 uppercase tracking-wide">
                  Current Pattern
                </h4>
                <div className="text-sm text-[#374151] space-y-1">
                  {currentSize && (
                    <>
                      <p>Size: {currentSize.width.toFixed(2)}" × {currentSize.height.toFixed(2)}"</p>
                      <p>DPI: {currentDPI} &bull; Pixels: {image?.naturalWidth} × {image?.naturalHeight}</p>
                      <p className="text-xs text-emerald-700 font-medium mt-1">
                        Max export at {selectedDPI} DPI: {maxExportSize.toFixed(1)}" (no pixelation)
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Size Selection */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-semibold text-[#294051] uppercase tracking-wide">
                    Select Sizes (Longest Side)
                  </h4>
                  {!isPro && (
                    <span className="text-[10px] text-[#6b7280] italic">Free: 8" & 12" only</span>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {(isPro ? PRESET_SIZES : FREE_USER_SIZES).map((size) => {
                    const allowed = isSizeAllowed(size);
                    return (
                      <label
                        key={size}
                        className={`flex flex-col items-center justify-center px-3 py-2 rounded-md border transition-colors ${
                          !allowed
                            ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                            : selectedSizes.includes(size)
                              ? 'bg-[#faf3e0] border-[#e0c26e] text-[#294051] cursor-pointer'
                              : 'bg-white border-[#e5e7eb] text-[#374151] hover:bg-[#f5f5f5] cursor-pointer'
                        }`}
                        title={!allowed ? `Cannot export at ${size}" — would require upscaling (max ${maxExportSize.toFixed(1)}" at ${selectedDPI} DPI)` : undefined}
                      >
                        <input
                          type="checkbox"
                          checked={selectedSizes.includes(size)}
                          onChange={() => handleSizeToggle(size)}
                          className="sr-only"
                          disabled={isExporting || !allowed}
                        />
                        <span className="text-xs font-medium">{size}"</span>
                        {!allowed && (
                          <span className="text-[9px] text-gray-400 leading-tight">too large</span>
                        )}
                      </label>
                    );
                  })}
                </div>
                {!isPro && (
                  <p className="text-xs text-[#6b7280] mt-2 italic">
                    💡 Upgrade to Pro to export all sizes (2", 4", 6", 8", 10", 12", 18", 24")
                  </p>
                )}

                {/* Custom Size Input (Pro only) */}
                {isPro && (
                  <div className="mt-3">
                    <p className="text-[10px] text-[#6b7280] mb-1.5">Custom size (max {maxExportSize.toFixed(1)}" at {selectedDPI} DPI without pixelation)</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max={Math.floor(maxExportSize * 2) / 2}
                        step="0.5"
                        value={customSizeInput}
                        onChange={(e) => setCustomSizeInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const val = parseFloat(customSizeInput);
                            if (val > 0 && isSizeAllowed(val) && !selectedSizes.includes(val)) {
                              setSelectedSizes(prev => [...prev, val]);
                              setCustomSizeInput('');
                            }
                          }
                        }}
                        placeholder="Custom"
                        className="w-20 px-2 py-1.5 text-xs border border-[#e5e7eb] rounded-md focus:outline-none focus:border-[#e0c26e] text-[#374151]"
                        disabled={isExporting}
                      />
                      <span className="text-xs text-[#6b7280]">inches</span>
                      <button
                        onClick={() => {
                          const val = parseFloat(customSizeInput);
                          if (val > 0 && isSizeAllowed(val) && !selectedSizes.includes(val)) {
                            setSelectedSizes(prev => [...prev, val]);
                            setCustomSizeInput('');
                          }
                        }}
                        disabled={isExporting || !customSizeInput || parseFloat(customSizeInput) <= 0 || !isSizeAllowed(parseFloat(customSizeInput || '0'))}
                        className="px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ backgroundColor: '#e0c26e', color: 'white' }}
                      >
                        + Add
                      </button>
                      {customSizeInput && parseFloat(customSizeInput) > 0 && !isSizeAllowed(parseFloat(customSizeInput)) && (
                        <span className="text-[10px] text-red-500">Too large — max {maxExportSize.toFixed(1)}"</span>
                      )}
                    </div>

                    {/* Show custom (non-preset) sizes as removable chips */}
                    {selectedSizes.filter(s => !PRESET_SIZES.includes(s)).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {selectedSizes.filter(s => !PRESET_SIZES.includes(s)).map(size => (
                          <span
                            key={size}
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-[#faf3e0] border border-[#e0c26e] text-[#294051]"
                          >
                            {size}"
                            <button
                              onClick={() => setSelectedSizes(prev => prev.filter(s => s !== size))}
                              className="text-[#705046] hover:text-red-500 leading-none"
                              disabled={isExporting}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* DPI Selection */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-semibold text-[#294051] uppercase tracking-wide">
                    Target DPI
                  </h4>
                  {!isPro && (
                    <span className="text-[10px] text-[#6b7280] italic">Free: 150 DPI only</span>
                  )}
                </div>
                <div className="flex gap-3">
                  <label className="flex items-center cursor-pointer group">
                    <input
                      type="radio"
                      name="dpi"
                      value="150"
                      checked={selectedDPI === 150}
                      onChange={() => setSelectedDPI(150)}
                      className="mr-2 w-3 h-3 border-[#e5e7eb] focus:ring-1"
                      style={{ accentColor: '#e0c26e' }}
                      disabled={isExporting}
                    />
                    <span className="text-sm text-[#374151] group-hover:text-[#294051]">
                      150 DPI (Standard)
                    </span>
                  </label>
                  <label className={`flex items-center ${isPro && currentDPI >= 300 ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'} group`}>
                    <input
                      type="radio"
                      name="dpi"
                      value="300"
                      checked={selectedDPI === 300}
                      onChange={() => setSelectedDPI(300)}
                      className="mr-2 w-3 h-3 border-[#e5e7eb] focus:ring-1"
                      style={{ accentColor: '#e0c26e' }}
                      disabled={isExporting || currentDPI < 300 || !isPro}
                    />
                    <span className="text-sm text-[#374151] group-hover:text-[#294051]">
                      300 DPI (High Quality) {!isPro && '🔒'}
                    </span>
                  </label>
                </div>
                {!isPro && (
                  <p className="text-xs text-[#6b7280] mt-2 italic">
                    💡 Upgrade to Pro for 300 DPI exports
                  </p>
                )}
                {isPro && currentDPI < 300 && (
                  <p className="text-xs text-[#6b7280] mt-2 italic">
                    300 DPI export requires original file to be at least 300 DPI
                  </p>
                )}
              </div>

              {/* Format Selection */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-semibold text-[#294051] uppercase tracking-wide">
                    Format
                  </h4>
                  {!isPro && (
                    <span className="text-[10px] text-[#6b7280] italic">Free: JPG only</span>
                  )}
                </div>
                <div className="flex gap-3">
                  <label className={`flex items-center ${isPro ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'} group`}>
                    <input
                      type="radio"
                      name="format"
                      value="png"
                      checked={format === 'png'}
                      onChange={() => setFormat('png')}
                      className="mr-2 w-3 h-3 border-[#e5e7eb] focus:ring-1"
                      style={{ accentColor: '#e0c26e' }}
                      disabled={isExporting || !isPro}
                    />
                    <span className="text-sm text-[#374151] group-hover:text-[#294051]">
                      PNG (Lossless) {!isPro && '🔒'}
                    </span>
                  </label>
                  <label className="flex items-center cursor-pointer group">
                    <input
                      type="radio"
                      name="format"
                      value="jpg"
                      checked={format === 'jpg'}
                      onChange={() => setFormat('jpg')}
                      className="mr-2 w-3 h-3 border-[#e5e7eb] focus:ring-1"
                      style={{ accentColor: '#e0c26e' }}
                      disabled={isExporting}
                    />
                    <span className="text-sm text-[#374151] group-hover:text-[#294051]">
                      JPG (Smaller File)
                    </span>
                  </label>
                  <label className={`flex items-center ${isPro ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'} group`}>
                    <input
                      type="radio"
                      name="format"
                      value="tif"
                      checked={format === 'tif'}
                      onChange={() => setFormat('tif')}
                      className="mr-2 w-3 h-3 border-[#e5e7eb] focus:ring-1"
                      style={{ accentColor: '#e0c26e' }}
                      disabled={isExporting || !isPro}
                    />
                    <span className="text-sm text-[#374151] group-hover:text-[#294051]">
                      TIFF (Lossless, Pro) {!isPro && '🔒'}
                    </span>
                  </label>
                </div>
                {!isPro && (
                  <p className="text-xs text-[#6b7280] mt-2 italic">
                    💡 Upgrade to Pro for PNG and TIFF exports
                  </p>
                )}
              </div>

              {/* Include Original */}
              <div>
                <label className={`flex items-center ${isPro ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
                  <input
                    type="checkbox"
                    checked={includeOriginal}
                    onChange={(e) => setIncludeOriginal(e.target.checked)}
                    className="mr-2 w-4 h-4 border-[#e5e7eb] rounded focus:ring-1 bg-white"
                    style={{ accentColor: '#e0c26e' }}
                    disabled={isExporting || !isPro}
                  />
                  <span className="text-sm text-[#374151]">
                    Include original tile in export {!isPro && '🔒'}
                  </span>
                </label>
                {!isPro && (
                  <p className="text-xs text-[#6b7280] mt-2 italic ml-6">
                    💡 Upgrade to Pro to include your original tile
                  </p>
                )}
              </div>

              {/* Preview */}
              {selectedSizes.length > 0 && (
                <div className="p-3 bg-[#f5f5f5] rounded-md border border-[#e5e7eb]">
                  <p className="text-xs text-[#6b7280]">
                    Will generate {fileCount} file{fileCount !== 1 ? 's' : ''} in the zip archive
                  </p>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-md">
                  <p className="text-xs text-orange-700">{error}</p>
                </div>
              )}

              {/* Export Button */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 text-xs font-medium bg-white border border-[#e5e7eb] rounded-md text-[#374151] hover:bg-[#f5f5f5] transition-colors"
                  disabled={isExporting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleExport}
                  disabled={isExporting || selectedSizes.length === 0}
                  className="flex-1 px-4 py-2.5 text-xs font-medium text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: '#e0c26e' }}
                  onMouseEnter={(e) => {
                    if (!e.currentTarget.disabled) {
                      e.currentTarget.style.backgroundColor = '#c9a94e';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!e.currentTarget.disabled) {
                      e.currentTarget.style.backgroundColor = '#e0c26e';
                    }
                  }}
                >
                  {isExporting ? 'Exporting...' : 'Export'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


