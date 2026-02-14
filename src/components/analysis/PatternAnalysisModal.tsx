'use client';

import { useEffect } from 'react';
import { ContrastAnalysis, CompositionAnalysis } from '@/lib/analysis/patternAnalyzer';

interface PatternAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  image: HTMLImageElement | null;
  contrastAnalysis: ContrastAnalysis | null;
  compositionAnalysis: CompositionAnalysis | null;
  isAnalyzing: boolean;
  isPro: boolean;
  onUpgrade: () => void;
}

export default function PatternAnalysisModal({
  isOpen,
  onClose,
  image,
  contrastAnalysis,
  compositionAnalysis,
  isAnalyzing,
  isPro,
  onUpgrade,
}: PatternAnalysisModalProps) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="relative w-[calc(100vw-32px)] max-w-lg max-h-[85vh] bg-white rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-[#3a3d44]">
          <h3 className="text-sm font-semibold text-white">Pattern Analysis</h3>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white p-1"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-4 space-y-4" style={{ maxHeight: 'calc(85vh - 52px)' }}>
          {!isPro ? (
            <div
              className="p-6 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg text-center cursor-pointer hover:border-[#e0c26e] transition-colors group"
              onClick={onUpgrade}
            >
              <div className="text-3xl mb-2">&#x1f512;</div>
              <div className="text-sm font-semibold text-gray-700 mb-1">Pro Feature</div>
              <div className="text-xs text-gray-500 mb-3">
                Get advanced contrast analysis, composition insights, and seam inspection
              </div>
              <div className="text-xs font-semibold text-[#e0c26e] group-hover:text-[#c9a94e]">
                Click to Upgrade
              </div>
            </div>
          ) : !image ? (
            <div className="text-sm text-gray-500 text-center py-8">
              Upload a pattern tile to see analysis
            </div>
          ) : isAnalyzing ? (
            <div className="text-sm text-gray-500 text-center py-8">
              Analyzing...
            </div>
          ) : (
            <>
              {/* Contrast Analysis */}
              {contrastAnalysis && (
                <div className="p-4 bg-white border border-[#e5e7eb] rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-[#294051]">
                      {contrastAnalysis.label}
                    </span>
                    <span className={`px-2 py-0.5 text-[10px] font-medium rounded uppercase ${
                      contrastAnalysis.severity === 'none' ? 'bg-emerald-100 text-emerald-700' :
                      contrastAnalysis.severity === 'info' ? 'bg-blue-100 text-blue-700' :
                      'bg-orange-100 text-orange-700'
                    }`}>
                      {contrastAnalysis.band.toUpperCase().replace('_', ' ')}
                    </span>
                  </div>
                  <div className="text-xs text-[#374151] mb-2">
                    Global contrast: {(contrastAnalysis.globalContrast * 100).toFixed(0)}%
                  </div>
                  <p className="text-sm text-[#374151] leading-relaxed">
                    {contrastAnalysis.message}
                  </p>
                </div>
              )}

              {/* Composition Analysis */}
              {compositionAnalysis && (
                <div className="p-4 bg-white border border-[#e5e7eb] rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-[#294051]">
                      {compositionAnalysis.label}
                    </span>
                    <span className={`px-2 py-0.5 text-[10px] font-medium rounded uppercase ${
                      compositionAnalysis.band === 'balanced' ? 'bg-emerald-100 text-emerald-700' :
                      compositionAnalysis.band === 'dynamic' ? 'bg-blue-100 text-blue-700' :
                      'bg-orange-100 text-orange-700'
                    }`}>
                      {compositionAnalysis.band}
                    </span>
                  </div>
                  <div className="text-xs text-[#374151] mb-2">
                    Pattern: {compositionAnalysis.distributionPattern.replace('-', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                    {' \u2022 '}Balance: {(compositionAnalysis.balanceScore * 100).toFixed(0)}%
                  </div>
                  <p className="text-sm text-[#374151] leading-relaxed mb-2">
                    {compositionAnalysis.message}
                  </p>
                  <p className="text-xs text-[#6b7280] leading-relaxed italic">
                    {compositionAnalysis.contextHint}
                  </p>
                </div>
              )}

              {!contrastAnalysis && !compositionAnalysis && (
                <div className="text-sm text-gray-500 text-center py-8">
                  No analysis data available
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
