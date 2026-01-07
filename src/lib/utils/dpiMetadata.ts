/**
 * DPI Metadata Injection Utilities
 * Injects DPI metadata into PNG and JPEG files so they open at correct physical sizes
 */

/**
 * Calculate CRC32 checksum for PNG chunks
 * Uses the standard PNG CRC32 polynomial
 */
function calculateCRC32(data: Uint8Array): number {
  const crcTable: number[] = [];
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
    }
    crcTable[i] = crc;
  }

  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Inject DPI metadata into PNG file
 * Creates or updates the pHYs chunk with DPI information
 */
export async function injectPngDpi(blob: Blob, dpi: number): Promise<Blob> {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const view = new DataView(arrayBuffer);
    
    // Validate PNG signature
    if (view.byteLength < 8 || view.getUint32(0) !== 0x89504e47) {
      console.warn('Invalid PNG file, returning original');
      return blob;
    }

    // Convert DPI to pixels per meter (PNG uses meters)
    const pixelsPerMeter = Math.round(dpi * 39.3701);
    
    // Create pHYs chunk data
    const chunkType = new Uint8Array([0x70, 0x48, 0x59, 0x73]); // "pHYs"
    const chunkData = new Uint8Array(9);
    const dataView = new DataView(chunkData.buffer);
    
    // Write pixels per unit X (big-endian)
    dataView.setUint32(0, pixelsPerMeter, false);
    // Write pixels per unit Y (big-endian)
    dataView.setUint32(4, pixelsPerMeter, false);
    // Write unit (1 = meter)
    dataView.setUint8(8, 1);
    
    // Calculate CRC32 for chunk type + data
    const crcData = new Uint8Array(4 + 9);
    crcData.set(chunkType, 0);
    crcData.set(chunkData, 4);
    const crc = calculateCRC32(crcData);
    
    // Build complete chunk: length (4) + type (4) + data (9) + CRC (4) = 21 bytes
    const chunkLength = 9;
    const fullChunk = new Uint8Array(21);
    const chunkView = new DataView(fullChunk.buffer);
    chunkView.setUint32(0, chunkLength, false); // Length
    fullChunk.set(chunkType, 4); // Type
    fullChunk.set(chunkData, 8); // Data
    chunkView.setUint32(17, crc, false); // CRC
    
    // Find insertion point (after IHDR, before IEND)
    let offset = 8; // After PNG signature
    let foundPhys = false;
    let physOffset = -1;
    let iendOffset = -1;
    
    while (offset < view.byteLength - 12) {
      const chunkLength = view.getUint32(offset, false);
      const chunkType = String.fromCharCode(
        view.getUint8(offset + 4),
        view.getUint8(offset + 5),
        view.getUint8(offset + 6),
        view.getUint8(offset + 7)
      );
      
      if (chunkType === 'pHYs') {
        foundPhys = true;
        physOffset = offset;
      }
      
      if (chunkType === 'IEND') {
        iendOffset = offset;
        break;
      }
      
      offset += chunkLength + 12; // length + type + data + CRC
    }
    
    if (foundPhys && physOffset !== -1) {
      // Replace existing pHYs chunk
      const oldChunkLength = view.getUint32(physOffset, false);
      const oldChunkSize = 12 + oldChunkLength; // length (4) + type (4) + data + CRC (4)
      const newChunkSize = 21; // Our new pHYs chunk is always 21 bytes
      const sizeDiff = newChunkSize - oldChunkSize;
      
      // Build new file with adjusted size
      const newFile = new Uint8Array(arrayBuffer.byteLength + sizeDiff);
      
      // Copy everything before pHYs
      newFile.set(new Uint8Array(arrayBuffer, 0, physOffset), 0);
      
      // Insert new pHYs chunk
      newFile.set(fullChunk, physOffset);
      
      // Copy everything after old pHYs chunk
      const afterOffset = physOffset + oldChunkSize;
      newFile.set(
        new Uint8Array(arrayBuffer, afterOffset),
        physOffset + newChunkSize
      );
      
      return new Blob([newFile], { type: 'image/png' });
    } else if (iendOffset !== -1) {
      // Insert pHYs before IEND
      // Build new file with 21 additional bytes
      const newFile = new Uint8Array(arrayBuffer.byteLength + 21);
      // Insert pHYs before IEND
      // Copy everything before IEND
      newFile.set(new Uint8Array(arrayBuffer, 0, iendOffset), 0);
      
      // Insert pHYs chunk
      newFile.set(fullChunk, iendOffset);
      
      // Copy IEND and everything after
      newFile.set(
        new Uint8Array(arrayBuffer, iendOffset),
        iendOffset + 21
      );
      
      return new Blob([newFile], { type: 'image/png' });
    } else {
      // Fallback: append before end (shouldn't happen in valid PNG)
      console.warn('Could not find IEND chunk, appending pHYs at end');
      const newFile = new Uint8Array(arrayBuffer.byteLength + 21);
      newFile.set(new Uint8Array(arrayBuffer), 0);
      newFile.set(fullChunk, arrayBuffer.byteLength - 12); // Before IEND
      return new Blob([newFile], { type: 'image/png' });
    }
  } catch (error) {
    console.error('Error injecting PNG DPI:', error);
    return blob; // Return original on error
  }
}

