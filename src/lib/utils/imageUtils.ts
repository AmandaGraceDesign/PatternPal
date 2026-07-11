import { isIOS } from './downloadCanvas';

// Maximum per-side pixel dimension for uploaded patterns.
// Browser canvases (Chromium) cap at 16,384px per side; we leave a small margin
// so direct natural-size renders (main canvas, seam inspector, full-drop export)
// stay safely below the ceiling. Half-drop / half-brick conversion doubles one
// side and is gated separately at the conversion call site, not at upload.
export const MAX_PATTERN_DIMENSION = 15000;
export const BROWSER_CANVAS_LIMIT = 16384;

// iPad/iPhone Safari (and all iOS browsers, which are forced onto WebKit) cap
// canvases far lower than desktop — ~4096px/side, ~16.7M px area on 11" iPads —
// and run on a tight per-tab memory budget. Allocating a canvas above this
// doesn't throw catchably; it OOM-kills the tab, which surfaces to the user as
// the Next.js "Application error: a client-side exception has occurred" screen.
// We block oversized exports up front with a friendly message instead.
export const IOS_CANVAS_MAX_SIDE = 4096;
export const IOS_CANVAS_MAX_AREA = IOS_CANVAS_MAX_SIDE * IOS_CANVAS_MAX_SIDE; // 16,777,216

/**
 * Non-throwing predicate: does a canvas of these pixel dimensions fit within the
 * device's safe ceiling? Shared by the assert (export time) and the EasyScale
 * modal's size gating (selection time) so the UI never offers an export that the
 * assert would later reject. `onIOS` is injectable for testing.
 */
export function exportCanvasWithinLimits(
  width: number,
  height: number,
  onIOS: boolean = isIOS()
): boolean {
  const maxSide = onIOS ? IOS_CANVAS_MAX_SIDE : BROWSER_CANVAS_LIMIT;
  const maxArea = maxSide * maxSide;
  return !(width > maxSide || height > maxSide || width * height > maxArea);
}

/**
 * Largest export size (inches, longest side) that stays within the device's
 * canvas ceiling at the given DPI. On iOS this is far smaller than desktop
 * (4096/dpi ≈ 13.6" at 300 DPI). The EasyScale modal uses this to grey out and
 * auto-deselect sizes that would always hit the ceiling guard — otherwise a
 * large source lets the user pick a size that can never export, and that stuck
 * selection blocks every subsequent export until a full page refresh. `onIOS`
 * is injectable for testing.
 */
export function deviceMaxExportInches(dpi: number, onIOS: boolean = isIOS()): number {
  const maxSide = onIOS ? IOS_CANVAS_MAX_SIDE : BROWSER_CANVAS_LIMIT;
  return maxSide / dpi;
}

/**
 * Throw a friendly, catchable error if a target export canvas would exceed the
 * current device's safe ceiling. Call BEFORE allocating the canvas so the
 * export modal can show an inline message rather than crashing the tab.
 */
export function assertExportCanvasWithinLimits(width: number, height: number): void {
  if (exportCanvasWithinLimits(width, height)) return;

  const onIOS = isIOS();
  const maxSide = onIOS ? IOS_CANVAS_MAX_SIDE : BROWSER_CANVAS_LIMIT;
  const maxInchesAt300 = Math.floor(maxSide / 300);
  throw new Error(
    onIOS
      ? `This size is too large to export on iPad/iPhone (${width} × ${height}px). ` +
        `On this device the longest side maxes out near ${maxInchesAt300}" at 300 DPI. ` +
        `Try a smaller size, choose 150 DPI, or export from a desktop browser.`
      : `This export is too large for your browser (${width} × ${height}px). ` +
        `Try a smaller size or lower DPI.`
  );
}

export function validateImageDimensions(image: HTMLImageElement): void {
  if (
    image.naturalWidth > MAX_PATTERN_DIMENSION ||
    image.naturalHeight > MAX_PATTERN_DIMENSION
  ) {
    throw new Error(
      `Your image is ${image.naturalWidth} × ${image.naturalHeight} pixels. ` +
      `Patternpal supports patterns up to ${MAX_PATTERN_DIMENSION} × ${MAX_PATTERN_DIMENSION} pixels. ` +
      `Please resize and re-import.`
    );
  }
}

