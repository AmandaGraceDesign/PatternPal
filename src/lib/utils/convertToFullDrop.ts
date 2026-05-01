import { BROWSER_CANVAS_LIMIT } from './imageUtils';

/**
 * Returns a browser-limit error message if converting a tile of (W, H) to
 * full-drop via the given repeat type would exceed Chromium's canvas ceiling,
 * or null if conversion is safe. Used both as a guard inside convertToFullDrop
 * and to disable "Convert to full-drop" toggles in export modals.
 */
export function getConvertToFullDropBlockReason(
  W: number,
  H: number,
  repeatType: string, // 'halfdrop' | 'halfbrick' | 'fulldrop'
): string | null {
  const requiredW = repeatType === 'halfdrop' ? W * 2 : W;
  const requiredH = repeatType === 'halfbrick' ? H * 2 : H;
  if (requiredW <= BROWSER_CANVAS_LIMIT && requiredH <= BROWSER_CANVAS_LIMIT) {
    return null;
  }
  return (
    `Browser limit: canvases max out at ${BROWSER_CANVAS_LIMIT.toLocaleString()} px per side, ` +
    `and converting a ${repeatType === 'halfdrop' ? 'half-drop' : 'half-brick'} ` +
    `${repeatType === 'halfdrop' ? 'doubles the width' : 'doubles the height'} of your tile. ` +
    `Your ${W.toLocaleString()} × ${H.toLocaleString()} tile would need a ` +
    `${requiredW.toLocaleString()} × ${requiredH.toLocaleString()} canvas — just past the ceiling. ` +
    `You can still export this as ${repeatType === 'halfdrop' ? 'half-drop' : 'half-brick'}, or resize the tile to ` +
    `${Math.floor(BROWSER_CANVAS_LIMIT / 2).toLocaleString()} px or smaller to enable conversion.`
  );
}

/**
 * Convert a half-drop or half-brick tile into a full-drop tile.
 *
 * Half-drop → full-drop:
 *   Canvas = 2W × H
 *   Draw at (0, 0), (W, −H/2), (W, +H/2)
 *
 * Half-brick → full-drop:
 *   Canvas = W × 2H
 *   Draw at (0, 0), (−W/2, H), (+W/2, H)
 */
export function convertToFullDrop(
  image: HTMLImageElement,
  repeatType: string, // 'halfdrop' | 'halfbrick' | 'fulldrop'
): HTMLCanvasElement {
  const W = image.naturalWidth;
  const H = image.naturalHeight;

  const blockReason = getConvertToFullDropBlockReason(W, H, repeatType);
  if (blockReason) throw new Error(blockReason);

  if (repeatType === 'halfdrop') {
    const canvas = document.createElement('canvas');
    canvas.width = W * 2;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Left column — original tile
    ctx.drawImage(image, 0, 0);

    // Right column — shifted up by H/2 (wraps around)
    ctx.drawImage(image, W, -H / 2);
    ctx.drawImage(image, W, H / 2);

    return canvas;
  }

  if (repeatType === 'halfbrick') {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H * 2;
    const ctx = canvas.getContext('2d')!;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Top row — original tile
    ctx.drawImage(image, 0, 0);

    // Bottom row — shifted left and right by W/2 (wraps around)
    ctx.drawImage(image, -W / 2, H);
    ctx.drawImage(image, W / 2, H);

    return canvas;
  }

  // fulldrop — no conversion needed, return image as canvas
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, 0, 0);
  return canvas;
}
