import { describe, it, expect } from 'vitest';
import { PatternTiler, tilePositions } from '../lib/tiling/PatternTiler';

function recordingCtx() {
  const calls: Array<{ op: string; args: unknown[] }> = [];
  const ctx = {
    fillStyle: '',
    fillRect: (...args: unknown[]) => calls.push({ op: 'fillRect', args }),
    drawImage: (...args: unknown[]) => calls.push({ op: 'drawImage', args }),
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

const fakeTile = (w: number, h: number) =>
  ({ width: w, height: h } as unknown as HTMLCanvasElement);

describe('PatternTiler.renderPreScaledAt', () => {
  it('clears once, then blits the tile at every on-viewport position', () => {
    const { ctx, calls } = recordingCtx();
    const tiler = new PatternTiler(ctx, 250, 250);
    tiler.renderPreScaledAt(fakeTile(200, 200), 100, 100, 'full-drop', 0, 0);

    const clears = calls.filter(c => c.op === 'fillRect');
    const blits = calls.filter(c => c.op === 'drawImage');
    expect(clears.length).toBe(1);

    // Every full-drop position that overlaps a 250x250 viewport (tile 100, +1px overlap)
    const expected = tilePositions('full-drop', 100, 100, 0, 0, 250, 250)
      .filter(p => !(p.dx + 101 <= 0 || p.dy + 101 <= 0 || p.dx >= 250 || p.dy >= 250));
    expect(blits.length).toBe(expected.length);
  });

  it('draws each tile at ceil(tileW)+1 / ceil(tileH)+1 to avoid sub-pixel gaps', () => {
    const { ctx, calls } = recordingCtx();
    const tiler = new PatternTiler(ctx, 100, 100);
    tiler.renderPreScaledAt(fakeTile(64, 64), 33, 33, 'full-drop', 0, 0);
    const firstBlit = calls.find(c => c.op === 'drawImage')!;
    // drawImage(tile, dx, dy, dw, dh) -> dw/dh are args[3]/args[4]
    expect(firstBlit.args[3]).toBe(34);
    expect(firstBlit.args[4]).toBe(34);
  });

  it('renders nothing (only the clear) for a zero-size tile', () => {
    const { ctx, calls } = recordingCtx();
    const tiler = new PatternTiler(ctx, 250, 250);
    tiler.renderPreScaledAt(fakeTile(0, 0), 0, 0, 'full-drop', 0, 0);
    expect(calls.filter(c => c.op === 'drawImage').length).toBe(0);
  });
});
