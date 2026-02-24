'use client';

import { useEffect, useState } from 'react';
import MockupRenderer from './MockupRenderer';
import { getMockupTemplate } from '@/lib/mockups/mockupTemplates';
import CheckoutModal from '@/components/billing/CheckoutModal';

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
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

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
  <>
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
        <div className="relative overflow-y-auto p-4" style={{ maxHeight: 'calc(85vh - 52px)' }}>
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
                </div>
              );
            })}
          </div>

          {/* Upgrade overlay for free users — thumbnails visible behind */}
          {!isPro && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] rounded-b-xl">
              <div className="bg-white rounded-xl shadow-xl p-6 max-w-xs w-full mx-4 text-center">
                <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-[#e0c26e]/15 flex items-center justify-center">
                  <svg className="w-5 h-5 text-[#e0c26e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h4 className="text-sm font-bold text-[#294051] mb-1">Unlock Mockups</h4>
                <p className="text-xs text-gray-500 mb-4">
                  See your pattern on real products — pillows, wallpaper, onesies & more. Upgrade to preview and download.
                </p>
                <button
                  onClick={() => setIsCheckoutOpen(true)}
                  className="w-full px-4 py-2.5 text-sm font-semibold text-white rounded-lg transition-colors"
                  style={{ backgroundColor: '#e0c26e' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#c9a94e'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#e0c26e'; }}
                >
                  Upgrade to Pro
                </button>
                <button
                  onClick={onClose}
                  className="mt-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Maybe Later
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Checkout modal — opens directly from upgrade overlay */}
    <CheckoutModal
      isOpen={isCheckoutOpen}
      onClose={() => {
        setIsCheckoutOpen(false);
      }}
    />
  </>
  );
}
