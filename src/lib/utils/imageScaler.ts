// Core scaling utilities for easyscale export
import { injectPngDpi, injectJpegDpi } from './dpiMetadata';

/**
 * Detect original DPI from image
 * TODO: Integrate with extractDpiFromFile from imageUtils.ts in Phase 1b
 * For now, returns 150 as placeholder
 * Note: The app already has DPI detection in state, so this can use the existing dpi prop
 */
export function detectOriginalDPI(image: HTMLImageElement): number {
  // TODO: EXIF detection (Phase 1b)
  // For now, assume 150dpi
  return 150;
}

/**
 * Calculate original size in inches from image and DPI
 */
export function calculateOriginalSize(image: HTMLImageElement, dpi: number) {
  return {
    width: image.width / dpi,
    height: image.height / dpi,
    longest: Math.max(image.width, image.height) / dpi
  };
}

/**
 * Scale an image to target size at target DPI
 * @param image - Source image element
 * @param targetSizeInches - Target size in inches (longest side)
 * @param originalSizeInches - Original size in inches (longest side)
 * @param originalDPI - Original DPI of the image
 * @param targetDPI - Target DPI for export
 * @param format - Output format ('png' or 'jpg')
 * @returns Promise resolving to Blob of scaled image
 * 
 * Key insight: DPI only affects the physical size, not the pixel dimensions directly.
 * Formula: Target Pixels = Target Size (inches) × Target DPI
 */
export async function scaleImage(
  image: HTMLImageElement,
  targetSizeInches: number,
  originalSizeInches: number,
  originalDPI: number,
  targetDPI: number,
  format: 'png' | 'jpg'
): Promise<Blob> {
  
  // Calculate target pixel dimensions
  // targetSizeInches * targetDPI = final pixel width/height
  const targetPixels = targetSizeInches * targetDPI;
  
  // Calculate original pixel dimensions
  const originalPixels = originalSizeInches * originalDPI;
  
  // Scale factor is the ratio of target to original pixels
  const scaleFactor = targetPixels / originalPixels;
  
  // Apply scale factor to actual image dimensions
  const targetWidth = Math.round(image.width * scaleFactor);
  const targetHeight = Math.round(image.height * scaleFactor);
  
  console.log('Scaling:', {
    original: `${image.width}x${image.height} (${originalSizeInches}" at ${originalDPI}dpi)`,
    target: `${targetWidth}x${targetHeight} (${targetSizeInches}" at ${targetDPI}dpi)`,
    scaleFactor: scaleFactor.toFixed(2)
  });
  
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  
  ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
  
  // Create blob from canvas
  const blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob!),
      format === 'jpg' ? 'image/jpeg' : 'image/png',
      0.95
    );
  });
  
  // Inject DPI metadata
  if (format === 'png') {
    return await injectPngDpi(blob, targetDPI);
  } else {
    return await injectJpegDpi(blob, targetDPI);
  }
}

/**
 * Check for upscaling warnings based on pixel dimensions
 * Warns if target pixels exceed original pixels (which may cause pixelation)
 * Tells users the maximum size they can export at the selected DPI
 * @param image - Source image element
 * @param selectedSizes - Array of target sizes in inches (longest side)
 * @param originalSizeInches - Original size in inches (longest side)
 * @param originalDPI - Original DPI of the image
 * @param targetDPI - Target DPI for export
 * @returns Array of warning messages
 */
export function checkUpscaling(
  image: HTMLImageElement,
  selectedSizes: number[],
  originalSizeInches: number,
  originalDPI: number,
  targetDPI: number
): string[] {
  const warnings: string[] = [];
  
  // Calculate maximum size without pixelation
  const originalPixels = originalSizeInches * originalDPI;
  const maxSizeWithoutPixelation = originalPixels / targetDPI;
  
  // Find sizes that will cause pixelation
  const problematicSizes = selectedSizes.filter(size => {
    const targetPixels = size * targetDPI;
    return targetPixels > originalPixels;
  });
  
  if (problematicSizes.length > 0) {
    // Create a user-friendly message
    if (problematicSizes.length === 1) {
      warnings.push(
        `Selecting ${problematicSizes[0]}" at ${targetDPI}dpi may cause pixelation. ` +
        `The largest size you can export at ${targetDPI}dpi without pixelation is ${maxSizeWithoutPixelation.toFixed(1)}".`
      );
    } else {
      warnings.push(
        `Selecting ${problematicSizes.join('", "')}" at ${targetDPI}dpi may cause pixelation. ` +
        `The largest size you can export at ${targetDPI}dpi without pixelation is ${maxSizeWithoutPixelation.toFixed(1)}".`
      );
    }
  }
  
  return warnings;
}


