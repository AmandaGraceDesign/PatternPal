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
}

const PRESET_SIZES = [2, 4, 6, 8, 10, 12, 18, 24];

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
}: EasyscaleExportModalProps) {
  const [selectedSizes, setSelectedSizes] = useState<number[]>([]);
  const [selectedDPI, setSelectedDPI] = useState<150 | 300>(300);
  const [format, setFormat] = useState<'png' | 'jpg'>('png');
  const [includeOriginal, setIncludeOriginal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSize, setCurrentSize] = useState<{ width: number; height: number } | null>(null);

  // Calculate current size when image or DPI changes
  useEffect(() => {
    if (image && currentDPI) {
      const size = calculateOriginalSize(image, currentDPI);
      setCurrentSize({ width: size.width, height: size.height });
    } else {
      setCurrentSize(null);
    }
  }, [image, currentDPI]);

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
    setSelectedSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]
    );
  };

  const handleExport = async () => {
    if (!image || selectedSizes.length === 0) {
      setError('Please select at least one size to export.');
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-w-2xl w-full max-h-[90vh] bg-slate-800 rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200">Easyscale Export</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors"
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
              <p className="text-sm text-slate-400">No pattern loaded. Please upload a pattern first.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Current Pattern Info */}
              <div className="p-4 bg-slate-900 rounded-md border border-slate-700">
                <h4 className="text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wide">
                  Current Pattern
                </h4>
                <div className="text-sm text-slate-200 space-y-1">
                  {currentSize && (
                    <>
                      <p>Size: {currentSize.width.toFixed(2)}" × {currentSize.height.toFixed(2)}"</p>
                      <p>DPI: {currentDPI}</p>
                    </>
                  )}
                </div>
              </div>

              {/* Size Selection */}
              <div>
                <h4 className="text-xs font-semibold text-slate-300 mb-3 uppercase tracking-wide">
                  Select Sizes (Longest Side)
                </h4>
                <div className="grid grid-cols-4 gap-2">
                  {PRESET_SIZES.map((size) => (
                    <label
                      key={size}
                      className={`flex items-center justify-center px-3 py-2 rounded-md border cursor-pointer transition-colors ${
                        selectedSizes.includes(size)
                          ? 'bg-slate-700 border-slate-600 text-slate-100'
                          : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedSizes.includes(size)}
                        onChange={() => handleSizeToggle(size)}
                        className="sr-only"
                        disabled={isExporting}
                      />
                      <span className="text-xs font-medium">{size}"</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* DPI Selection */}
              <div>
                <h4 className="text-xs font-semibold text-slate-300 mb-3 uppercase tracking-wide">
                  Target DPI
                </h4>
                <div className="flex gap-3">
                  <label className="flex items-center cursor-pointer group">
                    <input
                      type="radio"
                      name="dpi"
                      value="150"
                      checked={selectedDPI === 150}
                      onChange={() => setSelectedDPI(150)}
                      className="mr-2 w-3 h-3 border-slate-600 focus:ring-1"
                      style={{ accentColor: '#f1737c' }}
                      disabled={isExporting}
                    />
                    <span className="text-sm text-slate-200 group-hover:text-slate-100">
                      150 DPI (Standard)
                    </span>
                  </label>
                  <label className="flex items-center cursor-pointer group">
                    <input
                      type="radio"
                      name="dpi"
                      value="300"
                      checked={selectedDPI === 300}
                      onChange={() => setSelectedDPI(300)}
                      className="mr-2 w-3 h-3 border-slate-600 focus:ring-1"
                      style={{ accentColor: '#f1737c' }}
                      disabled={isExporting}
                    />
                    <span className="text-sm text-slate-200 group-hover:text-slate-100">
                      300 DPI (High Quality)
                    </span>
                  </label>
                </div>
              </div>

              {/* Format Selection */}
              <div>
                <h4 className="text-xs font-semibold text-slate-300 mb-3 uppercase tracking-wide">
                  Format
                </h4>
                <div className="flex gap-3">
                  <label className="flex items-center cursor-pointer group">
                    <input
                      type="radio"
                      name="format"
                      value="png"
                      checked={format === 'png'}
                      onChange={() => setFormat('png')}
                      className="mr-2 w-3 h-3 border-slate-600 focus:ring-1"
                      style={{ accentColor: '#f1737c' }}
                      disabled={isExporting}
                    />
                    <span className="text-sm text-slate-200 group-hover:text-slate-100">
                      PNG (Lossless)
                    </span>
                  </label>
                  <label className="flex items-center cursor-pointer group">
                    <input
                      type="radio"
                      name="format"
                      value="jpg"
                      checked={format === 'jpg'}
                      onChange={() => setFormat('jpg')}
                      className="mr-2 w-3 h-3 border-slate-600 focus:ring-1"
                      style={{ accentColor: '#f1737c' }}
                      disabled={isExporting}
                    />
                    <span className="text-sm text-slate-200 group-hover:text-slate-100">
                      JPG (Smaller File)
                    </span>
                  </label>
                </div>
              </div>

              {/* Include Original */}
              <div>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeOriginal}
                    onChange={(e) => setIncludeOriginal(e.target.checked)}
                    className="mr-2 w-4 h-4 border-slate-600 rounded focus:ring-1 bg-slate-800"
                    style={{ accentColor: '#f1737c' }}
                    disabled={isExporting}
                  />
                  <span className="text-sm text-slate-200">Include original tile in export</span>
                </label>
              </div>

              {/* Preview */}
              {selectedSizes.length > 0 && (
                <div className="p-3 bg-slate-900 rounded-md border border-slate-700">
                  <p className="text-xs text-slate-400">
                    Will generate {fileCount} file{fileCount !== 1 ? 's' : ''} in the zip archive
                  </p>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="p-3 bg-orange-900/20 border border-orange-700 rounded-md">
                  <p className="text-xs text-orange-300">{error}</p>
                </div>
              )}

              {/* Export Button */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 text-xs font-medium bg-slate-700 border border-slate-600 rounded-md text-slate-200 hover:bg-slate-600 transition-colors"
                  disabled={isExporting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleExport}
                  disabled={isExporting || selectedSizes.length === 0}
                  className="flex-1 px-4 py-2.5 text-xs font-medium text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: '#f1737c' }}
                  onMouseEnter={(e) => {
                    if (!e.currentTarget.disabled) {
                      e.currentTarget.style.backgroundColor = '#e05a65';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!e.currentTarget.disabled) {
                      e.currentTarget.style.backgroundColor = '#f1737c';
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


