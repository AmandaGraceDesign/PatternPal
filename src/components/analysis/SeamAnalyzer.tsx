'use client';

import { useState } from 'react';
import type { RepeatType } from '@/lib/analysis/seamAnalyzer';
import SeamInspector from './SeamInspector';

interface SeamAnalyzerProps {
  canvas: HTMLCanvasElement | null;
  image: HTMLImageElement | null;
  repeatType: RepeatType;
  isPro: boolean;
}

export default function SeamAnalyzer({ canvas, image, repeatType, isPro }: SeamAnalyzerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleInspect = () => {
    if (!image) return;
    setIsModalOpen(true);
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
        <button className="w-full px-4 py-2 bg-[#f1737c] text-white rounded cursor-not-allowed flex items-center justify-center gap-2 text-sm font-semibold hover:bg-[#ff8a94] transition-colors disabled:opacity-50">
          Upgrade to Pro
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
            style={{ backgroundColor: '#f1737c' }}
            onMouseEnter={(e) => {
              if (!e.currentTarget.disabled) {
                e.currentTarget.style.backgroundColor = '#ff8a94';
              }
            }}
            onMouseLeave={(e) => {
              if (!e.currentTarget.disabled) {
                e.currentTarget.style.backgroundColor = '#f1737c';
              }
            }}
          >
            Inspect Seams
          </button>
        </>
      )}

      {/* Modal */}
      <SeamInspector
        image={image}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        repeatType={
          repeatType === 'fulldrop' ? 'full-drop' :
          repeatType === 'halfdrop' ? 'half-drop' :
          'half-brick'
        }
      />
    </div>
  );
}



