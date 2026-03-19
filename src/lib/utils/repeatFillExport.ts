import { convertToFullDrop } from './convertToFullDrop';
import { injectPngDpi, injectJpegDpi } from './dpiMetadata';
import { sanitizeFilename } from './sanitizeFilename';

const MAX_SIDE_PX = 10000;
const MAX_TOTAL_PIXELS = 67_108_864; // ~8192^2, safe browser canvas limit

export interface RepeatFillExportConfig {
  image: HTMLImageElement;
  repeatType: 'full-drop' | 'half-drop' | 'half-brick';
  targetWidthInches: number;
  targetHeightInches: number;
  dpi: 150 | 300;
  format: 'png' | 'jpg';
  tileWidthInches: number;
  tileHeightInches: number;
  originalFilename: string | null;
}

export interface RepeatFillCalcResult {
  tilePxW: number;
  tilePxH: number;
  repeatsX: number;
  repeatsY: number;
  outputPxW: number;
  outputPxH: number;
  outputWidthInches: number;
  outputHeightInches: number;
  wasConverted: boolean;
  tileWidthInches: number;
  tileHeightInches: number;
  convertedTileWidthInches: number;
  convertedTileHeightInches: number;
  isUpscaled: boolean;
}

export const SOCIAL_DPI = 96;

export interface SocialFillBlobConfig {
  image: HTMLImageElement;
  repeatType: 'full-drop' | 'half-drop' | 'half-brick';
  targetPxW: number;
  targetPxH: number;
  format: 'png' | 'jpg';
  tileWidthInches: number;
  tileHeightInches: number;
  exportScale: number;
}

/**
 * Map UI repeat types to the format convertToFullDrop expects.
 */
function mapRepeatType(
  repeatType: 'full-drop' | 'half-drop' | 'half-brick'
): string {
  switch (repeatType) {
    case 'full-drop':
      return 'fulldrop';
    case 'half-drop':
      return 'halfdrop';
    case 'half-brick':
      return 'halfbrick';
  }
}

/**
 * GCD helper for finding the smallest square tiling.
 */
function gcd(a: number, b: number): number {
  a = Math.round(a * 1000);
  b = Math.round(b * 1000);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a / 1000;
}

/**
 * Calculate tiling dimensions for the repeat fill export.
 *
 * Strategy: find the smallest rectangle of whole tiles that matches the
 * target aspect ratio. For a square target this means finding the smallest
 * square grid of tiles (using GCD of tile dimensions). The entire grid is
 * then uniformly scaled to the target output size — no distortion possible.
 */
export function calculateRepeatFillDimensions(
  image: HTMLImageElement,
  repeatType: 'full-drop' | 'half-drop' | 'half-brick',
  targetWidthInches: number,
  targetHeightInches: number,
  dpi: number,
  tileWidthInches: number,
  tileHeightInches: number
): RepeatFillCalcResult {
  // Effective tile dimensions after full-drop conversion
  let convertedW = tileWidthInches;
  let convertedH = tileHeightInches;
  const wasConverted = repeatType !== 'full-drop';

  if (repeatType === 'half-drop') {
    convertedW = tileWidthInches * 2;
  } else if (repeatType === 'half-brick') {
    convertedH = tileHeightInches * 2;
  }

  // Scale-aware: how many tiles fit across at current scale?
  const repeatsX = Math.max(1, Math.round(targetWidthInches / convertedW));

  // Width is exact target. Tile height preserves aspect ratio (no distortion).
  let outputPxW = Math.min(Math.round(targetWidthInches * dpi), MAX_SIDE_PX);
  const tileAspect = convertedW / convertedH;
  const tilePxW = outputPxW / repeatsX;
  const tilePxH = tilePxW / tileAspect;

  // How many fit vertically at the correct aspect ratio?
  const targetPxH = Math.min(Math.round(targetHeightInches * dpi), MAX_SIDE_PX);
  const repeatsY = Math.max(1, Math.round(targetPxH / tilePxH));
  let outputPxH = Math.round(repeatsY * tilePxH);

  // Cap to platform limits
  if (outputPxW * outputPxH > MAX_TOTAL_PIXELS) {
    const scale = Math.sqrt(MAX_TOTAL_PIXELS / (outputPxW * outputPxH));
    outputPxW = Math.floor(outputPxW * scale);
    outputPxH = Math.floor(outputPxH * scale);
  }

  // Detect upscaling: effective source DPI vs target DPI
  const effectiveDPI = image.naturalWidth / tileWidthInches;
  const isUpscaled = dpi > effectiveDPI;

  return {
    tilePxW,
    tilePxH,
    repeatsX,
    repeatsY,
    outputPxW,
    outputPxH,
    outputWidthInches: outputPxW / dpi,
    outputHeightInches: outputPxH / dpi,
    wasConverted,
    tileWidthInches,
    tileHeightInches,
    convertedTileWidthInches: convertedW,
    convertedTileHeightInches: convertedH,
    isUpscaled,
  };
}

/**
 * Generate and download a repeat fill export.
 * Tiles the pattern at uniform scale into a target canvas.
 * HD/HB patterns are auto-converted to full-drop.
 */
