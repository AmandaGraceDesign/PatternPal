/**
 * MockupRenderer Component
 * 
 * Renders pattern designs onto product mockup images with realistic blending.
 * Optimized for both placeholder mockups and realistic product photography.
 * 
 * Features:
 * - Automatic pattern tiling for seamless repeats
 * - Blend mode support for natural integration
 * - Adjustable opacity for fabric/material realism
 * - Responsive scaling and positioning
 * - Performance-optimized canvas rendering
 */

import React, { useEffect, useRef, useState } from 'react';
import { MockupTemplate } from '../lib/mockups/mockupTemplates';

interface MockupRendererProps {
  mockupTemplate: MockupTemplate;
  patternImageUrl: string;
  patternRepeat?: 'repeat' | 'no-repeat' | 'repeat-x' | 'repeat-y';
  patternScale?: number;  // Scale factor for pattern (1.0 = original size)
  className?: string;
  onRenderComplete?: (canvas: HTMLCanvasElement) => void;
  fallbackImage?: string; // Fallback if mockup fails to load
}

export const MockupRenderer: React.FC<MockupRendererProps> = ({
  mockupTemplate,
  patternImageUrl,
  patternRepeat = 'repeat',
  patternScale = 1.0,
  className = '',
  onRenderComplete,
  fallbackImage
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { 
      alpha: true,
      willReadFrequently: false  // Performance optimization
    });
    if (!ctx) {
      setError('Canvas context not supported');
      return;
    }

    setIsLoading(true);
    setError(null);

    // Load both mockup and pattern images
    const mockupImage = new Image();
    const patternImage = new Image();
    
    let mockupLoaded = false;
    let patternLoaded = false;

    const checkAndRender = () => {
      if (mockupLoaded && patternLoaded) {
        renderMockup(ctx, canvas, mockupImage, patternImage);
      }
    };

    mockupImage.onload = () => {
      mockupLoaded = true;
      checkAndRender();
    };

    patternImage.onload = () => {
      patternLoaded = true;
      checkAndRender();
    };

    mockupImage.onerror = () => {
      if (fallbackImage) {
        mockupImage.src = fallbackImage;
      } else {
        setError('Failed to load mockup image');
        setIsLoading(false);
      }
    };

    patternImage.onerror = () => {
      setError('Failed to load pattern image');
      setIsLoading(false);
    };

    // Start loading images
    mockupImage.crossOrigin = 'anonymous';
    patternImage.crossOrigin = 'anonymous';
    mockupImage.src = mockupTemplate.image;
    patternImage.src = patternImageUrl;

    function renderMockup(
      ctx: CanvasRenderingContext2D,
      canvas: HTMLCanvasElement,
      mockup: HTMLImageElement,
      pattern: HTMLImageElement
    ) {
      try {
        // Set canvas dimensions to match mockup
        canvas.width = mockup.width;
        canvas.height = mockup.height;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw base mockup image
        ctx.drawImage(mockup, 0, 0);

        // Apply pattern to designated area
        applyPattern(ctx, pattern);

        setIsLoading(false);
        
        if (onRenderComplete) {
          onRenderComplete(canvas);
        }
      } catch (err) {
        setError('Error rendering mockup');
        setIsLoading(false);
        console.error('Mockup rendering error:', err);
      }
    }

    function applyPattern(ctx: CanvasRenderingContext2D, pattern: HTMLImageElement) {
      const { x, y, width, height } = mockupTemplate.patternArea;
      const blendMode = mockupTemplate.blendMode || 'multiply';
      const opacity = mockupTemplate.opacity || 1.0;

      // Save current context state
      ctx.save();

      // Set blend mode and opacity
      ctx.globalCompositeOperation = blendMode;
      ctx.globalAlpha = opacity;

      // Create pattern fill
      const scaledPatternWidth = pattern.width * patternScale;
      const scaledPatternHeight = pattern.height * patternScale;

      if (patternRepeat === 'repeat') {
        // Create tiling pattern
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = scaledPatternWidth;
        tempCanvas.height = scaledPatternHeight;
        const tempCtx = tempCanvas.getContext('2d');
        
        if (tempCtx) {
          tempCtx.drawImage(
            pattern,
            0, 0,
            scaledPatternWidth,
            scaledPatternHeight
          );
          
          const patternFill = ctx.createPattern(tempCanvas, 'repeat');
          if (patternFill) {
            ctx.fillStyle = patternFill;
            ctx.fillRect(x, y, width, height);
          }
        }
      } else {
        // Draw pattern once (centered or stretched)
        const patternX = x + (width - scaledPatternWidth) / 2;
        const patternY = y + (height - scaledPatternHeight) / 2;
        
        ctx.drawImage(
          pattern,
          patternX,
          patternY,
          scaledPatternWidth,
          scaledPatternHeight
        );
      }

      // Restore context state
      ctx.restore();
    }

    // Cleanup
    return () => {
      mockupImage.onload = null;
      mockupImage.onerror = null;
      patternImage.onload = null;
      patternImage.onerror = null;
    };
  }, [
    mockupTemplate,
    patternImageUrl,
    patternRepeat,
    patternScale,
    fallbackImage,
    onRenderComplete
  ]);

  return (
    <div className={`mockup-renderer ${className}`}>
      {isLoading && (
        <div className="mockup-loading">
          <div className="loading-spinner" />
          <p>Rendering mockup...</p>
        </div>
      )}
      
      {error && (
        <div className="mockup-error">
          <p>⚠️ {error}</p>
        </div>
      )}
      
      <canvas
        ref={canvasRef}
        className="mockup-canvas"
        style={{
          display: isLoading || error ? 'none' : 'block',
          maxWidth: '100%',
          height: 'auto'
        }}
      />
    </div>
  );
};

/**
 * Hook for downloading rendered mockup as image
 */
export function useMockupDownload() {
  const downloadMockup = (
    canvas: HTMLCanvasElement,
    filename: string = 'mockup.png',
    quality: number = 0.95
  ) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = filename;
        link.href = url;
        link.click();
        
        // Cleanup
        setTimeout(() => URL.revokeObjectURL(url), 100);
      },
      'image/png',
      quality
    );
  };

  return { downloadMockup };
}

/**
 * Component for rendering multiple mockup variations
 */
interface MockupGalleryProps {
  mockupTemplates: MockupTemplate[];
  patternImageUrl: string;
  columns?: number;
  gap?: number;
  onMockupClick?: (template: MockupTemplate) => void;
}

export const MockupGallery: React.FC<MockupGalleryProps> = ({
  mockupTemplates,
  patternImageUrl,
  columns = 2,
  gap = 16,
  onMockupClick
}) => {
  return (
    <div
      className="mockup-gallery"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: `${gap}px`
      }}
    >
      {mockupTemplates.map((template) => (
        <div
          key={template.id}
          className="mockup-gallery-item"
          onClick={() => onMockupClick?.(template)}
          style={{ cursor: onMockupClick ? 'pointer' : 'default' }}
        >
          <MockupRenderer
            mockupTemplate={template}
            patternImageUrl={patternImageUrl}
          />
          <p className="mockup-name">{template.name}</p>
        </div>
      ))}
    </div>
  );
};

export default MockupRenderer;
