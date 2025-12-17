'use client';

import { useEffect, useRef } from 'react';

interface MiniMapProps {
  image: HTMLImageElement;
  cursorX: number;
  cursorY: number;
  tileWidth: number;
  tileHeight: number;
  displayScale: number;
  repeatType: 'full-drop' | 'half-drop' | 'half-brick';
}

export default function MiniMap({
  image,
  cursorX,
  cursorY,
  tileWidth,
  tileHeight,
  displayScale,
  repeatType,
}: MiniMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maxSize = 200; // Max size of mini-map

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Calculate mini-map dimensions maintaining aspect ratio
    const aspectRatio = image.width / image.height;
    let mapWidth = maxSize;
    let mapHeight = maxSize;

    if (aspectRatio > 1) {
      mapHeight = maxSize / aspectRatio;
    } else {
      mapWidth = maxSize * aspectRatio;
    }

    canvas.width = mapWidth;
    canvas.height = mapHeight;

    // Draw the original tile
    ctx.drawImage(image, 0, 0, mapWidth, mapHeight);

    // Calculate where the cursor is on the original tile
    const displayedTileWidth = tileWidth * displayScale;
    const displayedTileHeight = tileHeight * displayScale;
    
    console.log('MiniMap Debug:');
    console.log('  Cursor position:', cursorX, cursorY);
    console.log('  Displayed tile size:', displayedTileWidth, displayedTileHeight);
    console.log('  Repeat type:', repeatType);
    
    let tileX = cursorX;
    let tileY = cursorY;
    
    // For half-drop: need to account for vertical offset in alternating columns
    if (repeatType === 'half-drop') {
      const col = Math.floor(cursorX / displayedTileWidth);
      // Odd columns are shifted down by half height
      if (col % 2 === 1) {
        tileY = cursorY + displayedTileHeight / 2;
      }
    }
    
    // For half-brick: need to account for horizontal offset in alternating rows
    if (repeatType === 'half-brick') {
      const row = Math.floor(cursorY / displayedTileHeight);
      // Odd rows are shifted right by half width
      if (row % 2 === 1) {
        tileX = cursorX + displayedTileWidth / 2;
      }
    }
    
    // Find position within a single tile (accounting for repeats)
    tileX = tileX % displayedTileWidth;
    tileY = tileY % displayedTileHeight;
    
    // JavaScript modulo can return negative, ensure positive
    if (tileX < 0) tileX += displayedTileWidth;
    if (tileY < 0) tileY += displayedTileHeight;
    
    console.log('  Position within tile:', tileX, tileY);
    
    // Convert to mini-map coordinates
    const mapX = (tileX / displayedTileWidth) * mapWidth;
    const mapY = (tileY / displayedTileHeight) * mapHeight;
    
    console.log('  Mini-map position:', mapX, mapY);

    // Draw crosshair indicator
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    // Draw cross
    const crossSize = 10;
    ctx.moveTo(mapX - crossSize, mapY);
    ctx.lineTo(mapX + crossSize, mapY);
    ctx.moveTo(mapX, mapY - crossSize);
    ctx.lineTo(mapX, mapY + crossSize);
    ctx.stroke();

    // Draw circle around crosshair
    ctx.beginPath();
    ctx.arc(mapX, mapY, 15, 0, Math.PI * 2);
    ctx.stroke();

    // Draw border around mini-map
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, mapWidth, mapHeight);
  }, [image, cursorX, cursorY, tileWidth, tileHeight, displayScale, repeatType]);

  return (
    <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-xl p-2 pointer-events-none z-50">
      <div className="text-xs font-semibold text-gray-700 mb-1">Original Tile</div>
      <canvas ref={canvasRef} className="rounded border border-gray-300" />
      <div className="text-xs text-gray-500 mt-1 text-center">Red marker shows location</div>
    </div>
  );
}

