'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { analyzeContrast, analyzeComposition, ContrastAnalysis, CompositionAnalysis } from '@/lib/analysis/patternAnalyzer';
import MockupRenderer from '@/components/mockups/MockupRenderer';
import MockupModal from '@/components/mockups/MockupModal';
import MockupGalleryModal from '@/components/mockups/MockupGalleryModal';
import EasyscaleExportModal from '@/components/export/EasyscaleExportModal';
import PatternAnalysisModal from '@/components/analysis/PatternAnalysisModal';
import UpgradeModal from '@/components/export/UpgradeModal';
import SeamInspector from '@/components/analysis/SeamInspector';
import { getMockupTemplate } from '@/lib/mockups/mockupTemplates';
import { checkClientProStatus } from '@/lib/utils/checkProStatus';
import { sanitizeFilename } from '@/lib/utils/sanitizeFilename';

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
  const [isEasyscaleModalOpen, setIsEasyscaleModalOpen] = useState(false);
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
  const [isSeamInspectorOpen, setIsSeamInspectorOpen] = useState(false);
  const [isMockupGalleryOpen, setIsMockupGalleryOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [upgradePlan, setUpgradePlan] = useState<'monthly' | 'yearly' | undefined>(undefined);
  const [tileCanvas, setTileCanvas] = useState<HTMLCanvasElement | null>(null);
  const isPro = isSignedIn && user ? checkClientProStatus(user.publicMetadata) : false;
  const [proAccess, setProAccess] = useState<'unknown' | 'allowed' | 'denied'>('unknown');
  const proAllowed = isPro || proAccess === 'allowed';

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
          onClick={() => setIsSeamInspectorOpen(true)}
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

      {/* Seam Inspector Modal */}
      <SeamInspector
        image={image}
        isOpen={isSeamInspectorOpen}
        onClose={() => setIsSeamInspectorOpen(false)}
        repeatType={repeatType}
        seamLineColor={tileOutlineColor}
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
          }}
          title={getMockupTemplate(selectedMockup as any)?.name}
          subtitle={`Based on ${tileWidth.toFixed(1)} \u00d7 ${tileHeight.toFixed(1)} inch repeat`}
          onDownload={async () => {
            const allowed = await verifyProAccess();
            if (!allowed) {
              setIsUpgradeModalOpen(true);
              return;
            }

            const mockupCanvas = document.querySelector(
              '[data-mockup-modal] .mockup-canvas'
            ) as HTMLCanvasElement | null;
            if (mockupCanvas) {
              const dataURL = mockupCanvas.toDataURL('image/png', 1.0);
              const link = document.createElement('a');
              const template = getMockupTemplate(selectedMockup as any);
              const templateSlug =
                template?.name?.toLowerCase().replace(/\s+/g, '-') || 'mockup';
              const baseName = originalFilename
                ? `${originalFilename}-${templateSlug}`
                : `mockup-${templateSlug}`;
              const suggested = sanitizeFilename(baseName, 'mockup');
              const userInput = window.prompt('Name your mockup file:', suggested);
              if (!userInput) return;
              link.download = `${sanitizeFilename(userInput, 'mockup')}.png`;
              link.href = dataURL;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }
          }}
        >
          <div className="flex flex-col gap-3">
            {/* Color picker for onesie and wrapping paper bow */}
            {(selectedMockup === 'onesie' || selectedMockup === 'wrapping-paper') && (
              <div className="flex items-center justify-center gap-2 p-2 bg-[#ffe4e7] rounded-md">
                <label className="text-xs font-medium text-[#294051]">
                  {selectedMockup === 'wrapping-paper' ? 'Bow Color:' : 'Onesie Trim Color:'}
                </label>
                <input
                  type="color"
                  value={mockupColorOverride || '#ffffff'}
                  onChange={(e) => setMockupColorOverride(e.target.value)}
                  className="w-10 h-8 rounded border border-[#92afa5]/30 cursor-pointer"
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
            )}

            {/* Mockup preview */}
            <div className="flex items-center justify-center bg-white rounded-lg p-4">
              <div className="w-full max-w-2xl">
                <MockupRenderer
                  template={getMockupTemplate(selectedMockup as any)}
                  patternImage={image}
                  tileWidth={tileWidth}
                  tileHeight={tileHeight}
                  dpi={dpi}
                  repeatType={repeatType}
                  zoom={zoom}
                  scaleFactor={scaleFactor}
                  scalePreviewActive={scalePreviewActive}
                  onClick={() => {}}
                  colorOverride={mockupColorOverride}
                />
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
