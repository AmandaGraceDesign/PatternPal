'use client';

import { useRef } from 'react';
import { cropsVertically, FULL_SIZE_SLUG, MOCKUP_SRC_ASPECT, type SocialSizePreset } from '@/lib/export/socialSizes';
import { WatermarkConfig } from '@/lib/watermark/watermark';
import WatermarkPreviewOverlay from '@/components/watermark/WatermarkPreviewOverlay';
import BadgePreviewOverlay from '@/components/badge/BadgePreviewOverlay';

export interface MockupCropStageProps {
  /** Data-URL snapshot of the live mockup canvas; null until first render. */
  snapshotUrl: string | null;
  /** The size currently being framed. */
  preset: SocialSizePreset;
  /** Current vertical offset 0..1 for this size (0.5 = center). */
  offset: number;
  /** Called with the new clamped offset as the user drags. */
  onChangeOffset: (next: number) => void;
  isBusy: boolean;
  /** Watermark config — previewed over the crop region exactly where export stamps it. */
  watermark: WatermarkConfig;
  /** Whether the "Tested in PatternPAL" badge will be stamped on export. */
  badgeVisible: boolean;
}

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

export default function MockupCropStage({
  snapshotUrl,
  preset,
  offset,
  onChangeOffset,
  isBusy,
  watermark,
  badgeVisible,
}: MockupCropStageProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const draggable = cropsVertically(preset);

  // The crop region is the sub-rectangle of the snapshot that gets exported. The
  // stage frame and snapshot are both 2:3 (MOCKUP_SRC_ASPECT), so frame fractions
  // map 1:1 to the snapshot. We mirror computeCoverCropRect with srcAspect =
  // MOCKUP_SRC_ASPECT so the crop box, the offset drag, AND the watermark/badge
  // overlay all coincide with the exported PNG.
  //   - vertical crop (square/portrait): full width, height slides with offset
  //   - horizontal crop (story): full height, centered narrower width
  //   - no crop (pinterest / full size): the whole frame
  const targetAspect = preset.pxW / preset.pxH;
  const horizontalCrop = !draggable && MOCKUP_SRC_ASPECT > targetAspect;

  let widthFraction = 1;
  let heightFraction = 1;
  let leftFraction = 0;
  let topFraction = 0;
  if (draggable) {
    heightFraction = clamp01(MOCKUP_SRC_ASPECT / targetAspect);
    topFraction = (1 - heightFraction) * clamp01(offset);
  } else if (horizontalCrop) {
    widthFraction = clamp01(targetAspect / MOCKUP_SRC_ASPECT);
    leftFraction = (1 - widthFraction) / 2;
  }

  const travel = 1 - heightFraction; // fraction of stage height the box can move

  function offsetFromClientY(clientY: number): number {
    const el = frameRef.current;
    if (!el || travel <= 0) return offset;
    const rect = el.getBoundingClientRect();
    // Position the box so its CENTER tracks the pointer, then convert to offset.
    const boxH = heightFraction * rect.height;
    const top = clamp01((clientY - rect.top - boxH / 2) / rect.height);
    return clamp01(top / travel);
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (!draggable || isBusy) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    onChangeOffset(offsetFromClientY(e.clientY));
  }
  function handlePointerMove(e: React.PointerEvent) {
    if (!draggable || isBusy) return;
    if (e.buttons === 0) return; // not dragging
    onChangeOffset(offsetFromClientY(e.clientY));
  }

  if (!snapshotUrl) {
    return (
      <div className="flex items-center justify-center rounded-lg bg-[#f4e8c8] text-[12px] text-[#9aa3ab]"
           style={{ aspectRatio: '2 / 3', width: 240 }}>
        Rendering preview…
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        ref={frameRef}
        className="relative overflow-hidden rounded-lg select-none"
        style={{
          width: 240,
          aspectRatio: '2 / 3',
          backgroundImage: `url(${snapshotUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          touchAction: 'none',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
      >
        {/* Watermark + badge previewed inside the crop region. `containerType:
            inline-size` makes the overlays' cqw units reference the crop width,
            so the logo lands exactly where the export stamps it on the cropped
            PNG. pointer-events:none keeps the crop drag working through it. */}
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

        {draggable ? (
          <>
            {/* dim above + below the box */}
            <div className="absolute left-0 right-0 top-0 bg-[#294051]/45"
                 style={{ height: `${topFraction * 100}%` }} />
            <div className="absolute left-0 right-0 bottom-0 bg-[#294051]/45"
                 style={{ height: `${(travel - topFraction) * 100}%` }} />
            {/* crop box */}
            <div className="absolute left-0 right-0 border-[3px] border-[#e0c26e] cursor-grab active:cursor-grabbing"
                 style={{ top: `${topFraction * 100}%`, height: `${heightFraction * 100}%` }} />
          </>
        ) : null}
      </div>
      <p className="text-[12px] text-[#705046] text-center max-w-[240px]">
        {preset.slug === FULL_SIZE_SLUG
          ? 'Full size — the whole mockup, no crop.'
          : draggable
            ? 'Drag the box up or down to frame this size.'
            : 'This size frames automatically — no manual crop.'}
      </p>
    </div>
  );
}
