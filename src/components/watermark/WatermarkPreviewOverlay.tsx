'use client';

import { WatermarkConfig, WATERMARK_FONTS } from '@/lib/watermark/watermark';

interface Props {
  watermark: WatermarkConfig;
}

/** Live preview of the watermark as an HTML overlay. Drop inside a wrapper
 *  with `position: relative` and `containerType: inline-size`. The DOWNLOAD
 *  path still bakes the real watermark onto the canvas via applyWatermarkToBlob;
 *  this is purely a what-you-see hint so users can position the logo before
 *  exporting. */
export default function WatermarkPreviewOverlay({ watermark }: Props) {
  if (!watermark.enabled) return null;
  const hasText = watermark.text.trim().length > 0;
  const hasLogo = !!watermark.logoDataUrl;
  if (!hasText && !hasLogo) return null;
  const fontDef = WATERMARK_FONTS.find(f => f.value === watermark.font) ?? WATERMARK_FONTS[0];

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center justify-end gap-[1cqw] z-10"
      style={{ paddingBottom: '3cqw' }}
    >
      {hasLogo && (
        // eslint-disable-next-line @next/next/no-img-element
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
      )}
      {hasText && (
        <span
          style={{
            fontFamily: fontDef.css,
            // Match the bake path's scaleFactor = canvasW / 1080 — preview uses
            // container width as the analog, so fontSize / 1080 of canvas width
            // ≈ (fontSize / 10.8) cqw.
            fontSize: `${watermark.fontSize / 10.8}cqw`,
            color: watermark.color,
            opacity: watermark.opacity,
            backgroundColor: watermark.bgEnabled ? watermark.bgColor : undefined,
            padding: watermark.bgEnabled ? '0.5cqw 1.5cqw' : undefined,
            whiteSpace: 'nowrap',
          }}
        >
          {watermark.text}
        </span>
      )}
    </div>
  );
}
