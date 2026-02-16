'use client';

import { useState, useEffect } from 'react';

interface QuickExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  image: HTMLImageElement | null;
  currentDPI: number;
  repeatType: 'full-drop' | 'half-drop' | 'half-brick';
  originalFilename: string | null;
  onUpgrade: () => void;
}

export default function QuickExportModal({
  isOpen,
  onClose,
  image,
  currentDPI,
  repeatType,
  originalFilename,
  onUpgrade,
}: QuickExportModalProps) {
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  // Calculate the maximum exportable size (in inches) without upscaling
  const getMaxExportSize = (targetDPI: number): number => {
    if (!image) return 0;
    const longestPixelSide = Math.max(image.naturalWidth, image.naturalHeight);
    return longestPixelSide / targetDPI;
  };

  // Check if a size would cause upscaling/pixelation
  const isSizeAllowed = (sizeInches: number, dpi: number): boolean => {
    const maxSize = getMaxExportSize(dpi);
    return sizeInches <= maxSize;
  };

  const handleExport = async (size: string, dpi: number) => {
    if (!image) return;

    setIsExporting(true);
    try {
      // Create a canvas for the export
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Calculate dimensions based on size and DPI
      const inches = parseInt(size);
      const pixels = inches * dpi;

      canvas.width = pixels;
      canvas.height = pixels;

      // Draw the pattern (tiled)
      const cols = Math.ceil(pixels / image.naturalWidth) + 1;
      const rows = Math.ceil(pixels / image.naturalHeight) + 1;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          let x = col * image.naturalWidth;
          let y = row * image.naturalHeight;

          // Apply repeat type offset
          if (repeatType === 'half-drop' && col % 2 === 1) {
            y -= image.naturalHeight / 2;
          } else if (repeatType === 'half-brick' && row % 2 === 1) {
            x -= image.naturalWidth / 2;
          }

          ctx.drawImage(image, x, y, image.naturalWidth, image.naturalHeight);
        }
      }

      // Convert to blob and download
      canvas.toBlob((blob) => {
        if (!blob) return;

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const baseName = originalFilename?.replace(/\.[^/.]+$/, '') || 'pattern';
        link.download = `${baseName}_${size}x${size}_${dpi}dpi.jpg`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 'image/jpeg', 0.95);

    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const sizes = [
    { label: '12" × 12"', size: '12', dpi: 150, free: true },
    { label: '24" × 24"', size: '24', dpi: 150, free: true },
    { label: '12" × 12"', size: '12', dpi: 300, free: false },
    { label: '42" × 42"', size: '42', dpi: 300, free: false },
  ];

  // Calculate which sizes are actually allowed based on image metadata
  const sizesWithAvailability = sizes.map(item => ({
    ...item,
    allowed: isSizeAllowed(parseInt(item.size), item.dpi),
  }));

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="relative w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[#4caf50] flex items-center justify-center text-xl">
            📦
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-[#294051]">Quick Export</h3>
            <p className="text-xs text-gray-500">Export 2 sizes as JPG</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Size Selection Grid */}
          <div>
            <h4 className="text-sm font-semibold text-[#294051] mb-3">Select Size</h4>
            <div className="grid grid-cols-2 gap-3">
              {sizesWithAvailability.map((item, idx) => {
                const canExport = item.free && item.allowed && image && !isExporting;
                return (
                  <button
                    key={idx}
                    onClick={() => canExport && handleExport(item.size, item.dpi)}
                    disabled={!canExport}
                    className={`relative p-4 rounded-lg border-2 transition-all ${
                      item.free && item.allowed
                        ? 'border-[#4caf50] hover:bg-[#4caf50]/5 cursor-pointer'
                        : 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                    }`}
                  >
                    <div className="text-sm font-semibold text-[#294051] mb-1">{item.label}</div>
                    <div className="text-xs text-gray-500">@ {item.dpi} DPI</div>
                    {!item.allowed && (
                      <span className="absolute top-2 right-2 text-[9px] font-bold bg-red-500 text-white px-2 py-1 rounded">
                        TOO LARGE
                      </span>
                    )}
                    {item.allowed && !item.free && (
                      <span className="absolute top-2 right-2 text-[9px] font-bold bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] text-white px-2 py-1 rounded">
                        PRO
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Format Section */}
          <div>
            <h4 className="text-sm font-semibold text-[#294051] mb-3">Format</h4>
            <div className="flex gap-3">
              <div className="flex-1 p-3 rounded-lg border-2 border-[#4caf50] bg-[#4caf50]/5">
                <div className="text-sm font-semibold text-[#294051]">JPG</div>
                <div className="text-xs text-gray-500">Active</div>
              </div>
              <button
                onClick={onUpgrade}
                className="flex-1 p-3 rounded-lg border-2 border-gray-200 bg-gray-50 cursor-pointer hover:border-[#fbbf24] transition-colors relative"
              >
                <div className="text-sm font-semibold text-gray-400">PNG</div>
                <div className="text-xs text-gray-400">Locked</div>
                <span className="absolute top-2 right-2 text-[9px] font-bold bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] text-white px-2 py-1 rounded">
                  PRO
                </span>
              </button>
            </div>
          </div>

          {/* Export Button */}
          <button
            onClick={() => {
              // Export both free sizes that are allowed
              const allowedFreeSizes = sizesWithAvailability.filter(s => s.free && s.allowed);
              if (allowedFreeSizes.length > 0) {
                handleExport(allowedFreeSizes[0].size, allowedFreeSizes[0].dpi);
                if (allowedFreeSizes.length > 1) {
                  setTimeout(() => handleExport(allowedFreeSizes[1].size, allowedFreeSizes[1].dpi), 500);
                }
              }
            }}
            disabled={!image || isExporting || !sizesWithAvailability.some(s => s.free && s.allowed)}
            className="w-full px-6 py-3 bg-[#4caf50] hover:bg-[#45a049] text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? 'Exporting...' : `Export ${sizesWithAvailability.filter(s => s.free && s.allowed).length} File${sizesWithAvailability.filter(s => s.free && s.allowed).length !== 1 ? 's' : ''}`}
          </button>

          {/* Upsell */}
          <div className="text-center">
            <button
              onClick={onUpgrade}
              className="text-sm text-[#fbbf24] hover:text-[#f59e0b] font-medium transition-colors"
            >
              Need all 8 sizes + PNG? Upgrade to Pro →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
