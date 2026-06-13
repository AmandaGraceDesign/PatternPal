'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { analyzeContrast, analyzeComposition, ContrastAnalysis, CompositionAnalysis } from '@/lib/analysis/patternAnalyzer';
import MockupRendererV2, { preloadTemplateImages } from '@/components/mockups/MockupRendererV2';
import MockupCropStage from '@/components/mockups/MockupCropStage';
import MockupModal from '@/components/mockups/MockupModal';
import MockupGalleryModal from '@/components/mockups/MockupGalleryModal';
import EasyscaleExportModal from '@/components/export/EasyscaleExportModal';
import PatternAnalysisModal from '@/components/analysis/PatternAnalysisModal';
import UpgradeModal from '@/components/export/UpgradeModal';
import { openSeamInspector } from '@/lib/seam-inspector/openSeamInspector';
import { getV2Template } from '@/lib/mockups/mockupEngineV2/templates/templateRegistry';
import { extractDominantColor } from '@/lib/mockups/mockupEngineV2/MockupPipeline';
import { checkClientProStatus } from '@/lib/utils/checkProStatus';
import { sanitizeFilename } from '@/lib/utils/sanitizeFilename';
import { isFreeMockup, isFreeSocialSize } from '@/lib/mockups/freeTier';
import { mockupDownloadSizes, FULL_SIZE_SLUG, FULL_SIZE_PRESET, SOCIAL_SIZE_PRESETS, type SizeSlug, type SocialSizePreset } from '@/lib/export/socialSizes';
import { createTrailingThrottle } from '@/lib/utils/trailingThrottle';
import { downloadMockupSocialSizes } from '@/lib/utils/mockupSocialExport';
import MockupDownloadMenu from '@/components/mockups/MockupDownloadMenu';
import { WatermarkConfig, DEFAULT_WATERMARK } from '@/lib/watermark/watermark';
import WatermarkPanel from '@/components/watermark/WatermarkPanel';
import PatternpalBadgeToggle from '@/components/badge/PatternpalBadgeToggle';
import { shouldStampBadge } from '@/lib/badge/patternpalBadge';

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

interface ActionsSidebarProps {
  image: HTMLImageElement | null;
  dpi: number;
  tileWidth: number;
  tileHeight: number;
  repeatType: 'full-drop' | 'half-drop' | 'half-brick';
  zoom: number;
  originalFilename: string | null;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  scaleFactor?: number;
  scalePreviewActive?: boolean;
  tileOutlineColor?: string;
}

