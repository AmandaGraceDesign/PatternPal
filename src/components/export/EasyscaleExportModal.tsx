'use client';

import { useState, useEffect } from 'react';
import { generateScaledExport, ScaledExportConfig } from '@/lib/utils/exportScaled';
import { calculateOriginalSize, detectOriginalDPI } from '@/lib/utils/imageScaler';
import { getConvertToFullDropBlockReason } from '@/lib/utils/convertToFullDrop';
import { deviceMaxExportInches, exportCanvasWithinLimits } from '@/lib/utils/imageUtils';
import { FREE_EASYSCALE_SIZES, FREE_EASYSCALE_DPI, FREE_EASYSCALE_FORMAT } from '@/lib/mockups/freeTier';

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
  const [selectedDPI, setSelectedDPI] = useState<150 | 300>(isPro ? 300 : FREE_EASYSCALE_DPI);
  const [format, setFormat] = useState<'png' | 'jpg' | 'tif'>(isPro ? 'png' : FREE_EASYSCALE_FORMAT);
  const [includeOriginal, setIncludeOriginal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSize, setCurrentSize] = useState<{ width: number; height: number } | null>(null);
  const [customSizeInput, setCustomSizeInput] = useState<string>('');
  const [selectedUnit, setSelectedUnit] = useState<'in' | 'cm' | 'px'>('in');
  const [convertToFD, setConvertToFD] = useState(false);

  const showConvertToggle = repeatType !== 'full-drop';
  const convertBlockReason = image && showConvertToggle
    ? getConvertToFullDropBlockReason(image.naturalWidth, image.naturalHeight, mapRepeatType(repeatType))
    : null;
  const convertDisabled = convertBlockReason !== null;

  // If the toggle becomes disabled (e.g. user re-imports a larger tile), make
  // sure we don't keep `convertToFD` checked from a prior session.
  useEffect(() => {
    if (convertDisabled && convertToFD) setConvertToFD(false);
  }, [convertDisabled, convertToFD]);

  // Calculate the maximum exportable size (in inches) without upscaling
  // When converting to full-drop, the user's selected size refers to the
  // original tile (unchanged side), so max size is always based on original dims.
  const getMaxExportSize = (targetDPI: number): number => {
    if (!image) return 0;
    const longestPixelSide = Math.max(image.naturalWidth, image.naturalHeight);
    // Two independent caps, whichever is smaller:
    //  1. Anti-upscaling: can't export larger than the source supports cleanly.
    //  2. Device canvas ceiling: on iPad a size whose output exceeds ~4096px
    //     always throws the ceiling guard at export. Without this cap a large
    //     source lets the user pick (e.g.) 18", which can never export AND
    //     sticks in selectedSizes, blocking every later export until a full
    //     page refresh. Greying it out here prevents both.
    const antiUpscaleMax = longestPixelSide / targetDPI;
    const deviceMax = deviceMaxExportInches(targetDPI);
    return Math.min(antiUpscaleMax, deviceMax);
  };

  const maxExportSize = getMaxExportSize(selectedDPI);

  // The original tile is exported at its NATIVE pixel size (no downscale), so on
  // iPad a source larger than the device ceiling can't be included — and if left
  // checked it throws for the whole batch (exportScaled guards the original
  // before the size loop). Gate the checkbox the same way oversized sizes are
  // greyed out.
  const originalTileWithinLimits = image
    ? exportCanvasWithinLimits(image.naturalWidth, image.naturalHeight)
    : true;

  // Distinguish WHY a size is capped so the copy is accurate:
  //  - anti-upscaling limit = the source resolution (pixelation)
  //  - device limit = the iPad/iPhone canvas ceiling (an Apple limit, not ours)
  const longestPixelSide = image ? Math.max(image.naturalWidth, image.naturalHeight) : 0;
  const antiUpscaleMax = image ? longestPixelSide / selectedDPI : Infinity;
  const deviceMax = deviceMaxExportInches(selectedDPI);
  // True when the DEVICE ceiling (not the source) is what's capping size.
  const deviceLimited = image ? deviceMax < antiUpscaleMax : false;
  // True when that device cap actually greys out one or more offered sizes —
  // gates the explanatory banner so it only shows when it's relevant.
  const deviceBlocksAnyPreset = deviceLimited && PRESET_SIZES.some((s) => s > maxExportSize);

  const sizeInchesFromUnitValue = (value: number, unit: 'in' | 'cm' | 'px', dpiValue: number): number => {
    if (unit === 'in') return value;
    if (unit === 'cm') return value / 2.54;
    return value / dpiValue;
  };

  const sizeValueFromInches = (inches: number, unit: 'in' | 'cm' | 'px', dpiValue: number): number => {
    if (unit === 'in') return inches;
    if (unit === 'cm') return inches * 2.54;
    return inches * dpiValue;
  };

  const formatUnitValue = (inches: number) => {
    if (selectedUnit === 'in') return `${inches.toFixed(2)}"`;
    if (selectedUnit === 'cm') return `${(inches * 2.54).toFixed(1)}cm`;
    return `${Math.round(inches * selectedDPI)}px`;
  };

  // Check if a size in inches would cause upscaling/pixelation
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

  // Auto-deselect sizes that become invalid when DPI or convert toggle changes
  useEffect(() => {
    if (!image) return;
    const maxSize = getMaxExportSize(selectedDPI);
    setSelectedSizes(prev => prev.filter(size => size <= maxSize));
  }, [selectedDPI, image, convertToFD]);

  // Force "include original" off when the source tile exceeds the device
  // ceiling — otherwise it throws for the whole export.
  useEffect(() => {
    if (!originalTileWithinLimits && includeOriginal) setIncludeOriginal(false);
  }, [originalTileWithinLimits, includeOriginal]);

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

  const handleSizeToggle = (sizeInInches: number) => {
    // Block sizes that would cause upscaling
    if (!isSizeAllowed(sizeInInches)) return;

    if (!isPro) {
      setSelectedSizes((prev) => {
        if (prev.includes(sizeInInches)) {
          return prev.filter((s) => s !== sizeInInches);
        } else if (prev.length < 2) {
          return [...prev, sizeInInches];
        } else {
          return [prev[1], sizeInInches];
        }
      });
    } else {
      setSelectedSizes((prev) =>
        prev.includes(sizeInInches) ? prev.filter((s) => s !== sizeInInches) : [...prev, sizeInInches]
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
        exportUnit: selectedUnit,
        convertToFullDrop: convertToFD,
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
              {/* Info Banner */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-xs text-blue-800 leading-relaxed">
                  <span className="font-semibold">Print-Ready Export</span> —
                  Resize your pattern tile to print-ready scales and download
                  them all in one click. Use this for uploading to Spoonflower,
                  Redbubble, Society6, or any print-on-demand site — or for
                  delivering scaled files for pattern licensing.
                </p>
              </div>

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
                        {deviceLimited
                          ? `Max export on this device: ${maxExportSize.toFixed(1)}" at ${selectedDPI} DPI`
                          : `Max export at ${selectedDPI} DPI: ${maxExportSize.toFixed(1)}" (no pixelation)`}
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
                <div className="flex items-center gap-2 text-xs mb-2">
                  <span className="font-medium text-slate-700">Unit:</span>
                  {['in', 'cm', 'px'].map((unit) => (
                    <button
                      key={unit}
                      type="button"
                      onClick={() => setSelectedUnit(unit as 'in' | 'cm' | 'px')}
                      className={`px-2 py-1 rounded border ${selectedUnit === unit ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'}`}
                    >
                      {unit}
                    </button>
                  ))}
                  <span className="text-slate-500">(changes size labels)</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {(isPro ? PRESET_SIZES : [...FREE_EASYSCALE_SIZES]).map((sizeInInches) => {
                    const sizeValue = sizeValueFromInches(sizeInInches, selectedUnit, selectedDPI);
                    const allowed = isSizeAllowed(sizeInInches);
                    const selected = selectedSizes.includes(sizeInInches);
                    return (
                      <label
                        key={`${sizeInInches}-${selectedUnit}`}
                        className={`flex flex-col items-center justify-center px-3 py-2 rounded-md border transition-colors ${
                          !allowed
                            ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                            : selected
                              ? 'bg-[#faf3e0] border-[#e0c26e] text-[#294051] cursor-pointer'
                              : 'bg-white border-[#e5e7eb] text-[#374151] hover:bg-[#f5f5f5] cursor-pointer'
                        }`}
                        title={!allowed
                          ? (sizeInInches > deviceMax
                              ? `${formatUnitValue(sizeInInches)} is too large to export on this device — iPads/iPhones cap the longest side near ${deviceMax.toFixed(1)}" at ${selectedDPI} DPI. Switch to 150 DPI or export from a computer. (Apple device limit, not a PatternPAL error.)`
                              : `Cannot export at ${formatUnitValue(sizeInInches)} — would require upscaling (max ${maxExportSize.toFixed(1)}" at ${selectedDPI} DPI)`)
                          : undefined}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => handleSizeToggle(sizeInInches)}
                          className="sr-only"
                          disabled={isExporting || !allowed}
                        />
                        <span className="text-xs font-medium">{formatUnitValue(sizeInInches)}</span>
                        {!allowed && (
                          <span className="text-[9px] text-red-600 font-medium leading-tight">too large</span>
                        )}
                      </label>
                    );
                  })}
                </div>
                {deviceBlocksAnyPreset && (
                  <div className="mt-2.5 p-2.5 rounded-md bg-amber-50 border border-amber-200">
                    <p className="text-xs text-amber-800 leading-relaxed">
                      <span className="font-semibold">Why are 18" and 24" greyed out?</span>{' '}
                      iPads and iPhones limit how large an image their browsers can build, so sizes above{' '}
                      {deviceMax.toFixed(1)}" at {selectedDPI} DPI aren't available on this device.
                      This is an Apple device limit — not a PatternPAL problem. To get the larger
                      sizes, switch to <span className="font-semibold">150 DPI</span> or export from
                      a computer.
                    </p>
                  </div>
                )}
                {!isPro && (
                  <p className="text-xs text-[#6b7280] mt-2 italic">
                    💡 Try Pro free for 3 days to export all sizes (2", 4", 6", 8", 10", 12", 18", 24")
                  </p>
                )}

                {/* Custom Size Input (Pro only) */}
                {isPro && (
                  <div className="mt-3">
                    <p className="text-[10px] text-[#6b7280] mb-1.5">Custom size (max {formatUnitValue(maxExportSize)} at {selectedDPI} DPI{deviceLimited ? ' on this device' : ' without pixelation'})</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max={Math.floor(sizeValueFromInches(maxExportSize, selectedUnit, selectedDPI) * 10) / 10}
                        step="0.5"
                        value={customSizeInput}
                        onChange={(e) => setCustomSizeInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const val = parseFloat(customSizeInput);
                            const inches = sizeInchesFromUnitValue(val, selectedUnit, selectedDPI);
                            if (val > 0 && isSizeAllowed(inches) && !selectedSizes.includes(inches)) {
                              setSelectedSizes(prev => [...prev, inches]);
                              setCustomSizeInput('');
                            }
                          }
                        }}
                        placeholder="Custom"
                        className="w-20 px-2 py-1.5 text-xs border border-[#e5e7eb] rounded-md focus:outline-none focus:border-[#e0c26e] text-[#374151]"
                        disabled={isExporting}
                      />
                      <span className="text-xs text-[#6b7280]">{selectedUnit === 'in' ? 'in' : selectedUnit === 'cm' ? 'cm' : 'px'}</span>
                      <button
                        onClick={() => {
                          const val = parseFloat(customSizeInput);
                          const inches = sizeInchesFromUnitValue(val, selectedUnit, selectedDPI);
                          if (val > 0 && isSizeAllowed(inches) && !selectedSizes.includes(inches)) {
                            setSelectedSizes(prev => [...prev, inches]);
                            setCustomSizeInput('');
                          }
                        }}
                        disabled={isExporting || !customSizeInput || parseFloat(customSizeInput) <= 0 || !isSizeAllowed(sizeInchesFromUnitValue(parseFloat(customSizeInput || '0'), selectedUnit, selectedDPI))}
                        className="px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ backgroundColor: '#e0c26e', color: 'white' }}
                      >
                        + Add
                      </button>
                      {customSizeInput && parseFloat(customSizeInput) > 0 && !isSizeAllowed(sizeInchesFromUnitValue(parseFloat(customSizeInput || '0'), selectedUnit, selectedDPI)) && (
                        <span className="text-[10px] text-red-500">Too large — max {formatUnitValue(maxExportSize)}</span>
                      )}
                    </div>

                    {/* Show custom (non-preset) sizes as removable chips */}
                    {selectedSizes.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {selectedSizes.map(size => (
                          <span
                            key={`${size}-${selectedUnit}`}
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-[#faf3e0] border border-[#e0c26e] text-[#294051]"
                          >
                            {formatUnitValue(size)}
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
                    💡 Try Pro free for 3 days for 300 DPI exports
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
                    💡 Try Pro free for 3 days for PNG and TIFF exports
                  </p>
                )}
              </div>

              {/* Convert to Full Drop */}
              {showConvertToggle && (
                <div>
                  <label
                    className={`flex items-center ${convertDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                    title={convertBlockReason ?? undefined}
                  >
                    <input
                      type="checkbox"
                      checked={convertToFD && !convertDisabled}
                      onChange={(e) => setConvertToFD(e.target.checked)}
                      className="mr-2 w-4 h-4 border-[#e5e7eb] rounded focus:ring-1 bg-white"
                      style={{ accentColor: '#e0c26e' }}
                      disabled={isExporting || convertDisabled}
                    />
                    <span className="text-sm text-[#374151]">
                      Convert to Full Drop
                    </span>
                  </label>
                  <p className="text-xs text-[#6b7280] mt-1 ml-6">
                    {convertBlockReason
                      ? convertBlockReason
                      : `Tiles your ${repeatType === 'half-drop' ? 'half-drop' : 'half-brick'} pattern into a full-drop tile for POD sites that only accept full-drop repeats.`}
                  </p>
                </div>
              )}

              {/* Include Original */}
              <div>
                <label className={`flex items-center ${isPro && originalTileWithinLimits ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
                  <input
                    type="checkbox"
                    checked={includeOriginal && originalTileWithinLimits}
                    onChange={(e) => setIncludeOriginal(e.target.checked)}
                    className="mr-2 w-4 h-4 border-[#e5e7eb] rounded focus:ring-1 bg-white"
                    style={{ accentColor: '#e0c26e' }}
                    disabled={isExporting || !isPro || !originalTileWithinLimits}
                  />
                  <span className="text-sm text-[#374151]">
                    Include original tile in export {!isPro && '🔒'}
                  </span>
                </label>
                {!isPro && (
                  <p className="text-xs text-[#6b7280] mt-2 italic ml-6">
                    💡 Try Pro free for 3 days to include your original tile
                  </p>
                )}
                {isPro && !originalTileWithinLimits && (
                  <p className="text-xs text-red-600 mt-2 ml-6 leading-relaxed">
                    Your original tile ({image?.naturalWidth}&times;{image?.naturalHeight}px) is too large
                    for this iPad/iPhone to include — an Apple device limit, not a PatternPAL error. Export
                    from a computer to include the original tile.
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


