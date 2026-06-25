// Core scaling utilities for easyscale export
import { injectPngDpi, injectJpegDpi, createTiffWithDpi } from './dpiMetadata';
import { assertExportCanvasWithinLimits } from './imageUtils';
import { canvasToBlob } from './downloadCanvas';

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
    width: image.naturalWidth / dpi,
    height: image.naturalHeight / dpi,
    longest: Math.max(image.naturalWidth, image.naturalHeight) / dpi
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
  format: 'png' | 'jpg' | 'tif'
): Promise<Blob> {
  
  // Calculate target pixel dimensions
  // targetSizeInches * targetDPI = final pixel width/height
  const targetPixels = targetSizeInches * targetDPI;
  
  // Calculate original pixel dimensions
  const originalPixels = originalSizeInches * originalDPI;
  
  // Scale factor is the ratio of target to original pixels
  const scaleFactor = targetPixels / originalPixels;
  
  // Apply scale factor to actual image dimensions
  const targetWidth = Math.round(image.naturalWidth * scaleFactor);
  const targetHeight = Math.round(image.naturalHeight * scaleFactor);

  console.log('Scaling:', {
    original: `${image.naturalWidth}x${image.naturalHeight} (${originalSizeInches}" at ${originalDPI}dpi)`,
    target: `${targetWidth}x${targetHeight} (${targetSizeInches}" at ${targetDPI}dpi)`,
    scaleFactor: scaleFactor.toFixed(2)
  });
  
  // Guard the device canvas ceiling BEFORE allocating. On iPad an oversized
  // canvas OOM-kills the tab (white "Application error") instead of throwing
  // catchably, so block it here with a friendly, catchable message.
  assertExportCanvasWithinLimits(targetWidth, targetHeight);

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error(
      'Could not create the export canvas (likely low memory on this device). ' +
      'Try a smaller size, fewer sizes at once, or close other browser tabs.'
    );
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

  try {
    // Create blob based on format (canvasToBlob rejects on a null blob rather
    // than silently passing null downstream into the DPI injector).
    if (format === 'tif') {
      // TIFF creation includes DPI metadata
      return await createTiffWithDpi(canvas, targetDPI);
    }
    const blob = await canvasToBlob(canvas, format === 'jpg' ? 'image/jpeg' : 'image/png', 0.95);
    return format === 'png'
      ? await injectPngDpi(blob, targetDPI)
      : await injectJpegDpi(blob, targetDPI);
  } finally {
    // Free the backing store immediately so the next size's canvas and the
    // final JSZip pass aren't competing with it for the iPad's memory budget.
    canvas.width = 0;
    canvas.height = 0;
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


