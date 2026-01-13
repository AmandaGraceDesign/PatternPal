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
                const densityUnits = view.getUint8(offset + 9);
                const xDensity = view.getUint16(offset + 10);
                
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

function detectFileType(view: DataView): string {
  if (view.byteLength >= 4 && view.getUint32(0) === 0x89504e47) {
    return 'PNG';
  }
  if (view.byteLength >= 2 && view.getUint16(0) === 0xffd8) {
    return 'JPEG';
  }
  return 'UNKNOWN';
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
      fetch('http://127.0.0.1:7242/ingest/f37b4cf4-ef5d-4355-935c-d1043bf409fa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'imageUtils.ts:197',message:'Default pattern SVG loaded',data:{svgWidth:img.width,svgHeight:img.height,canvasWidth:canvas.width,canvasHeight:canvas.height,expectedSize:400},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      // Draw the jpg to canvas first (scale jpg to requested size)
      ctx.drawImage(img, 0, 0, size, size);
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/f37b4cf4-ef5d-4355-935c-d1043bf409fa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'imageUtils.ts:200',message:'SVG drawn to canvas, checking edge pixels',data:{checkingEdgePixels:true},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      
      // Check edge pixels before clearing
      const beforeTop = ctx.getImageData(0, 0, size, 1);
      const beforeBottom = ctx.getImageData(0, size - 1, size, 1);
      const beforeLeft = ctx.getImageData(0, 0, 1, size);
      const beforeRight = ctx.getImageData(size - 1, 0, 1, size);
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/f37b4cf4-ef5d-4355-935c-d1043bf409fa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'imageUtils.ts:207',message:'Edge pixels before clearing',data:{topEdgeSample:[...beforeTop.data.slice(0,12)],bottomEdgeSample:[...beforeBottom.data.slice(0,12)],leftEdgeSample:[...beforeLeft.data.slice(0,12)],rightEdgeSample:[...beforeRight.data.slice(0,12)]},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
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