// Extract DPI from image file metadata
export async function extractDpiFromFile(file: File | Blob): Promise<number | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const arrayBuffer = e.target?.result as ArrayBuffer;
      if (!arrayBuffer) {
        resolve(null);
        return;
      }
      
      const view = new DataView(arrayBuffer);
      const fileType = detectFileType(view);
      
      // Check for PNG format
      if (fileType === 'PNG') {
        try {
          let offset = 8;
          let chunkIndex = 0;
          while (offset < view.byteLength - 12) {
            const chunkLength = view.getUint32(offset);
            const chunkType = String.fromCharCode(
              view.getUint8(offset + 4),
              view.getUint8(offset + 5),
              view.getUint8(offset + 6),
              view.getUint8(offset + 7)
            );
            
            // pHYs chunk contains physical pixel dimensions
            if (chunkType === 'pHYs') {
              const pixelsPerUnitX = view.getUint32(offset + 8);
              const unit = view.getUint8(offset + 16);
              
              // Unit = 1 means pixels per meter
              if (unit === 1) {
                const dpi = Math.round(pixelsPerUnitX / 39.3701); // Convert meter to inch
                resolve(dpi);
                return;
              }
            }
            
            offset += chunkLength + 12;
            chunkIndex++;
            
            if (chunkType === 'IEND') break;
            if (chunkIndex > 100) break;
          }
        } catch (error) {
          console.error('Error parsing PNG metadata:', error);
        }
      }
      
      // Check for JPEG format
      if (fileType === 'JPEG') {
        try {
          let offset = 2;
          let markerIndex = 0;
          
          while (offset < view.byteLength - 4) {
            if (view.getUint8(offset) !== 0xff) break;
            
            const markerType = view.getUint8(offset + 1);
            if (markerType === 0xff) {
              offset++;
              continue;
            }
            
            const marker = (0xff << 8) | markerType;
            const length = view.getUint16(offset + 2);
            
            // APP0 (JFIF) marker
            if (marker === 0xffe0 && length >= 16) {
              const identifier = String.fromCharCode(
                view.getUint8(offset + 4),
                view.getUint8(offset + 5),
                view.getUint8(offset + 6),
                view.getUint8(offset + 7),
                view.getUint8(offset + 8)
              );
              
              if (identifier.startsWith('JFIF')) {
                const densityUnits = view.getUint8(offset + 11);
                const xDensity = view.getUint16(offset + 12);
                
                if (densityUnits === 1 && xDensity > 0) {
                  resolve(xDensity);
                  return;
                } else if (densityUnits === 2 && xDensity > 0) {
                  const dpi = Math.round(xDensity * 2.54);
                  resolve(dpi);
                  return;
                }
              }
            }
            
            // APP1 (EXIF) marker
            if (marker === 0xffe1 && length > 16) {
              const identifier = String.fromCharCode(
                view.getUint8(offset + 4),
                view.getUint8(offset + 5),
                view.getUint8(offset + 6),
                view.getUint8(offset + 7)
              );
              
              if (identifier === 'Exif') {
                try {
                  const exifOffset = offset + 10;
                  const byteOrder = String.fromCharCode(
                    view.getUint8(exifOffset),
                    view.getUint8(exifOffset + 1)
                  );
                  const isLittleEndian = byteOrder === 'II';
                  
                  const ifd0Offset = exifOffset + view.getUint32(exifOffset + 4, isLittleEndian);
                  const numEntries = view.getUint16(ifd0Offset, isLittleEndian);
                  
                  let xResolution = null;
                  let resolutionUnit = null;
                  
                  for (let i = 0; i < numEntries; i++) {
                    const entryOffset = ifd0Offset + 2 + (i * 12);
                    const tag = view.getUint16(entryOffset, isLittleEndian);
                    const valueOffset = view.getUint32(entryOffset + 8, isLittleEndian);
                    
                    if (tag === 0x011A) {
                      const dataOffset = exifOffset + valueOffset;
                      const numerator = view.getUint32(dataOffset, isLittleEndian);
                      const denominator = view.getUint32(dataOffset + 4, isLittleEndian);
                      xResolution = numerator / denominator;
                    }
                    
                    if (tag === 0x0128) {
                      resolutionUnit = view.getUint16(entryOffset + 8, isLittleEndian);
                    }
                  }
                  
                  if (xResolution && resolutionUnit === 2) {
                    const dpi = Math.round(xResolution);
                    resolve(dpi);
                    return;
                  } else if (xResolution && resolutionUnit === 3) {
                    const dpi = Math.round(xResolution * 2.54);
                    resolve(dpi);
                    return;
                  }
                } catch (error) {
                  console.error('Error parsing EXIF data:', error);
                }
              }
            }
            
            offset += length + 2;
            markerIndex++;
            
            if (markerIndex > 50) break;
            if (marker === 0xffda) break;
          }
        } catch (error) {
          console.error('Error parsing JPEG metadata:', error);
        }
      }
      
      resolve(null);
    };
    
    reader.onerror = () => resolve(null);
    reader.readAsArrayBuffer(file);
  });
}

