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

    // Background
    ctx.fillStyle = '#3a3d44';
    ctx.fillRect(0, 0, width, height);

    // Border
    ctx.strokeStyle = '#3a3d44';
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

    // Draw tick marks and labels
    ctx.fillStyle = '#ffffff'; // White text
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.font = '10px sans-serif';
    ctx.textAlign = isHorizontal ? 'center' : 'center';
    ctx.textBaseline = isHorizontal ? 'top' : 'middle';

    const { minorSpacing, majorEvery } = getTickSpacing(pixelsPerUnit, unit);
    const start = 0;
    const end = length;

    let tickCount = 0;
    for (let pos = start; pos <= end; pos += minorSpacing) {
      if (pos > length) break;

      const isMajorTick = tickCount % majorEvery === 0;
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

function getTickSpacing(pixelsPerUnit: number, unit: string): { minorSpacing: number; majorEvery: number } {
  const MIN_LABEL_GAP = 60; // minimum pixels between labels

  if (unit === 'px') {
    // Find a clean pattern-pixel interval whose screen width >= MIN_LABEL_GAP
    const steps = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
    const majorPatternPx = steps.find(s => s * pixelsPerUnit >= MIN_LABEL_GAP) || 1000;
    const minorSpacing = (majorPatternPx / 4) * pixelsPerUnit;
    return { minorSpacing, majorEvery: 4 };
  }

  // For in/cm: base minor tick is half a unit
  const minorSpacing = Math.max(5, pixelsPerUnit / 2);
  const majorSpacingPx = minorSpacing * 4;

  // If major ticks are too close, widen the major interval
  if (majorSpacingPx >= MIN_LABEL_GAP) {
    return { minorSpacing, majorEvery: 4 };
  }

  const majorEvery = Math.ceil(MIN_LABEL_GAP / minorSpacing);
  return { minorSpacing, majorEvery };
}

function formatLabel(value: number, unit: string, pixelsPerUnit: number): string {
  if (unit === 'px') {
    return `${Math.round(value / pixelsPerUnit)}px`;
  }

  const numeric = value / pixelsPerUnit;
  const measure = numeric;
  const unitLabel = unit === 'cm' ? 'cm' : 'in';

  if (measure >= 10) {
    return `${Math.round(measure)}${unitLabel}`;
  } else if (measure >= 1) {
    return `${measure.toFixed(1)}${unitLabel}`;
  } else {
    // show fractions for inches under 1 only
    if (unit === 'in') {
      if (Math.abs(measure - 0.125) < 0.01) return `⅛${unitLabel}`;
      if (Math.abs(measure - 0.25) < 0.01) return `¼${unitLabel}`;
      if (Math.abs(measure - 0.375) < 0.01) return `⅜${unitLabel}`;
      if (Math.abs(measure - 0.5) < 0.01) return `½${unitLabel}`;
      if (Math.abs(measure - 0.625) < 0.01) return `⅝${unitLabel}`;
      if (Math.abs(measure - 0.75) < 0.01) return `¾${unitLabel}`;
      if (Math.abs(measure - 0.875) < 0.01) return `⅞${unitLabel}`;
    }
    return `${measure.toFixed(2)}${unitLabel}`;
  }
}

