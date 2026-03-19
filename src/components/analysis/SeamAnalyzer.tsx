'use client';

import type { RepeatType } from '@/lib/analysis/seamAnalyzer';
import { openSeamInspector } from '@/lib/seam-inspector/openSeamInspector';

interface SeamAnalyzerProps {
  canvas: HTMLCanvasElement | null;
  image: HTMLImageElement | null;
  repeatType: RepeatType;
  isPro: boolean;
  dpi?: number;
  seamLineColor?: string;
  onUpgrade?: () => void;
}

export default function SeamAnalyzer({ canvas, image, repeatType, isPro, dpi = 150, seamLineColor = '#38bdf8', onUpgrade }: SeamAnalyzerProps) {
  const handleInspect = () => {
    if (!image) return;
    openSeamInspector({
      image,
      repeatType:
        repeatType === 'fulldrop' ? 'full-drop' :
        repeatType === 'halfdrop' ? 'half-drop' :
        'half-brick',
      dpi,
      filename: null,
      outlineColor: seamLineColor,
    });
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
      <div className="p-4 border border-[#e5e7eb] rounded-md bg-white">
        <h3 className="text-sm font-semibold text-[#294051] mb-2 flex items-center gap-2">
          Seam Analyzer
          <span className="text-xs bg-[#e5e7eb] text-[#294051] px-2 py-1 rounded font-medium">
            {getRepeatLabel(repeatType)}
          </span>
        </h3>
        <p className="text-xs text-[#6b7280] mb-3">
          Detect seamless pattern errors before upload
        </p>
        <button
          onClick={onUpgrade}
          className="w-full px-4 py-2 bg-[#e0c26e] text-white rounded flex items-center justify-center gap-2 text-sm font-semibold hover:bg-[#c9a94e] transition-colors"
        >
          Try Pro free for 3 days
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 border border-[#e5e7eb] rounded-md bg-white">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[#294051] flex items-center gap-2">
          Seam Analyzer
        </h3>
        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-medium">
          {getRepeatLabel(repeatType)}
        </span>
      </div>
      
      {!image ? (
        <div className="p-3 bg-[#f5f5f5] border border-[#e5e7eb] rounded mb-3">
          <p className="text-xs text-[#374151] text-center font-medium">
            Upload your pattern to inspect seams
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-[#6b7280] mb-3">
            Visually inspect pattern seams for alignment
          </p>

          <button
            onClick={handleInspect}
            disabled={!image}
            className="w-full px-4 py-2 text-sm font-semibold text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-3"
            style={{ backgroundColor: '#e0c26e' }}
            onMouseEnter={(e) => {
              if (!e.currentTarget.disabled) {
                e.currentTarget.style.backgroundColor = '#e8d28e';
              }
            }}
            onMouseLeave={(e) => {
              if (!e.currentTarget.disabled) {
                e.currentTarget.style.backgroundColor = '#e0c26e';
              }
            }}
          >
            Inspect Seams
          </button>
        </>
      )}

    </div>
  );
}



