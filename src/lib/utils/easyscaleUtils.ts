// Scaling utilities for Easyscale Export
import { extractDpiFromFile } from './imageUtils';
import { calculateOriginalSize as calculateOriginalSizeFromScaler, scaleImage as scaleImageFromScaler } from './imageScaler';

/**
 * Preset size options for Easyscale Export (in inches, longest side)
 */
export const PRESET_SIZES = [8, 12, 18, 24] as const;

/**
 * DPI options for Easyscale Export
 */
export const DPI_OPTIONS = [150, 300] as const;

/**
 * Format options for Easyscale Export
 */
export const FORMAT_OPTIONS = ['png', 'jpg'] as const;

/**
 * Detect original DPI from image
 * Uses extractDpiFromFile from imageUtils.ts
 * Falls back to provided currentDPI if extraction fails
 */
export async function detectOriginalDPI(
  image: HTMLImageElement,
  currentDPI: number
): Promise<number> {
  try {
    // Convert image to blob to extract DPI
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      return currentDPI;
    }
    
    ctx.drawImage(image, 0, 0);
    
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => resolve(blob!), 'image/png');
    });
    
    const detectedDPI = await extractDpiFromFile(blob);
    
    if (detectedDPI && detectedDPI > 0) {
      return detectedDPI;
    }
  } catch (error) {
    console.warn('Failed to detect DPI from image metadata:', error);
  }
  
  // Fallback to current DPI from app state
  return currentDPI;
}

/**
 * Calculate original size in inches from image and DPI
 * Re-exports from imageScaler for convenience
 */
export function calculateOriginalSize(image: HTMLImageElement, dpi: number) {
  return calculateOriginalSizeFromScaler(image, dpi);
}

/**
 * Scale an image to target size at target DPI
 * Re-exports from imageScaler for convenience
 */
export async function scaleImage(
  image: HTMLImageElement,
  targetSizeInches: number,
  originalSizeInches: number,
  originalDPI: number,
  targetDPI: number,
  format: 'png' | 'jpg'
): Promise<Blob> {
  return scaleImageFromScaler(
    image,
    targetSizeInches,
    originalSizeInches,
    originalDPI,
    targetDPI,
    format
  );
}

/**
 * Get preset size options
 */
export function getPresetSizes(): readonly number[] {
  return PRESET_SIZES;
}

/**
 * Validate scale calculation
 * Returns warning message if upscaling would cause pixelation
 */
export function validateScaleCalculation(
  image: HTMLImageElement,
  targetSizeInches: number,
  originalSizeInches: number,
  originalDPI: number,
  targetDPI: number
): string | null {
  const originalPixels = originalSizeInches * originalDPI;
  const targetPixels = targetSizeInches * targetDPI;
  
  if (targetPixels > originalPixels) {
    const maxSizeWithoutPixelation = originalPixels / targetDPI;
    return `Warning: Exporting at ${targetSizeInches}" with ${targetDPI} DPI may cause pixelation. Maximum size without pixelation at ${targetDPI} DPI is ${maxSizeWithoutPixelation.toFixed(1)}".`;
  }
  
  return null;
}
