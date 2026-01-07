'use client';

import { useState, useEffect } from 'react';
import { generateScaledExport, ScaledExportConfig } from '@/lib/utils/exportScaled';
import { calculateOriginalSize, detectOriginalDPI, checkUpscaling } from '@/lib/utils/imageScaler';

interface ScaleExportModalProps {
  image: HTMLImageElement;
  repeatType: string;
  currentDPI: number;
  originalFilename: string | null;
  onClose: () => void;
}

const AVAILABLE_SIZES = [24, 20, 18, 16, 14, 12, 10, 8, 6, 4, 2];

export default function ScaleExportModal({ image, repeatType, currentDPI, originalFilename, onClose }: ScaleExportModalProps) {
  const [selectedDPI, setSelectedDPI] = useState<150 | 300>(300);
  const [selectedFormat, setSelectedFormat] = useState<'png' | 'jpg'>('png');
  const [selectedSizes, setSelectedSizes] = useState<number[]>([]);
  const [includeOriginal, setIncludeOriginal] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [originalSize, setOriginalSize] = useState<{ longest: number } | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  // Calculate original size
  useEffect(() => {
    if (image && currentDPI) {
      const size = calculateOriginalSize(image, currentDPI);
      setOriginalSize({ longest: size.longest });
    }
  }, [image, currentDPI]);

  // Calculate warnings
  useEffect(() => {
    const newWarnings: string[] = [];

    // Check for pixelation warnings (upscaling)
    if (originalSize && selectedSizes.length > 0) {
      const upscalingWarnings = checkUpscaling(
        image,
        selectedSizes,
        originalSize.longest,
        currentDPI,
        selectedDPI
      );
      newWarnings.push(...upscalingWarnings);
    }

    // Check if total files > 10
    const totalFiles = selectedSizes.length + (includeOriginal ? 1 : 0);
    if (totalFiles > 10) {
      newWarnings.push(
        `This will create ${totalFiles} files, which may take a while to generate.`
      );
    }

    setWarnings(newWarnings);
  }, [selectedSizes, selectedDPI, currentDPI, originalSize, includeOriginal, image]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const toggleSize = (size: number) => {
    setSelectedSizes(prev => 
      prev.includes(size) 
        ? prev.filter(s => s !== size)
        : [...prev, size]
    );
  };

  const handleGenerate = async () => {
    if (selectedSizes.length === 0) {
      alert('Please select at least one size');
      return;
    }

    setIsGenerating(true);
    try {
      const config: ScaledExportConfig = {
        image,
        selectedSizes,
        selectedDPI,
        format: selectedFormat,
        repeatType,
        includeOriginal,
        originalDPI: currentDPI,
        originalFilename,
      };
      await generateScaledExport(config);
      onClose();
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const totalFiles = selectedSizes.length + (includeOriginal ? 1 : 0);

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-200">Scale & Export Pattern</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors"
            aria-label="Close"
            disabled={isGenerating}
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

        {/* DPI Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-300 mb-2">Select DPI:</label>
          <div className="flex gap-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                value={300}
                checked={selectedDPI === 300}
                onChange={() => setSelectedDPI(300)}
                className="mr-2 w-3 h-3 border-slate-600 focus:ring-1"
                style={{ accentColor: '#f1737c' }}
                disabled={isGenerating}
              />
              <span className="text-sm text-slate-200">300dpi</span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                value={150}
                checked={selectedDPI === 150}
                onChange={() => setSelectedDPI(150)}
                className="mr-2 w-3 h-3 border-slate-600 focus:ring-1"
                style={{ accentColor: '#f1737c' }}
                disabled={isGenerating}
              />
              <span className="text-sm text-slate-200">150dpi</span>
            </label>
          </div>
        </div>

        {/* Format Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-300 mb-2">Select File Format:</label>
          <div className="flex gap-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                value="png"
                checked={selectedFormat === 'png'}
                onChange={() => setSelectedFormat('png')}
                className="mr-2 w-3 h-3 border-slate-600 focus:ring-1"
                style={{ accentColor: '#f1737c' }}
                disabled={isGenerating}
              />
              <span className="text-sm text-slate-200">PNG</span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                value="jpg"
                checked={selectedFormat === 'jpg'}
                onChange={() => setSelectedFormat('jpg')}
                className="mr-2 w-3 h-3 border-slate-600 focus:ring-1"
                style={{ accentColor: '#f1737c' }}
                disabled={isGenerating}
              />
              <span className="text-sm text-slate-200">JPG</span>
            </label>
          </div>
        </div>

        {/* Size Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-300 mb-2">Select Scale Sizes:</label>
          <div className="grid grid-cols-2 gap-2">
            {AVAILABLE_SIZES.map(size => (
              <label 
                key={size} 
                className={`flex items-center px-3 py-2 rounded-md border cursor-pointer transition-colors ${
                  selectedSizes.includes(size)
                    ? 'bg-slate-700 border-slate-600 text-slate-100'
                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedSizes.includes(size)}
                  onChange={() => toggleSize(size)}
                  className="mr-2 w-4 h-4 border-slate-600 rounded focus:ring-1 bg-slate-800"
                  style={{ accentColor: '#f1737c' }}
                  disabled={isGenerating}
                />
                <span className="text-sm font-medium">{size} inch</span>
              </label>
            ))}
          </div>
        </div>

        {/* Include Original */}
        <div className="mb-4">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={includeOriginal}
              onChange={(e) => setIncludeOriginal(e.target.checked)}
              className="mr-2 w-4 h-4 border-slate-600 rounded focus:ring-1 bg-slate-800"
              style={{ accentColor: '#f1737c' }}
              disabled={isGenerating}
            />
            <span className="text-sm text-slate-200">Include original tile</span>
          </label>
        </div>

        {/* File Count */}
        <div className="mb-4 text-sm text-slate-400">
          📦 This will create {totalFiles} file{totalFiles !== 1 ? 's' : ''}
        </div>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-700 rounded-md">
            <div className="text-xs text-yellow-300 space-y-1">
              {warnings.map((warning, index) => (
                <p key={index}>⚠️ {warning}</p>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="flex-1 px-4 py-2 border border-slate-600 rounded-md text-slate-200 hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={isGenerating || selectedSizes.length === 0}
            className="flex-1 px-4 py-2 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
            {isGenerating ? 'Generating...' : 'Generate Zip'}
          </button>
        </div>
      </div>
    </div>
  );
}


