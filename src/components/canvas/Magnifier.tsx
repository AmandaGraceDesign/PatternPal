'use client';

import { useEffect, useRef } from 'react';

interface MagnifierProps {
  sourceCanvas: HTMLCanvasElement;
  x: number;
  y: number;
  zoom: number;
  size: number;
}

export default function Magnifier({ sourceCanvas, x, y, zoom, size }: MagnifierProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, size, size);

    // Draw magnified portion
    const sourceSize = size / zoom;
    const sourceX = x - sourceSize / 2;
    const sourceY = y - sourceSize / 2;

    // Draw white background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, size, size);

    // Draw magnified content
    ctx.imageSmoothingEnabled = false; // Crisp pixels when zoomed
    ctx.drawImage(
      sourceCanvas,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      size,
      size
    );

    // Draw border only
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, size, size);
  }, [sourceCanvas, x, y, zoom, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="absolute rounded-lg shadow-2xl border-4 border-blue-500 pointer-events-none"
      style={{
        left: `${x - size / 2}px`,
        top: `${y - size / 2}px`,
        zIndex: 1000,
      }}
    />
  );
}

