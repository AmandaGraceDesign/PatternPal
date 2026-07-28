import { describe, it, expect, vi } from 'vitest';
import { applyDisplacement } from '../lib/mockups/mockupEngineV2/stages/displacementMap';

/**
 * processZone skips generating the procedural displacement map entirely when
 * `displacement.intensity === 0` (every shipped template zone is 0 — warps were
 * removed deliberately). Generating it was the single largest cost in each
 * rotate/drag frame and it made the gesture stutter on iPad.
 *
 * That optimisation is only output-preserving if applyDisplacement genuinely
 * ignores the displacement map at intensity 0. These tests pin that contract,
 * so the skip can't silently start changing rendered output.
 *
 * jsdom has no real canvas (no node-canvas installed), so these use minimal
 * fakes and assert on the calls rather than on pixels.
 */

function fakeCanvas(ctx: unknown) {
  return { getContext: vi.fn(() => ctx) } as unknown as HTMLCanvasElement;
}

describe('applyDisplacement intensity-0 contract', () => {
  it('draws the source unchanged and never reads the displacement map', () => {
    const destCtx = {
      drawImage: vi.fn(),
      getImageData: vi.fn(),
      createImageData: vi.fn(),
      putImageData: vi.fn(),
    };
    const srcCanvas = fakeCanvas({});
    // Any access to this canvas would mean the map is load-bearing at scale 0,
    // which would make skipping its generation a rendering change.
    const dispCanvas = fakeCanvas({});

    applyDisplacement(
      srcCanvas,
      dispCanvas,
      destCtx as unknown as CanvasRenderingContext2D,
      4, 4,
      0,
    );

    expect(destCtx.drawImage).toHaveBeenCalledTimes(1);
    expect(destCtx.drawImage).toHaveBeenCalledWith(srcCanvas, 0, 0);
    expect(dispCanvas.getContext).not.toHaveBeenCalled();

    // No per-pixel work at all on this path.
    expect(destCtx.createImageData).not.toHaveBeenCalled();
    expect(destCtx.putImageData).not.toHaveBeenCalled();
  });

  it('still consumes the displacement map when intensity is non-zero', () => {
    const w = 2, h = 2;
    const px = () => ({ data: new Uint8ClampedArray(w * h * 4) });
    const srcCtx = { getImageData: vi.fn(px) };
    const dispCtx = { getImageData: vi.fn(px) };
    const destCtx = {
      drawImage: vi.fn(),
      createImageData: vi.fn(px),
      putImageData: vi.fn(),
    };
    const dispCanvas = fakeCanvas(dispCtx);

    applyDisplacement(
      fakeCanvas(srcCtx),
      dispCanvas,
      destCtx as unknown as CanvasRenderingContext2D,
      w, h,
      12,
    );

    // The warp path must keep working — this guards the non-zero branch that
    // processZone still takes if a warp is ever re-enabled on a template.
    expect(dispCanvas.getContext).toHaveBeenCalled();
    expect(dispCtx.getImageData).toHaveBeenCalled();
    expect(destCtx.putImageData).toHaveBeenCalledTimes(1);
    expect(destCtx.drawImage).not.toHaveBeenCalled();
  });
});
