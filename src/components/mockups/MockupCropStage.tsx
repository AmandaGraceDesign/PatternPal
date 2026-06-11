'use client';

import { useRef } from 'react';
import { cropsVertically, FULL_SIZE_SLUG, type SocialSizePreset } from '@/lib/export/socialSizes';

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
}

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

export default function MockupCropStage({
  snapshotUrl,
  preset,
  offset,
  onChangeOffset,
  isBusy,
}: MockupCropStageProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const draggable = cropsVertically(preset);

  // The crop box keeps full source WIDTH and has the target's aspect, so its
  // height as a fraction of the (2:3) snapshot height is what slides vertically.
  // boxHeightFraction = (snapshotAspect) / (targetAspect)
  //   snapshotAspect = srcW/srcH (≈0.667 for the 2:3 render)
  //   targetAspect   = preset.pxW/preset.pxH
  // We don't know srcW/srcH here, but the snapshot is the 2:3 render, so use 2/3.
  const SNAP_ASPECT = 2 / 3;
  const targetAspect = preset.pxW / preset.pxH;
  const boxHeightFraction = draggable ? clamp01(SNAP_ASPECT / targetAspect) : 1;
  const travel = 1 - boxHeightFraction; // fraction of stage height the box can move
  const boxTopFraction = travel * clamp01(offset);

  function offsetFromClientY(clientY: number): number {
    const el = frameRef.current;
    if (!el || travel <= 0) return offset;
    const rect = el.getBoundingClientRect();
    // Position the box so its CENTER tracks the pointer, then convert to offset.
    const boxH = boxHeightFraction * rect.height;
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
        {draggable ? (
          <>
            {/* dim above + below the box */}
            <div className="absolute left-0 right-0 top-0 bg-[#294051]/45"
                 style={{ height: `${boxTopFraction * 100}%` }} />
            <div className="absolute left-0 right-0 bottom-0 bg-[#294051]/45"
                 style={{ height: `${(travel - boxTopFraction) * 100}%` }} />
            {/* crop box */}
            <div className="absolute left-0 right-0 border-[3px] border-[#e0c26e] cursor-grab active:cursor-grabbing"
                 style={{ top: `${boxTopFraction * 100}%`, height: `${boxHeightFraction * 100}%` }} />
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