// Friendly notice shown when a CMYK file is uploaded. CMYK is a print color
// mode; browsers/screens are RGB-only and convert CMYK on decode (ignoring the
// embedded ICC profile), which visibly shifts colors. The fix is to re-export
// as RGB — so we tell the user exactly that.
export const CMYK_WARNING_MESSAGE =
  'Heads up — this looks like a CMYK file (a print color mode). ' +
  'Screens can only display RGB, so your colors may look different here than ' +
  'in your design software. For accurate color, re-export as RGB ' +
  '(in Illustrator: File → Document Color Mode → RGB Color) and upload again. ' +
  'CMYK is only needed when sending to a physical printer.';

// SOFn (Start Of Frame) markers that carry the component count. Excludes
// 0xC4 (DHT), 0xC8 (JPG), 0xCC (DAC), which are not frame headers.
const SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

/**
 * Detect whether a JPEG is CMYK (or YCCK) by reading the component count in its
 * SOF marker. The component count is the definitive color-space signal:
 *   1 = grayscale, 3 = RGB (YCbCr), 4 = CMYK / YCCK.
 * Returns false for non-JPEG, RGB, grayscale, or malformed buffers.
 */
export function isCmykJpegBuffer(buffer: ArrayBuffer): boolean {
  try {
    const view = new DataView(buffer);
    if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return false; // not JPEG

    let offset = 2;
    let markerCount = 0;
    while (offset < view.byteLength - 9) {
      if (view.getUint8(offset) !== 0xff) {
        offset++;
        continue;
      }
      const markerType = view.getUint8(offset + 1);

      // Fill byte (0xFF padding) — advance one and retry.
      if (markerType === 0xff) {
        offset++;
        continue;
      }
      // Standalone markers with no length payload: SOI, EOI, TEM, RSTn.
      if (
        markerType === 0xd8 ||
        markerType === 0xd9 ||
        markerType === 0x01 ||
        (markerType >= 0xd0 && markerType <= 0xd7)
      ) {
        offset += 2;
        continue;
      }

      const length = view.getUint16(offset + 2);

      if (SOF_MARKERS.has(markerType)) {
        // Layout: FF, marker, length(2), precision(1), height(2), width(2), Nf(1)
        const components = view.getUint8(offset + 9);
        return components === 4;
      }

      if (markerType === 0xda) break; // SOS: scan data begins, no SOF after this
      offset += 2 + length;
      if (++markerCount > 50) break;
    }
  } catch {
    // Malformed header — treat as "not detected" rather than crashing upload.
    return false;
  }
  return false;
}

/**
 * Read a file and report whether it is a CMYK JPEG. Resolves false on any read
 * error so it can never block an upload.
 */
export async function detectCmykJpeg(file: File | Blob): Promise<boolean> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const buf = e.target?.result as ArrayBuffer | undefined;
      resolve(buf ? isCmykJpegBuffer(buf) : false);
    };
    reader.onerror = () => resolve(false);
    reader.readAsArrayBuffer(file);
  });
}

function detectFileType(view: DataView): string {
  if (view.byteLength >= 4 && view.getUint32(0) === 0x89504e47) {
    return 'PNG';
  }
  if (view.byteLength >= 2 && view.getUint16(0) === 0xffd8) {
    return 'JPEG';
  }
  // Check for SVG (starts with '<' or '<?xml' or whitespace + '<svg')
  if (view.byteLength >= 5) {
    const firstBytes = String.fromCharCode(
      view.getUint8(0),
      view.getUint8(1),
      view.getUint8(2),
      view.getUint8(3),
      view.getUint8(4)
    );
    if (firstBytes.includes('<svg') || firstBytes.startsWith('<?xml') || firstBytes.startsWith('<')) {
      return 'SVG';
    }
  }
  return 'UNKNOWN';
}

/**
 * Validate and sanitize SVG files to prevent XSS attacks
 * Rejects SVGs with dangerous elements (script, object, embed, iframe)
 * @throws Error if SVG contains dangerous content
 */
