// src/lib/utils/mockupSocialExport.ts
// Clean-mockup → social-size export. Cover-crops the full-res mockup canvas into
// each target social size, then reuses the existing watermark + badge compositors.

export interface CoverCropRect {
  sx: number;
  sy: number;
  sWidth: number;
  sHeight: number;
}

/** Centered "cover" crop: the largest centered sub-rectangle of the source that
 *  has the target's aspect ratio. Draw it onto the full target canvas to fill it
 *  edge-to-edge with no distortion. */
export function computeCoverCropRect(
  srcW: number,
  srcH: number,
  targetW: number,
  targetH: number,
): CoverCropRect {
  const srcAspect = srcW / srcH;
  const targetAspect = targetW / targetH;

  if (srcAspect > targetAspect) {
    // Source is wider than target -> crop left/right.
    const sWidth = Math.round(srcH * targetAspect);
    return { sx: Math.round((srcW - sWidth) / 2), sy: 0, sWidth, sHeight: srcH };
  }
  // Source is taller than (or equal to) target -> crop top/bottom.
  const sHeight = Math.round(srcW / targetAspect);
  return { sx: 0, sy: Math.round((srcH - sHeight) / 2), sWidth: srcW, sHeight };
}
