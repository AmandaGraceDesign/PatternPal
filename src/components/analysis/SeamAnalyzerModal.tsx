'use client';

import { useEffect } from 'react';
import type { SeamAnalysisResult, RepeatType, EdgeComparison } from '@/lib/analysis/seamAnalyzer';

interface SeamAnalyzerModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: SeamAnalysisResult;
  repeatType: RepeatType;
  canvas: HTMLCanvasElement | null;
  showOverlay: boolean;
  overlayCanvas: HTMLCanvasElement | null;
  onShowOverlay: () => void;
  onShowProblemAreas: () => void;
}

export default function SeamAnalyzerModal({
  isOpen,
  onClose,
  analysis,
  repeatType,
  showOverlay,
  overlayCanvas,
  onShowOverlay,
  onShowProblemAreas,
}: SeamAnalyzerModalProps) {
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

  if (!isOpen) return null;

  const getRepeatLabel = (type: RepeatType) => {
    switch (type) {
      case 'fulldrop': return 'Full Drop';
      case 'halfdrop': return 'Half Drop';
      case 'halfbrick': return 'Half Brick';
    }
  };

  const getSeamQualityLabel = (edge: EdgeComparison): string => {
    if (edge.match) return '✅ Perfect match';
    if (edge.avgDifference < 10) return '⚠️ Nearly seamless';
    if (edge.avgDifference < 30) return '⚠️ Slight mismatch';
    return '❌ Visible seam';
  };

  const getSeamQualityDetail = (edge: EdgeComparison): string => {
    if (edge.match) return 'Ready to print!';
    if (edge.avgDifference < 10) return 'Minor differences (not visible at viewing distance)';
    if (edge.avgDifference < 30) return 'May show as faint line on some fabrics';
    return 'Will be noticeable on printed fabric';
  };

  const calculateOverallScore = (
    topBottom: EdgeComparison,
    leftRight: EdgeComparison
  ): number => {
    let score = 100;
    
    // Deduct based on average difference
    score -= topBottom.avgDifference;
    score -= leftRight.avgDifference;
    
    // Ensure 0-100 range
    return Math.max(0, Math.min(100, score));
  };

  const getStarRating = (score: number): string => {
    if (score >= 90) return '⭐⭐⭐⭐⭐';
    if (score >= 75) return '⭐⭐⭐⭐';
    if (score >= 60) return '⭐⭐⭐';
    if (score >= 40) return '⭐⭐';
    return '⭐';
  };

  const getActionableAdvice = (overallScore: number): string => {
    if (overallScore >= 95) return '🎉 Perfect! Upload to Spoonflower or license with confidence.';
    if (overallScore >= 85) return '✅ Good to go! Minor imperfections won\'t show.';
    if (overallScore >= 70) return '⚠️ Consider fixing edges before printing.';
    return '❌ Recommend adjusting pattern before upload.';
  };

  const overallScore = calculateOverallScore(analysis.topBottom, analysis.leftRight);
  const stars = getStarRating(overallScore);

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg p-6 max-w-2xl w-full border border-slate-700 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-200">Seam Analysis Results</h2>
            <span className="text-xs bg-blue-900/50 text-blue-300 px-2 py-1 rounded font-medium">
              {getRepeatLabel(repeatType)}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors"
            aria-label="Close"
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

        <div className="space-y-3">
          {/* Results */}
          <div className="space-y-2 text-sm">
            {repeatType === 'fulldrop' && (
              <>
                <div className="p-2 bg-slate-900 rounded border border-slate-700">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-200">Top ↕ Bottom:</span>
                    <span className={analysis.topBottom.match ? 'text-emerald-400 text-xs font-medium' : analysis.topBottom.avgDifference < 30 ? 'text-orange-400 text-xs font-medium' : 'text-red-400 text-xs font-medium'}>
                      {getSeamQualityLabel(analysis.topBottom)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {getSeamQualityDetail(analysis.topBottom)}
                  </p>
                </div>
                
                <div className="p-2 bg-slate-900 rounded border border-slate-700">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-200">Left ↔ Right:</span>
                    <span className={analysis.leftRight.match ? 'text-emerald-400 text-xs font-medium' : analysis.leftRight.avgDifference < 30 ? 'text-orange-400 text-xs font-medium' : 'text-red-400 text-xs font-medium'}>
                      {getSeamQualityLabel(analysis.leftRight)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {getSeamQualityDetail(analysis.leftRight)}
                  </p>
                </div>
              </>
            )}

            {repeatType === 'halfdrop' && (
              <>
                <div className="p-2 bg-slate-900 rounded border border-slate-700">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-200">Top ↕ Bottom:</span>
                    <span className={analysis.topBottom.match ? 'text-emerald-400 text-xs font-medium' : analysis.topBottom.avgDifference < 30 ? 'text-orange-400 text-xs font-medium' : 'text-red-400 text-xs font-medium'}>
                      {getSeamQualityLabel(analysis.topBottom)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {getSeamQualityDetail(analysis.topBottom)}
                  </p>
                </div>
                
                <div className="p-2 bg-slate-900 rounded border border-slate-700">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-200">Left ↔ Right <span className="text-slate-400">(offset)</span>:</span>
                    <span className={analysis.leftRight.match ? 'text-emerald-400 text-xs font-medium' : analysis.leftRight.avgDifference < 30 ? 'text-orange-400 text-xs font-medium' : 'text-red-400 text-xs font-medium'}>
                      {getSeamQualityLabel(analysis.leftRight)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {getSeamQualityDetail(analysis.leftRight)}
                  </p>
                </div>
              </>
            )}

            {repeatType === 'halfbrick' && (
              <>
                <div className="p-2 bg-slate-900 rounded border border-slate-700">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-200">Top ↕ Bottom <span className="text-slate-400">(offset)</span>:</span>
                    <span className={analysis.topBottom.match ? 'text-emerald-400 text-xs font-medium' : analysis.topBottom.avgDifference < 30 ? 'text-orange-400 text-xs font-medium' : 'text-red-400 text-xs font-medium'}>
                      {getSeamQualityLabel(analysis.topBottom)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {getSeamQualityDetail(analysis.topBottom)}
                  </p>
                </div>
                
                <div className="p-2 bg-slate-900 rounded border border-slate-700">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-200">Left ↔ Right:</span>
                    <span className={analysis.leftRight.match ? 'text-emerald-400 text-xs font-medium' : analysis.leftRight.avgDifference < 30 ? 'text-orange-400 text-xs font-medium' : 'text-red-400 text-xs font-medium'}>
                      {getSeamQualityLabel(analysis.leftRight)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {getSeamQualityDetail(analysis.leftRight)}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Overall score */}
          <div className="p-3 bg-slate-900 rounded border border-slate-700">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-slate-200">Overall Quality:</span>
              <span className="text-sm font-bold text-slate-100">
                {overallScore}/100 {stars}
              </span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all ${
                  overallScore >= 90 ? 'bg-emerald-500' :
                  overallScore >= 75 ? 'bg-yellow-500' :
                  overallScore >= 60 ? 'bg-orange-500' :
                  'bg-red-500'
                }`}
                style={{ width: `${overallScore}%` }}
              />
            </div>
            <div className="text-xs mt-2 text-slate-300">
              {getActionableAdvice(overallScore)}
            </div>
          </div>

          {/* Show Problem Areas button */}
          {!analysis.topBottom.match && (
            <button
              onClick={onShowProblemAreas}
              className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded mt-2 text-sm font-medium transition-colors"
            >
              👁️ Show Problem Areas
            </button>
          )}

          {/* Issues or success message */}
          {!analysis.isPerfect ? (
            <div className="p-3 bg-orange-900/20 border border-orange-700 rounded">
              <p className="text-xs font-medium text-orange-300 mb-2">⚠️ Issues Detected:</p>
              <ul className="text-xs text-orange-200 space-y-1">
                {!analysis.topBottom.match && (
                  <li>
                    • {analysis.topBottom.problemAreas.length} pixel{analysis.topBottom.problemAreas.length !== 1 ? 's' : ''} mismatched on 
                    {repeatType === 'halfbrick' ? ' top/bottom (offset) seam' : ' top/bottom seam'}
                  </li>
                )}
                {!analysis.leftRight.match && (
                  <li>
                    • {analysis.leftRight.problemAreas.length} pixel{analysis.leftRight.problemAreas.length !== 1 ? 's' : ''} mismatched on 
                    {repeatType === 'halfdrop' ? ' left/right (offset) seam' : ' left/right seam'}
                  </li>
                )}
              </ul>
            </div>
          ) : (
            <div className="p-3 bg-emerald-900/20 border border-emerald-700 rounded">
              <p className="text-xs font-medium text-emerald-300">
                ✅ Perfect seamless {getRepeatLabel(repeatType).toLowerCase()} pattern!
              </p>
              <p className="text-xs text-emerald-400 mt-1">
                Ready to upload to Spoonflower or print-on-demand sites.
              </p>
            </div>
          )}

          {/* Show overlay button */}
          {!analysis.isPerfect && (
            <button
              onClick={onShowOverlay}
              className="w-full px-3 py-2 bg-slate-700 text-slate-200 rounded hover:bg-slate-600 text-xs font-medium transition-colors"
            >
              {showOverlay ? '👁️ Hide Problem Areas' : '👁️ Show Problem Areas'}
            </button>
          )}

          {/* Overlay preview */}
          {showOverlay && overlayCanvas && (
            <div className="border border-slate-700 rounded p-2 bg-slate-900">
              <p className="text-xs text-slate-400 mb-2">Red highlights show mismatched pixels:</p>
              <img 
                src={overlayCanvas.toDataURL()} 
                alt="Seam problems highlighted"
                className="w-full h-auto border border-slate-700 rounded"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
