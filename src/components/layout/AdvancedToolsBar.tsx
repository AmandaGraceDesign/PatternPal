'use client';

import { useState, Suspense } from 'react';
import QuickExportModal from '@/components/export/QuickExportModal';
import EasyscaleExportModal from '@/components/export/EasyscaleExportModal';
import PatternAnalysisModal from '@/components/analysis/PatternAnalysisModal';
import SeamInspector from '@/components/analysis/SeamInspector';
import MockupGalleryModal from '@/components/mockups/MockupGalleryModal';
import MockupModal from '@/components/mockups/MockupModal';
import MockupRenderer from '@/components/mockups/MockupRenderer';
import UpgradeModal from '@/components/export/UpgradeModal';
import { getMockupTemplate } from '@/lib/mockups/mockupTemplates';
import { sanitizeFilename } from '@/lib/utils/sanitizeFilename';
import { analyzeContrast, analyzeComposition, analyzeColorHarmony, ContrastAnalysis, CompositionAnalysis, ColorHarmonyAnalysis } from '@/lib/analysis/patternAnalyzer';
import { useUser } from '@clerk/nextjs';
import { checkClientProStatus } from '@/lib/utils/checkProStatus';
import { useEffect } from 'react';

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
  onClick: () => void;
  disabled?: boolean;
}

function ToolCard({ icon, title, description, isFree = false, isPro = false, onClick, disabled = false }: ToolCardProps) {
  const showBadge = !isPro; // Hide badge if user is Pro

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`group relative flex items-center gap-2 md:gap-3 min-w-[160px] md:min-w-[200px] px-3 md:px-5 py-3 md:py-4 rounded-lg border-2 transition-all duration-200 ${
        isFree
          ? 'border-[#4caf50] hover:shadow-[0_4px_16px_rgba(76,175,80,0.3)] hover:-translate-y-0.5'
          : 'border-[#3a3a3a] hover:border-[#fbbf24] hover:shadow-[0_4px_16px_rgba(251,191,36,0.2)] hover:-translate-y-0.5'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} bg-[#2a2a2a] hover:bg-[#333]`}
    >
      {/* Icon Circle */}
      <div
        className={`flex-shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center text-lg md:text-xl ${
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

      {/* Badge - only show if user is not Pro */}
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
  const [isQuickExportOpen, setIsQuickExportOpen] = useState(false);
  const [isEasyscaleOpen, setIsEasyscaleOpen] = useState(false);
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);
  const [isSeamOpen, setIsSeamOpen] = useState(false);
  const [isMockupsOpen, setIsMockupsOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [selectedMockup, setSelectedMockup] = useState<string | null>(null);
  const [mockupColorOverride, setMockupColorOverride] = useState<string | null>(null);
  const [contrastAnalysis, setContrastAnalysis] = useState<ContrastAnalysis | null>(null);
  const [compositionAnalysis, setCompositionAnalysis] = useState<CompositionAnalysis | null>(null);
  const [colorHarmonyAnalysis, setColorHarmonyAnalysis] = useState<ColorHarmonyAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [proAccess, setProAccess] = useState<'unknown' | 'allowed' | 'denied'>('unknown');

  const isPro = isSignedIn && user ? checkClientProStatus(user.publicMetadata) : false;
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
      <div className="w-full bg-[#1a1a1a] px-4 py-4 border-b border-black/50 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <style jsx>{`
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
        `}</style>
        <div className="flex gap-3 md:gap-4 justify-center items-center min-w-max mx-auto">
          {/* Card 1: Quick Export (FREE) - Only show for non-Pro users */}
          {!proAllowed && (
            <ToolCard
              icon="📦"
              title="Quick Export"
              description="2 sizes • JPG only"
              isFree
              isPro={proAllowed}
              onClick={() => setIsQuickExportOpen(true)}
              disabled={!image}
            />
          )}

          {/* Card 2: Easyscale Export (PRO) */}
          <ToolCard
            icon="📦"
            title="Easyscale Export"
            description="8 sizes in one click"
            isPro={proAllowed}
            onClick={() => handleProToolClick(() => setIsEasyscaleOpen(true))}
            disabled={!image}
          />

          {/* Card 3: Pattern Analysis (PRO) */}
          <ToolCard
            icon="📊"
            title="Pattern Analysis"
            description="Contrast & composition insights"
            isPro={proAllowed}
            onClick={() => handleProToolClick(() => setIsAnalysisOpen(true))}
            disabled={!image}
          />

          {/* Card 4: Seam Analyzer (PRO) */}
          <ToolCard
            icon="🔍"
            title="Seam Analyzer"
            description="Inspect pattern seam alignment"
            isPro={proAllowed}
            onClick={() => handleProToolClick(() => setIsSeamOpen(true))}
            disabled={!image}
          />

          {/* Card 5: Mockups (PRO) */}
          <ToolCard
            icon="🎨"
            title="Mockups"
            description="Preview on products & download"
            isPro={proAllowed}
            onClick={() => handleProToolClick(() => setIsMockupsOpen(true))}
            disabled={!image}
          />
        </div>
      </div>

      {/* Modals */}
      <QuickExportModal
        isOpen={isQuickExportOpen}
        onClose={() => setIsQuickExportOpen(false)}
        image={image}
        currentDPI={dpi}
        repeatType={repeatType}
        originalFilename={originalFilename}
        onUpgrade={() => setIsUpgradeModalOpen(true)}
      />

      <EasyscaleExportModal
        isOpen={isEasyscaleOpen}
        onClose={() => setIsEasyscaleOpen(false)}
        image={image}
        currentDPI={dpi}
        repeatType={repeatType}
        originalFilename={originalFilename}
        isPro={proAllowed}
      />

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

      <SeamInspector
        image={image}
        isOpen={isSeamOpen}
        onClose={() => setIsSeamOpen(false)}
        repeatType={repeatType}
        seamLineColor={tileOutlineColor}
      />

      <MockupGalleryModal
        isOpen={isMockupsOpen}
        onClose={() => {
          setIsMockupsOpen(false);
          setSelectedMockup(null);
          setMockupColorOverride(null);
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

      {selectedMockup && (
        <MockupModal
          isOpen={!!selectedMockup}
          onClose={() => {
            setSelectedMockup(null);
            setMockupColorOverride(null);
          }}
          title={getMockupTemplate(selectedMockup as any)?.name}
          subtitle={`Based on ${tileWidth.toFixed(1)} × ${tileHeight.toFixed(1)} inch repeat`}
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

      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        initialPlan={undefined}
        onClose={() => setIsUpgradeModalOpen(false)}
      />
    </>
  );
}
