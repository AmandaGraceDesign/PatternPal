// lib/seamAnalyzer.ts

export type RepeatType = 'fulldrop' | 'halfdrop' | 'halfbrick';

export interface SeamAnalysisResult {
  repeatType: RepeatType;
  topBottom: EdgeComparison;
  leftRight: EdgeComparison;
  overallScore: number;
  isPerfect: boolean;
}

export interface EdgeComparison {
  match: boolean;
  mismatchPercent: number;
  maxDifference: number;
  avgDifference: number;
  problemAreas: ProblemArea[];
}

interface ProblemArea {
  position: number;
  diff: number;
}

/**
 * Analyze seams based on repeat type
 */
export function analyzeSeams(
  canvas: HTMLCanvasElement,
  repeatType: RepeatType,
  tolerance: number = 5
): SeamAnalysisResult {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  const width = canvas.width;
  const height = canvas.height;
  
  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;
  
  let topBottom: EdgeComparison;
  let leftRight: EdgeComparison;
  
  switch (repeatType) {
    case 'fulldrop':
      // Full Drop: straight comparisons for both axes
      topBottom = compareEdgesStraight(pixels, width, height, 'horizontal', tolerance);
      leftRight = compareEdgesStraight(pixels, width, height, 'vertical', tolerance);
      break;
      
    case 'halfdrop':
      // Half Drop: straight horizontal, offset vertical by height/2
      topBottom = compareEdgesStraight(pixels, width, height, 'horizontal', tolerance);
      leftRight = compareEdgesOffset(pixels, width, height, 'vertical', height / 2, tolerance);
      break;
      
    case 'halfbrick':
      // Half Brick: offset horizontal by width/2, straight vertical
      topBottom = compareEdgesOffset(pixels, width, height, 'horizontal', width / 2, tolerance);
      leftRight = compareEdgesStraight(pixels, width, height, 'vertical', tolerance);
      break;
  }
  
  const overallScore = calculateSeamScore(topBottom, leftRight);
  const isPerfect = topBottom.match && leftRight.match;
  
  console.log('🔍 Seam Analysis:', {
    repeatType,
    topBottom: `${topBottom.mismatchPercent}% mismatch`,
    leftRight: `${leftRight.mismatchPercent}% mismatch`,
    overallScore,
    isPerfect
  });
  
  return {
    repeatType,
    topBottom,
    leftRight,
    overallScore,
    isPerfect
  };
}

/**
 * Compare edges without offset (straight match)
 */
function compareEdgesStraight(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  direction: 'horizontal' | 'vertical',
  tolerance: number
): EdgeComparison {
  const problemAreas: ProblemArea[] = [];
  let totalDifference = 0;
  let maxDifference = 0;
  let pixelsCompared = 0;
  
  if (direction === 'horizontal') {
    // Compare top row (y=0) with bottom row (y=height-1)
    for (let x = 0; x < width; x++) {
      const topIndex = (0 * width + x) * 4;
      const bottomIndex = ((height - 1) * width + x) * 4;
      
      const diff = calculatePixelDifference(
        pixels[topIndex],
        pixels[topIndex + 1],
        pixels[topIndex + 2],
        pixels[bottomIndex],
        pixels[bottomIndex + 1],
        pixels[bottomIndex + 2]
      );
      
      totalDifference += diff;
      pixelsCompared++;
      
      if (diff > tolerance) {
        problemAreas.push({ position: x, diff });
        maxDifference = Math.max(maxDifference, diff);
      }
    }
  } else {
    // Compare left column (x=0) with right column (x=width-1)
    for (let y = 0; y < height; y++) {
      const leftIndex = (y * width + 0) * 4;
      const rightIndex = (y * width + (width - 1)) * 4;
      
      const diff = calculatePixelDifference(
        pixels[leftIndex],
        pixels[leftIndex + 1],
        pixels[leftIndex + 2],
        pixels[rightIndex],
        pixels[rightIndex + 1],
        pixels[rightIndex + 2]
      );
      
      totalDifference += diff;
      pixelsCompared++;
      
      if (diff > tolerance) {
        problemAreas.push({ position: y, diff });
        maxDifference = Math.max(maxDifference, diff);
      }
    }
  }
  
  const avgDifference = totalDifference / pixelsCompared;
  const mismatchPercent = (problemAreas.length / pixelsCompared) * 100;
  
  return {
    match: problemAreas.length === 0,
    mismatchPercent: Math.round(mismatchPercent * 10) / 10,
    maxDifference: Math.round(maxDifference),
    avgDifference: Math.round(avgDifference * 10) / 10,
    problemAreas
  };
}

/**
 * Compare edges with offset (for half drop/half brick)
 */
