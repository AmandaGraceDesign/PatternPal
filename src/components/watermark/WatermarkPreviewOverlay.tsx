'use client';

import { WatermarkConfig } from '@/lib/watermark/watermark';

interface Props {
  watermark: WatermarkConfig;
}

/** Convert a #rrggbb hex + 0..1 alpha to an rgba() string, so band opacity
 *  fades only the background — not the logo/text composited over it. */
function bandRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return hex; // non-6-digit fallback
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Live preview of the watermark logo as an HTML overlay. Drop inside a
 *  wrapper with `position: relative` and `containerType: inline-size`. The
 *  DOWNLOAD path still bakes the real watermark onto the canvas via
 *  applyWatermarkToBlob; this is purely a what-you-see hint so users can
 *  position the logo before exporting. */
export default function WatermarkPreviewOverlay({ watermark }: Props) {
  if (!watermark.enabled) return null;

  const vAlign =
    watermark.anchorV === 'top' ? 'justify-start'
    : watermark.anchorV === 'middle' ? 'justify-center'
    : 'justify-end';

  if (watermark.mode === 'banner') {
    const hasTitle = watermark.bannerTitle.trim().length > 0;
    const hasSubtitle = watermark.bannerSubtitle.trim().length > 0;
    const showText = watermark.anchorH !== 'center' && (hasTitle || hasSubtitle);
    if (!watermark.logoDataUrl && !showText) return null;
    const rowJustify =
      watermark.anchorH === 'left' ? 'justify-start'
      : watermark.anchorH === 'right' ? 'justify-end'
      : 'justify-center';
    const rowReverse = watermark.anchorH === 'right' ? 'flex-row-reverse' : 'flex-row';
    return (
      <div className={`pointer-events-none absolute inset-0 flex flex-col ${vAlign} z-10`}>
        <div
          className="w-full flex items-center gap-[2cqw]"
          style={{ backgroundColor: bandRgba(watermark.bandColor, watermark.bandOpacity), padding: '2cqw' }}
        >
          <div className={`w-full flex items-center gap-[2cqw] ${rowJustify} ${rowReverse}`}>
            {watermark.logoDataUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={watermark.logoDataUrl}
                alt=""
                style={{ width: `${watermark.logoSizePercent * 100}%`, opacity: watermark.logoOpacity, objectFit: 'contain', maxHeight: '12cqw' }}
              />
            )}
            {showText && (
              <div className="flex flex-col" style={{ color: watermark.color, textAlign: watermark.anchorH === 'right' ? 'right' : 'left' }}>
                {hasTitle && <span style={{ fontWeight: 600, fontSize: '3.5cqw', lineHeight: 1.1 }}>{watermark.bannerTitle}</span>}
                {hasSubtitle && <span style={{ fontWeight: 400, fontSize: '2.5cqw', lineHeight: 1.1 }}>{watermark.bannerSubtitle}</span>}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Simple logo mode
  if (!watermark.logoDataUrl) return null;
  const hAlign =
    watermark.anchorH === 'left' ? 'items-start'
    : watermark.anchorH === 'right' ? 'items-end'
    : 'items-center';
  return (
    <div
      className={`pointer-events-none absolute inset-0 flex flex-col ${vAlign} ${hAlign} z-10`}
      style={{ padding: '3cqw' }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={watermark.logoDataUrl}
        alt=""
        style={{ width: `${watermark.logoSizePercent * 100}%`, opacity: watermark.logoOpacity, objectFit: 'contain', maxHeight: '40%' }}
      />
    </div>
  );
}
