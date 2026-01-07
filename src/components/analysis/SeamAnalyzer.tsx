'use client';

import { useState } from 'react';
import { 
  analyzeSeams, 
  highlightSeamProblems,
  generateComparisonView,
  type SeamAnalysisResult, 
  type RepeatType 
} from '@/lib/analysis/seamAnalyzer';

interface SeamAnalyzerProps {
  canvas: HTMLCanvasElement | null;
  repeatType: RepeatType;
  isPro: boolean;
}

export default function SeamAnalyzer({ canvas, repeatType, isPro }: SeamAnalyzerProps) {
  const [analysis, setAnalysis] = useState<SeamAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [overlayCanvas, setOverlayCanvas] = useState<HTMLCanvasElement | null>(null);

  const handleAnalyze = async () => {
    if (!canvas) return;
    
    setIsAnalyzing(true);
    setShowOverlay(false);
    setOverlayCanvas(null);
    
    // Run analysis in next frame to avoid blocking UI
    setTimeout(() => {
      const result = analyzeSeams(canvas, repeatType, 5);
      setAnalysis(result);
      setIsAnalyzing(false);
    }, 0);
  };

  const handleShowOverlay = () => {
    if (!canvas || !analysis) return;
    
    if (showOverlay) {
      setShowOverlay(false);
      setOverlayCanvas(null);
    } else {
      const overlay = highlightSeamProblems(canvas, analysis);
      setOverlayCanvas(overlay);
      setShowOverlay(true);
    }
  };

  const getRepeatLabel = (type: RepeatType) => {
    switch (type) {
      case 'fulldrop': return 'Full Drop';
      case 'halfdrop': return 'Half Drop';
      case 'halfbrick': return 'Half Brick';
    }
  };

  const getRepeatDescription = (type: RepeatType) => {
    switch (type) {
      case 'fulldrop': 
        return 'Checking straight edge matches';
      case 'halfdrop': 
        return 'Left/right edges offset by 50% vertically';
      case 'halfbrick': 
        return 'Top/bottom edges offset by 50% horizontally';
    }
  };

  if (!isPro) {
    return (
      <div className="p-4 border border-slate-700 rounded-md bg-slate-800">
        <h3 className="text-sm font-semibold text-slate-200 mb-2 flex items-center gap-2">
          🔍 Seam Analyzer
          <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded">
            {getRepeatLabel(repeatType)}
          </span>
        </h3>
        <p className="text-xs text-slate-400 mb-3">
          Detect seamless pattern errors before upload
        </p>
        <button className="w-full px-4 py-2 bg-slate-700 text-slate-400 rounded cursor-not-allowed flex items-center justify-center gap-2 text-sm">
          🔒 Upgrade to Pro
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 border border-slate-700 rounded-md bg-slate-800">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          🔍 Seam Analyzer
        </h3>
        <span className="text-xs bg-blue-900/50 text-blue-300 px-2 py-1 rounded font-medium">
          {getRepeatLabel(repeatType)}
        </span>
      </div>
      
      <p className="text-xs text-slate-400 mb-3">
        {getRepeatDescription(repeatType)}
      </p>

      <button
        onClick={handleAnalyze}
        disabled={!canvas || isAnalyzing}
        className="w-full px-4 py-2 text-sm font-medium text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-3"
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
        {isAnalyzing ? '🔍 Analyzing...' : '🔍 Analyze Seams'}
      </button>

      {analysis && (
        <div className="space-y-3">
          {/* Results */}
          <div className="space-y-2 text-sm">
            {repeatType === 'fulldrop' && (
              <>
                <div className="flex items-center justify-between p-2 bg-slate-900 rounded border border-slate-700">
                  <span className="text-xs font-medium text-slate-200">Top ↔ Bottom:</span>
                  <span className={analysis.topBottom.match ? 'text-emerald-400 text-xs font-medium' : 'text-orange-400 text-xs font-medium'}>
                    {analysis.topBottom.match ? '✅ Perfect' : `⚠️ ${analysis.topBottom.mismatchPercent}%`}
                  </span>
                </div>
                
                <div className="flex items-center justify-between p-2 bg-slate-900 rounded border border-slate-700">
                  <span className="text-xs font-medium text-slate-200">Left ↔ Right:</span>
                  <span className={analysis.leftRight.match ? 'text-emerald-400 text-xs font-medium' : 'text-orange-400 text-xs font-medium'}>
                    {analysis.leftRight.match ? '✅ Perfect' : `⚠️ ${analysis.leftRight.mismatchPercent}%`}
                  </span>
                </div>
              </>
            )}

            {repeatType === 'halfdrop' && (
              <>
                <div className="flex items-center justify-between p-2 bg-slate-900 rounded border border-slate-700">
                  <span className="text-xs font-medium text-slate-200">Top ↔ Bottom:</span>
                  <span className={analysis.topBottom.match ? 'text-emerald-400 text-xs font-medium' : 'text-orange-400 text-xs font-medium'}>
                    {analysis.topBottom.match ? '✅ Perfect' : `⚠️ ${analysis.topBottom.mismatchPercent}%`}
                  </span>
                </div>
                
                <div className="flex items-center justify-between p-2 bg-slate-900 rounded border border-slate-700">
                  <span className="text-xs font-medium text-slate-200">Left ↔ Right <span className="text-slate-400">(offset)</span>:</span>
                  <span className={analysis.leftRight.match ? 'text-emerald-400 text-xs font-medium' : 'text-orange-400 text-xs font-medium'}>
                    {analysis.leftRight.match ? '✅ Perfect' : `⚠️ ${analysis.leftRight.mismatchPercent}%`}
                  </span>
                </div>
              </>
            )}

            {repeatType === 'halfbrick' && (
              <>
                <div className="flex items-center justify-between p-2 bg-slate-900 rounded border border-slate-700">
                  <span className="text-xs font-medium text-slate-200">Top ↔ Bottom <span className="text-slate-400">(offset)</span>:</span>
                  <span className={analysis.topBottom.match ? 'text-emerald-400 text-xs font-medium' : 'text-orange-400 text-xs font-medium'}>
                    {analysis.topBottom.match ? '✅ Perfect' : `⚠️ ${analysis.topBottom.mismatchPercent}%`}
                  </span>
                </div>
                
                <div className="flex items-center justify-between p-2 bg-slate-900 rounded border border-slate-700">
                  <span className="text-xs font-medium text-slate-200">Left ↔ Right:</span>
                  <span className={analysis.leftRight.match ? 'text-emerald-400 text-xs font-medium' : 'text-orange-400 text-xs font-medium'}>
                    {analysis.leftRight.match ? '✅ Perfect' : `⚠️ ${analysis.leftRight.mismatchPercent}%`}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Overall score */}
          <div className="p-3 bg-slate-900 rounded border border-slate-700">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-slate-200">Overall Quality:</span>
              <span className="text-sm font-bold text-slate-100">{analysis.overallScore}/100</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all ${
                  analysis.overallScore >= 95 ? 'bg-emerald-500' :
                  analysis.overallScore >= 80 ? 'bg-yellow-500' :
                  'bg-orange-500'
                }`}
                style={{ width: `${analysis.overallScore}%` }}
              />
            </div>
          </div>

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
              onClick={handleShowOverlay}
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
      )}
    </div>
  );
}