function compareEdgesOffset(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  direction: 'horizontal' | 'vertical',
  offset: number,
  tolerance: number
): EdgeComparison {
  const problemAreas: ProblemArea[] = [];
  let totalDifference = 0;
  let maxDifference = 0;
  let pixelsCompared = 0;
  
  if (direction === 'horizontal') {
    // HALF BRICK: Compare top row with bottom row, offset by width/2
    const offsetX = Math.floor(offset);
    
    for (let x = 0; x < width; x++) {
      // Top pixel at position x
      const topIndex = (0 * width + x) * 4;
      
      // Bottom pixel at position (x + offset) % width
      const bottomX = (x + offsetX) % width;
      const bottomIndex = ((height - 1) * width + bottomX) * 4;
      
      const diff = calculatePixelDifference(
        pixels[topIndex],
        pixels[topIndex + 1],
        pixels[topIndex + 2],
        pixels[bottomIndex],
        pixels[bottomIndex + 1],
        pixels[bottomIndex + 2]
      );
      
      totalDifference += diff;
      pixelsCompared++;
      
      if (diff > tolerance) {
        problemAreas.push({ position: x, diff });
        maxDifference = Math.max(maxDifference, diff);
      }
    }
  } else {
    // HALF DROP: Compare left column with right column, offset by height/2
    const offsetY = Math.floor(offset);
    
    for (let y = 0; y < height; y++) {
      // Left pixel at position y
      const leftIndex = (y * width + 0) * 4;
      
      // Right pixel at position (y + offset) % height
      const rightY = (y + offsetY) % height;
      const rightIndex = (rightY * width + (width - 1)) * 4;
      
      const diff = calculatePixelDifference(
        pixels[leftIndex],
        pixels[leftIndex + 1],
        pixels[leftIndex + 2],
        pixels[rightIndex],
        pixels[rightIndex + 1],
        pixels[rightIndex + 2]
      );
      
      totalDifference += diff;
      pixelsCompared++;
      
      if (diff > tolerance) {
        problemAreas.push({ position: y, diff });
        maxDifference = Math.max(maxDifference, diff);
      }
    }
  }
  
  const avgDifference = totalDifference / pixelsCompared;
  const mismatchPercent = (problemAreas.length / pixelsCompared) * 100;
  
  return {
    match: problemAreas.length === 0,
    mismatchPercent: Math.round(mismatchPercent * 10) / 10,
    maxDifference: Math.round(maxDifference),
    avgDifference: Math.round(avgDifference * 10) / 10,
    problemAreas
  };
}

/**
 * Calculate pixel difference using Euclidean distance
 */
function calculatePixelDifference(
  r1: number, g1: number, b1: number,
  r2: number, g2: number, b2: number
): number {
  const rDiff = r1 - r2;
  const gDiff = g1 - g2;
  const bDiff = b1 - b2;
  
  return Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);
}

/**
 * Calculate overall seam quality score (0-100)
 */
function calculateSeamScore(topBottom: EdgeComparison, leftRight: EdgeComparison): number {
  // Perfect match = 100
  // Each 1% mismatch = -10 points
  
  const topBottomScore = 100 - (topBottom.mismatchPercent * 10);
  const leftRightScore = 100 - (leftRight.mismatchPercent * 10);
  
  const overallScore = (topBottomScore + leftRightScore) / 2;
  
  return Math.max(0, Math.round(overallScore));
}

/**
 * Highlight seam problems on canvas overlay
 */
export function highlightSeamProblems(
  canvas: HTMLCanvasElement,
  analysis: SeamAnalysisResult
): HTMLCanvasElement {
  // Create overlay canvas
  const overlay = document.createElement('canvas');
  overlay.width = canvas.width;
  overlay.height = canvas.height;
  
  const ctx = overlay.getContext('2d')!;
  
  // Draw original image
  ctx.drawImage(canvas, 0, 0);
  
  // Highlight problems based on repeat type
  switch (analysis.repeatType) {
    case 'fulldrop':
      highlightFullDropProblems(overlay, analysis);
      break;
    case 'halfdrop':
      highlightHalfDropProblems(overlay, analysis);
      break;
    case 'halfbrick':
      highlightHalfBrickProblems(overlay, analysis);
      break;
  }
  
  return overlay;
}

/**
 * Highlight Full Drop seam issues (straight matches)
 */
