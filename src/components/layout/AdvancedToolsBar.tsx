'use client';

import React, { useRef, useState, useCallback, Suspense } from 'react';
import EasyscaleExportModal from '@/components/export/EasyscaleExportModal';
import RepeatExportModal from '@/components/export/RepeatExportModal';
import PatternAnalysisModal from '@/components/analysis/PatternAnalysisModal';
import { openSeamInspector } from '@/lib/seam-inspector/openSeamInspector';
import MockupGalleryModal from '@/components/mockups/MockupGalleryModal';
import MockupModal from '@/components/mockups/MockupModal';
import { preloadTemplateImages } from '@/components/mockups/MockupRendererV2';
import MockupModalBody from '@/components/mockups/MockupModalBody';
import UpgradeModal from '@/components/export/UpgradeModal';
import { getV2Template } from '@/lib/mockups/mockupEngineV2/templates/templateRegistry';
import {
  isFreeMockup,
  isFreeSocialSize,
  FREE_EASYSCALE_SIZES,
  FREE_EASYSCALE_DPI,
  FREE_EASYSCALE_FORMAT,
} from '@/lib/mockups/freeTier';
import { extractDominantColor } from '@/lib/mockups/mockupEngineV2/MockupPipeline';
import { mockupDownloadSizes, FULL_SIZE_SLUG, FULL_SIZE_PRESET, SOCIAL_SIZE_PRESETS, type SizeSlug, type SocialSizePreset } from '@/lib/export/socialSizes';
import { createTrailingThrottle } from '@/lib/utils/trailingThrottle';
import { downloadMockupSocialSizes } from '@/lib/utils/mockupSocialExport';
import { sanitizeFilename } from '@/lib/utils/sanitizeFilename';
import { WatermarkConfig, DEFAULT_WATERMARK } from '@/lib/watermark/watermark';
import { shouldStampBadge } from '@/lib/badge/patternpalBadge';
import { analyzeContrast, analyzeComposition, analyzeColorHarmony, ContrastAnalysis, CompositionAnalysis, ColorHarmonyAnalysis } from '@/lib/analysis/patternAnalyzer';
import { useUser } from '@clerk/nextjs';
import { checkClientProStatus } from '@/lib/utils/checkProStatus';
import { useEffect } from 'react';

// Full size is preselected when it's downloadable for the current template/user;
// if it's Pro-locked (free user on a paid template), start with nothing selected.
function defaultDownloadSelection(canFullSize: boolean): Set<SizeSlug> {
  return canFullSize ? new Set<SizeSlug>([FULL_SIZE_SLUG]) : new Set<SizeSlug>();
}

// All per-size crop offsets default to 0.5 (center) so an untouched export is
// byte-identical to the pre-crop behavior.
function allCenterOffsets(): Record<SizeSlug, number> {
  return mockupDownloadSizes().reduce((acc, p) => {
    acc[p.slug] = 0.5;
    return acc;
  }, {} as Record<SizeSlug, number>);
}

/** Debounces a value — returns the input only after it has stopped changing for `delay` ms. */
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

interface AdvancedToolsBarProps {
  image: HTMLImageElement | null;
  dpi: number;
  tileWidth: number;
  tileHeight: number;
  repeatType: 'full-drop' | 'half-drop' | 'half-brick';
  zoom: number;
  originalFilename: string | null;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  scaleFactor: number;
  scalePreviewActive: boolean;
  tileOutlineColor: string;
}

interface ToolCardProps {
  icon: string;
  title: string;
  description: string;
  isFree?: boolean;
  isPro?: boolean; // User's Pro status
  hideBadge?: boolean; // Suppress the PRO/FREE chip even for non-Pro users
  onClick: () => void;
  disabled?: boolean;
  dataTour?: string;
}

