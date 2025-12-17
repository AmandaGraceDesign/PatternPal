'use client';
import Ruler from './Ruler';
import { useEffect, useRef, useState } from 'react';
import { PatternTiler, RepeatType } from '@/lib/tiling/PatternTiler';

// Extract DPI from image file metadata
async function extractDpiFromFile(file: File | Blob): Promise<number | null> {
  console.log('=== Starting DPI extraction ===');
  console.log('File type:', file.type);
  console.log('File size:', file.size);
  
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const arrayBuffer = e.target?.result as ArrayBuffer;
      if (!arrayBuffer) {
        console.log('❌ No array buffer');
        resolve(null);
        return;
      }
      
      console.log('✓ Array buffer loaded, size:', arrayBuffer.byteLength);
      
      const view = new DataView(arrayBuffer);
      const fileType = detectFileType(view);
      console.log('✓ Detected file type:', fileType);
      
      // Check for PNG format
      if (fileType === 'PNG') {
        console.log('📄 Processing PNG file...');
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
            
            console.log(`  Chunk ${chunkIndex}: ${chunkType}, length: ${chunkLength}, offset: ${offset}`);
            
            // pHYs chunk contains physical pixel dimensions
            if (chunkType === 'pHYs') {
              const pixelsPerUnitX = view.getUint32(offset + 8);
              const pixelsPerUnitY = view.getUint32(offset + 12);
              const unit = view.getUint8(offset + 16);
              
              console.log(`  ✓ pHYs chunk found!`);
              console.log(`    X: ${pixelsPerUnitX} pixels per unit`);
              console.log(`    Y: ${pixelsPerUnitY} pixels per unit`);
              console.log(`    Unit: ${unit} (1=meter, 0=unknown)`);
              
              // Unit = 1 means pixels per meter
              if (unit === 1) {
                const dpi = Math.round(pixelsPerUnitX / 39.3701); // Convert meter to inch
                console.log(`  ✅ Calculated DPI from PNG: ${dpi}`);
                resolve(dpi);
                return;
              } else {
                console.log(`  ⚠️ Unit is not meters, cannot calculate DPI`);
              }
            }
            
            offset += chunkLength + 12;
            chunkIndex++;
            
            if (chunkType === 'IEND') {
              console.log('  Reached IEND chunk');
              break;
            }
            
            // Safety limit
            if (chunkIndex > 100) {
              console.log('  ⚠️ Too many chunks, stopping');
              break;
            }
          }
          console.log('❌ No pHYs chunk found with valid unit');
        } catch (error) {
          console.error('❌ Error parsing PNG metadata:', error);
        }
      }
      
      // Check for JPEG format
      if (fileType === 'JPEG') {
        console.log('📄 Processing JPEG file...');
        try {
          let offset = 2;
          let markerIndex = 0;
          
          while (offset < view.byteLength - 4) {
            // JPEG markers start with 0xFF
            if (view.getUint8(offset) !== 0xff) {
              console.log(`  ⚠️ Expected 0xFF at offset ${offset}, got 0x${view.getUint8(offset).toString(16)}`);
              break;
            }
            
            const markerType = view.getUint8(offset + 1);
            const marker = (0xff << 8) | markerType;
            
            // Skip padding bytes
            if (markerType === 0xff) {
              offset++;
              continue;
            }
            
            const length = view.getUint16(offset + 2);
            
            console.log(`  Marker ${markerIndex}: 0x${marker.toString(16)}, length: ${length}, offset: ${offset}`);
            
            // APP0 (JFIF) marker (0xFFE0)
            if (marker === 0xffe0 && length >= 16) {
              const identifier = String.fromCharCode(
                view.getUint8(offset + 4),
                view.getUint8(offset + 5),
                view.getUint8(offset + 6),
                view.getUint8(offset + 7),
                view.getUint8(offset + 8)
              );
              
              console.log(`    Identifier: "${identifier}"`);
              
              if (identifier.startsWith('JFIF')) {
                const densityUnits = view.getUint8(offset + 9);
                const xDensity = view.getUint16(offset + 10);
                const yDensity = view.getUint16(offset + 12);
                
                console.log(`    ✓ JFIF header found!`);
                console.log(`      Density units: ${densityUnits} (0=none, 1=dpi, 2=dpcm)`);
                console.log(`      X density: ${xDensity}`);
                console.log(`      Y density: ${yDensity}`);
                
                if (densityUnits === 1 && xDensity > 0) {
                  console.log(`    ✅ Found JPEG DPI: ${xDensity}`);
                  resolve(xDensity);
                  return;
                } else if (densityUnits === 2 && xDensity > 0) {
                  const dpi = Math.round(xDensity * 2.54);
                  console.log(`    ✅ Calculated DPI from JPEG (dpcm): ${dpi}`);
                  resolve(dpi);
                  return;
                } else {
                  console.log(`    ⚠️ Density units is ${densityUnits}, cannot calculate DPI`);
                }
              }
            }
            
            // APP1 (EXIF) marker (0xFFE1)
            if (marker === 0xffe1 && length > 16) {
              const identifier = String.fromCharCode(
                view.getUint8(offset + 4),
                view.getUint8(offset + 5),
                view.getUint8(offset + 6),
                view.getUint8(offset + 7)
              );
              
              console.log(`    Identifier: "${identifier}"`);
              
              if (identifier === 'Exif') {
                console.log(`    ✓ EXIF header found!`);
                
                try {
                  // EXIF data starts after "Exif\0\0"
                  const exifOffset = offset + 10;
                  
                  // Check byte order (II = little-endian, MM = big-endian)
                  const byteOrder = String.fromCharCode(
                    view.getUint8(exifOffset),
                    view.getUint8(exifOffset + 1)
                  );
                  const isLittleEndian = byteOrder === 'II';
                  
                  console.log(`      Byte order: ${byteOrder} (${isLittleEndian ? 'little-endian' : 'big-endian'})`);
                  
                  // Read IFD0 offset
                  const ifd0Offset = exifOffset + view.getUint32(exifOffset + 4, isLittleEndian);
                  const numEntries = view.getUint16(ifd0Offset, isLittleEndian);
                  
                  console.log(`      IFD0 entries: ${numEntries}`);
                  
                  // Look for XResolution (0x011A) and ResolutionUnit (0x0128)
                  let xResolution = null;
                  let yResolution = null;
                  let resolutionUnit = null;
                  
                  for (let i = 0; i < numEntries; i++) {
                    const entryOffset = ifd0Offset + 2 + (i * 12);
                    const tag = view.getUint16(entryOffset, isLittleEndian);
                    const valueOffset = view.getUint32(entryOffset + 8, isLittleEndian);
                    
                    // XResolution tag (0x011A)
                    if (tag === 0x011A) {
                      const dataOffset = exifOffset + valueOffset;
                      const numerator = view.getUint32(dataOffset, isLittleEndian);
                      const denominator = view.getUint32(dataOffset + 4, isLittleEndian);
                      xResolution = numerator / denominator;
                      console.log(`      XResolution: ${numerator}/${denominator} = ${xResolution}`);
                    }
                    
                    // YResolution tag (0x011B)
                    if (tag === 0x011B) {
                      const dataOffset = exifOffset + valueOffset;
                      const numerator = view.getUint32(dataOffset, isLittleEndian);
                      const denominator = view.getUint32(dataOffset + 4, isLittleEndian);
                      yResolution = numerator / denominator;
                      console.log(`      YResolution: ${numerator}/${denominator} = ${yResolution}`);
                    }
                    
                    // ResolutionUnit tag (0x0128)
                    if (tag === 0x0128) {
                      resolutionUnit = view.getUint16(entryOffset + 8, isLittleEndian);
                      console.log(`      ResolutionUnit: ${resolutionUnit} (2=inches, 3=cm)`);
                    }
                  }
                  
                  if (xResolution && resolutionUnit === 2) {
                    const dpi = Math.round(xResolution);
                    console.log(`    ✅ Found DPI from EXIF: ${dpi}`);
                    resolve(dpi);
                    return;
                  } else if (xResolution && resolutionUnit === 3) {
                    const dpi = Math.round(xResolution * 2.54);
                    console.log(`    ✅ Calculated DPI from EXIF (cm): ${dpi}`);
                    resolve(dpi);
                    return;
                  }
                } catch (error) {
                  console.error('    ❌ Error parsing EXIF data:', error);
                }
              }
            }
            
            // Move to next marker
            offset += length + 2;
            markerIndex++;
            
            // Safety limit
            if (markerIndex > 50) {
              console.log('  ⚠️ Too many markers, stopping');
              break;
            }
            
            // Stop at Start of Scan
            if (marker === 0xffda) {
              console.log('  Reached SOS marker');
              break;
            }
          }
          console.log('❌ No JFIF header with valid density found');
        } catch (error) {
          console.error('❌ Error parsing JPEG metadata:', error);
        }
      }
      
      console.log('❌ No DPI information found in file');
      console.log('=== DPI extraction complete ===');
      resolve(null);
    };
    
    reader.onerror = () => {
      console.error('❌ FileReader error');
      resolve(null);
    };
    reader.readAsArrayBuffer(file);
  });
}