export async function generateRepeatFillExport(
  config: RepeatFillExportConfig
): Promise<void> {
  // Pro verification
  const res = await fetch('/api/pro/verify', { method: 'POST' });
  if (!res.ok) {
    throw new Error('Pro subscription required for Pattern Fill Export.');
  }

  const { image, repeatType, dpi, format, originalFilename } = config;

  // Convert HD/HB to full-drop tile (use canvas directly, no data URL round-trip)
  const mapped = mapRepeatType(repeatType);
  const tileSource: HTMLCanvasElement | HTMLImageElement =
    mapped === 'fulldrop' ? image : convertToFullDrop(image, mapped);

  // Calculate dimensions
  const calc = calculateRepeatFillDimensions(
    image,
    repeatType,
    config.targetWidthInches,
    config.targetHeightInches,
    dpi,
    config.tileWidthInches,
    config.tileHeightInches
  );

  // Create output canvas
  const canvas = document.createElement('canvas');
  canvas.width = calc.outputPxW;
  canvas.height = calc.outputPxH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create canvas context.');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Fill with white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Grid-tile the full-drop tile (uniform scale, correct aspect ratio).
  // Draw at integer pixel boundaries with +1px overlap to prevent
  // sub-pixel anti-aliasing seam lines between tiles.
  for (let x = 0; x < calc.repeatsX; x++) {
    for (let y = 0; y < calc.repeatsY; y++) {
      const dx = Math.floor(x * calc.tilePxW);
      const dy = Math.floor(y * calc.tilePxH);
      const dw = Math.ceil(calc.tilePxW) + 1;
      const dh = Math.ceil(calc.tilePxH) + 1;
      ctx.drawImage(tileSource, dx, dy, dw, dh);
    }
  }

  // Convert to blob
  const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
  const quality = format === 'jpg' ? 0.95 : undefined;

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else
          reject(
            new Error(
              'Failed to create image. Try a smaller target size or lower DPI.'
            )
          );
      },
      mimeType,
      quality
    );
  });

  // Inject DPI metadata
  const finalBlob =
    format === 'png'
      ? await injectPngDpi(blob, dpi)
      : await injectJpegDpi(blob, dpi);

  // Build filename
  const baseName = sanitizeFilename(originalFilename || 'pattern', 'pattern');
  const suffix = calc.wasConverted ? '-fulldrop' : '';
  const sizeLabel = `${calc.outputWidthInches.toFixed(1)}x${calc.outputHeightInches.toFixed(1)}in`;
  const filename = `${baseName}-${sizeLabel}-${dpi}dpi-fill${suffix}.${format === 'jpg' ? 'jpg' : 'png'}`;

  // Download
  const url = URL.createObjectURL(finalBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Render a pattern fill at exact platform pixel dimensions and return a Blob.
 * Used for social media exports. Does NOT auto-download or inject DPI metadata.
 * Uses a fixed 96 DPI bridge to convert tile inches → pixels.
 */
export async function generateSocialFillBlob(
  config: SocialFillBlobConfig
): Promise<Blob> {
  const {
    image, repeatType, targetPxW, targetPxH,
    format, tileWidthInches, tileHeightInches, exportScale,
  } = config;

  // Convert HD/HB tile to full-drop canvas (same as generateRepeatFillExport)
  const mapped = mapRepeatType(repeatType);
  const tileSource: HTMLCanvasElement | HTMLImageElement =
    mapped === 'fulldrop' ? image : convertToFullDrop(image, mapped);

  // Effective tile dimensions after full-drop conversion:
  // half-drop doubles width, half-brick doubles height.
  const effectiveW = mapped === 'halfdrop' ? tileWidthInches * 2 : tileWidthInches;
  const effectiveH = mapped === 'halfbrick' ? tileHeightInches * 2 : tileHeightInches;

  // DPI bridge: tile size in pixels at current scale
  const tilePixelW = effectiveW * exportScale * SOCIAL_DPI;
  const tileAspect = effectiveW / effectiveH;
  const tilePixelH = tilePixelW / tileAspect;

  const repeatsX = Math.max(1, Math.round(targetPxW / tilePixelW));

  // Tile at aspect-correct size: derive height from width so tiles are never stretched
  const actualTilePxW = targetPxW / repeatsX;
  const actualTilePxH = actualTilePxW / tileAspect;
  // How many rows needed to cover the full canvas height
  const rowsNeeded = Math.max(1, Math.ceil(targetPxH / actualTilePxH));

  // Create canvas at EXACT platform pixel dimensions
  const canvas = document.createElement('canvas');
  canvas.width = targetPxW;
  canvas.height = targetPxH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create canvas context.');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, targetPxW, targetPxH);

  // Tile with +1px overlap to prevent sub-pixel seam lines
  for (let x = 0; x < repeatsX; x++) {
    for (let y = 0; y < rowsNeeded; y++) {
      const dx = Math.floor(x * actualTilePxW);
      const dy = Math.floor(y * actualTilePxH);
      const dw = Math.ceil(actualTilePxW) + 1;
      const dh = Math.ceil(actualTilePxH) + 1;
      ctx.drawImage(tileSource, dx, dy, dw, dh);
    }
  }

  const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
  const quality = format === 'jpg' ? 0.95 : undefined;

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Failed to create image blob.'));
      },
      mimeType,
      quality
    );
  });
}