function highlightFullDropProblems(
  canvas: HTMLCanvasElement,
  analysis: SeamAnalysisResult
) {
  const ctx = canvas.getContext('2d')!;
  const width = canvas.width;
  const height = canvas.height;
  
  // Top/Bottom seam (straight)
  analysis.topBottom.problemAreas.forEach(({ position, diff }) => {
    const intensity = Math.min(diff / 50, 1);
    ctx.fillStyle = `rgba(255, 0, 0, ${intensity * 0.6})`;
    
    ctx.fillRect(position, 0, 1, 10); // Top
    ctx.fillRect(position, height - 10, 1, 10); // Bottom
  });
  
  // Left/Right seam (straight)
  analysis.leftRight.problemAreas.forEach(({ position, diff }) => {
    const intensity = Math.min(diff / 50, 1);
    ctx.fillStyle = `rgba(255, 0, 0, ${intensity * 0.6})`;
    
    ctx.fillRect(0, position, 10, 1); // Left
    ctx.fillRect(width - 10, position, 10, 1); // Right
  });
}

/**
 * Highlight Half Drop seam issues (vertical offset)
 */
function highlightHalfDropProblems(
  canvas: HTMLCanvasElement,
  analysis: SeamAnalysisResult
) {
  const ctx = canvas.getContext('2d')!;
  const width = canvas.width;
  const height = canvas.height;
  const offsetY = Math.floor(height / 2);
  
  // Top/Bottom seam (straight)
  analysis.topBottom.problemAreas.forEach(({ position, diff }) => {
    const intensity = Math.min(diff / 50, 1);
    ctx.fillStyle = `rgba(255, 0, 0, ${intensity * 0.6})`;
    
    ctx.fillRect(position, 0, 1, 10);
    ctx.fillRect(position, height - 10, 1, 10);
  });
  
  // Left/Right seam (offset by height/2)
  analysis.leftRight.problemAreas.forEach(({ position, diff }) => {
    const intensity = Math.min(diff / 50, 1);
    ctx.fillStyle = `rgba(255, 0, 0, ${intensity * 0.6})`;
    
    // Left edge at position y
    ctx.fillRect(0, position, 10, 1);
    
    // Right edge matches at (position + offset) % height
    const matchY = (position + offsetY) % height;
    ctx.fillRect(width - 10, matchY, 10, 1);
    
    // Draw connecting line to show offset relationship
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(10, position);
    ctx.lineTo(width - 10, matchY);
    ctx.stroke();
    ctx.setLineDash([]);
  });
}

/**
 * Highlight Half Brick seam issues (horizontal offset)
 */
function highlightHalfBrickProblems(
  canvas: HTMLCanvasElement,
  analysis: SeamAnalysisResult
) {
  const ctx = canvas.getContext('2d')!;
  const width = canvas.width;
  const height = canvas.height;
  const offsetX = Math.floor(width / 2);
  
  // Top/Bottom seam (offset by width/2)
  analysis.topBottom.problemAreas.forEach(({ position, diff }) => {
    const intensity = Math.min(diff / 50, 1);
    ctx.fillStyle = `rgba(255, 0, 0, ${intensity * 0.6})`;
    
    // Top edge at position x
    ctx.fillRect(position, 0, 1, 10);
    
    // Bottom edge matches at (position + offset) % width
    const matchX = (position + offsetX) % width;
    ctx.fillRect(matchX, height - 10, 1, 10);
    
    // Draw connecting line
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(position, 10);
    ctx.lineTo(matchX, height - 10);
    ctx.stroke();
    ctx.setLineDash([]);
  });
  
  // Left/Right seam (straight)
  analysis.leftRight.problemAreas.forEach(({ position, diff }) => {
    const intensity = Math.min(diff / 50, 1);
    ctx.fillStyle = `rgba(255, 0, 0, ${intensity * 0.6})`;
    
    ctx.fillRect(0, position, 10, 1);
    ctx.fillRect(width - 10, position, 10, 1);
  });
}

/**
 * Generate side-by-side comparison view
 */
export function generateComparisonView(
  canvas: HTMLCanvasElement,
  analysis: SeamAnalysisResult,
  direction: 'horizontal' | 'vertical'
): HTMLCanvasElement {
  const comparison = document.createElement('canvas');
  const width = canvas.width;
  const height = canvas.height;
  
  if (direction === 'horizontal') {
    // Side-by-side: original | tiled
    comparison.width = width * 2;
    comparison.height = height;
  } else {
    // Stacked: original on top, tiled below
    comparison.width = width;
    comparison.height = height * 2;
  }
  
  const ctx = comparison.getContext('2d')!;
  
  // Draw original on left/top
  ctx.drawImage(canvas, 0, 0);
  
  // Draw tiled version on right/bottom
  // For now, just duplicate the original
  // TODO: Use PatternTiler to create actual tiled version
  if (direction === 'horizontal') {
    ctx.drawImage(canvas, width, 0);
  } else {
    ctx.drawImage(canvas, 0, height);
  }
  
  return comparison;
}
