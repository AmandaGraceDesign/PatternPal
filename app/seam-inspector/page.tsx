'use client';

import { useEffect, useState, useRef } from 'react';
import SeamInspectorCanvas from '@/components/analysis/SeamInspectorCanvas';

type RepeatType = 'full-drop' | 'half-drop' | 'half-brick';

interface InspectorData {
  image: HTMLImageElement;
  repeatType: RepeatType;
  dpi: number;
  filename: string;
  outlineColor: string;
}

export default function SeamInspectorPage() {
  const [data, setData] = useState<InspectorData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const receivedRef = useRef(false);

  useEffect(() => {
    if (!window.opener) {
      setError('No pattern data available. Please open the Seam Inspector from the main editor.');
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== 'init') return;
      if (receivedRef.current) return;
      receivedRef.current = true;

      clearInterval(readyInterval);

      const { imageUrl, repeatType, dpi, filename, outlineColor } = event.data;

      const img = new Image();
      img.onload = () => {
        setData({ image: img, repeatType, dpi, filename, outlineColor });
      };
      img.onerror = () => {
        setError('Failed to load pattern image.');
      };
      img.src = imageUrl;
    };

    window.addEventListener('message', handleMessage);

    // Send 'ready' every 200ms until parent responds with 'init'
    // This handles React strict mode double-mounting and timing issues
    const readyInterval = setInterval(() => {
      if (receivedRef.current) {
        clearInterval(readyInterval);
        return;
      }
      try {
        window.opener.postMessage({ type: 'ready' }, window.location.origin);
      } catch {
        // opener may have navigated away
        clearInterval(readyInterval);
        setError('Lost connection to the editor. Please reopen the Seam Inspector.');
      }
    }, 200);

    // Also send one immediately
    try {
      window.opener.postMessage({ type: 'ready' }, window.location.origin);
    } catch {
      // opener not available
    }

    // Timeout after 5s — if parent never responds, something is wrong
    const timeout = setTimeout(() => {
      if (!receivedRef.current) {
        clearInterval(readyInterval);
        setError('Timed out waiting for pattern data. Please reopen the Seam Inspector.');
      }
    }, 5000);

    return () => {
      clearInterval(readyInterval);
      clearTimeout(timeout);
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // ESC to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') window.close();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-[#294051] flex items-center justify-center">
        <div className="bg-white rounded-lg p-8 max-w-md text-center shadow-xl">
          <h2 className="text-lg font-bold text-[#294051] mb-3">Seam Inspector</h2>
          <p className="text-sm text-[#6b7280] mb-4">{error}</p>
          <a
            href="/"
            className="inline-block px-4 py-2 bg-[#e0c26e] text-white rounded-lg font-semibold text-sm hover:bg-[#c9a94e] transition-colors"
          >
            Go to Editor
          </a>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#294051] flex items-center justify-center">
        <p className="text-[#94a3b8] text-sm">Loading pattern...</p>
      </div>
    );
  }

  return (
    <SeamInspectorCanvas
      image={data.image}
      repeatType={data.repeatType}
      dpi={data.dpi}
      filename={data.filename}
      outlineColor={data.outlineColor}
    />
  );
}
