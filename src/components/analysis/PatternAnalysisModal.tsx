'use client';

import { useEffect } from 'react';
import { ContrastAnalysis, CompositionAnalysis, ColorHarmonyAnalysis } from '@/lib/analysis/patternAnalyzer';

interface PatternAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  image: HTMLImageElement | null;
  contrastAnalysis: ContrastAnalysis | null;
  compositionAnalysis: CompositionAnalysis | null;
  colorHarmonyAnalysis?: ColorHarmonyAnalysis | null;
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
  colorHarmonyAnalysis,
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
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-[#3a3d44]">
          <div className="flex items-center gap-2 flex-1">
            <div className="w-8 h-8 rounded-lg bg-[#fbbf24] flex items-center justify-center text-lg">
              📊
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Pattern Analysis</h3>
              <p className="text-[10px] text-white/70">Contrast & Composition</p>
            </div>
          </div>
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
            // Non-Pro: Show blurred preview with upgrade CTA
            <>
              {/* Blurred Contrast Preview */}
              <div className="relative">
                <div className="p-4 bg-white border border-[#e5e7eb] rounded-lg" style={{ filter: 'blur(6px)', opacity: 0.6 }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">◐</span>
                    <span className="text-sm font-semibold text-[#294051]">Contrast Check</span>
                  </div>
                  <div className="text-xs text-[#374151] mb-1">GOOD Contrast</div>
                  <div className="text-xs text-[#374151] mb-2">Global contrast: 68%</div>
                  <p className="text-sm text-[#374151]">
                    Your pattern demonstrates good contrast that will print clearly...
                  </p>
                </div>
              </div>

              {/* Blurred Composition Preview */}
              <div className="relative">
                <div className="p-4 bg-white border border-[#e5e7eb] rounded-lg" style={{ filter: 'blur(6px)', opacity: 0.6 }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">🎯</span>
                    <span className="text-sm font-semibold text-[#294051]">Composition Analysis</span>
                  </div>
                  <div className="text-xs text-[#374151] mb-1">Balanced Composition</div>
                  <div className="text-xs text-[#374151] mb-2">Pattern: Even Distribution • Balance: 85%</div>
                  <p className="text-sm text-[#374151]">
                    The pattern shows balanced visual weight with good flow...
                  </p>
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-white px-4 py-2 rounded-lg shadow-lg border-2 border-[#fbbf24]">
                    <div className="text-sm font-semibold text-[#294051] flex items-center gap-2">
                      🔒 Unlock full analysis with Pro
                    </div>
                  </div>
                </div>
              </div>

              {/* Blurred Harmony Preview */}
              <div className="relative">
                <div className="p-4 bg-white border border-[#e5e7eb] rounded-lg" style={{ filter: 'blur(6px)', opacity: 0.6 }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">🎨</span>
                    <span className="text-sm font-semibold text-[#294051]">Color Harmony</span>
                  </div>
                  <div className="text-xs text-[#374151] mb-1">Colors work beautifully together</div>
                  <div className="flex gap-2 mt-2">
                    {['#e07b54', '#d4a853', '#7ab87a', '#5b8db8', '#9b6bb5'].map((c, i) => (
                      <div key={i} className="w-8 h-8 rounded-full" style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Upgrade CTA */}
              <button
                onClick={onUpgrade}
                className="w-full px-6 py-3 bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] hover:from-[#f59e0b] hover:to-[#d97706] text-white font-semibold rounded-lg transition-all"
              >
                Start 7-Day Free Trial →
              </button>
              <div className="text-center text-xs text-gray-500">
                or upgrade now for $7.99/month
              </div>
            </>
          ) : !image ? (
            <div className="text-sm text-gray-500 text-center py-8">
              Upload a pattern tile to see analysis
            </div>
          ) : isAnalyzing ? (
            <div className="text-sm text-gray-500 text-center py-8">
              Analyzing...
            </div>
          ) : (
            // Pro: Show both analyses
            <>
              {/* Contrast Analysis */}
              {contrastAnalysis && (
                <div className="p-4 bg-white border border-[#e5e7eb] rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">◐</span>
                    <span className="text-sm font-semibold text-[#294051]">Contrast Check</span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-[#294051]">
                      {contrastAnalysis.label}
                    </span>
                    <span className={`px-2 py-0.5 text-[10px] font-medium rounded uppercase ${
                      contrastAnalysis.severity === 'none' ? 'bg-emerald-100 text-emerald-700' :
                      contrastAnalysis.severity === 'info' ? 'bg-blue-100 text-blue-700' :
                      'bg-orange-100 text-orange-700'
                    }`}>
                      {contrastAnalysis.band === 'very_low' ? 'VERY LOW' : contrastAnalysis.band.toUpperCase()}
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
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">🎯</span>
                    <span className="text-sm font-semibold text-[#294051]">Composition Analysis</span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-[#294051]">
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

              {/* Color Harmony Analysis */}
              {colorHarmonyAnalysis && (
                <div className="p-4 bg-white border border-[#e5e7eb] rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">🎨</span>
                    <span className="text-sm font-semibold text-[#294051]">Color Harmony</span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-[#294051]">
                      {colorHarmonyAnalysis.label}
                    </span>
                    <span className={`px-2 py-0.5 text-[10px] font-medium rounded uppercase ${
                      colorHarmonyAnalysis.severity === 'none' ? 'bg-emerald-100 text-emerald-700' :
                      colorHarmonyAnalysis.severity === 'info' ? 'bg-blue-100 text-blue-700' :
                      'bg-orange-100 text-orange-700'
                    }`}>
                      {colorHarmonyAnalysis.band === 'too_similar' ? 'TOO SIMILAR' :
                       colorHarmonyAnalysis.band === 'beautiful' ? 'HARMONIOUS' :
                       colorHarmonyAnalysis.band === 'mostly' ? 'MOSTLY' : 'CLASHING'}
                    </span>
                  </div>
                  <p className="text-sm text-[#374151] leading-relaxed mb-3">
                    {colorHarmonyAnalysis.message}
                  </p>

                  {/* Swatches */}
                  {colorHarmonyAnalysis.isNeutralDominant ? (
                    <p className="text-xs text-[#6b7280] italic">
                      Mostly neutral palette — no strong color conflicts detected.
                    </p>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 flex-wrap">
                        {colorHarmonyAnalysis.chromaticColors.map((color, i) => (
                          <div
                            key={i}
                            className="relative"
                            title={color.isClashing ? 'This color may be clashing' : undefined}
                          >
                            <div
                              className={`w-8 h-8 rounded-full ${
                                color.isClashing
                                  ? 'ring-2 ring-orange-400 ring-offset-1'
                                  : ''
                              }`}
                              style={{ backgroundColor: `rgb(${color.r}, ${color.g}, ${color.b})` }}
                            />
                            {color.isClashing && (
                              <span className="absolute -top-1 -right-1 text-[10px] leading-none">⚠️</span>
                            )}
                          </div>
                        ))}
                      </div>
                      {colorHarmonyAnalysis.totalChromaticCount > 6 && (
                        <p className="text-[10px] text-[#9ca3af] mt-2">
                          Showing 6 of {colorHarmonyAnalysis.totalChromaticCount} colors
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              {!contrastAnalysis && !compositionAnalysis && !colorHarmonyAnalysis && (
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
