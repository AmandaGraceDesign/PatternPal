'use client';
import Ruler from './Ruler';
import { useEffect, useRef, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { PatternTiler, RepeatType } from '@/lib/tiling/PatternTiler';
import ScaleExportModal from '@/components/export/ScaleExportModal';
import UpgradeModal from '@/components/export/UpgradeModal';
import { checkClientProStatus } from '@/lib/utils/checkProStatus';

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
  const { user, isSignedIn } = useUser();
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
  
  // Scale Export Modal state
  const [showScaleModal, setShowScaleModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const isPro = isSignedIn && user ? checkClientProStatus(user.publicMetadata) : false;
  
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
    
    // Calculate displayed tile size based on ACTUAL DPI and zoom
    // Don't convert to 96 DPI - use the image's actual DPI
    // Wait, that simplifies to:
    const displayWidth = Math.max(1, Math.round(image.width * viewZoom));
    const displayHeight = Math.max(1, Math.round(image.height * viewZoom));
    
    // #region agent log
    console.log('🎨 RENDERING - Pattern rendering started:', {
      imageWidth: image.width,
      imageHeight: image.height,
      dpi,
      viewZoom,
      displayWidth,
      displayHeight,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      canvasStyleWidth: canvas.style.width,
      canvasStyleHeight: canvas.style.height,
      canvasSizeWidth: canvasSize.width,
      canvasSizeHeight: canvasSize.height,
    });
    fetch('http://127.0.0.1:7242/ingest/f37b4cf4-ef5d-4355-935c-d1043bf409fa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PatternCanvas.tsx:343',message:'Pattern rendering started',data:{imageWidth:image.width,imageHeight:image.height,dpi,viewZoom,displayWidth,displayHeight,canvasWidth:canvas.width,canvasHeight:canvas.height,canvasSizeWidth:canvasSize.width,canvasSizeHeight:canvasSize.height},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    // Pass canvas size to PatternTiler so it uses correct dimensions
    const tiler = new PatternTiler(canvas, canvasSize.width, canvasSize.height);
    
    const scaledCanvas = document.createElement('canvas');
    scaledCanvas.width = displayWidth;
    scaledCanvas.height = displayHeight;

    // Store dimensions immediately for ruler calculations
    setTileDisplaySize({ width: scaledCanvas.width, height: scaledCanvas.height });

    const scaledCtx = scaledCanvas.getContext('2d');
    if (!scaledCtx) return;

    scaledCtx.imageSmoothingEnabled = true;
    scaledCtx.imageSmoothingQuality = 'high';
    scaledCtx.clearRect(0, 0, scaledCanvas.width, scaledCanvas.height);
    scaledCtx.drawImage(image, 0, 0, scaledCanvas.width, scaledCanvas.height);

    const renderSource = viewZoom === 1 ? image : scaledCanvas;
    const tileWidthPx =
      renderSource instanceof HTMLImageElement
        ? renderSource.naturalWidth || renderSource.width
        : renderSource.width;
    const tileHeightPx =
      renderSource instanceof HTMLImageElement
        ? renderSource.naturalHeight || renderSource.height
        : renderSource.height;

    console.log('🎨 SCALED IMAGE SIZE:', tileWidthPx, '×', tileHeightPx);
    console.log('🎨 TILE PHYSICAL SIZE:', image.width / dpi, '×', image.height / dpi, 'inches');
    console.log('🎨 EXPECTED DISPLAY SIZE:', (image.width / dpi) * dpi * viewZoom, 'pixels');

    // #region agent log
    console.log('🖼️ SCALED IMAGE - Ready:', {
      tileWidthPx,
      tileHeightPx,
      displayWidth,
      displayHeight,
    });
    fetch('http://127.0.0.1:7242/ingest/f37b4cf4-ef5d-4355-935c-d1043bf409fa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PatternCanvas.tsx:366',message:'Scaled image ready',data:{tileWidthPx,tileHeightPx,displayWidth,displayHeight},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    // Render the tiled pattern
    tiler.render(renderSource, repeatType);

    // #region agent log
    console.log('🔲 PATTERN TILED - Pattern rendered:', {
      repeatType,
      tileWidthPx,
      tileHeightPx,
    });
    fetch('http://127.0.0.1:7242/ingest/f37b4cf4-ef5d-4355-935c-d1043bf409fa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PatternCanvas.tsx:371',message:'Pattern tiled',data:{repeatType,tileWidthPx,tileHeightPx},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion

    // Draw tile outline if enabled
    if (showTileOutline) {
      requestAnimationFrame(() => {
        const canvasCtx = canvas.getContext('2d');
        if (canvasCtx) {
          const actualTileWidth = tileWidthPx;
          const actualTileHeight = tileHeightPx;

          let outlineX = 0;
          let outlineY = 0;

          if (repeatType === 'half-drop') {
            outlineX = actualTileWidth;
            outlineY = actualTileHeight / 2;
          }

          if (repeatType === 'half-brick') {
            outlineX = actualTileWidth / 2;
            outlineY = actualTileHeight;
          }

          console.log('📦 OUTLINE DRAWING:', {
            actualTileWidth,
            actualTileHeight,
            outlineX,
            outlineY
          });

          canvasCtx.strokeStyle = '#ff1493';
          canvasCtx.lineWidth = 6;
          canvasCtx.setLineDash([]);
          canvasCtx.strokeRect(outlineX + 3, outlineY + 3, actualTileWidth - 6, actualTileHeight - 6);
        }
      });
    }
  }, [image, repeatType, viewZoom, dpi, showTileOutline, canvasSize]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const softLimitBytes = 15 * 1024 * 1024;
    if (file.size > softLimitBytes) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      const proceed = window.confirm(
        `This file is ${mb}MB (over 15MB) and may be slow to process. Continue?`
      );
      if (!proceed) return;
    }

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

        const softLimitBytes = 15 * 1024 * 1024;
        if (blob.size > softLimitBytes) {
          const mb = (blob.size / (1024 * 1024)).toFixed(1);
          const proceed = window.confirm(
            `This file is ${mb}MB (over 15MB) and may be slow to process. Continue?`
          );
          if (!proceed) continue;
        }

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

        {/* Export Section */}
        {image && (
          <div className="mb-8">
            <label className="block text-sm font-semibold mb-2">
              Export
            </label>
            <div className="space-y-2">
              <div className="relative group">
                <button
                  onClick={() => {
                    if (isPro) {
                      setShowScaleModal(true);
                    } else {
                      setShowUpgradeModal(true);
                    }
                  }}
                  className="w-full px-4 py-2 text-sm font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 rounded border border-blue-200 flex items-center justify-center gap-2"
                  disabled={!image}
                >
                  {!isPro && <span>🔒</span>}
                  <span>Scale & Export</span>
                </button>
                {!isPro && (
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                    Upgrade to Pro
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
                  </div>
                )}
              </div>
            </div>
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
            {image ? (
              <Ruler
                orientation="horizontal"
                length={canvasSize.width}
                scale={1}
                unit="in"
                pixelsPerUnit={(() => {
                  const tileWidthInches = image.width / dpi;
                  const displayWidthPixels = image.width * viewZoom;
                  const ppu = displayWidthPixels / tileWidthInches;
                  console.log('🔢 RULER PPU CALC:', {
                    imageWidth: image.width,
                    dpi,
                    viewZoom,
                    tileWidthInches,
                    displayWidthPixels,
                    pixelsPerUnit: ppu
                  });
                  return ppu;
                })()}
              />
            ) : (
              <div className="h-[30px] bg-gray-200" />
            )}
          </div>
        </div>
        
        {/* Canvas with left ruler */}
        <div className="flex flex-1 overflow-hidden">
          <div className="w-[30px] overflow-hidden">
            {image ? (
              <Ruler
                orientation="vertical"
                length={canvasSize.height}
                scale={1}
                unit="in"
                pixelsPerUnit={(() => {
                  const tileHeightInches = image.height / dpi;
                  const displayHeightPixels = image.height * viewZoom;
                  return displayHeightPixels / tileHeightInches;
                })()}
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

      {/* Scale Export Modal */}
      {showScaleModal && image && (
        <ScaleExportModal
          image={image}
          repeatType={
            repeatType === 'full-drop' ? 'fulldrop' :
            repeatType === 'half-drop' ? 'halfdrop' :
            'halfbrick'
          }
          currentDPI={dpi}
          originalFilename={null}
          onClose={() => setShowScaleModal(false)}
        />
      )}

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
      />
    </div>
  );
}