import { describe, it, expect } from 'vitest';
import { isCmykJpegBuffer } from '../lib/utils/imageUtils';

/**
 * Build a minimal-but-valid JPEG byte stream with a given SOF0 component count.
 * The number of components is the definitive color-space signal:
 *   1 = grayscale, 3 = RGB (YCbCr), 4 = CMYK / YCCK.
 * Optionally prefix an APP0 (JFIF) segment to exercise marker-skipping.
 */
function makeJpeg(components: number, withApp0 = false): ArrayBuffer {
  const bytes: number[] = [0xff, 0xd8]; // SOI

  if (withApp0) {
    // APP0/JFIF segment (length 16) the scanner must skip past to reach SOF.
    bytes.push(0xff, 0xe0, 0x00, 0x10);
    bytes.push(0x4a, 0x46, 0x49, 0x46, 0x00); // "JFIF\0"
    bytes.push(0x01, 0x01, 0x00, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00);
  }

  const sofLen = 8 + components * 3; // 2(len)+1(prec)+2(h)+2(w)+1(Nf) + 3 per comp
  bytes.push(0xff, 0xc0); // SOF0
  bytes.push((sofLen >> 8) & 0xff, sofLen & 0xff);
  bytes.push(0x08); // precision
  bytes.push(0x00, 0x10); // height 16
  bytes.push(0x00, 0x10); // width 16
  bytes.push(components); // Nf
  for (let i = 0; i < components; i++) {
    bytes.push(i + 1, 0x11, 0x00); // component id, sampling factors, quant table
  }
  bytes.push(0xff, 0xda); // SOS (stop point)
  return new Uint8Array(bytes).buffer;
}

describe('isCmykJpegBuffer', () => {
  it('flags a 4-component (CMYK/YCCK) JPEG', () => {
    expect(isCmykJpegBuffer(makeJpeg(4))).toBe(true);
  });

  it('passes a 3-component (RGB/YCbCr) JPEG', () => {
    expect(isCmykJpegBuffer(makeJpeg(3))).toBe(false);
  });

  it('passes a 1-component (grayscale) JPEG', () => {
    expect(isCmykJpegBuffer(makeJpeg(1))).toBe(false);
  });

  it('still detects CMYK when an APP0 segment precedes the SOF marker', () => {
    expect(isCmykJpegBuffer(makeJpeg(4, true))).toBe(true);
  });

  it('returns false for a non-JPEG buffer (PNG signature)', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer;
    expect(isCmykJpegBuffer(png)).toBe(false);
  });

  it('returns false for a truncated / empty buffer', () => {
    expect(isCmykJpegBuffer(new Uint8Array([0xff]).buffer)).toBe(false);
  });
});