export default function ActionsSidebar({ image, dpi, tileWidth, tileHeight, repeatType, zoom, originalFilename, canvasRef, scaleFactor = 1, scalePreviewActive = false, tileOutlineColor = '#38bdf8' }: ActionsSidebarProps) {
  const { user, isSignedIn } = useUser();
  const [contrastAnalysis, setContrastAnalysis] = useState<ContrastAnalysis | null>(null);
  const [compositionAnalysis, setCompositionAnalysis] = useState<CompositionAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedMockup, setSelectedMockup] = useState<string | null>(null);
  const [mockupColorOverride, setMockupColorOverride] = useState<string | null>(null);
  // Per-layer arrays: index 0 is the PRIMARY shadow/highlight, indices 1+ are
  // template.additionalShadowPaths / additionalHighlightPaths (e.g. tie + jacket).
  const [shadowEnableds, setShadowEnableds] = useState<boolean[]>([true]);
  const [shadowOpacityPercents, setShadowOpacityPercents] = useState<number[]>([30]);
  const [highlightEnableds, setHighlightEnableds] = useState<boolean[]>([true]);
  const [highlightOpacityPercents, setHighlightOpacityPercents] = useState<number[]>([30]);
  const [colorOverlayEnabled, setColorOverlayEnabled] = useState(true);
  const [watermark, setWatermark] = useState<WatermarkConfig>({ ...DEFAULT_WATERMARK });
  const [badgeEnabled, setBadgeEnabled] = useState(true);
  const [isCapturingFullRes, setIsCapturingFullRes] = useState(false);
  const downloadAfterRenderRef = useRef<(() => void) | null>(null);
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
  const [isEasyscaleModalOpen, setIsEasyscaleModalOpen] = useState(false);
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
  const [isMockupGalleryOpen, setIsMockupGalleryOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [upgradePlan, setUpgradePlan] = useState<'monthly' | 'yearly' | undefined>(undefined);
  const [tileCanvas, setTileCanvas] = useState<HTMLCanvasElement | null>(null);
  const isPro = isSignedIn && user ? checkClientProStatus(user.publicMetadata) : false;
  const [proAccess, setProAccess] = useState<'unknown' | 'allowed' | 'denied'>('unknown');
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

  const handleManageSubscription = async () => {
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Failed to open customer portal', error);
    }
  };

  // When the selected mockup changes, resize the per-layer arrays to match the
  // template's shadow/highlight layer count (primary + additionals) and reset
  // all toggles/opacities to their defaults.
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
    // Primary shadow/highlight default on; additionals honor template defaults
    // (missing entries → true).
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
  // onChange many times per second while the user drags inside the picker;
  // each setState kicks off a full 3000×4500 pipeline render. Without this,
  // the queue grows faster than renders complete and the UI feels stuck.
  // Coalescing to one setState per animation frame caps render rate at ~60fps
  // and matches the drag-throttle pattern in MockupRendererV2.
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

  // Create canvas from image for seam analysis
  useEffect(() => {
    if (!image) {
      setTileCanvas(null);
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.drawImage(image, 0, 0);
      setTileCanvas(canvas);
    }
  }, [image]);

  useEffect(() => {
    if (!isSignedIn) {
      setProAccess('denied');
      return;
    }
    verifyProAccess();
  }, [isSignedIn, user?.id]);

  useEffect(() => {
    const handler = (event: Event) => {
      if (!isSignedIn) return;
      const detail = (event as CustomEvent<{ plan?: 'monthly' | 'yearly' }>).detail;
      setUpgradePlan(detail?.plan === 'yearly' ? 'yearly' : 'monthly');
      setIsUpgradeModalOpen(true);
    };

    window.addEventListener('pp:resume-upgrade', handler as EventListener);
    return () => {
      window.removeEventListener('pp:resume-upgrade', handler as EventListener);
    };
  }, [isSignedIn]);

  useEffect(() => {
    if (!image) {
      setContrastAnalysis(null);
      setCompositionAnalysis(null);
      return;
    }

    if (!proAllowed) {
      setContrastAnalysis(null);
      setCompositionAnalysis(null);
      return;
    }

    setIsAnalyzing(true);

    try {
      const contrast = analyzeContrast(image, 'unspecified');
      const composition = analyzeComposition(image, 'unspecified');

      setContrastAnalysis(contrast);
      setCompositionAnalysis(composition);
    } catch (error) {
      console.error('Error analyzing pattern:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [image, dpi, tileWidth, tileHeight, proAllowed]);

  // Unified mockup download handler. Lifted to component scope so the shared
  // <MockupDownloadMenu> can receive it as a prop. Captures the live preview at
  // full res, then exports every selected size with its per-size crop anchor.
  const onDownloadExport = async () => {
    if (!selectedMockup || socialSizes.size === 0) return;
    const mockupId = selectedMockup;

    const presets = mockupDownloadSizes().filter(p => socialSizes.has(p.slug));

    // Any selected row that isn't free for this user requires Pro.
    const needsPro = presets.some(p =>
      p.slug === FULL_SIZE_SLUG ? !isFreeMockup(mockupId) : !isFreeSocialSize(p.slug),
    );
    if (needsPro && !proAllowed) {
      const allowed = await verifyProAccess();
      if (!allowed) { setIsUpgradeModalOpen(true); return; }
    }

    const template = getV2Template(mockupId);
    const templateSlug = template?.name?.toLowerCase().replace(/\s+/g, '-') || 'mockup';
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

  // Tool button component for consistent styling
  const ToolButton = ({ onClick, disabled, icon, label, description, proOnly }: {
    onClick: () => void;
    disabled?: boolean;
    icon: React.ReactNode;
    label: string;
    description: string;
    proOnly?: boolean;
  }) => (
    <button
      onClick={proOnly && !proAllowed ? () => setIsUpgradeModalOpen(true) : onClick}
      disabled={disabled}
      className="w-full flex items-center gap-3 px-4 py-3 text-left rounded-lg border border-[#e5e7eb] hover:border-[#e0c26e] hover:bg-[#fdf8ec] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-[#e5e7eb] disabled:hover:bg-transparent group"
    >
      <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-[#e0c26e] flex items-center justify-center text-white">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[#294051]">{label}</span>
          {proOnly && !proAllowed && (
            <span className="text-[10px] font-medium bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">PRO</span>
          )}
        </div>
        <span className="text-xs text-[#6b7280]">{description}</span>
      </div>
      <svg className="w-4 h-4 text-gray-400 group-hover:text-[#e0c26e] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );

  return (
    <div className="bg-white p-4">
      <div className="space-y-2">
        {/* Easyscale Export */}
        <ToolButton
          onClick={() => setIsEasyscaleModalOpen(true)}
          disabled={!image}
          label="Easyscale Export"
          description="Export pattern at multiple sizes"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          }
        />

        {/* Pattern Analysis */}
        <ToolButton
          onClick={() => setIsAnalysisModalOpen(true)}
          disabled={!image}
          proOnly
          label="Pattern Analysis"
          description="Contrast & composition insights"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
        />

        {/* Seam Analyzer */}
        <ToolButton
          onClick={() => openSeamInspector({
            image: image!,
            repeatType,
            dpi,
            filename: originalFilename,
            outlineColor: tileOutlineColor,
          })}
          disabled={!image}
          proOnly
          label="Seam Analyzer"
          description="Inspect pattern seam alignment"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          }
        />

        {/* Mockups — always opens gallery (free users see upgrade overlay inside) */}
        <ToolButton
          onClick={() => setIsMockupGalleryOpen(true)}
          disabled={!image}
          label="Mockups"
          description="Preview on products & download"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
        />
      </div>

      {/* ===== MODALS ===== */}

      {/* Easyscale Export Modal */}
      {isEasyscaleModalOpen && (
        <EasyscaleExportModal
          isOpen={isEasyscaleModalOpen}
          onClose={() => setIsEasyscaleModalOpen(false)}
          image={image}
          currentDPI={dpi}
          repeatType={repeatType}
          originalFilename={originalFilename}
          isPro={proAllowed}
        />
      )}

      {/* Pattern Analysis Modal */}
      <PatternAnalysisModal
        isOpen={isAnalysisModalOpen}
        onClose={() => setIsAnalysisModalOpen(false)}
        image={image}
        contrastAnalysis={contrastAnalysis}
        compositionAnalysis={compositionAnalysis}
        isAnalyzing={isAnalyzing}
        isPro={proAllowed}
        onUpgrade={() => setIsUpgradeModalOpen(true)}
      />

      {/* Mockup Gallery Modal */}
      <MockupGalleryModal
        isOpen={isMockupGalleryOpen}
        onClose={() => setIsMockupGalleryOpen(false)}
        onSelectMockup={(type) => {
          setSelectedMockup(type);
          setIsMockupGalleryOpen(false);
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

      {/* Individual Mockup Modal (opens from gallery) */}
      {selectedMockup && (
        <MockupModal
          isOpen={!!selectedMockup}
          onClose={() => {
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
          title={getV2Template(selectedMockup)?.name}
          subtitle={`Based on ${tileWidth.toFixed(1)} \u00d7 ${tileHeight.toFixed(1)} inch repeat`}
        >
          <div className="flex flex-col gap-3">
            {/* Color picker for any mockup with a color overlay region */}
            {(selectedMockup === 'onesie' || selectedMockup === 'wrapping-paper' || !!getV2Template(selectedMockup)?.colorOverlay) && (() => {
              const v2 = getV2Template(selectedMockup);
              const defaultColor = v2?.colorOverlay?.defaultColor;
              const effectiveAuto = (defaultColor && defaultColor !== 'auto')
                ? defaultColor
                : (image ? extractDominantColor(image) : '#ffffff');
              const overlayLabel = v2?.colorOverlayLabel
                ?? (selectedMockup === 'wrapping-paper' ? 'Bow Color'
                  : selectedMockup === 'onesie' ? 'Onesie Trim Color'
                  : selectedMockup === 'curtain' ? 'Wall Color'
                  : selectedMockup === 'picnic-blanket' ? 'Border Color'
                  : 'Accent Color');
              // V2 templates may have colorOverlay; allow toggling it off entirely.
              const canToggle = !!v2?.colorOverlay;
              return (
              <div className="flex items-center justify-center gap-2 p-2 bg-[#ffe4e7] rounded-md">
                {canToggle && (
                  <input
                    type="checkbox"
                    checked={colorOverlayEnabled}
                    onChange={(e) => setColorOverlayEnabled(e.target.checked)}
                    className="cursor-pointer"
                    aria-label={`Enable ${overlayLabel}`}
                  />
                )}
                <label className="text-xs font-medium text-[#294051]">
                  {overlayLabel}:
                </label>
                <input
                  type="color"
                  value={mockupColorOverride || effectiveAuto}
                  onChange={(e) => scheduleColorUpdate(e.target.value)}
                  disabled={canToggle && !colorOverlayEnabled}
                  className="w-10 h-8 rounded border border-[#92afa5]/30 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                />
                {mockupColorOverride && (
                  <button
                    onClick={() => setMockupColorOverride(null)}
                    className="text-xs text-[#705046] hover:text-[#294051] underline"
                  >
                    Reset to auto
                  </button>
                )}
              </div>
              );
            })()}

            {/* Shadow / Highlight opacity controls (only for templates with those layers).
                Renders one row per shadow/highlight layer the template defines — so multi-region
                templates like mens-tie expose independent "Tie shadow" / "Jacket shadow" controls. */}
            {(() => {
              const v2Tmpl = getV2Template(selectedMockup);
              const hasShadow = !!v2Tmpl?.shadowPath;
              const hasHighlight = !!v2Tmpl?.highlightPath;
              if (!hasShadow && !hasHighlight) return null;
              const shadowLabels = [
                v2Tmpl?.shadowLabel ?? 'Shadow',
                ...(v2Tmpl?.additionalShadowLabels ?? []),
              ];
              const highlightLabels = [
                v2Tmpl?.highlightLabel ?? 'Highlight',
                ...(v2Tmpl?.additionalHighlightLabels ?? []),
              ];
              const setShadowAt = (i: number, enabled: boolean) => {
                setShadowEnableds(prev => prev.map((v, idx) => (idx === i ? enabled : v)));
              };
              const setShadowOpAt = (i: number, percent: number) => {
                setShadowOpacityPercents(prev => prev.map((v, idx) => (idx === i ? percent : v)));
              };
              const setHighlightAt = (i: number, enabled: boolean) => {
                setHighlightEnableds(prev => prev.map((v, idx) => (idx === i ? enabled : v)));
              };
              const setHighlightOpAt = (i: number, percent: number) => {
                setHighlightOpacityPercents(prev => prev.map((v, idx) => (idx === i ? percent : v)));
              };
              return (
                <div className="flex flex-wrap items-center justify-center gap-5 p-2 bg-[#f1efeb] rounded-md text-xs text-[#294051]">
                  {hasShadow && shadowEnableds.map((enabled, i) => (
                    // Outer wrapper is a div, NOT a label — wrapping the number
                    // input in a label causes clicks/typing on the number to
                    // toggle the checkbox (label's labelable-control behavior).
                    <div key={`shadow-${i}`} className="flex items-center gap-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={(e) => setShadowAt(i, e.target.checked)}
                          className="cursor-pointer"
                        />
                        <span className="font-medium">{shadowLabels[i] ?? 'Shadow'}</span>
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={shadowOpacityPercents[i] ?? 30}
                        disabled={!enabled}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          if (Number.isFinite(n)) setShadowOpAt(i, Math.max(0, Math.min(100, Math.round(n))));
                        }}
                        className="w-14 h-7 px-1 rounded border border-[#92afa5]/40 bg-white text-center tabular-nums disabled:opacity-40 disabled:cursor-not-allowed"
                      />
                      <span className="opacity-60">%</span>
                    </div>
                  ))}
                  {hasHighlight && highlightEnableds.map((enabled, i) => (
                    <div key={`highlight-${i}`} className="flex items-center gap-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={(e) => setHighlightAt(i, e.target.checked)}
                          className="cursor-pointer"
                        />
                        <span className="font-medium">{highlightLabels[i] ?? 'Highlight'}</span>
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={highlightOpacityPercents[i] ?? 30}
                        disabled={!enabled}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          if (Number.isFinite(n)) setHighlightOpAt(i, Math.max(0, Math.min(100, Math.round(n))));
                        }}
                        className="w-14 h-7 px-1 rounded border border-[#92afa5]/40 bg-white text-center tabular-nums disabled:opacity-40 disabled:cursor-not-allowed"
                      />
                      <span className="opacity-60">%</span>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Watermark (text + logo) — same UX as social export */}
            <WatermarkPanel watermark={watermark} setWatermark={setWatermark} />

            {/* PatternPAL badge */}
            <PatternpalBadgeToggle
              enabled={badgeEnabled}
              onChange={setBadgeEnabled}
              locked={!isPro}
            />

            {/* Unified download menu — Full size first, then social sizes */}
            <MockupDownloadMenu
              selected={socialSizes}
              onToggleSize={handleToggleSocialSize}
              offsets={socialOffsets}
              activeSlug={activeSlug}
              onSetActive={setActiveSlug}
              snapshotUrl={mockupSnapshotUrl}
              isLocked={(preset: SocialSizePreset) =>
                preset.slug === FULL_SIZE_SLUG
                  ? (!isPro && !isFreeMockup(selectedMockup))
                  : (!isPro && !isFreeSocialSize(preset.slug))
              }
              onLockedClick={handleDownloadMenuLockedClick}
              isBusy={isCapturingFullRes}
              onDownload={onDownloadExport}
            />

            {/* Live mockup preview. The MockupRendererV2 canvas is the visible
                preview; MockupCropStage overlays it to frame the active size and
                also doubles as the snapshot source for the size-grid thumbnails
                (read via the [data-mockup-modal] canvas selector). */}
            <div className="bg-white w-full flex justify-center">
              {/* Definite wrapper width keeps the modal sized predictably even
                  before the canvas mounts (otherwise the whole modal collapses).
                  `flex justify-center` centers the canvas horizontally when
                  fitContainer shrinks it below 600px wide (e.g. tall 2:3 mockup
                  capped by 60vh height). */}
              <div className="w-[600px] max-w-full relative flex justify-center">
                {(() => {
                  const v2Tmpl = getV2Template(selectedMockup);
                  if (!v2Tmpl) return null;
                  return (
                    /* Tight wrapper that shrinks to the rendered mockup canvas
                       (NOT the 600px outer box). It mirrors the canvas's own CSS
                       sizing — aspect-ratio + 60vh height cap — so its width
                       equals the visible canvas width. `containerType:
                       inline-size` makes the overlays' `cqw` units reference the
                       canvas, putting the bottom-left badge over the product
                       image exactly where the export stamps it. */
                    <div
                      className="relative"
                      style={{
                        // WIDTH-DRIVEN, non-collapsing sizing. `width` is the
                        // smaller of (a) the full 600px box width — `100%` — and
                        // (b) the width that would make this 2:3 portrait box
                        // exactly 60vh tall: `60vh * W / H`. Both are DEFINITE
                        // lengths, so the wrapper can never collapse to 0 the way
                        // a bare aspect-ratio + maxHeight box did (that had no
                        // definite main-axis size, so width:100% on the canvas
                        // resolved against a 0-width parent). `aspectRatio` then
                        // sets the height, and the canvas (width:100%) fills this
                        // box exactly — so `containerType: inline-size` makes the
                        // overlay `cqw` units reference the REAL canvas width and
                        // the badge lands on the canvas's bottom-left, not the
                        // 600px box's margin.
                        width: `min(100%, calc(60vh * ${v2Tmpl.canvasSize.width} / ${v2Tmpl.canvasSize.height}))`,
                        aspectRatio: `${v2Tmpl.canvasSize.width} / ${v2Tmpl.canvasSize.height}`,
                        containerType: 'inline-size',
                      }}
                    >
                      <MockupRendererV2
                      template={v2Tmpl}
                      patternImage={image}
                      tileWidth={tileWidth}
                      tileHeight={tileHeight}
                      dpi={dpi}
                      repeatType={repeatType}
                      onClick={() => {}}
                      colorOverride={mockupColorOverride}
                      shadowEnabled={shadowEnableds[0] ?? true}
                      shadowOpacityOverride={(shadowOpacityPercents[0] ?? 30) / 100}
                      highlightEnabled={highlightEnableds[0] ?? true}
                      highlightOpacityOverride={(highlightOpacityPercents[0] ?? 30) / 100}
                      additionalShadowEnableds={shadowEnableds.slice(1)}
                      additionalShadowOpacityOverrides={shadowOpacityPercents.slice(1).map(p => p / 100)}
                      additionalHighlightEnableds={highlightEnableds.slice(1)}
                      additionalHighlightOpacityOverrides={highlightOpacityPercents.slice(1).map(p => p / 100)}
                      colorOverlayEnabled={colorOverlayEnabled}
                      dragEnabled
                      fitContainer
                      maxRenderDimension={isCapturingFullRes ? undefined : 1500}
                      preview={!isCapturingFullRes}
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
                      <MockupCropStage
                        preset={activePreset}
                        offset={socialOffsets[activeSlug] ?? 0.5}
                        onChangeOffset={next => setSocialOffsets(prev => ({ ...prev, [activeSlug]: next }))}
                        isBusy={isCapturingFullRes}
                        watermark={watermark}
                        badgeVisible={shouldStampBadge({ isPaidPro: isPro, badgeEnabled })}
                      />
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </MockupModal>
      )}

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        initialPlan={upgradePlan}
        onClose={() => setIsUpgradeModalOpen(false)}
      />
    </div>
  );
}
