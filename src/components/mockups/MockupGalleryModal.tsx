'use client';

import { useEffect } from 'react';
import MockupRenderer from './MockupRenderer';
import { getMockupTemplate } from '@/lib/mockups/mockupTemplates';

const MOCKUP_TYPES = ['onesie', 'fabric-swatch', 'wallpaper', 'throw-pillow', 'wrapping-paper', 'journal'] as const;

interface MockupGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMockup: (type: string) => void;
  image: HTMLImageElement | null;
  tileWidth: number;
  tileHeight: number;
  dpi: number;
  repeatType: 'full-drop' | 'half-drop' | 'half-brick';
  zoom: number;
  scaleFactor: number;
  scalePreviewActive: boolean;
  isPro: boolean;
  onUpgrade: () => void;
}

export default function MockupGalleryModal({
  isOpen,
  onClose,
  onSelectMockup,
  image,
  tileWidth,
  tileHeight,
  dpi,
  repeatType,
  zoom,
  scaleFactor,
  scalePreviewActive,
  isPro,
  onUpgrade,
}: MockupGalleryModalProps) {
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
        className="relative w-[calc(100vw-32px)] max-w-2xl max-h-[85vh] bg-white rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-[#3a3d44]">
          <h3 className="text-sm font-semibold text-white">Mockups</h3>
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
        <div className="overflow-y-auto p-4" style={{ maxHeight: 'calc(85vh - 52px)' }}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {MOCKUP_TYPES.map((mockupType) => {
              const template = getMockupTemplate(mockupType);
              return (
                <div key={mockupType} className="relative">
                  <MockupRenderer
                    template={template}
                    patternImage={image}
                    tileWidth={tileWidth}
                    tileHeight={tileHeight}
                    dpi={dpi}
                    repeatType={repeatType}
                    zoom={zoom}
                    scaleFactor={scaleFactor}
                    scalePreviewActive={scalePreviewActive}
                    onClick={() => {
                      if (isPro) {
                        onSelectMockup(mockupType);
                      } else {
                        onUpgrade();
                      }
                    }}
                  />
                  <div className="mt-1 text-center">
                    <span className="text-xs font-medium text-[#294051]">
                      {template?.name || mockupType}
                    </span>
                    {template?.physicalDimensions?.displayLabel && (
                      <span className="block text-[10px] text-gray-400">
                        {template.physicalDimensions.displayLabel}
                      </span>
                    )}
                  </div>
                  {!isPro && (
                    <div className="absolute inset-0 rounded-md flex items-center justify-center text-[#294051] pointer-events-none">
                      <span className="text-xs font-semibold bg-white/80 px-2 py-1 rounded">&#x1f512; Pro</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {!isPro && (
            <div
              className="mt-4 p-4 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg text-center cursor-pointer hover:border-[#e0c26e] transition-colors group"
              onClick={onUpgrade}
            >
              <div className="text-xs text-gray-500 mb-2">
                Preview mockups are available, but opening and downloads require Pro.
              </div>
              <div className="text-xs font-semibold text-[#e0c26e] group-hover:text-[#c9a94e]">
                Click to Upgrade
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
