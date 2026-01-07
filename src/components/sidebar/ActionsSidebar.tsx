'use client';

import { useEffect, useState } from 'react';
import { analyzeContrast, analyzeDensity, ContrastAnalysis, DensityAnalysis } from '@/lib/analysis/patternAnalyzer';
import MockupRenderer from '@/components/mockups/MockupRenderer';
import MockupModal from '@/components/mockups/MockupModal';
import ScaleExportModal from '@/components/export/ScaleExportModal';
import { getMockupTemplate, getAllMockupTypes } from '@/lib/mockups/mockupTemplates';

interface ActionsSidebarProps {
  image: HTMLImageElement | null;
  dpi: number;
  tileWidth: number;
  tileHeight: number;
  repeatType: 'full-drop' | 'half-drop' | 'half-brick';
  zoom: number;
  originalFilename: string | null;
}

export default function ActionsSidebar({ image, dpi, tileWidth, tileHeight, repeatType, zoom, originalFilename }: ActionsSidebarProps) {
  const [contrastAnalysis, setContrastAnalysis] = useState<ContrastAnalysis | null>(null);
  const [densityAnalysis, setDensityAnalysis] = useState<DensityAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedMockup, setSelectedMockup] = useState<string | null>(null);
  const [isEasyscaleModalOpen, setIsEasyscaleModalOpen] = useState(false);

  useEffect(() => {
    if (!image) {
      setContrastAnalysis(null);
      setDensityAnalysis(null);
      return;
    }

    setIsAnalyzing(true);
    
    // Run analyses
    try {
      const contrast = analyzeContrast(image, 'unspecified'); // TODO: Add intended use selector
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
    <aside className="w-72 bg-slate-900 border-l border-slate-700 p-6 overflow-y-auto">
      {/* Export Section */}
      <div className="mb-8">
        <h2 className="text-xs font-semibold text-slate-300 mb-3 uppercase tracking-wide">
          Export
        </h2>
        <div className="space-y-2">
          <button 
            onClick={() => setIsEasyscaleModalOpen(true)}
            disabled={!image}
            className="w-full px-4 py-2.5 text-xs font-medium text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#f1737c' }}
            onMouseEnter={(e) => {
              if (!e.currentTarget.disabled) {
                e.currentTarget.style.backgroundColor = '#e05a65';
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
        <h2 className="text-xs font-semibold text-slate-300 mb-3 uppercase tracking-wide">
          Analysis
        </h2>
        
        {!image && (
          <div className="text-xs text-slate-500 text-center py-4">
            Upload a pattern tile to see analysis
          </div>
        )}
        
        {isAnalyzing && (
          <div className="text-xs text-slate-400 text-center py-4">
            Analyzing...
          </div>
        )}
        
        {image && !isAnalyzing && (
          <div className="space-y-4">
            {/* Contrast Analysis */}
            {contrastAnalysis && (
              <div className="p-3 bg-slate-800 border border-slate-700 rounded-md">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-200">
                    {contrastAnalysis.label}
                  </span>
                  <span className={`px-2 py-0.5 text-[10px] font-medium rounded ${
                    contrastAnalysis.severity === 'none' ? 'bg-emerald-900/50 text-emerald-300' :
                    contrastAnalysis.severity === 'info' ? 'bg-blue-900/50 text-blue-300' :
                    'bg-orange-900/50 text-orange-300'
                  }`}>
                    {contrastAnalysis.band.toUpperCase().replace('_', ' ')}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mb-2">
                  Global contrast: {(contrastAnalysis.globalContrast * 100).toFixed(0)}%
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {contrastAnalysis.message}
                </p>
              </div>
            )}
            
            {/* Density Analysis */}
            {densityAnalysis && (
              <div className="p-3 bg-slate-800 border border-slate-700 rounded-md">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-200">
                    {densityAnalysis.label}
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-slate-700 text-slate-400 uppercase">
                    {densityAnalysis.coverageBand}
                  </span>
                </div>
                
                <p className="text-xs text-slate-300 leading-relaxed mb-2">
                  {densityAnalysis.description}
                </p>
                
                <p className="text-xs text-slate-400 leading-relaxed italic">
                  {densityAnalysis.contextHint}
                </p>
                
                {densityAnalysis.combinedNote && (
                  <div className="mt-2 pt-2 border-t border-slate-700">
                    <p className="text-xs text-orange-300 leading-relaxed">
                      ⚠️ {densityAnalysis.combinedNote}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mockups Section */}
      <div>
        <h2 className="text-xs font-semibold text-slate-300 mb-3 uppercase tracking-wide">
          Mockups
        </h2>
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
          >
            <div className="flex items-center justify-center bg-slate-900 rounded-lg p-4">
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
        <p className="text-[10px] text-slate-500 text-center">
          Reference only - not for download
        </p>
      </div>

      {/* Scale Export Modal */}
      {isEasyscaleModalOpen && image && (
        <ScaleExportModal
          image={image}
          repeatType={
            repeatType === 'full-drop' ? 'fulldrop' :
            repeatType === 'half-drop' ? 'halfdrop' :
            'halfbrick'
          }
          currentDPI={dpi}
          originalFilename={originalFilename}
          onClose={() => setIsEasyscaleModalOpen(false)}
        />
      )}
    </aside>
  );
}