export async function validateSvgSafety(file: File | Blob): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) {
        reject(new Error('Failed to read SVG file'));
        return;
      }

      // Check for dangerous tags and attributes
      const dangerousPatterns = [
        /<script[\s>]/i,                    // <script> tags
        /on\w+\s*=/i,                       // Event handlers (onclick, onload, etc.)
        /<object[\s>]/i,                    // <object> tags
        /<embed[\s>]/i,                     // <embed> tags
        /<iframe[\s>]/i,                    // <iframe> tags
        /javascript:/i,                     // javascript: protocol
        /data:text\/html/i,                 // data: HTML URIs
        /<foreignObject[\s>]/i,             // <foreignObject> can contain HTML
        /<use[\s>][^>]*href\s*=\s*["']?data:/i, // data URIs in <use>
        /<image[\s>][^>]*href\s*=\s*["']?data:(?!image)/i, // Non-image data URIs
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(text)) {
          reject(new Error('SVG contains potentially dangerous content and cannot be uploaded. Please use PNG or JPEG formats instead.'));
          return;
        }
      }

      // Additional check: ensure it's actually an SVG
      if (!text.includes('<svg')) {
        reject(new Error('File does not appear to be a valid SVG'));
        return;
      }

      resolve();
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * Create a seamless default pattern using the placeholder jpg design
 * This pattern tiles perfectly by ensuring edges match
 * @param size Optional size for the pattern (default: 800). Recommended: power-of-2 (256, 512) for better scaling
 */
export function createSeamlessDefaultPattern(size: number = 800): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    
    const ctx = canvas.getContext('2d')!;

    // Load the placeholder jpg
    const img = new Image();
    img.src = '/place_design_here.jpg';
    
    img.onload = () => {
      // #region agent log
      // #endregion
      
      // Draw the jpg to canvas first (scale jpg to requested size)
      ctx.drawImage(img, 0, 0, size, size);
      
      // #region agent log
      // #endregion
      
      // Check edge pixels before clearing
      const beforeTop = ctx.getImageData(0, 0, size, 1);
      const beforeBottom = ctx.getImageData(0, size - 1, size, 1);
      const beforeLeft = ctx.getImageData(0, 0, 1, size);
      const beforeRight = ctx.getImageData(size - 1, 0, 1, size);
      
      // #region agent log
      // #endregion
      
     
      resolve(canvas);
    };
    
    img.onerror = () => {
      // Fallback: recreate the design programmatically if SVG fails
      // White background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      
      // Center text (scale font size proportionally)
      ctx.fillStyle = '#000000';
      const fontSize = Math.round(size * 0.09); // ~9% of size (was 36px for 400px)
      ctx.font = `bold ${fontSize}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PLACE YOUR', size / 2, size * 0.4625);
      ctx.fillText('DESIGN HERE', size / 2, size * 0.5625);
      
      // Dotted lines from corners (simplified - just draw lines)
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      
      const margin = size * 0.025; // 2.5% margin
      const lineStartX = margin;
      const lineStartY = margin;
      const lineEndX = size - margin - size * 0.15;
      const lineEndY = size * 0.4625;
      
      ctx.beginPath();
      ctx.moveTo(lineStartX, lineStartY);
      ctx.lineTo(lineEndX, lineEndY);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(size - lineStartX, lineStartY);
      ctx.lineTo(size - lineEndX, lineEndY);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(lineStartX, size - lineStartY);
      ctx.lineTo(lineEndX, size * 0.5625);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(size - lineStartX, size - lineStartY);
      ctx.lineTo(size - lineEndX, size * 0.5625);
      ctx.stroke();
      
      // Clear edges for seamless tiling
      ctx.fillStyle = '#ffffff';
      const edgeBorder = 3;
      ctx.fillRect(0, 0, size, edgeBorder);
      ctx.fillRect(0, size - edgeBorder, size, edgeBorder);
      ctx.fillRect(0, 0, edgeBorder, size);
      ctx.fillRect(size - edgeBorder, 0, edgeBorder, size);
      
      resolve(canvas);
    };
    
    // Load image from public folder
    img.src = '/place_design_here.jpg';
  });
}

/**
 * Convert canvas to HTMLImageElement
 */
export function canvasToImage(canvas: HTMLCanvasElement): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to convert canvas to image'));
    img.src = canvas.toDataURL('image/png');
  });
}








