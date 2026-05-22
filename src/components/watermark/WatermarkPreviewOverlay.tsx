'use client';

import { WatermarkConfig } from '@/lib/watermark/watermark';

interface Props {
  watermark: WatermarkConfig;
}

/** Live preview of the watermark logo as an HTML overlay. Drop inside a
 *  wrapper with `position: relative` and `containerType: inline-size`. The
 *  DOWNLOAD path still bakes the real watermark onto the canvas via
 *  applyWatermarkToBlob; this is purely a what-you-see hint so users can
 *  position the logo before exporting. */
export default function WatermarkPreviewOverlay({ watermark }: Props) {
  if (!watermark.enabled) return null;
  if (!watermark.logoDataUrl) return null;

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center justify-end gap-[1cqw] z-10"
      style={{ paddingBottom: '3cqw' }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={watermark.logoDataUrl}
        alt=""
        style={{
          width: `${watermark.logoSizePercent * 100}%`,
          opacity: watermark.logoOpacity,
          objectFit: 'contain',
          maxHeight: '40%',
        }}
      />
    </div>
  );
}
