'use client';

import { useState, useRef, useEffect } from 'react';
import SeamAnalyzer from '@/components/analysis/SeamAnalyzer';
import ScaleExportModal from '@/components/export/ScaleExportModal';
import type { RepeatType } from '@/lib/analysis/seamAnalyzer';

interface PatternCanvasProps {
  isPro: boolean;
}

export default function PatternCanvas({ isPro }: PatternCanvasProps) {
  // State
  const [uploadedImage, setUploadedImage] = useState<HTMLImageElement | null>(null);
  const [repeatType, setRepeatType] = useState<RepeatType>('fulldrop');
  const [tileSize, setTileSize] = useState(300); // pixels
  const [dpi, setDpi] = useState(150);
  const [showScaleModal, setShowScaleModal] = useState(false);
  
  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  
  // File upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      setUploadedImage(img);
      drawPattern(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
    };
    img.src = objectUrl;
  };
  
  // Paste from clipboard
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (!file) continue;
        
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          setUploadedImage(img);
          drawPattern(img);
        };
        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
        };
        img.src = objectUrl;
        break;
      }
    }
  };
  
  // Draw pattern based on repeat type
  const drawPattern = (img: HTMLImageElement) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas size
    canvas.width = window.innerWidth - 400; // Leave room for sidebars
    canvas.height = window.innerHeight - 200;
    
    // Calculate how many tiles to draw
    const tilesX = Math.ceil(canvas.width / tileSize);
    const tilesY = Math.ceil(canvas.height / tileSize);
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw tiled pattern
    for (let x = 0; x < tilesX; x++) {
      for (let y = 0; y < tilesY; y++) {
        let offsetX = x * tileSize;
        let offsetY = y * tileSize;
        
        // Apply offset based on repeat type
        if (repeatType === 'halfdrop' && x % 2 === 1) {
          offsetY += tileSize / 2;
        } else if (repeatType === 'halfbrick' && y % 2 === 1) {
          offsetX += tileSize / 2;
        }
        
        ctx.drawImage(img, offsetX, offsetY, tileSize, tileSize);
      }
    }
    
    // Also draw to preview canvas (single tile for seam analysis)
    const previewCanvas = previewCanvasRef.current;
    if (previewCanvas) {
      previewCanvas.width = img.width;
      previewCanvas.height = img.height;
      const previewCtx = previewCanvas.getContext('2d');
      if (previewCtx) {
        previewCtx.drawImage(img, 0, 0);
      }
    }
  };
  
  // Redraw when settings change
  useEffect(() => {
    if (uploadedImage) {
      drawPattern(uploadedImage);
    }
  }, [repeatType, tileSize]);

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-gray-50">
      {/* LEFT SIDEBAR */}
      <div className="w-full lg:w-80 bg-white border-b lg:border-r overflow-y-auto p-4 space-y-4">
        <h2 className="text-xl font-bold">Pattern Settings</h2>
        
        {/* Upload Section */}
        <div className="space-y-2">
          <h3 className="font-semibold">Upload Pattern</h3>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="w-full text-sm"
          />
          <div
            contentEditable
            onPaste={handlePaste}
            className="w-full h-20 border-2 border-dashed border-gray-300 rounded flex items-center justify-center text-sm text-gray-500 cursor-text"
          >
            Or paste image here (Cmd+V)
          </div>
        </div>
        
        {/* Repeat Type */}
        <div className="space-y-2">
          <h3 className="font-semibold">Repeat Type</h3>
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="repeat"
                value="fulldrop"
                checked={repeatType === 'fulldrop'}
                onChange={(e) => setRepeatType(e.target.value as RepeatType)}
              />
              Full Drop
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="repeat"
                value="halfdrop"
                checked={repeatType === 'halfdrop'}
                onChange={(e) => setRepeatType(e.target.value as RepeatType)}
              />
              Half Drop
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="repeat"
                value="halfbrick"
                checked={repeatType === 'halfbrick'}
                onChange={(e) => setRepeatType(e.target.value as RepeatType)}
              />
              Half Brick
            </label>
          </div>
        </div>
        
        {/* Tile Size */}
        <div className="space-y-2">
          <h3 className="font-semibold">Tile Size: {tileSize}px</h3>
          <input
            type="range"
            min="50"
            max="1000"
            value={tileSize}
            onChange={(e) => setTileSize(Number(e.target.value))}
            className="w-full"
          />
        </div>
        
        {/* DPI Display */}
        <div className="p-3 bg-gray-100 rounded">
          <p className="text-sm">
            <strong>Current DPI:</strong> {dpi}
          </p>
          <p className="text-xs text-gray-600 mt-1">
            Physical size: {(uploadedImage?.width || 0) / dpi}″ × {(uploadedImage?.height || 0) / dpi}″
          </p>
        </div>
      </div>

      {/* CENTER CANVAS */}
      <div className="flex-1 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
        />
        {!uploadedImage && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
            Upload or paste a pattern to get started
          </div>
        )}
      </div>

      {/* RIGHT SIDEBAR */}
      <div className="w-full lg:w-80 bg-white border-t lg:border-l overflow-y-auto p-4 space-y-4">
        <h2 className="text-xl font-bold">Pro Tools</h2>
        
        {/* Seam Analyzer */}
        <SeamAnalyzer
          canvas={previewCanvasRef.current}
          image={uploadedImage}
          repeatType={repeatType}
          isPro={isPro}
        />
        
        {/* Scale & Export */}
        <div className="p-4 border rounded">
          <h3 className="font-bold mb-2">📦 Scale & Export</h3>
          {isPro ? (
            <button
              onClick={() => setShowScaleModal(true)}
              disabled={!uploadedImage}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Export Multiple Sizes
            </button>
          ) : (
            <button className="w-full px-4 py-2 bg-gray-300 text-gray-500 rounded cursor-not-allowed">
              🔒 Upgrade to Pro
            </button>
          )}
        </div>
        
        {/* Basic Export */}
        <div className="p-4 border rounded">
          <h3 className="font-bold mb-2">💾 Quick Export</h3>
          <button
            onClick={() => {
              const canvas = canvasRef.current;
              if (!canvas) return;
              const link = document.createElement('a');
              link.download = 'pattern-preview.png';
              link.href = canvas.toDataURL();
              link.click();
            }}
            disabled={!uploadedImage}
            className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            Export Preview
          </button>
        </div>
      </div>
      
      {/* Hidden preview canvas for seam analysis */}
      <canvas ref={previewCanvasRef} className="hidden" />
      
      {/* Scale Export Modal */}
      {showScaleModal && uploadedImage && (
        <ScaleExportModal
          image={uploadedImage}
          repeatType={repeatType}
          currentDPI={dpi}
          originalFilename={null}
          onClose={() => setShowScaleModal(false)}
        />
      )}
    </div>
  );
}
