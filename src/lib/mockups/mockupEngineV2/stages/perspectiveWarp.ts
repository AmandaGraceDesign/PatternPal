/**
 * Applies perspective warp to a source canvas using strip-subdivision.
 * Divides the canvas into horizontal strips and maps each to a trapezoid
 * defined by topSqueeze and bottomSqueeze values.
 *
 * topSqueeze: pixels to inset from each side at the top (0 = no squeeze)
 * bottomSqueeze: pixels to inset from each side at the bottom (0 = no squeeze)
 */
export function applyPerspective(
  srcCanvas: HTMLCanvasElement,
  destCtx: CanvasRenderingContext2D,
  width: number,
  height: number,
  topSqueeze: number,
  bottomSqueeze: number
): void {
  destCtx.clearRect(0, 0, width, height);

  // Skip if no perspective needed
  if (topSqueeze === 0 && bottomSqueeze === 0) {
    destCtx.drawImage(srcCanvas, 0, 0);
    return;
  }

  // Four corners of destination quadrilateral
  const tl = [topSqueeze, topSqueeze * 0.5];
  const tr = [width - topSqueeze, topSqueeze * 0.5];
  const bl = [bottomSqueeze, height - bottomSqueeze * 0.5];
  const br = [width - bottomSqueeze, height - bottomSqueeze * 0.5];

  // Subdivide into horizontal strips for smooth perspective
  const strips = 40;
  for (let i = 0; i < strips; i++) {
    const t0 = i / strips;
    const t1 = (i + 1) / strips;

    // Interpolate left and right edges
    const l0x = tl[0] + (bl[0] - tl[0]) * t0;
    const l0y = tl[1] + (bl[1] - tl[1]) * t0;
    const r0x = tr[0] + (br[0] - tr[0]) * t0;
    const r0y = tr[1] + (br[1] - tr[1]) * t0;

    const l1x = tl[0] + (bl[0] - tl[0]) * t1;
    const l1y = tl[1] + (bl[1] - tl[1]) * t1;
    const r1x = tr[0] + (br[0] - tr[0]) * t1;
    const r1y = tr[1] + (br[1] - tr[1]) * t1;

    // Source strip
    const sy = Math.round(t0 * height);
    const sh = Math.round((t1 - t0) * height) + 1;

    destCtx.save();
    destCtx.beginPath();
    destCtx.moveTo(l0x, l0y);
    destCtx.lineTo(r0x, r0y);
    destCtx.lineTo(r1x, r1y);
    destCtx.lineTo(l1x, l1y);
    destCtx.closePath();
    destCtx.clip();

    const stripWidth = r0x - l0x;
    const scaleX = stripWidth / width;
    const skewAngle = Math.atan2(r0y - l0y, r0x - l0x);

    destCtx.setTransform(scaleX, Math.sin(skewAngle) * scaleX, 0, (l1y - l0y) / sh, l0x, l0y);
    destCtx.drawImage(srcCanvas, 0, sy, width, sh, 0, 0, width, sh);
    destCtx.restore();
  }
  destCtx.setTransform(1, 0, 0, 1, 0, 0);
}
