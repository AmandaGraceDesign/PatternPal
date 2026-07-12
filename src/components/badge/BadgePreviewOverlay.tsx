'use client';

import { BADGE_WIDTH_PERCENT } from '@/lib/badge/patternpalBadge';

interface Props {
  visible: boolean;
  /** When true, render top-left instead of bottom-left (matches the export,
   *  which moves the badge up when a bottom banner/logo would cover it). */
  atTop?: boolean;
}

/** Live preview of the "Tested in PatternPAL" badge as an HTML overlay. Drop
 *  inside a wrapper with `position: relative` and `containerType: inline-size`.
 *  The DOWNLOAD path bakes the real badge onto the canvas via applyBadgeToBlob,
 *  which auto-picks the navy (light bg) or gold (dark bg) mark per background.
 *  This preview always shows navy purely as a placement/size hint. */
export default function BadgePreviewOverlay({ visible, atTop = false }: Props) {
  if (!visible) return null;

  return (
    <div
      className={`pointer-events-none absolute left-0 z-10 ${atTop ? 'top-0' : 'bottom-0'}`}
      style={atTop ? { paddingLeft: '4cqw', paddingTop: '4cqw' } : { paddingLeft: '4cqw', paddingBottom: '4cqw' }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/tested-in-patternpal-navy.png"
        alt=""
        style={{
          width: `${BADGE_WIDTH_PERCENT * 100}cqw`,
          objectFit: 'contain',
        }}
      />
    </div>
  );
}
