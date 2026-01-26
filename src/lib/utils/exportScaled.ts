import JSZip from 'jszip';
import { scaleImage, calculateOriginalSize, detectOriginalDPI } from './imageScaler';
import { injectPngDpi, injectJpegDpi, createTiffWithDpi } from './dpiMetadata';

export interface ScaledExportConfig {
  image: HTMLImageElement;
  selectedSizes: number[];      // [2, 4, 6, 8, 10]
  selectedDPI: 150 | 300;
  format: 'png' | 'jpg' | 'tif';
  repeatType: string;            // 'halfdrop', 'halfbrick', 'fulldrop'
  includeOriginal: boolean;
  originalDPI: number;           // Current DPI of the image from app state
  originalFilename: string | null; // Original filename without extension
}

/**
 * Generate a zip file containing scaled versions of the pattern
 */
export async function generateScaledExport(config: ScaledExportConfig) {
  const zip = new JSZip();
  const originalDPI = config.originalDPI || detectOriginalDPI(config.image);
  const originalSize = calculateOriginalSize(config.image, originalDPI);
  
  // Get base filename (use original filename if available, otherwise "pattern")
  const baseFilename = config.originalFilename || 'pattern';
  const fileExtension = config.format;
  
  // Add original tile
  if (config.includeOriginal) {
    const canvas = document.createElement('canvas');
    canvas.width = config.image.width;
    canvas.height = config.image.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(config.image, 0, 0);
    
    // Create blob with format-specific handling
    let blobWithDpi: Blob;
    if (config.format === 'tif') {
      // TIFF creation includes DPI metadata
      blobWithDpi = await createTiffWithDpi(canvas, originalDPI);
    } else {
      const originalBlob = await new Promise<Blob>((resolve) => {
        canvas.toBlob(
          (blob) => resolve(blob!),
          config.format === 'jpg' ? 'image/jpeg' : 'image/png',
          0.95
        );
      });

      // Inject DPI metadata for PNG/JPG
      blobWithDpi = config.format === 'png'
        ? await injectPngDpi(originalBlob, originalDPI)
        : await injectJpegDpi(originalBlob, originalDPI);
    }
    
    const originalFilename = `${baseFilename}-original-${originalDPI}dpi.${fileExtension}`;
    zip.file(originalFilename, blobWithDpi);
  }
  
  // Generate scaled versions
  for (const size of config.selectedSizes) {
    const scaledBlob = await scaleImage(
      config.image,
      size,
      originalSize.longest,
      originalDPI,
      config.selectedDPI,
      config.format
    );
    
    const filename = `${baseFilename}-${size}in-${config.selectedDPI}dpi.${fileExtension}`;
    zip.file(filename, scaledBlob);
  }
  
  // Generate and download zip
  const zipBlob = await zip.generateAsync({ 
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });
  
  const timestamp = new Date().toISOString().split('T')[0];
  const link = document.createElement('a');
  link.href = URL.createObjectURL(zipBlob);
  link.download = `${baseFilename}-scaled-${timestamp}.zip`;
  link.click();
  
  // Clean up object URL after a short delay
  setTimeout(() => {
    URL.revokeObjectURL(link.href);
  }, 100);
}


