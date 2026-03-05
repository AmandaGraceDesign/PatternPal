'use client';

import { useEffect, useState } from 'react';
import MockupRenderer from './MockupRenderer';
import MockupRendererV2 from './MockupRendererV2';
import { getMockupTemplate } from '@/lib/mockups/mockupTemplates';
import { getAllV2Templates } from '@/lib/mockups/mockupEngineV2/templates/templateRegistry';
import UpgradeModal from '@/components/export/UpgradeModal';

const MOCKUP_TYPES = ['onesie', 'fabric-swatch', 'wallpaper', 'throw-pillow', 'wrapping-paper', 'journal'] as const;

// Map V1 classic mockups into their respective categories
const V1_CATEGORY_MAP: Record<string, string> = {
  'onesie': 'apparel',
  'fabric-swatch': 'fabric',
  'wallpaper': 'wallpaper',
  'throw-pillow': 'home-goods',
  'wrapping-paper': 'gifting',
  'journal': 'stationery',
};

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

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const v2Templates = getAllV2Templates();
  const categories = ['all', 'apparel', 'home-goods', 'fabric', 'wallpaper', 'gifting', 'stationery', 'accessories'];
  const categoryLabels: Record<string, string> = {
    'all': 'All',
    'apparel': 'Apparel',
    'home-goods': 'Home Goods',
    'fabric': 'Fabric',
    'wallpaper': 'Wallpaper',
    'gifting': 'Gifting',
    'stationery': 'Stationery',
    'accessories': 'Accessories',
  };

  if (!isOpen) return null;

  // Free users get the UpgradeModal directly — no gallery wrapper
  // TODO: Re-enable pro gate after testing
  // if (!isPro) {
  //   return <UpgradeModal isOpen onClose={onClose} />;
  // }

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

        {/* Category Tabs */}
        <div className="flex gap-2 px-4 py-2 bg-[#3a3d44] border-b border-gray-600 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded text-[10px] font-bold whitespace-nowrap transition-all ${
                activeCategory === cat
                  ? 'bg-[#d97706] text-white shadow-[0_2px_8px_rgba(251,191,36,0.4)]'
                  : 'bg-[#fbbf24] text-white hover:bg-[#f59e0b]'
              }`}
            >
              {categoryLabels[cat]}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-4" style={{ maxHeight: 'calc(85vh - 96px)' }}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {/* V1 Mockups (filtered by category) */}
            {MOCKUP_TYPES
              .filter((mockupType) => activeCategory === 'all' || V1_CATEGORY_MAP[mockupType] === activeCategory)
              .map((mockupType) => {
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
                      onClick={() => onSelectMockup(mockupType)}
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
              })
            }

            {/* V2 New Mockups */}
            {v2Templates
              .filter(t => activeCategory === 'all' || t.category === activeCategory)
              .map((template) => (
                <div key={template.id} className="relative">
                  <MockupRendererV2
                    template={template}
                    patternImage={image}
                    tileWidth={tileWidth}
                    tileHeight={tileHeight}
                    dpi={dpi}
                    repeatType={repeatType}
                    onClick={() => onSelectMockup(template.id)}
                  />
                  <div className="mt-1 text-center">
                    <span className="text-xs font-medium text-[#294051]">
                      {template.name}
                    </span>
                    <span className="block text-[10px] text-gray-400">
                      {template.physicalSize.width}×{template.physicalSize.height}"
                    </span>
                  </div>
                </div>
              ))
            }
          </div>
          <p className="text-center text-xs text-gray-400 mt-4 pb-1">
            20+ mockups coming May 2026
          </p>
        </div>
      </div>
    </div>
  );
}
