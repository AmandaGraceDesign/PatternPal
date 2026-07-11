import { describe, it, expect } from 'vitest';
import { shouldPaintBackground } from '../lib/utils/repeatFillExport';

describe('shouldPaintBackground', () => {
  it('paints white by default (no flag)', () => {
    expect(shouldPaintBackground('png', undefined)).toBe(true);
    expect(shouldPaintBackground('jpg', undefined)).toBe(true);
  });
  it('skips the fill only for transparent PNG', () => {
    expect(shouldPaintBackground('png', true)).toBe(false);
  });
  it('always paints white for JPG even if transparent requested (JPEG has no alpha)', () => {
    expect(shouldPaintBackground('jpg', true)).toBe(true);
  });
});
