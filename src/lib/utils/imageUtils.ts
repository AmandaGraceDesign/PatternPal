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







