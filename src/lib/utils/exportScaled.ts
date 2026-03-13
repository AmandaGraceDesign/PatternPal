import JSZip from 'jszip';
import { scaleImage, calculateOriginalSize, detectOriginalDPI } from './imageScaler';
import { injectPngDpi, injectJpegDpi, createTiffWithDpi } from './dpiMetadata';
import { sanitizeFilename } from './sanitizeFilename';
import { convertToFullDrop } from './convertToFullDrop';

const FREE_USER_SIZES = [8, 12];

async function verifyProAccessIfNeeded(config: ScaledExportConfig) {
  const usesProDpi = config.selectedDPI === 300;
  const usesProFormat = config.format !== 'jpg';
  const usesProSizes = config.selectedSizes.some((size) => !FREE_USER_SIZES.includes(size));
  const usesExtraSizes = config.selectedSizes.length > FREE_USER_SIZES.length;
  const usesOriginal = config.includeOriginal;

  const requiresPro = usesProDpi || usesProFormat || usesProSizes || usesExtraSizes || usesOriginal;
  if (!requiresPro) return;

  const res = await fetch('/api/pro/verify', { method: 'POST' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Pro required for this export.');
  }
}

export interface ScaledExportConfig {
  image: HTMLImageElement;
  selectedSizes: number[];      // [2, 4, 6, 8, 10]
  selectedDPI: 150 | 300;
  format: 'png' | 'jpg' | 'tif';
  repeatType: string;            // 'halfdrop', 'halfbrick', 'fulldrop'
  includeOriginal: boolean;
  originalDPI: number;           // Current DPI of the image from app state
  originalFilename: string | null; // Original filename without extension
  exportUnit?: 'in' | 'cm' | 'px';
  convertToFullDrop?: boolean;   // Convert HD/HB tile to full-drop before scaling
}

/**
 * Generate a zip file containing scaled versions of the pattern
 */
export async function generateScaledExport(config: ScaledExportConfig) {
  await verifyProAccessIfNeeded(config);
  const zip = new JSZip();
  const originalDPI = config.originalDPI || detectOriginalDPI(config.image);

  // Get base filename (use original filename if available, otherwise "pattern")
  const baseFilename = sanitizeFilename(config.originalFilename || 'pattern', 'pattern');
  const fileExtension = config.format;

  // If converting to full-drop, create the converted tile as an HTMLImageElement
  let exportImage = config.image;
  let exportDPI = originalDPI;
  const needsConversion = config.convertToFullDrop &&
    (config.repeatType === 'halfdrop' || config.repeatType === 'halfbrick');

  if (needsConversion) {
    const convertedCanvas = convertToFullDrop(config.image, config.repeatType);
    // Convert canvas to HTMLImageElement for the scaleImage pipeline
    exportImage = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = convertedCanvas.toDataURL('image/png');
    });
    // DPI stays the same — the tile just got bigger in pixels
    exportDPI = originalDPI;
  }

  // When converting to full-drop, the user's selected size refers to their
  // original tile (the unchanged side). Use original tile's longest side as the
  // scaling reference so the original portion exports at the requested size,
  // and the doubled dimension naturally becomes 2× that.
  const originalTileSize = calculateOriginalSize(config.image, originalDPI);
  const scalingReference = needsConversion ? originalTileSize.longest : calculateOriginalSize(exportImage, exportDPI).longest;

  // Add original tile (always the unconverted tile)
  if (config.includeOriginal) {
    const canvas = document.createElement('canvas');
    canvas.width = config.image.naturalWidth;
    canvas.height = config.image.naturalHeight;
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

  // Generate scaled versions (using converted image if applicable)
  for (const size of config.selectedSizes) {
    const scaledBlob = await scaleImage(
      exportImage,
      size,
      scalingReference,
      exportDPI,
      config.selectedDPI,
      config.format
    );

    const suffix = needsConversion ? '-fulldrop' : '';
    const exportUnit = config.exportUnit || 'in';
    const sizeLabel = exportUnit === 'in' ? `${size}in` : exportUnit === 'cm' ? `${(size * 2.54).toFixed(1)}cm` : `${Math.round(size * config.selectedDPI)}px`;
    const filename = `${baseFilename}-${sizeLabel}-${config.selectedDPI}dpi${suffix}.${fileExtension}`;
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
  const zipUrl = URL.createObjectURL(zipBlob);
  link.href = zipUrl;
  link.download = `${baseFilename}-scaled-${timestamp}.zip`;
  link.click();
  
  // Clean up object URL after a short delay
  setTimeout(() => {
    URL.revokeObjectURL(zipUrl);
  }, 100);
}


