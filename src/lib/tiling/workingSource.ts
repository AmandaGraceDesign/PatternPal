/**
 * Size for the cached "working" downsample of a source image.
 *
 * Goal: large enough that the biggest on-screen tile is still a downscale from
 * it (crisp), but no larger than necessary (caps canvas memory — mitigates the
 * iPad canvas-crash bug). Aspect ratio is preserved and the result is never
 * larger than the natural image (we never upsample the source).
 *
 * @param neededDeviceWidth  the largest tile width we must draw, in device px
 * @param neededDeviceHeight the largest tile height we must draw, in device px
 * @param safety             headroom multiplier so max zoom never reveals softness
 */
export function computeWorkingSourceSize(
  naturalWidth: number,
  naturalHeight: number,
  neededDeviceWidth: number,
  neededDeviceHeight: number,
  safety = 1.15,
): { width: number; height: number } {
  const scale = Math.min(
    1,
    Math.max(
      (neededDeviceWidth * safety) / naturalWidth,
      (neededDeviceHeight * safety) / naturalHeight,
    ),
  );
  return {
    width: Math.max(1, Math.round(naturalWidth * scale)),
    height: Math.max(1, Math.round(naturalHeight * scale)),
  };
}