function ToolCard({ icon, title, description, isFree = false, isPro = false, hideBadge = false, onClick, disabled = false, dataTour }: ToolCardProps) {
  const showBadge = !isPro && !hideBadge; // Hide if Pro user, or if explicitly suppressed

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      data-tour={dataTour}
      className={`group relative flex items-center gap-2 md:gap-3 min-w-[160px] md:min-w-[200px] flex-1 px-3 md:px-4 py-2.5 md:py-3 rounded-lg border-2 transition-all duration-200 ${
        isFree
          ? 'border-[#4caf50] hover:shadow-[0_4px_16px_rgba(76,175,80,0.3)] hover:-translate-y-0.5'
          : 'border-[#3a3a3a] hover:border-[#fbbf24] hover:shadow-[0_4px_16px_rgba(251,191,36,0.2)] hover:-translate-y-0.5'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} bg-[#2a2a2a] hover:bg-[#333]`}
    >
      {/* Icon Circle */}
      <div
        className={`flex-shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-md flex items-center justify-center text-sm md:text-base ${
          isFree ? 'bg-[#4caf50]' : 'bg-[#fbbf24]'
        }`}
      >
        {icon}
      </div>

      {/* Text Section */}
      <div className="flex-1 text-left">
        <div className="text-xs md:text-sm font-bold text-white">{title}</div>
        <div className="text-[10px] md:text-[11px] text-[#999] leading-tight">{description}</div>
      </div>

      {/* Badge - hidden for Pro users and for cards that opt out via hideBadge */}
      {showBadge && (
        <span
          className={`absolute top-2 right-2 text-[9px] font-bold px-1.5 py-1 rounded ${
            isFree
              ? 'bg-[#4caf50] text-white'
              : 'bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] text-white'
          }`}
        >
          {isFree ? 'FREE' : 'PRO'}
        </span>
      )}

      {/* Arrow */}
      <div className="text-base md:text-[18px] text-[#666] group-hover:text-[#fbbf24] group-hover:translate-x-[3px] transition-all duration-200">
        →
      </div>
    </button>
  );
}