/**
 * Inject DPI metadata into JPEG file
 * Creates or updates the JFIF APP0 marker with DPI information
 */
export async function injectJpegDpi(blob: Blob, dpi: number): Promise<Blob> {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const view = new DataView(arrayBuffer);
    
    // Validate JPEG signature
    if (view.byteLength < 2 || view.getUint16(0) !== 0xffd8) {
      console.warn('Invalid JPEG file, returning original');
      return blob;
    }
    
    // Validate DPI range
    if (dpi < 1 || dpi > 65535) {
      console.warn('DPI out of range, returning original');
      return blob;
    }
    
    let offset = 2; // After SOI (0xFFD8)
    let foundJfif = false;
    let jfifOffset = -1;
    let jfifLength = 0;
    
    // Find existing JFIF marker
    while (offset < view.byteLength - 4) {
      if (view.getUint8(offset) !== 0xff) break;
      
      const markerType = view.getUint8(offset + 1);
      
      // Skip padding bytes
      if (markerType === 0xff) {
        offset++;
        continue;
      }
      
      const marker = (0xff << 8) | markerType;
      const length = view.getUint16(offset + 2, false); // Big-endian
      
      // Check for JFIF APP0 marker
      if (marker === 0xffe0 && length >= 16) {
        const identifier = String.fromCharCode(
          view.getUint8(offset + 4),
          view.getUint8(offset + 5),
          view.getUint8(offset + 6),
          view.getUint8(offset + 7),
          view.getUint8(offset + 8)
        );
        
        if (identifier.startsWith('JFIF')) {
          foundJfif = true;
          jfifOffset = offset;
          jfifLength = length + 2; // Include marker bytes
          break;
        }
      }
      
      // Stop at Start of Scan (image data)
      if (marker === 0xffda) break;
      
      offset += length + 2;
    }
    
    // Create JFIF APP0 marker
    // Structure: [0xFF, 0xE0, length(2), "JFIF\0", version(2), units(1), Xdensity(2), Ydensity(2), Xthumbnail(1), Ythumbnail(1)]
    const jfifData = new Uint8Array(16);
    const jfifView = new DataView(jfifData.buffer);
    
    jfifData[0] = 0xff;
    jfifData[1] = 0xe0;
    jfifView.setUint16(2, 16, false); // Length (big-endian)
    jfifData[4] = 0x4a; // 'J'
    jfifData[5] = 0x46; // 'F'
    jfifData[6] = 0x49; // 'I'
    jfifData[7] = 0x46; // 'F'
    jfifData[8] = 0x00; // '\0'
    jfifData[9] = 0x01; // Version major
    jfifData[10] = 0x01; // Version minor
    jfifData[11] = 0x01; // Density units (1 = DPI)
    jfifView.setUint16(12, dpi, false); // X density (big-endian)
    jfifView.setUint16(14, dpi, false); // Y density (big-endian)
    
    if (foundJfif && jfifOffset !== -1) {
      // Update existing JFIF marker in place
      const newFile = new Uint8Array(arrayBuffer);
      const fileView = new DataView(newFile.buffer, jfifOffset);
      
      // Update density fields (offsets are relative to jfifOffset)
      fileView.setUint8(11, 1); // Density units (1 = DPI)
      fileView.setUint16(12, dpi, false); // X density (big-endian)
      fileView.setUint16(14, dpi, false); // Y density (big-endian)
      
      return new Blob([newFile], { type: 'image/jpeg' });
    } else {
      // Insert new JFIF marker after SOI (0xFFD8)
      const newFile = new Uint8Array(arrayBuffer.byteLength + 18);
      
      // Copy SOI
      newFile.set(new Uint8Array(arrayBuffer, 0, 2), 0);
      
      // Insert JFIF marker
      newFile.set(jfifData, 2);
      
      // Copy rest of file
      newFile.set(new Uint8Array(arrayBuffer, 2), 20);
      
      return new Blob([newFile], { type: 'image/jpeg' });
    }
  } catch (error) {
    console.error('Error injecting JPEG DPI:', error);
    return blob; // Return original on error
  }
}

