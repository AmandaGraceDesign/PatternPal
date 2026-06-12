import { cropsVertically, MOCKUP_SRC_ASPECT, type SocialSizePreset } from './socialSizes';

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

export type CropMode = 'vertical' | 'horizontal' | 'none';

export interface PreviewCropFractions {
  /** 'vertical' = draggable box (square/portrait); 'horizontal' = static centered band
   *  (story); 'none' = whole frame (pinterest/full size). */
  mode: CropMode;
  leftFraction: number;
  topFraction: number;
  widthFraction: number;
  heightFraction: number;
  /** Fraction of the frame height the box can travel (0 when not vertical). */
  travel: number;
}

/**
 * Crop sub-rectangle of the live 2:3 mockup canvas that a given social size exports,
 * expressed as 0..1 fractions of the canvas. Mirrors `computeCoverCropRect` (the export
 * path) with srcAspect = MOCKUP_SRC_ASPECT so the on-screen crop box, the offset drag,
 * and the watermark/badge overlay all coincide with the exported PNG.
 */
export function computePreviewCropFractions(
  preset: SocialSizePreset,
  offset: number,
): PreviewCropFractions {
  const targetAspect = preset.pxW / preset.pxH;
  const vertical = cropsVertically(preset);
  const horizontal = !vertical && MOCKUP_SRC_ASPECT > targetAspect;

  let widthFraction = 1;
  let heightFraction = 1;
  let leftFraction = 0;
  let topFraction = 0;

  if (vertical) {
    heightFraction = clamp01(MOCKUP_SRC_ASPECT / targetAspect);
    topFraction = (1 - heightFraction) * clamp01(offset);
  } else if (horizontal) {
    widthFraction = clamp01(targetAspect / MOCKUP_SRC_ASPECT);
    leftFraction = (1 - widthFraction) / 2;
  }

  return {
    mode: vertical ? 'vertical' : horizontal ? 'horizontal' : 'none',
    leftFraction,
    topFraction,
    widthFraction,
    heightFraction,
    travel: 1 - heightFraction,
  };
}
