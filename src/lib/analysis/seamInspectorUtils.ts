import type { RepeatType } from './seamAnalyzer';

const SEAM_LINE_COLOR = '#38bdf8';

export type SeamView = 'horizontal' | 'vertical';

/**
 * Create a visual seam view canvas showing edges meeting
 */
export function createSeamViewCanvas(
  originalCanvas: HTMLCanvasElement,
  repeatType: RepeatType,
  seamView: SeamView,
  zoomLevel: number,
  seamPosition: number, // 0-100, position along the seam
  panPosition: { x: number; y: number } = { x: 0, y: 0 },
  canvasWidth: number = 800,
  canvasHeight: number = 600
): HTMLCanvasElement {
  const tileW = originalCanvas.width;
  const tileH = originalCanvas.height;
  const zoom = zoomLevel;
  
  // Create output canvas
  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = canvasWidth;
  outputCanvas.height = canvasHeight;
  const ctx = outputCanvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  
  if (seamView === 'horizontal') {
    // Top/Bottom seam view
    // Show bottom 25% of tile and top 25% of tile stacked vertically
    
    const edgeHeight = tileH * 0.25;
    const viewportWidth = canvasWidth / zoom;
    const viewportHeight = canvasHeight / zoom;
    
    // Calculate which section of the seam to show based on seamPosition (0-100)
    // Position 0 = left edge, 100 = right edge
    const positionRatio = seamPosition / 100;
    const maxOffsetX = Math.max(0, tileW - viewportWidth);
    const baseOffsetX = positionRatio * maxOffsetX;
    
    // Apply pan offset (pan is in screen pixels, convert to source pixels)
    const sourceOffsetX = baseOffsetX - panPosition.x / zoom;
    const clampedOffsetX = Math.max(0, Math.min(sourceOffsetX, tileW - viewportWidth));
    
    // Handle repeat type offset for half-brick
    let bottomOffsetX = clampedOffsetX;
    let topOffsetX = clampedOffsetX;
    
    if (repeatType === 'halfbrick') {
      // Top edge is offset by width/2
      topOffsetX = (clampedOffsetX + tileW / 2) % tileW;
    }
    
    // Draw bottom 25% of tile (bottom edge)
    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.drawImage(
      originalCanvas,
      bottomOffsetX, tileH * 0.75, // Source: bottom 25% of tile
      viewportWidth, edgeHeight,
      0, 0, // Destination: top half of output
      viewportWidth, edgeHeight
    );
    
    // Draw pink crosshair line
    ctx.strokeStyle = SEAM_LINE_COLOR;
    ctx.lineWidth = 2 / zoom; // Scale line width inversely with zoom
    ctx.beginPath();
    ctx.moveTo(0, edgeHeight);
    ctx.lineTo(viewportWidth, edgeHeight);
    ctx.stroke();
    
    // Draw top 25% of tile (top edge) - below the crosshair
    ctx.drawImage(
      originalCanvas,
      topOffsetX, 0, // Source: top 25% of tile
      viewportWidth, edgeHeight,
      0, edgeHeight, // Destination: bottom half of output
      viewportWidth, edgeHeight
    );
    
    ctx.restore();
    
  } else {
    // Left/Right seam view
    // Show right 25% of tile and left 25% of tile side-by-side
    
    const edgeWidth = tileW * 0.25;
    const viewportWidth = canvasWidth / zoom;
    const viewportHeight = canvasHeight / zoom;
    
    // Calculate which section of the seam to show based on seamPosition (0-100)
    // Position 0 = top edge, 100 = bottom edge
    const positionRatio = seamPosition / 100;
    const maxOffsetY = Math.max(0, tileH - viewportHeight);
    const baseOffsetY = positionRatio * maxOffsetY;
    
    // Apply pan offset
    const sourceOffsetY = baseOffsetY - panPosition.y / zoom;
    const clampedOffsetY = Math.max(0, Math.min(sourceOffsetY, tileH - viewportHeight));
    
    // Handle repeat type offset for half-drop
    let rightOffsetY = clampedOffsetY;
    let leftOffsetY = clampedOffsetY;
    
    if (repeatType === 'halfdrop') {
      // Right edge is offset by height/2
      leftOffsetY = clampedOffsetY;
      rightOffsetY = (clampedOffsetY + tileH / 2) % tileH;
    }
    
    // Draw left 25% of tile (left edge)
    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.drawImage(
      originalCanvas,
      0, leftOffsetY, // Source: left 25% of tile
      edgeWidth, viewportHeight,
      0, 0, // Destination: left half of output
      edgeWidth, viewportHeight
    );
    
    // Draw pink crosshair line
    ctx.strokeStyle = SEAM_LINE_COLOR;
    ctx.lineWidth = 2 / zoom;
    ctx.beginPath();
    ctx.moveTo(edgeWidth, 0);
    ctx.lineTo(edgeWidth, viewportHeight);
    ctx.stroke();
    
    // Draw right 25% of tile (right edge) - to the right of crosshair
    ctx.drawImage(
      originalCanvas,
      tileW * 0.75, rightOffsetY, // Source: right 25% of tile
      edgeWidth, viewportHeight,
      edgeWidth, 0, // Destination: right half of output
      edgeWidth, viewportHeight
    );
    
    ctx.restore();
  }
  
  return outputCanvas;
}
