'use client';

import { useEffect, useRef, useState } from 'react';
import MockupRendererV2 from './MockupRendererV2';
import {
  getAllV2Templates,
  getV2TemplatesByCategory,
} from '@/lib/mockups/mockupEngineV2/templates/templateRegistry';
import UpgradeModal from '@/components/export/UpgradeModal';

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

const categories = [
  'all',
  'apparel',
  'home-goods',
  'fabric',
  'wallpaper',
  'gifting',
  'stationery',
  'accessories',
] as const;

const categoryLabels: Record<string, string> = {
  all: 'All',
  apparel: 'Apparel',
  'home-goods': 'Home Goods',
  fabric: 'Fabric',
  wallpaper: 'Wallpaper',
  gifting: 'Gifting',
  stationery: 'Stationery',
  accessories: 'Accessories',
};

// Stagger batch size and interval for live preview rendering
const STAGGER_BATCH = 3;
const STAGGER_INTERVAL_MS = 80;

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
  const [activeCategory, setActiveCategory] = useState<string>('all');

  // Staggered reveal state — index up to which cards receive the real pattern image
  const [revealedCount, setRevealedCount] = useState(0);
  const staggerTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Staggered render initiation — resets when modal opens or category changes
  useEffect(() => {
    // Clear any in-flight timers
    staggerTimersRef.current.forEach(clearTimeout);
    staggerTimersRef.current = [];

    if (!isOpen || !image) {
      setRevealedCount(0);
      return;
    }

    const templates =
      activeCategory === 'all'
        ? getAllV2Templates()
        : getV2TemplatesByCategory(activeCategory);
    const total = templates.length;

    setRevealedCount(0);

    // Schedule batch reveals
    const timers: ReturnType<typeof setTimeout>[] = [];
    let revealed = 0;
    while (revealed < total) {
      const nextRevealed = Math.min(revealed + STAGGER_BATCH, total);
      const delay = (revealed / STAGGER_BATCH) * STAGGER_INTERVAL_MS;
      const capturedNext = nextRevealed;
      timers.push(
        setTimeout(() => {
          setRevealedCount(capturedNext);
        }, delay)
      );
      revealed = nextRevealed;
    }
    staggerTimersRef.current = timers;

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [isOpen, image, activeCategory]);

  if (!isOpen) return null;

  // Pro gate — non-pro users see UpgradeModal instead of gallery
  if (!isPro) {
    return <UpgradeModal isOpen onClose={onClose} />;
  }

  const filteredTemplates =
    activeCategory === 'all'
      ? getAllV2Templates()
      : getV2TemplatesByCategory(activeCategory);

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="relative w-[calc(100vw-32px)] max-w-2xl max-h-[85vh] flex flex-col rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-none flex items-center justify-between px-4 py-3 bg-[#3a3d44]">
          <h3 className="text-sm font-semibold text-white">Mockups</h3>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white p-1"
            aria-label="Close gallery"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Tab strip — horizontal scroll, no visible scrollbar
            Note: WebKit needs `::webkit-scrollbar { display: none }` in globals for full cross-browser coverage;
            `scrollbarWidth: none` here covers Firefox and Chrome standards mode. */}
        <div
          className="flex-none flex gap-2 px-4 py-2 bg-[#3a3d44]"
          style={{ overflowX: 'auto', scrollbarWidth: 'none' }}
        >
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`min-h-[44px] px-3 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all ${
                activeCategory === cat
                  ? 'bg-[#fbbf24] text-white shadow-[0_2px_8px_rgba(251,191,36,0.4)]'
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              {categoryLabels[cat]}
            </button>
          ))}
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto bg-white">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4">
            {filteredTemplates.length === 0 ? (
              <p className="col-span-full text-center text-sm text-gray-400 py-8">
                No mockups in this category yet.
              </p>
            ) : (
              filteredTemplates.map((template, index) => (
                <div
                  key={template.id}
                  className="group cursor-pointer rounded-xl overflow-hidden bg-gray-50 transition-transform hover:scale-[1.02] active:scale-[0.98]"
                  onClick={() => onSelectMockup(template.id)}
                >
                  {/* Thumbnail area — aspect-square wrapper for visual consistency */}
                  <div className="aspect-square overflow-hidden bg-gray-100">
                    <MockupRendererV2
                      template={template}
                      patternImage={index < revealedCount ? image : null}
                      tileWidth={tileWidth}
                      tileHeight={tileHeight}
                      dpi={dpi}
                      repeatType={repeatType}
                    />
                  </div>

                  {/* Card label */}
                  <div className="px-2 py-1.5">
                    <p className="text-xs font-semibold text-[#294051] truncate">
                      {template.name}
                    </p>
                    <p className="text-[10px] text-[#d97706] font-medium truncate">
                      {template.sizeLabel ??
                        `${template.physicalSize.width}×${template.physicalSize.height}"`}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Upcoming mockups teaser */}
          <p className="text-center text-xs text-gray-400 mt-4 pb-1">
            20+ mockups coming May 2026
          </p>
        </div>
      </div>
    </div>
  );
}
