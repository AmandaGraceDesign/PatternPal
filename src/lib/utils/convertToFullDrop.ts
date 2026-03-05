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
