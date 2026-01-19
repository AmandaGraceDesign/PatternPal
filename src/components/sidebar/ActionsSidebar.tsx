'use client';

import { useEffect, useState } from 'react';
import { analyzeContrast, analyzeDensity, ContrastAnalysis, DensityAnalysis } from '@/lib/analysis/patternAnalyzer';
import MockupRenderer from '@/components/mockups/MockupRenderer';
import MockupModal from '@/components/mockups/MockupModal';
import EasyscaleExportModal from '@/components/export/EasyscaleExportModal';
import SeamAnalyzer from '@/components/analysis/SeamAnalyzer';
import { getMockupTemplate, getAllMockupTypes } from '@/lib/mockups/mockupTemplates';

interface ActionsSidebarProps {
  image: HTMLImageElement | null;
  dpi: number;
  tileWidth: number;
  tileHeight: number;
  repeatType: 'full-drop' | 'half-drop' | 'half-brick';
  zoom: number;
  originalFilename: string | null;
  canvasRef: React.RefObject<HTMLCanvasElement>;
}

export default function ActionsSidebar({ image, dpi, tileWidth, tileHeight, repeatType, zoom, originalFilename, canvasRef }: ActionsSidebarProps) {
  const [contrastAnalysis, setContrastAnalysis] = useState<ContrastAnalysis | null>(null);
  const [densityAnalysis, setDensityAnalysis] = useState<DensityAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedMockup, setSelectedMockup] = useState<string | null>(null);
  const [isEasyscaleModalOpen, setIsEasyscaleModalOpen] = useState(false);
  const [tileCanvas, setTileCanvas] = useState<HTMLCanvasElement | null>(null);
  const [isPro] = useState(true); // TODO: Replace with actual Pro subscription check - TEMPORARILY TRUE FOR TESTING

  // Create canvas from image for seam analysis
  useEffect(() => {
    if (!image) {
      setTileCanvas(null);
      return;
    }

    // Create a canvas with the exact image dimensions (NO DPR scaling)
    const canvas = document.createElement('canvas');
    // CRITICAL: Use naturalWidth/naturalHeight, NOT width/height (avoids DPR scaling)
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      // Draw at 1:1 scale (no width/height params = no scaling)
      ctx.drawImage(image, 0, 0);
      
      // CRITICAL DEBUG: Verify canvas matches image dimensions
      console.log('🔍 Analysis canvas creation:', {
        imageNaturalWidth: image.naturalWidth,
        imageNaturalHeight: image.naturalHeight,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        imageDisplayWidth: image.width,
        imageDisplayHeight: image.height,
        match: canvas.width === image.naturalWidth && canvas.height === image.naturalHeight,
        warning: canvas.width !== image.naturalWidth ? '❌ DIMENSION MISMATCH - Analysis will be wrong!' : '✅ Dimensions match'
      });
      
      setTileCanvas(canvas);
    }
  }, [image]);

  useEffect(() => {
    if (!image) {
      setContrastAnalysis(null);
      setDensityAnalysis(null);
      return;
    }

    setIsAnalyzing(true);
    
    // Run analyses
    try {
      const contrast = analyzeContrast(image, 'unspecified');
      let density = analyzeDensity(image, dpi, tileWidth, tileHeight);
      
      // Add combined risk note if heavy coverage + very low contrast + high detail
      if (
        density.coverageBand === 'heavy' &&
        contrast.band === 'very_low' &&
        contrast.highDetail
      ) {
        density = {
          ...density,
          combinedNote: 'High coverage + very low contrast + fine detail may result in a muddy print where motifs blur together. Consider either opening up spacing or increasing contrast slightly if you want more clarity.',
        };
      }
      
      setContrastAnalysis(contrast);
      setDensityAnalysis(density);
    } catch (error) {
      console.error('Error analyzing pattern:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [image, dpi, tileWidth, tileHeight]);
  return (
    <aside className="w-72 bg-white border-l border-[#e5e7eb] p-6 overflow-y-auto">
      {/* Export Section */}
      <div className="mb-8">
        <div className="bg-[#f5f5f5] px-4 py-2.5 rounded-lg mb-4">
          <h2 className="text-xs font-bold text-[#294051] uppercase tracking-wider">
            Export
          </h2>
        </div>
        <div className="space-y-2">
          <button 
            onClick={() => setIsEasyscaleModalOpen(true)}
            disabled={!image}
            className="w-full px-4 py-2.5 text-xs font-semibold text-white rounded-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
            Easyscale Export
          </button>
          
        </div>
      </div>

      {/* Analysis Section */}
      <div className="mb-8">
        <div className="bg-[#f5f5f5] px-4 py-2.5 rounded-lg mb-4">
          <h2 className="text-xs font-bold text-[#294051] uppercase tracking-wider">
            Analysis
          </h2>
        </div>
        
        {!image && (
          <div className="text-xs text-[#6b7280] text-center py-4">
            Upload a pattern tile to see analysis
          </div>
        )}
        
        {isAnalyzing && (
          <div className="text-xs text-[#6b7280] text-center py-4">
            Analyzing...
          </div>
        )}
        
        {image && !isAnalyzing && (
          <div className="space-y-4">
            {/* Contrast Analysis */}
            {contrastAnalysis && (
              <div className="p-3 bg-white border border-[#e5e7eb] rounded-md">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-[#294051]">
                    {contrastAnalysis.label}
                  </span>
                  <span className={`px-2 py-0.5 text-[10px] font-medium rounded uppercase ${
                    contrastAnalysis.severity === 'none' ? 'bg-emerald-100 text-emerald-700' :
                    contrastAnalysis.severity === 'info' ? 'bg-blue-100 text-blue-700' :
                    'bg-orange-100 text-orange-700'
                  }`}>
                    {contrastAnalysis.band.toUpperCase().replace('_', ' ')}
                  </span>
                </div>
                <div className="text-xs text-[#374151] mb-2">
                  Global contrast: {(contrastAnalysis.globalContrast * 100).toFixed(0)}%
                </div>
                <p className="text-sm text-[#374151] leading-relaxed">
                  {contrastAnalysis.message}
                </p>
              </div>
            )}
            
            {/* Density Analysis */}
            {densityAnalysis && (
              <div className="p-3 bg-white border border-[#e5e7eb] rounded-md">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-[#294051]">
                    {densityAnalysis.label}
                  </span>
                  <span className={`px-2 py-0.5 text-[10px] font-medium rounded uppercase ${
                    densityAnalysis.coverageBand === 'light' ? 'bg-[#e5e7eb] text-[#294051]' :
                    densityAnalysis.coverageBand === 'medium' ? 'bg-[#f9c97d] text-white' :
                    'bg-[#f1737c] text-white'
                  }`}>
                    {densityAnalysis.coverageBand}
                  </span>
                </div>
                
                <p className="text-sm text-[#374151] leading-relaxed mb-2">
                  {densityAnalysis.description}
                </p>
                
                <p className="text-xs text-[#6b7280] leading-relaxed italic">
                  {densityAnalysis.contextHint}
                </p>
                
                {densityAnalysis.combinedNote && (
                  <div className="mt-2 pt-2 border-t border-[#e5e7eb]">
                    <p className="text-xs text-orange-700 leading-relaxed">
                      ⚠️ {densityAnalysis.combinedNote}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Seam Analyzer */}
            <SeamAnalyzer
              canvas={tileCanvas}
              image={image}
              repeatType={
                repeatType === 'full-drop' ? 'fulldrop' :
                repeatType === 'half-drop' ? 'halfdrop' :
                'halfbrick'
              }
              isPro={isPro}
            />
          </div>
        )}
      </div>

      {/* Mockups Section */}
      <div>
        <div className="bg-[#f5f5f5] px-4 py-2.5 rounded-lg mb-4">
          <h2 className="text-xs font-bold text-[#294051] uppercase tracking-wider">
            Mockups
          </h2>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {(['onesie', 'fabric-swatch', 'wallpaper'] as const).map((mockupType) => {
            const template = getMockupTemplate(mockupType);
            return (
              <MockupRenderer
                key={mockupType}
                template={template}
                patternImage={image}
                tileWidth={tileWidth}
                tileHeight={tileHeight}
                dpi={dpi}
                repeatType={repeatType}
                zoom={zoom}
                onClick={() => {
                  setSelectedMockup(mockupType);
                }}
              />
            );
          })}
        </div>
        
        {/* Mockup Modal */}
        {selectedMockup && (
          <MockupModal
            isOpen={!!selectedMockup}
            onClose={() => setSelectedMockup(null)}
            title={getMockupTemplate(selectedMockup as any)?.name}
            onDownload={() => {
              // Find the canvas element in the mockup renderer
              const mockupCanvas = document.querySelector('.mockup-canvas') as HTMLCanvasElement;
              if (mockupCanvas) {
                const dataURL = mockupCanvas.toDataURL('image/png', 1.0);
                const link = document.createElement('a');
                const template = getMockupTemplate(selectedMockup as any);
                link.download = originalFilename 
                  ? `${originalFilename}-${template?.name?.toLowerCase().replace(/\s+/g, '-') || 'mockup'}.png`
                  : `mockup-${template?.name?.toLowerCase().replace(/\s+/g, '-') || 'mockup'}.png`;
                link.href = dataURL;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }
            }}
          >
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
                  onClick={() => {}}
                />
              </div>
            </div>
          </MockupModal>
        )}
      </div>

      {/* Easyscale Export Modal */}
      {isEasyscaleModalOpen && (
        <EasyscaleExportModal
          isOpen={isEasyscaleModalOpen}
          onClose={() => setIsEasyscaleModalOpen(false)}
          image={image}
          currentDPI={dpi}
          tileWidth={tileWidth}
          tileHeight={tileHeight}
        />
      )}
    </aside>
  );
}


