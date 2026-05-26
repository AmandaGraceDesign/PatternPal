'use client';

import { useEffect } from 'react';

interface MockupModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  onDownload?: () => void;
  /** True while the canvas is regenerating at full res for download. Swaps
   *  the Download button to a disabled "Generating…" spinner so users get
   *  visual feedback during the 10-60s wait. */
  isDownloading?: boolean;
}

export default function MockupModal({ isOpen, onClose, children, title, subtitle, onDownload, isDownloading }: MockupModalProps) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent right-click and image copying
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    return false;
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.preventDefault();
    return false;
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[1001] flex items-center justify-center bg-black/50"
      data-mockup-modal="true"
      onClick={onClose}
    >
      <div
        className="relative max-w-[90vw] max-h-[90vh] bg-white rounded-lg shadow-2xl overflow-hidden border border-[#92afa5]/30"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {title && (
          <div className="px-4 py-3 border-b border-[#92afa5]/30 flex items-center justify-between bg-[#ffe4e7]">
            <div>
              <h3 className="text-sm font-semibold text-[#294051]">{title}</h3>
              {subtitle && (
                <p className="text-xs text-[#705046]">{subtitle}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {onDownload && (
                <button
                  onClick={onDownload}
                  disabled={isDownloading}
                  className="px-3 py-1.5 text-xs font-semibold text-white rounded-md transition-all duration-200 hover:opacity-90 disabled:opacity-70 disabled:cursor-wait flex items-center gap-1.5"
                  style={{ backgroundColor: '#e0c26e' }}
                  aria-label={isDownloading ? 'Generating high-resolution download' : 'Download'}
                  aria-busy={isDownloading}
                >
                  {isDownloading && (
                    <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
                      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                  )}
                  {isDownloading ? 'Generating high-res…' : 'Download'}
                </button>
              )}
              <button
                onClick={onClose}
                className="text-[#705046] hover:text-[#294051] transition-all duration-200"
                aria-label="Close"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div
          className="p-6 overflow-auto max-h-[calc(90vh-60px)] flex items-start justify-center select-none"
          onContextMenu={handleContextMenu}
          onDragStart={handleDragStart}
          style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
        >
          <div className="max-w-4xl w-full my-auto">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