export default function AdvancedToolsBar({
  image,
  dpi,
  tileWidth,
  tileHeight,
  repeatType,
  zoom,
  originalFilename,
  canvasRef,
  scaleFactor,
  scalePreviewActive,
  tileOutlineColor,
}: AdvancedToolsBarProps) {
  const { user, isSignedIn } = useUser();
  const [isEasyscalePickerOpen, setIsEasyscalePickerOpen] = useState(false);
  const [isEasyscaleOpen, setIsEasyscaleOpen] = useState(false);
  // Single state for both Cricut and Social flows — they share RepeatExportModal.
  // 'cricut' is reached via the Easyscale picker; 'social' via its own toolbar card.
  const [repeatModalMode, setRepeatModalMode] = useState<'cricut' | 'social' | null>(null);
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);
  const [isMockupsOpen, setIsMockupsOpen] = useState(false);
  const [mockupInitialCategory, setMockupInitialCategory] = useState<string>('all');
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [selectedMockup, setSelectedMockup] = useState<string | null>(null);
  const [mockupColorOverride, setMockupColorOverride] = useState<string | null>(null);
  // When true, the mockup canvas re-renders at full template resolution so the
  // download captures a high-res PNG. Default false → MockupRendererV2 renders
  // at maxRenderDimension=1500 for ~4× faster iPad display.
  const [isCapturingFullRes, setIsCapturingFullRes] = useState(false);
  // Ref holds the post-full-res-render callback. Set just before flipping
  // isCapturingFullRes=true; cleared by onRenderComplete once it fires.
  const downloadAfterRenderRef = useRef<(() => void) | null>(null);
  // Per-layer arrays — index 0 = primary, 1+ = template.additionalShadowPaths / additionalHighlightPaths.
  const [shadowEnableds, setShadowEnableds] = useState<boolean[]>([true]);
  const [shadowOpacityPercents, setShadowOpacityPercents] = useState<number[]>([30]);
  const [highlightEnableds, setHighlightEnableds] = useState<boolean[]>([true]);
  const [highlightOpacityPercents, setHighlightOpacityPercents] = useState<number[]>([30]);
  const [colorOverlayEnabled, setColorOverlayEnabled] = useState(true);
  const [mockupScaleOverride, setMockupScaleOverride] = useState<number | null>(null);
  const [watermark, setWatermark] = useState<WatermarkConfig>({ ...DEFAULT_WATERMARK });
  const [badgeEnabled, setBadgeEnabled] = useState(true);
  // Selected sizes for the unified Mockup Modal download menu (Full size + social sizes).
  const [socialSizes, setSocialSizes] = useState<Set<SizeSlug>>(new Set());
  const [socialOffsets, setSocialOffsets] = useState<Record<SizeSlug, number>>(
    () => allCenterOffsets(),
  );
  const [activeSlug, setActiveSlug] = useState<SizeSlug>(FULL_SIZE_SLUG);
  const [mockupSnapshotUrl, setMockupSnapshotUrl] = useState<string | null>(null);
  // Throttled snapshot of the live preview canvas → feeds the size-grid thumbnails.
  // Lazily created once; reads the on-screen mockup canvas and stores a PNG data URL.
  const snapshotThrottleRef = useRef<ReturnType<typeof createTrailingThrottle> | null>(null);
  // Holds the current object URL so we can revoke the previous one each refresh
  // (and on unmount) — otherwise the blobs leak as the preview updates.
  const snapshotUrlRef = useRef<string | null>(null);
  if (!snapshotThrottleRef.current) {
    snapshotThrottleRef.current = createTrailingThrottle(() => {
      const c = document.querySelector(
        '[data-mockup-modal] .mockup-canvas, [data-mockup-modal] canvas',
      ) as HTMLCanvasElement | null;
      if (!c) return;
      // JPEG via toBlob + object URL instead of a multi-MB PNG data-URL string
      // pushed through React state every 350ms. Thumbnails are ~64px so JPEG@0.8
      // is visually identical, and toBlob encodes off the main thread.
      c.toBlob(
        (blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          if (snapshotUrlRef.current) URL.revokeObjectURL(snapshotUrlRef.current);
          snapshotUrlRef.current = url;
          setMockupSnapshotUrl(url);
        },
        'image/jpeg',
        0.8,
      );
    }, 350);
  }
  useEffect(() => () => {
    snapshotThrottleRef.current?.cancel();
    if (snapshotUrlRef.current) URL.revokeObjectURL(snapshotUrlRef.current);
  }, []);

  // Lets anything outside this tree (e.g. the what's-new announcement in the
  // top bar) open the gallery on a given category without prop-drilling
  // through the whole layout.
  useEffect(() => {
    const onOpenGallery = (e: Event) => {
      const detail = (e as CustomEvent<{ category?: string }>).detail;
      setMockupInitialCategory(detail?.category ?? 'all');
      setIsMockupsOpen(true);
    };
    window.addEventListener('ppp:open-mockup-gallery', onOpenGallery);
    return () => window.removeEventListener('ppp:open-mockup-gallery', onOpenGallery);
  }, []);
  const [proAccess, setProAccess] = useState<'unknown' | 'allowed' | 'denied'>('unknown');

  const isPro = isSignedIn && user ? checkClientProStatus(user.publicMetadata) : false;
  const proAllowed = isPro || proAccess === 'allowed';

  // Stable handlers for the memoized download grid — value-stable refs let the
  // per-row React.memo skip every row except the one whose framing changed.
  const handleToggleSocialSize = useCallback((slug: SizeSlug) => {
    // Checking a size also makes it the active (framed) one, so the crop slider
    // pops up immediately instead of requiring a second tap on the thumbnail.
    setActiveSlug(slug);
    setSocialSizes(prev => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug); else next.add(slug);
      return next;
    });
  }, []);
  const handleDownloadMenuLockedClick = useCallback(() => setIsUpgradeModalOpen(true), []);

  // The size preset currently being framed on the live preview (drives MockupCropStage).
  const activePreset =
    activeSlug === FULL_SIZE_SLUG
      ? FULL_SIZE_PRESET
      : (SOCIAL_SIZE_PRESETS.find(p => p.slug === activeSlug) ?? FULL_SIZE_PRESET);

  // Resize per-layer arrays to match the selected template's layer count.
  useEffect(() => {
    if (!selectedMockup) return;
    const v2 = getV2Template(selectedMockup);
    // Warm the FULL-res layer cache as soon as the modal opens, so the eventual
    // full-res download capture doesn't cold-decode ~50-80MB of PNGs on the main
    // thread (which froze the UI). Fire-and-forget; the medium preview keeps
    // rendering off the medium set meanwhile.
    if (v2) preloadTemplateImages(v2);
    const shadowCount = 1 + (v2?.additionalShadowPaths?.length ?? 0);
    const highlightCount = 1 + (v2?.additionalHighlightPaths?.length ?? 0);
    const additionalShadowDefaults = v2?.additionalShadowDefaultEnableds ?? [];
    const additionalHighlightDefaults = v2?.additionalHighlightDefaultEnableds ?? [];
    setShadowEnableds([true, ...Array.from({ length: shadowCount - 1 }, (_, i) => additionalShadowDefaults[i] ?? true)]);
    setShadowOpacityPercents(Array(shadowCount).fill(30));
    setHighlightEnableds([true, ...Array.from({ length: highlightCount - 1 }, (_, i) => additionalHighlightDefaults[i] ?? true)]);
    setHighlightOpacityPercents(Array(highlightCount).fill(30));
    setColorOverlayEnabled(v2?.colorOverlayDefaultEnabled ?? true);
    setSocialSizes(defaultDownloadSelection(proAllowed || isFreeMockup(selectedMockup)));
    setSocialOffsets(allCenterOffsets());
    setActiveSlug(FULL_SIZE_SLUG);
    setMockupSnapshotUrl(null);
  }, [selectedMockup, proAllowed]);

  // rAF-coalesce color picker updates. Native <input type="color"> fires
  // onChange continuously during a picker drag; each setState kicks off a
  // full 3000×4500 pipeline render. Coalescing to one setState per animation
  // frame caps render rate at ~60fps. Same pattern as the drag throttle in
  // MockupRendererV2.
  const pendingColorRef = useRef<string | null>(null);
  const colorRafIdRef = useRef<number | null>(null);
  const scheduleColorUpdate = (value: string) => {
    pendingColorRef.current = value;
    if (colorRafIdRef.current !== null) return;
    colorRafIdRef.current = requestAnimationFrame(() => {
      colorRafIdRef.current = null;
      const v = pendingColorRef.current;
      pendingColorRef.current = null;
      if (v !== null) setMockupColorOverride(v);
    });
  };
  useEffect(() => () => {
    if (colorRafIdRef.current !== null) cancelAnimationFrame(colorRafIdRef.current);
  }, []);

  const effectiveTileWidth = mockupScaleOverride ?? tileWidth;
  const tileAspect = tileWidth > 0 ? tileHeight / tileWidth : 1;
  const effectiveTileHeight = mockupScaleOverride !== null ? mockupScaleOverride * tileAspect : tileHeight;

  // Debounced versions are what the (expensive) mockup pipeline actually consumes.
  // The input field still binds to the un-debounced value, so typing feels instant.
  const renderTileWidth = useDebouncedValue(effectiveTileWidth, 150);
  const renderTileHeight = useDebouncedValue(effectiveTileHeight, 150);
  const [contrastAnalysis, setContrastAnalysis] = useState<ContrastAnalysis | null>(null);
  const [compositionAnalysis, setCompositionAnalysis] = useState<CompositionAnalysis | null>(null);
  const [colorHarmonyAnalysis, setColorHarmonyAnalysis] = useState<ColorHarmonyAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const verifyProAccess = async () => {
    if (!isSignedIn) {
      setProAccess('denied');
      return false;
    }

    try {
      const res = await fetch('/api/pro/verify', { method: 'POST' });
      if (res.ok) {
        setProAccess('allowed');
        return true;
      }
      if (res.status === 401 || res.status === 403) {
        setProAccess('denied');
        return false;
      }
    } catch (error) {
      console.error('Pro verification failed:', error);
    }
    return proAccess === 'allowed';
  };

  useEffect(() => {
    if (!isSignedIn) {
      setProAccess('denied');
      return;
    }
    verifyProAccess();
  }, [isSignedIn, user?.id]);

  // Run analysis when image changes (for Pro users)
  useEffect(() => {
    if (!image || !proAllowed) {
      setContrastAnalysis(null);
      setCompositionAnalysis(null);
      return;
    }

    setIsAnalyzing(true);
    try {
      const contrast = analyzeContrast(image, 'unspecified');
      const composition = analyzeComposition(image, 'unspecified');
      const harmony = analyzeColorHarmony(image);
      setContrastAnalysis(contrast);
      setCompositionAnalysis(composition);
      setColorHarmonyAnalysis(harmony);
    } catch (error) {
      console.error('Error analyzing pattern:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [image, proAllowed]);

  const handleProToolClick = (openModal: () => void) => {
    if (proAllowed) {
      openModal();
    } else {
      setIsUpgradeModalOpen(true);
    }
  };

  return (
    <>
      {/* Horizontal Tool Cards Bar */}
      <div className="w-full bg-[#1a1a1a] px-4 py-4 border-b border-black/50">
        <div className="flex flex-wrap gap-3 md:gap-4 justify-center items-stretch mx-auto max-w-6xl">
          {/* Easyscale Export (FREE/PRO) — POD/Spoonflower is free (8"/12", JPG, 150 DPI); Cricut/Silhouette is Pro-locked */}
          <ToolCard
            icon="📦"
            title="Easyscale Export"
            description="POD, Spoonflower, Cricut & Silhouette"
            isPro={proAllowed}
            hideBadge
            onClick={() => setIsEasyscalePickerOpen(true)}
            disabled={!image}
            dataTour="easyscale-export"
          />

          {/* Pattern Analysis (PRO) */}
          <ToolCard
            icon="📊"
            title="Pattern Analysis"
            description="Contrast & composition insights"
            isPro={proAllowed}
            onClick={() => handleProToolClick(() => setIsAnalysisOpen(true))}
            disabled={!image}
            dataTour="pattern-analysis"
          />

          {/* Seam Analyzer (PRO) */}
          <ToolCard
            icon="🔍"
            title="Seam Analyzer"
            description="Inspect pattern seam alignment"
            isPro={proAllowed}
            onClick={() => handleProToolClick(() => openSeamInspector({
              image: image!,
              repeatType,
              dpi,
              filename: originalFilename,
              outlineColor: tileOutlineColor,
            }))}
            disabled={!image}
            dataTour="seam-analyzer"
          />

          {/* Social Media Export (FREE/PRO) — free users get the Instagram square; sits to the left of Mockups */}
          <ToolCard
            icon="📱"
            title="Social Media Export"
            description="Instagram, Pinterest, TikTok, Facebook"
            isPro={proAllowed}
            hideBadge
            onClick={() => setRepeatModalMode('social')}
            disabled={!image}
            dataTour="social-export"
          />

          {/* Mockups (FREE/PRO) — always opens gallery; free users get the curated free mockups, the rest show an upgrade overlay */}
          <ToolCard
            icon="🎨"
            title="Mockups"
            description="Preview on products & download"
            isPro={proAllowed}
            hideBadge
            onClick={() => setIsMockupsOpen(true)}
            disabled={!image}
            dataTour="mockups"
          />
        </div>
      </div>

      {/* Modals */}
      <EasyscaleExportModal
        isOpen={isEasyscaleOpen}
        onClose={() => setIsEasyscaleOpen(false)}
        image={image}
        currentDPI={dpi}
        repeatType={repeatType}
        originalFilename={originalFilename}
        isPro={proAllowed}
      />

      <RepeatExportModal
        isOpen={repeatModalMode !== null}
        onClose={() => setRepeatModalMode(null)}
        image={image}
        currentDPI={dpi}
        tileWidth={tileWidth}
        tileHeight={tileHeight}
        repeatType={repeatType}
        originalFilename={originalFilename}
        initialMode={repeatModalMode ?? undefined}
        isPro={proAllowed}
        onUpgrade={() => setIsUpgradeModalOpen(true)}
      />

      {/* Easyscale picker — choose between POD/Spoonflower and Cricut/Silhouette */}
      {isEasyscalePickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setIsEasyscalePickerOpen(false)}
        >
          <div
            className="relative max-w-md w-full mx-3 sm:mx-auto bg-white rounded-lg shadow-2xl overflow-hidden border border-[#92afa5]/30"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-[#92afa5]/30 flex items-center justify-between bg-[#e0c26e]">
              <h3 className="text-sm font-semibold text-white">Easyscale Export</h3>
              <button
                onClick={() => setIsEasyscalePickerOpen(false)}
                className="text-[#705046] hover:text-[#294051] transition-all duration-200"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-center text-[#6b7280]">What are you exporting for?</p>
              <div className="space-y-3">
                <button
                  onClick={() => {
                    setIsEasyscalePickerOpen(false);
                    setIsEasyscaleOpen(true);
                  }}
                  className="w-full text-left px-4 py-4 border-2 border-[#e0c26e] rounded-lg bg-[#faf3e0] hover:bg-[#f5ecd0] transition-colors"
                >
                  <div className="text-sm font-semibold text-[#294051]">📦 Print on Demand / Spoonflower</div>
                  <div className="text-xs text-[#9ca3af] mt-1">
                    {proAllowed
                      ? 'Batch sizes · 150/300 DPI · PNG, JPG, TIFF'
                      : `${FREE_EASYSCALE_SIZES.map((s) => `${s}"`).join(' & ')} · ${FREE_EASYSCALE_DPI} DPI · ${FREE_EASYSCALE_FORMAT.toUpperCase()}`}
                  </div>
                </button>
                <button
                  onClick={() => {
                    setIsEasyscalePickerOpen(false);
                    if (proAllowed) {
                      setRepeatModalMode('cricut');
                    } else {
                      setIsUpgradeModalOpen(true);
                    }
                  }}
                  className="w-full text-left px-4 py-4 border-2 border-[#e5e7eb] rounded-lg bg-white hover:bg-[#f9fafb] transition-colors"
                >
                  <div className="text-sm font-semibold text-[#294051]">
                    🖨 Cricut / Silhouette {!proAllowed && '🔒'}
                  </div>
                  <div className="text-xs text-[#9ca3af] mt-1">Digital paper · print files · Etsy / Creative Fabrica</div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <PatternAnalysisModal
        isOpen={isAnalysisOpen}
        onClose={() => setIsAnalysisOpen(false)}
        image={image}
        contrastAnalysis={contrastAnalysis}
        compositionAnalysis={compositionAnalysis}
        colorHarmonyAnalysis={colorHarmonyAnalysis}
        onColorHarmonyUpdate={(updated) => setColorHarmonyAnalysis(updated)}
        isAnalyzing={isAnalyzing}
        isPro={proAllowed}
        onUpgrade={() => setIsUpgradeModalOpen(true)}
      />

      <MockupGalleryModal
        initialCategory={mockupInitialCategory}
        isOpen={isMockupsOpen}
        onClose={() => {
          setIsMockupsOpen(false);
          setSelectedMockup(null);
          setMockupColorOverride(null);
          setShadowEnableds([true]);
          setHighlightEnableds([true]);
          setShadowOpacityPercents([30]);
          setHighlightOpacityPercents([30]);
          setColorOverlayEnabled(true);
          setSocialSizes(defaultDownloadSelection(proAllowed || (!!selectedMockup && isFreeMockup(selectedMockup))));
          setSocialOffsets(allCenterOffsets());
          setActiveSlug(FULL_SIZE_SLUG);
          setMockupSnapshotUrl(null);
        }}
        onSelectMockup={(type) => {
          setSelectedMockup(type);
          // Don't close gallery - keep it open in background
        }}
        image={image}
        tileWidth={tileWidth}
        tileHeight={tileHeight}
        dpi={dpi}
        repeatType={repeatType}
        zoom={zoom}
        scaleFactor={scaleFactor}
        scalePreviewActive={scalePreviewActive}
        isPro={proAllowed}
        onUpgrade={() => setIsUpgradeModalOpen(true)}
      />

      {selectedMockup && (() => {
        const v2Template = getV2Template(selectedMockup);
        const mockupName = v2Template?.name || selectedMockup;

        const onDownloadExport = async () => {
          if (socialSizes.size === 0) return;

          const presets = mockupDownloadSizes().filter(p => socialSizes.has(p.slug));

          // Any selected row that isn't free for this user requires Pro.
          const needsPro = presets.some(p =>
            p.slug === FULL_SIZE_SLUG ? !isFreeMockup(selectedMockup) : !isFreeSocialSize(p.slug),
          );
          if (needsPro && !proAllowed) {
            const allowed = await verifyProAccess();
            if (!allowed) { setIsUpgradeModalOpen(true); return; }
          }

          const templateSlug = mockupName?.toLowerCase().replace(/\s+/g, '-') || 'mockup';
          const baseName = sanitizeFilename(
            originalFilename ? `${originalFilename}-${templateSlug}` : `mockup-${templateSlug}`,
            'mockup',
          );

          downloadAfterRenderRef.current = async () => {
            try {
              const mockupCanvas = document.querySelector(
                '[data-mockup-modal] .mockup-canvas, [data-mockup-modal] canvas'
              ) as HTMLCanvasElement | null;
              if (!mockupCanvas) return;
              await downloadMockupSocialSizes(
                mockupCanvas,
                presets,
                { watermark, isPro: !!isPro, badgeEnabled, offsets: socialOffsets },
                baseName,
              );
            } finally {
              setIsCapturingFullRes(false);
            }
          };
          setIsCapturingFullRes(true);
        };

        return (
          <MockupModal
            isOpen={!!selectedMockup}
            onClose={() => {
              setSelectedMockup(null);
              setMockupColorOverride(null);
              setMockupScaleOverride(null);
              setSocialSizes(defaultDownloadSelection(proAllowed || isFreeMockup(selectedMockup!)));
              setSocialOffsets(allCenterOffsets());
              setActiveSlug(FULL_SIZE_SLUG);
              setMockupSnapshotUrl(null);
            }}
            title={mockupName}
            subtitle={`Based on ${effectiveTileWidth.toFixed(1)} × ${effectiveTileHeight.toFixed(1)} inch repeat`}
          >
            <MockupModalBody
              v2Template={v2Template}
              image={image}
              scale={{
                effectiveTileWidth,
                tileWidth,
                mockupScaleOverride,
                setMockupScaleOverride,
              }}
              showColor={selectedMockup === 'onesie' || selectedMockup === 'wrapping-paper' || !!v2Template?.colorOverlay}
              overlayLabel={v2Template?.colorOverlayLabel ?? (selectedMockup === 'wrapping-paper' ? 'Bow' : selectedMockup === 'onesie' ? 'Onesie Trim' : selectedMockup === 'curtain' ? 'Wall' : selectedMockup === 'picnic-blanket' ? 'Border' : 'Accent')}
              canToggleOverlay={!!v2Template?.colorOverlay}
              colorOverlayEnabled={colorOverlayEnabled}
              setColorOverlayEnabled={setColorOverlayEnabled}
              mockupColorOverride={mockupColorOverride}
              setMockupColorOverride={setMockupColorOverride}
              scheduleColorUpdate={scheduleColorUpdate}
              effectiveAutoColor={(v2Template?.colorOverlay?.defaultColor && v2Template.colorOverlay.defaultColor !== 'auto') ? v2Template.colorOverlay.defaultColor : (image ? extractDominantColor(image) : '#ffffff')}
              hasShadow={!!v2Template?.shadowPath}
              hasHighlight={!!v2Template?.highlightPath}
              shadowLabels={[v2Template?.shadowLabel ?? 'Shadow', ...(v2Template?.additionalShadowLabels ?? [])]}
              highlightLabels={[v2Template?.highlightLabel ?? 'Highlight', ...(v2Template?.additionalHighlightLabels ?? [])]}
              shadowEnableds={shadowEnableds}
              shadowOpacityPercents={shadowOpacityPercents}
              highlightEnableds={highlightEnableds}
              highlightOpacityPercents={highlightOpacityPercents}
              setShadowEnableds={setShadowEnableds}
              setShadowOpacityPercents={setShadowOpacityPercents}
              setHighlightEnableds={setHighlightEnableds}
              setHighlightOpacityPercents={setHighlightOpacityPercents}
              isPro={isPro}
              watermark={watermark}
              setWatermark={setWatermark}
              badgeEnabled={badgeEnabled}
              setBadgeEnabled={setBadgeEnabled}
              socialSizes={socialSizes}
              onToggleSize={handleToggleSocialSize}
              socialOffsets={socialOffsets}
              setSocialOffsets={setSocialOffsets}
              activeSlug={activeSlug}
              setActiveSlug={setActiveSlug}
              snapshotUrl={mockupSnapshotUrl}
              isLocked={(preset: SocialSizePreset) =>
                preset.slug === FULL_SIZE_SLUG
                  ? (!isPro && !isFreeMockup(selectedMockup))
                  : (!isPro && !isFreeSocialSize(preset.slug))
              }
              onLockedClick={handleDownloadMenuLockedClick}
              isBusy={isCapturingFullRes}
              onDownload={onDownloadExport}
              renderTileWidth={renderTileWidth}
              renderTileHeight={renderTileHeight}
              dpi={dpi}
              repeatType={repeatType}
              isCapturingFullRes={isCapturingFullRes}
              activePreset={activePreset}
              badgeVisible={shouldStampBadge({ isPaidPro: isPro, badgeEnabled })}
              onRenderComplete={() => {
                if (downloadAfterRenderRef.current) {
                  const cb = downloadAfterRenderRef.current;
                  downloadAfterRenderRef.current = null;
                  cb();
                }
                // Snapshot for the size-grid thumbnails only — throttled off the render hot path.
                if (!isCapturingFullRes) snapshotThrottleRef.current?.call();
              }}
            />
          </MockupModal>
        );
      })()}

      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        initialPlan={undefined}
        onClose={() => setIsUpgradeModalOpen(false)}
      />
    </>
  );
}
