'use client';

import { useEffect, useRef, useState } from 'react';

interface RulerProps {
  orientation: 'horizontal' | 'vertical';
  length: number;
  scale?: number;
  unit?: 'px' | 'in' | 'cm';
  pixelsPerUnit?: number;
}

export default function Ruler({
  orientation,
  length,
  scale = 1,
  unit = 'px',
  pixelsPerUnit = 1,
}: RulerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dpr, setDpr] = useState(1);

  useEffect(() => {
    // Use requestAnimationFrame to avoid setState in effect
    requestAnimationFrame(() => {
      setDpr(window.devicePixelRatio || 1);
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isHorizontal = orientation === 'horizontal';
    const width = isHorizontal ? length : 30;
    const height = isHorizontal ? 30 : length;

    // Set canvas size accounting for device pixel ratio
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Background - dark theme
    ctx.fillStyle = '#1e293b'; // slate-800
    ctx.fillRect(0, 0, width, height);

    // Border - dark theme
    ctx.strokeStyle = '#475569'; // slate-600
    ctx.lineWidth = 1;
    if (isHorizontal) {
      ctx.strokeRect(0, 0, width, height);
      ctx.beginPath();
      ctx.moveTo(0, height);
      ctx.lineTo(width, height);
      ctx.stroke();
    } else {
      ctx.strokeRect(0, 0, width, height);
      ctx.beginPath();
      ctx.moveTo(width, 0);
      ctx.lineTo(width, height);
      ctx.stroke();
    }

    // Draw tick marks and labels - dark theme
    ctx.fillStyle = '#cbd5e1'; // slate-300
    ctx.font = '10px sans-serif';
    ctx.textAlign = isHorizontal ? 'center' : 'center';
    ctx.textBaseline = isHorizontal ? 'top' : 'middle';

    const tickSpacing = getTickSpacing(pixelsPerUnit);
    const start = 0;
    const end = length;

    let tickCount = 0;
    for (let pos = start; pos <= end; pos += tickSpacing) {
      if (pos > length) break;

      // Every 4th tick is major (labeled)
      const isMajorTick = tickCount % 4 === 0;
      const tickLength = isMajorTick ? 15 : 8;

      if (isHorizontal) {
        ctx.beginPath();
        ctx.moveTo(pos, height);
        ctx.lineTo(pos, height - tickLength);
        ctx.stroke();

        if (isMajorTick) {
          const label = formatLabel(pos, unit, pixelsPerUnit);
          ctx.fillText(label, pos, height - tickLength - 12);
        }
      } else {
        ctx.beginPath();
        ctx.moveTo(width, pos);
        ctx.lineTo(width - tickLength, pos);
        ctx.stroke();

        if (isMajorTick) {
          const label = formatLabel(pos, unit, pixelsPerUnit);
          ctx.save();
          ctx.translate(width - tickLength - 8, pos);
          ctx.rotate(-Math.PI / 2);
          ctx.fillText(label, 0, 0);
          ctx.restore();
        }
      }
      
      tickCount++;
    }
  }, [orientation, length, scale, unit, pixelsPerUnit, dpr]);

  return (
    <canvas
      ref={canvasRef}
      className={`${orientation === 'horizontal' ? 'w-full' : 'h-full'} pointer-events-none`}
      style={{
        display: 'block',
      }}
    />
  );
}

function getTickSpacing(pixelsPerUnit: number): number {
  // Returns spacing in pixels for minor ticks
  // Choose spacing that creates logical inch increments
  
  if (pixelsPerUnit >= 200) {
    // Very zoomed in: 1/8 inch increments
    return pixelsPerUnit / 8;
  } else if (pixelsPerUnit >= 96) {
    // Zoomed in: 1/4 inch increments
    return pixelsPerUnit / 4;
  } else if (pixelsPerUnit >= 48) {
    // Medium: 1/2 inch increments
    return pixelsPerUnit / 2;
  } else if (pixelsPerUnit >= 24) {
    // Medium-far: 1 inch increments
    return pixelsPerUnit;
  } else if (pixelsPerUnit >= 12) {
    // Far: 2 inch increments
    return pixelsPerUnit * 2;
  } else if (pixelsPerUnit >= 6) {
    // Very far: 5 inch increments
    return pixelsPerUnit * 5;
  } else {
    // Extremely far: 10 inch increments
    return pixelsPerUnit * 10;
  }
}

function formatLabel(value: number, unit: string, pixelsPerUnit: number): string {
  if (unit === 'px') {
    return value.toString();
  }
  const inches = value / pixelsPerUnit;
  
  // Format based on value
  if (inches >= 10) {
    // Whole numbers for large values
    return Math.round(inches) + unit;
  } else if (inches >= 1) {
    // One decimal for medium values
    return inches.toFixed(1) + unit;
  } else {
    // Two decimals or fractions for small values
    const fraction = inches;
    if (Math.abs(fraction - 0.125) < 0.01) return '⅛' + unit;
    if (Math.abs(fraction - 0.25) < 0.01) return '¼' + unit;
    if (Math.abs(fraction - 0.375) < 0.01) return '⅜' + unit;
    if (Math.abs(fraction - 0.5) < 0.01) return '½' + unit;
    if (Math.abs(fraction - 0.625) < 0.01) return '⅝' + unit;
    if (Math.abs(fraction - 0.75) < 0.01) return '¾' + unit;
    if (Math.abs(fraction - 0.875) < 0.01) return '⅞' + unit;
    return inches.toFixed(2) + unit;
  }
}

