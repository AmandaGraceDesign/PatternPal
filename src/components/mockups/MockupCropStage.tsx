'use client';

import { useRef, useState } from 'react';
import { FULL_SIZE_SLUG, type SocialSizePreset } from '@/lib/export/socialSizes';
import { computePreviewCropFractions } from '@/lib/export/cropFraming';
import { WatermarkConfig } from '@/lib/watermark/watermark';
import WatermarkPreviewOverlay from '@/components/watermark/WatermarkPreviewOverlay';
import BadgePreviewOverlay from '@/components/badge/BadgePreviewOverlay';

export interface MockupCropStageProps {
  /** The size currently being framed on the live preview. */
  preset: SocialSizePreset;
  /** Current vertical offset 0..1 for this size (0.5 = center). */
  offset: number;
  /** Called with the new clamped offset as the user drags the frame. */
  onChangeOffset: (next: number) => void;
  isBusy: boolean;
  /** Watermark config — previewed over the crop region exactly where export stamps it. */
  watermark: WatermarkConfig;
  /** Whether the "Tested in PatternPAL" badge will be stamped on export. */
  badgeVisible: boolean;
}

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

/**
 * Transparent crop-framing overlay drawn over the live MockupRendererV2 canvas.
 * `absolute inset-0` over the 2:3 canvas wrapper (containerType: inline-size).
 *
 * Model A gesture split: every element here is pointer-events:none EXCEPT the center
 * grab-bar handle, so pointerdowns anywhere else fall through to the renderer's pattern
 * drag. Grabbing the handle slides the vertical crop offset.
 */
export default function MockupCropStage({
  preset,
  offset,
  onChangeOffset,
  isBusy,
  watermark,
  badgeVisible,
}: MockupCropStageProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [draggingCrop, setDraggingCrop] = useState(false);

  const { mode, leftFraction, topFraction, widthFraction, heightFraction, travel } =
    computePreviewCropFractions(preset, offset);

  function offsetFromClientY(clientY: number): number {
    const el = frameRef.current;
    if (!el || travel <= 0) return offset;
    const rect = el.getBoundingClientRect();
    // Position the box so its CENTER tracks the pointer, then convert to offset.
    const boxH = heightFraction * rect.height;
    const top = clamp01((clientY - rect.top - boxH / 2) / rect.height);
    return clamp01(top / travel);
  }

  function handleDown(e: React.PointerEvent) {
    if (mode !== 'vertical' || isBusy) return;
    e.preventDefault();
    e.stopPropagation(); // never let the renderer also start a pattern drag
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDraggingCrop(true);
    onChangeOffset(offsetFromClientY(e.clientY));
  }
  function handleMove(e: React.PointerEvent) {
    if (mode !== 'vertical' || isBusy) return;
    if (e.buttons === 0) return;
    e.stopPropagation();
    onChangeOffset(offsetFromClientY(e.clientY));
  }
  function handleUp(e: React.PointerEvent) {
    if (mode !== 'vertical') return;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    setDraggingCrop(false);
  }

  // Handle sits centered on the crop box; ≥44px tall touch target.
  const boxCenterPct = (topFraction + heightFraction / 2) * 100;

  const label =
    preset.slug === FULL_SIZE_SLUG
      ? 'Full size — drag to move the pattern'
      : mode === 'vertical'
        ? draggingCrop
          ? 'Sliding the crop frame ↕'
          : 'Moving the pattern · grab the gold bar to frame'
        : mode === 'horizontal'
          ? 'This size frames automatically · drag to move the pattern'
          : 'Drag to move the pattern';

  return (
    <div ref={frameRef} className="pointer-events-none absolute inset-0 select-none">
      {mode === 'vertical' && (
        <>
          {/* dim above + below the crop box */}
          <div
            className="absolute left-0 right-0 top-0 bg-[#294051]/45"
            style={{ height: `${topFraction * 100}%` }}
          />
          <div
            className="absolute left-0 right-0 bottom-0 bg-[#294051]/45"
            style={{ height: `${(travel - topFraction) * 100}%` }}
          />
          {/* gold crop box (visual only) */}
          <div
            className="absolute left-0 right-0 border-[3px] border-[#e0c26e]"
            style={{ top: `${topFraction * 100}%`, height: `${heightFraction * 100}%` }}
          />
          {/* center grab-bar handle — the ONLY crop-grab target */}
          <div
            className="pointer-events-auto absolute left-1/2 flex items-center justify-center gap-1 rounded-full bg-[#e0c26e] shadow-md cursor-grab active:cursor-grabbing"
            style={{
              top: `${boxCenterPct}%`,
              transform: 'translate(-50%, -50%)',
              width: 72,
              height: 44,
              touchAction: 'none',
            }}
            onPointerDown={handleDown}
            onPointerMove={handleMove}
            onPointerUp={handleUp}
            onPointerCancel={handleUp}
            aria-label="Drag to frame this size vertically"
          >
            <span className="block h-[3px] w-5 rounded-full bg-[#294051]/70" />
            <span className="block h-[3px] w-5 rounded-full bg-[#294051]/70" />
          </div>
        </>
      )}

      {mode === 'horizontal' && (
        <>
          {/* dim left + right of the centered band */}
          <div
            className="absolute top-0 bottom-0 left-0 bg-[#294051]/45"
            style={{ width: `${leftFraction * 100}%` }}
          />
          <div
            className="absolute top-0 bottom-0 right-0 bg-[#294051]/45"
            style={{ width: `${leftFraction * 100}%` }}
          />
          <div
            className="absolute top-0 bottom-0 border-[3px] border-[#e0c26e]"
            style={{ left: `${leftFraction * 100}%`, width: `${widthFraction * 100}%` }}
          />
        </>
      )}

      {/* Watermark + badge previewed inside the crop region. containerType: inline-size
          makes the overlays' cqw units reference the crop width, so the logo lands where
          the export stamps it on the cropped PNG. */}
      <div
        className="pointer-events-none absolute"
        style={{
          left: `${leftFraction * 100}%`,
          top: `${topFraction * 100}%`,
          width: `${widthFraction * 100}%`,
          height: `${heightFraction * 100}%`,
          containerType: 'inline-size',
        }}
      >
        <WatermarkPreviewOverlay watermark={watermark} />
        <BadgePreviewOverlay visible={badgeVisible} />
      </div>

      {/* Live action label */}
      <div className="pointer-events-none absolute left-1/2 bottom-2 -translate-x-1/2">
        <span className="rounded-full bg-[#294051]/80 px-3 py-1 text-[11px] font-medium text-white whitespace-nowrap">
          {label}
        </span>
      </div>
    </div>
  );
}
