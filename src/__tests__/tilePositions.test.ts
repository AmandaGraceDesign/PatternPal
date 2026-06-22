import { describe, it, expect } from 'vitest';
import { tilePositions } from '../lib/tiling/PatternTiler';

describe('tilePositions', () => {
  it('full-drop, no pan: covers the viewport with a 1-tile border', () => {
    // viewport 250x250, tile 100x100 -> cols -1..3 (ceil(250/100)=3), rows -1..3
    const pos = tilePositions('full-drop', 100, 100, 0, 0, 250, 250);
    const xs = [...new Set(pos.map(p => p.dx))].sort((a, b) => a - b);
    const ys = [...new Set(pos.map(p => p.dy))].sort((a, b) => a - b);
    expect(xs).toEqual([-100, 0, 100, 200, 300]);
    expect(ys).toEqual([-100, 0, 100, 200, 300]);
    expect(pos.length).toBe(25);
  });

  it('full-drop applies pan as an integer-rounded offset', () => {
    const pos = tilePositions('full-drop', 100, 100, 30, 30, 250, 250);
    // startCol = floor(-30/100)-1 = -2; first dx = round(-2*100 + 30) = -170
    expect(Math.min(...pos.map(p => p.dx))).toBe(-170);
  });

  it('half-drop offsets odd columns down by half a tile', () => {
    const pos = tilePositions('half-drop', 100, 100, 0, 0, 250, 250);
    const col0 = pos.filter(p => p.dx === 0).map(p => p.dy).sort((a, b) => a - b);
    const col1 = pos.filter(p => p.dx === 100).map(p => p.dy).sort((a, b) => a - b);
    // even column aligned to grid, odd column shifted +50
    expect(col0).toContain(0);
    expect(col1).toContain(50);
    expect(col1).not.toContain(0);
  });

  it('half-brick offsets odd rows right by half a tile', () => {
    const pos = tilePositions('half-brick', 100, 100, 0, 0, 250, 250);
    const row0 = pos.filter(p => p.dy === 0).map(p => p.dx).sort((a, b) => a - b);
    const row1 = pos.filter(p => p.dy === 100).map(p => p.dx).sort((a, b) => a - b);
    expect(row0).toContain(0);
    expect(row1).toContain(50);
    expect(row1).not.toContain(0);
  });

  it('negative pan keeps the half-drop parity stable (both aligned + half-shifted columns appear)', () => {
    // col parity uses the floored-modulo form so negative columns behave; under
    // a large negative pan the rendered columns are all-positive (1..5), and the
    // odd ones must still be shifted by +50.
    const pos = tilePositions('half-drop', 100, 100, -250, 0, 250, 250);
    const flooredMod = (n: number) => (((n % 100) + 100) % 100);
    expect(pos.some(p => flooredMod(p.dy) === 0)).toBe(true);
    expect(pos.some(p => flooredMod(p.dy) === 50)).toBe(true);
    expect(pos.every(p => flooredMod(p.dy) === 0 || flooredMod(p.dy) === 50)).toBe(true);
  });

  it('returns nothing for non-positive tile sizes', () => {
    expect(tilePositions('full-drop', 0, 100, 0, 0, 250, 250)).toEqual([]);
    expect(tilePositions('full-drop', 100, -1, 0, 0, 250, 250)).toEqual([]);
  });
});