function detectFileType(view: DataView): string {
  // PNG: 89 50 4E 47
  if (view.byteLength >= 4 && view.getUint32(0) === 0x89504e47) {
    return 'PNG';
  }
  // JPEG: FF D8 FF
  if (view.byteLength >= 2 && view.getUint16(0) === 0xffd8) {
    return 'JPEG';
  }
  return 'UNKNOWN';
}

export default function PatternCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [repeatType, setRepeatType] = useState<RepeatType>('full-drop');
  const [isLoading, setIsLoading] = useState(false);
  const [viewZoom, setViewZoom] = useState(0.15); // Actual physical zoom - starts at 15% to show many repeats
  const [displayZoom, setDisplayZoom] = useState(100); // Display zoom slider (0-200, where 100 = default view)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [dpi, setDpi] = useState(96); // Default DPI for screen display
  const [tileDisplaySize, setTileDisplaySize] = useState({ width: 0, height: 0 }); // Actual displayed tile size in pixels
  
  // Show tile outline state
  const [showTileOutline, setShowTileOutline] = useState(false);
  
  // Panning state
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  
  // Convert display zoom (0-200) to actual zoom (0.01-5.0)
  // 100 on slider = 0.15 actual zoom (our default "tester view")
  const displayZoomToActualZoom = (displayValue: number): number => {
    if (displayValue <= 100) {
      // 0-100 maps to 0.01-0.15 (zoom out range)
      return 0.01 + (displayValue / 100) * 0.14;
    } else {
      // 100-200 maps to 0.15-5.0 (zoom in range)
      return 0.15 + ((displayValue - 100) / 100) * 4.85;
    }
  };
  
  const actualZoomToDisplayZoom = (actualValue: number): number => {
    if (actualValue <= 0.15) {
      return (actualValue - 0.01) / 0.14 * 100;
    } else {
      return 100 + ((actualValue - 0.15) / 4.85) * 100;
    }
  };

  // Set canvas size - large enough for zooming and panning
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const updateCanvasSize = () => {
      if (canvasRef.current) {
        // Make canvas large enough for panning in all directions (100 inches at 96 DPI)
        const width = 9600;
        const height = 9600;
        canvasRef.current.width = width;
        canvasRef.current.height = height;
        setCanvasSize({ width, height });
      }
    };
    
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, []);

  // Render pattern with zoom
  useEffect(() => {
    if (!canvasRef.current || !image) return;

    const canvas = canvasRef.current;
    const tiler = new PatternTiler(canvas);
    
    // Calculate display DPI conversion (scale image from its DPI to screen 96 DPI)
    const displayScale = (96 / dpi) * viewZoom;
    
    // Create scaled image for display
    const scaledCanvas = document.createElement('canvas');
    const displayWidth = image.width * displayScale;
    const displayHeight = image.height * displayScale;
    scaledCanvas.width = displayWidth;
    scaledCanvas.height = displayHeight;
    
    const ctx = scaledCanvas.getContext('2d');
    
    if (ctx) {
      ctx.drawImage(image, 0, 0, scaledCanvas.width, scaledCanvas.height);
      const scaledImg = new Image();
      scaledImg.onload = () => {
        // Store the displayed tile size for ruler calculations (in callback to avoid setState in effect)
        setTileDisplaySize({ width: displayWidth, height: displayHeight });
        
        // Render the tiled pattern
        tiler.render(scaledImg, repeatType);
        
        // Draw tile outline if enabled (after pattern is rendered)
        if (showTileOutline) {
          requestAnimationFrame(() => {
            const canvasCtx = canvas.getContext('2d');
            if (canvasCtx) {
              console.log('Drawing tile outline...');
              console.log('Canvas size:', canvas.width, canvas.height);
              console.log('Tile size:', displayWidth, displayHeight);
              console.log('Repeat type:', repeatType);
              
              // For Full Drop: tiles are on a perfect grid starting at 0,0
              // Draw the second tile (1st column, 1st row after origin)
              let outlineX = 0;
              let outlineY = 0;
              
              // For Half Drop: columns alternate with vertical offset
              if (repeatType === 'half-drop') {
                // Draw a tile in column 1 (which is offset down by half height)
                outlineX = displayWidth;
                outlineY = displayHeight / 2;
              }
              
              // For Half Brick: rows alternate with horizontal offset
              if (repeatType === 'half-brick') {
                // Draw a tile in row 1 (which is offset right by half width)
                outlineX = displayWidth / 2;
                outlineY = displayHeight;
              }
              
              console.log('Outline position:', outlineX, outlineY);
              
              // Draw hot pink outline
              canvasCtx.strokeStyle = '#ff1493'; // Hot pink
              canvasCtx.lineWidth = 6;
              canvasCtx.setLineDash([]);
              canvasCtx.strokeRect(outlineX + 3, outlineY + 3, displayWidth - 6, displayHeight - 6);
            }
          });
        }
      };
      scaledImg.src = scaledCanvas.toDataURL();
    }
  }, [image, repeatType, viewZoom, dpi, showTileOutline]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    
    // Try to extract DPI from image metadata
    try {
      const detectedDpi = await extractDpiFromFile(file);
      console.log('Detected DPI from file:', detectedDpi);
      if (detectedDpi) {
        setDpi(detectedDpi);
      } else {
        console.log('No DPI found in image metadata, using default 96');
      }
    } catch (error) {
      console.warn('Could not extract DPI from image, using default:', error);
    }
    
    const img = new Image();
    
    img.onload = () => {
      setImage(img);
      setIsLoading(false);
    };
    
    img.src = URL.createObjectURL(file);
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (!blob) continue;

        setIsLoading(true);
        
        // Try to extract DPI from pasted image
        try {
          const detectedDpi = await extractDpiFromFile(blob);
          if (detectedDpi) {
            setDpi(detectedDpi);
          }
        } catch (error) {
          console.warn('Could not extract DPI from pasted image, using default:', error);
        }
        
        const img = new Image();
        
        img.onload = () => {
          setImage(img);
          setIsLoading(false);
        };
        
        img.src = URL.createObjectURL(blob);
      }
    }
  };

  return (
    <div className="flex h-screen" onPaste={handlePaste}>
      {/* Left Panel */}
      <div className="w-80 bg-white border-r p-6 overflow-y-auto">
        <h1 className="text-2xl font-bold mb-6">PatternPAL Pro</h1>
        
        {/* Upload */}
        <div className="mb-8">
          <label className="block text-sm font-semibold mb-2">
            Upload Tile
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          <p className="text-xs text-gray-500 mt-2">
            Or paste from clipboard (Cmd+V)
          </p>
        </div>

        {/* Repeat Type */}
        <div className="mb-8">
          <label className="block text-sm font-semibold mb-3">
            Repeat Type
          </label>
          <div className="space-y-2">
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                value="full-drop"
                checked={repeatType === 'full-drop'}
                onChange={(e) => setRepeatType(e.target.value as RepeatType)}
                className="mr-2"
              />
              <span>Full Drop</span>
            </label>
            
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                value="half-drop"
                checked={repeatType === 'half-drop'}
                onChange={(e) => setRepeatType(e.target.value as RepeatType)}
                className="mr-2"
              />
              <span>Half Drop</span>
            </label>
            
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                value="half-brick"
                checked={repeatType === 'half-brick'}
                onChange={(e) => setRepeatType(e.target.value as RepeatType)}
                className="mr-2"
              />
              <span>Half Brick</span>
            </label>
          </div>
        </div>

        {/* Tile Info */}
        {image && (
          <div className="mb-8 p-4 bg-gray-50 rounded">
            <h3 className="text-sm font-semibold mb-2">Tile Info</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p>Width: {image.width}px ({(image.width / dpi).toFixed(2)}in)</p>
              <p>Height: {image.height}px ({(image.height / dpi).toFixed(2)}in)</p>
              <p>DPI: {dpi}</p>
            </div>
          </div>
        )}

        {/* Show Tile Outline Toggle */}
        {image && (
          <div className="mb-8">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={showTileOutline}
                onChange={(e) => setShowTileOutline(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm font-semibold">Show Tile Outline</span>
            </label>
          </div>
        )}

        {/* View Zoom Control */}
        {image && (
          <div className="mb-8">
            <label className="block text-sm font-semibold mb-2">
              View Zoom: {Math.round(displayZoom)}%
            </label>
            
            {/* Preset Zoom Buttons */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => {
                  setDisplayZoom(100);
                  setViewZoom(0.15);
                }}
                className="flex-1 px-3 py-2 text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 rounded border border-blue-200"
              >
                Tester View
              </button>
              <button
                onClick={() => {
                  const actualZoom = 1.0;
                  setViewZoom(actualZoom);
                  setDisplayZoom(actualZoomToDisplayZoom(actualZoom));
                }}
                className="flex-1 px-3 py-2 text-xs font-medium bg-gray-100 hover:bg-gray-200 rounded border border-gray-300"
              >
                Actual Size
              </button>
              <button
                onClick={() => {
                  const actualZoom = 2.0;
                  setViewZoom(actualZoom);
                  setDisplayZoom(actualZoomToDisplayZoom(actualZoom));
                }}
                className="flex-1 px-3 py-2 text-xs font-medium bg-gray-100 hover:bg-gray-200 rounded border border-gray-300"
              >
                Detail View
              </button>
            </div>
            
            {/* Fine-tune Slider */}
            <input
              type="range"
              min="0"
              max="200"
              step="1"
              value={displayZoom}
              onChange={(e) => {
                const newDisplayZoom = Number(e.target.value);
                setDisplayZoom(newDisplayZoom);
                setViewZoom(displayZoomToActualZoom(newDisplayZoom));
              }}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Zoom Out</span>
              <span>100% (center)</span>
              <span>Zoom In</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Tile size: {(image.width / dpi).toFixed(2)}&quot; × {(image.height / dpi).toFixed(2)}&quot;
            </p>
          </div>
        )}
      </div>

      {/* Canvas Area with Rulers */}
      <div className="flex-1 bg-gray-100 overflow-hidden relative flex flex-col">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-10">
            <div className="text-lg">Loading...</div>
          </div>
        )}
        
        {!image && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400 z-0">
            <div className="text-center">
              <p className="text-xl mb-2">Upload or paste a pattern tile</p>
              <p className="text-sm">Drag & drop, choose file, or press Cmd+V</p>
            </div>
          </div>
        )}
        
        {/* Top ruler */}
        <div className="flex">
          <div className="w-[30px] h-[30px] bg-gray-200 border-b border-r border-gray-300" />
          <div className="flex-1 overflow-hidden">
            {image && tileDisplaySize.width > 0 ? (
              <Ruler
                orientation="horizontal"
                length={canvasSize.width}
                scale={1}
                unit="in"
                pixelsPerUnit={tileDisplaySize.width / (image.width / dpi)}
              />
            ) : (
              <div className="h-[30px] bg-gray-200" />
            )}
          </div>
        </div>
        
        {/* Canvas with left ruler */}
        <div className="flex flex-1 overflow-hidden">
          <div className="w-[30px] overflow-hidden">
            {image && tileDisplaySize.height > 0 ? (
              <Ruler
                orientation="vertical"
                length={canvasSize.height}
                scale={1}
                unit="in"
                pixelsPerUnit={tileDisplaySize.height / (image.height / dpi)}
              />
            ) : (
              <div className="w-[30px] bg-gray-200" />
            )}
          </div>
          <div 
            className="flex-1 relative overflow-auto bg-white"
            style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
            onWheel={(e) => {
              // Only prevent default if it's a zoom gesture (ctrl/cmd key pressed)
              if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                e.stopPropagation();
                
                if (!canvasRef.current || !image) return;
                
                const rect = canvasRef.current.getBoundingClientRect();
                const scrollContainer = e.currentTarget;
                
                // Get mouse position relative to canvas
                const mouseX = e.clientX - rect.left + scrollContainer.scrollLeft;
                const mouseY = e.clientY - rect.top + scrollContainer.scrollTop;
                
                // Calculate zoom delta - much slower sensitivity for pinch zoom
                const zoomDelta = -e.deltaY * 0.05; // Reduced from 0.5 to 0.05 (10x slower)
                const newDisplayZoom = Math.max(0, Math.min(200, displayZoom + zoomDelta));
              
              // Calculate the new actual zoom
              const newViewZoom = displayZoomToActualZoom(newDisplayZoom);
              
              // Calculate new tile size at new zoom
              const newDisplayScale = (96 / dpi) * newViewZoom;
              const newTileWidth = image.width * newDisplayScale;
              const newTileHeight = image.height * newDisplayScale;
              
              // Calculate what percentage of the tile the mouse was over
              const currentDisplayScale = (96 / dpi) * viewZoom;
              const currentTileWidth = image.width * currentDisplayScale;
              const currentTileHeight = image.height * currentDisplayScale;
              
              const percentX = mouseX / currentTileWidth;
              const percentY = mouseY / currentTileHeight;
              
              // Calculate where that same percentage should be at new zoom
              const newMouseX = percentX * newTileWidth;
              const newMouseY = percentY * newTileHeight;
              
              // Calculate scroll adjustment to keep mouse position stable
              const scrollDeltaX = newMouseX - mouseX;
              const scrollDeltaY = newMouseY - mouseY;
              
                // Update zoom
                setDisplayZoom(newDisplayZoom);
                setViewZoom(newViewZoom);
                
                // Adjust scroll to keep mouse position centered
                requestAnimationFrame(() => {
                  scrollContainer.scrollLeft += scrollDeltaX;
                  scrollContainer.scrollTop += scrollDeltaY;
                });
              }
              // If not a zoom gesture, allow normal scrolling
            }}
            onMouseDown={(e) => {
              const scrollContainer = e.currentTarget;
              setIsPanning(true);
              setPanStart({
                x: e.clientX + scrollContainer.scrollLeft,
                y: e.clientY + scrollContainer.scrollTop,
              });
            }}
            onMouseMove={(e) => {
              if (!isPanning) return;
              const scrollContainer = e.currentTarget;
              const dx = panStart.x - e.clientX;
              const dy = panStart.y - e.clientY;
              scrollContainer.scrollLeft = dx;
              scrollContainer.scrollTop = dy;
            }}
            onMouseUp={() => {
              setIsPanning(false);
            }}
            onMouseLeave={() => {
              setIsPanning(false);
            }}
          >
            <canvas
              ref={canvasRef}
              className="block w-full pointer-events-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}