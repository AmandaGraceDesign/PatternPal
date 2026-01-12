// lib/seamAnalyzer.ts

// Color constants for seam visualization
const TILE_EDGE_COLOR = '#FF1493'; // Deep Pink (visible on any background)
const PROBLEM_COLOR = 'rgba(255, 255, 0, 0.85)'; // Bright Yellow (85% opacity)
const GOOD_EDGE_COLOR = 'rgba(0, 255, 0, 0.3)'; // Subtle green (30% opacity)

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
  tolerance: number = 40  // Increased to 40 for Euclidean distance to reduce false positives
): SeamAnalysisResult {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  const width = canvas.width;
  const height = canvas.height;
  
  console.log('🔍 Starting seam analysis:', {
    canvasDimensions: `${width}x${height}`,
    repeatType,
    tolerance,
    note: 'Tolerance is now for RGB difference (25 = sum of RGB differences)'
  });
  
  // CRITICAL: Verify canvas dimensions match expected image size
  console.log('📐 Canvas verification:', {
    canvasWidth: width,
    canvasHeight: height,
    warning: 'Canvas should match image naturalWidth/naturalHeight exactly (NO DPR scaling)'
  });
  
  // Extract edges explicitly for verification
  const topEdge = ctx.getImageData(0, 0, width, 1);
  const bottomEdge = ctx.getImageData(0, height - 1, width, 1);
  const leftEdge = ctx.getImageData(0, 0, 1, height);
  const rightEdge = ctx.getImageData(width - 1, 0, 1, height);
  
  console.log('📐 Edge extraction:', {
    topEdge: { width: topEdge.width, height: topEdge.height, firstPixelRGB: [topEdge.data[0], topEdge.data[1], topEdge.data[2]] },
    bottomEdge: { width: bottomEdge.width, height: bottomEdge.height, firstPixelRGB: [bottomEdge.data[0], bottomEdge.data[1], bottomEdge.data[2]] },
    leftEdge: { width: leftEdge.width, height: leftEdge.height, firstPixelRGB: [leftEdge.data[0], leftEdge.data[1], leftEdge.data[2]] },
    rightEdge: { width: rightEdge.width, height: rightEdge.height, firstPixelRGB: [rightEdge.data[0], rightEdge.data[1], rightEdge.data[2]] }
  });
  
  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;
  
  // DEBUG: Sample first few edge pixels to verify we're getting the right data
  console.log('📊 Edge pixel samples (first 3 pixels from each edge):', {
    topEdge_first3: [
      [pixels[0], pixels[1], pixels[2]],
      [pixels[4], pixels[5], pixels[6]],
      [pixels[8], pixels[9], pixels[10]]
    ],
    bottomEdge_first3: [
      [pixels[((height - 1) * width) * 4], pixels[((height - 1) * width) * 4 + 1], pixels[((height - 1) * width) * 4 + 2]],
      [pixels[((height - 1) * width + 1) * 4], pixels[((height - 1) * width + 1) * 4 + 1], pixels[((height - 1) * width + 1) * 4 + 2]],
      [pixels[((height - 1) * width + 2) * 4], pixels[((height - 1) * width + 2) * 4 + 1], pixels[((height - 1) * width + 2) * 4 + 2]]
    ],
    leftEdge_first3: [
      [pixels[0], pixels[1], pixels[2]],
      [pixels[width * 4], pixels[width * 4 + 1], pixels[width * 4 + 2]],
      [pixels[width * 8], pixels[width * 8 + 1], pixels[width * 8 + 2]]
    ],
    rightEdge_first3: [
      [pixels[(width - 1) * 4], pixels[(width - 1) * 4 + 1], pixels[(width - 1) * 4 + 2]],
      [pixels[(width + width - 1) * 4], pixels[(width + width - 1) * 4 + 1], pixels[(width + width - 1) * 4 + 2]],
      [pixels[(width * 2 + width - 1) * 4], pixels[(width * 2 + width - 1) * 4 + 1], pixels[(width * 2 + width - 1) * 4 + 2]]
    ]
  });
  
  let topBottom: EdgeComparison;
  let leftRight: EdgeComparison;
  
  switch (repeatType) {
    case 'fulldrop':
      // Full Drop: straight comparisons for both axes
      console.log('\n🔄 Comparing top vs bottom edges (horizontal)...');
      topBottom = compareEdgesStraight(pixels, width, height, 'horizontal', tolerance, ctx);
      console.log('\n🔄 Comparing left vs right edges (vertical)...');
      leftRight = compareEdgesStraight(pixels, width, height, 'vertical', tolerance, ctx);
      break;
      
    case 'halfdrop':
      // Half Drop: straight horizontal, offset vertical by height/2
      console.log('\n🔄 Comparing top vs bottom edges (horizontal)...');
      topBottom = compareEdgesStraight(pixels, width, height, 'horizontal', tolerance, ctx);
      leftRight = compareEdgesOffset(pixels, width, height, 'vertical', height / 2, tolerance);
      break;
      
    case 'halfbrick':
      // Half Brick: offset horizontal by width/2, straight vertical
      topBottom = compareEdgesOffset(pixels, width, height, 'horizontal', width / 2, tolerance);
      console.log('\n🔄 Comparing left vs right edges (vertical)...');
      leftRight = compareEdgesStraight(pixels, width, height, 'vertical', tolerance, ctx);
      break;
  }
  
  const overallScore = calculateSeamScore(topBottom, leftRight);
  const isPerfect = topBottom.match && leftRight.match;
  
  console.log('🔍 Final Analysis Results:', {
    repeatType,
    topBottom: {
      match: topBottom.match,
      mismatchPercent: `${topBottom.mismatchPercent}%`,
      avgDifference: topBottom.avgDifference,
      maxDifference: topBottom.maxDifference,
      problemCount: topBottom.problemAreas.length,
      totalPixels: repeatType === 'halfbrick' ? 'offset comparison' : 'straight comparison'
    },
    leftRight: {
      match: leftRight.match,
      mismatchPercent: `${leftRight.mismatchPercent}%`,
      avgDifference: leftRight.avgDifference,
      maxDifference: leftRight.maxDifference,
      problemCount: leftRight.problemAreas.length,
      totalPixels: repeatType === 'halfdrop' ? 'offset comparison' : 'straight comparison'
    },
    overallScore,
    isPerfect,
    warning: isPerfect && overallScore >= 90 ? 'Pattern marked as seamless - verify visually!' : 'Check zoom view to verify seams'
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
  tolerance: number,
  ctx?: CanvasRenderingContext2D | null
): EdgeComparison {
  const problemAreas: ProblemArea[] = [];
  let totalDifference = 0;
  let maxDifference = 0;
  let pixelsCompared = 0;
  
  // Extract edges using getImageData for verification
  let edge1Data: ImageData | null = null;
  let edge2Data: ImageData | null = null;
  
  if (ctx) {
    if (direction === 'horizontal') {
      // Top strip: y=0, height=3 (3-pixel strip)
      edge1Data = ctx.getImageData(0, 0, width, 3);
      // Bottom strip: y=height-3, height=3 (3-pixel strip)
      edge2Data = ctx.getImageData(0, height - 3, width, 3);
    } else {
      // Left strip: x=0, width=3 (3-pixel strip)
      edge1Data = ctx.getImageData(0, 0, 3, height);
      // Right strip: x=width-3, width=3 (3-pixel strip)
      edge2Data = ctx.getImageData(width - 3, 0, 3, height);
    }
    
    // Debug logging
    console.log('Comparing edges:', direction === 'horizontal' ? 'top vs bottom' : 'left vs right');
    console.log('Canvas size:', width, 'x', height);
    console.log('First 3 pixels edge1:', [...edge1Data.data.slice(0, 12)]);
    console.log('First 3 pixels edge2:', [...edge2Data.data.slice(0, 12)]);
  }
  
  if (direction === 'horizontal') {
    // Compare top strip (y=0,1,2) with bottom strip (y=height-3,height-2,height-1)
    // Average RGB values across the 3-pixel strip for each x position
    for (let x = 0; x < width; x++) {
      // Average RGB values from top strip (y=0,1,2)
      let topR = 0, topG = 0, topB = 0;
      for (let y = 0; y < 3; y++) {
        const index = (y * width + x) * 4;
        topR += pixels[index];
        topG += pixels[index + 1];
        topB += pixels[index + 2];
      }
      topR /= 3;
      topG /= 3;
      topB /= 3;
      
      // Average RGB values from bottom strip (y=height-3,height-2,height-1)
      let bottomR = 0, bottomG = 0, bottomB = 0;
      for (let y = height - 3; y < height; y++) {
        const index = (y * width + x) * 4;
        bottomR += pixels[index];
        bottomG += pixels[index + 1];
        bottomB += pixels[index + 2];
      }
      bottomR /= 3;
      bottomG /= 3;
      bottomB /= 3;
      
      const diff = calculatePixelDifference(
        Math.round(topR),
        Math.round(topG),
        Math.round(topB),
        Math.round(bottomR),
        Math.round(bottomG),
        Math.round(bottomB)
      );
      
      totalDifference += diff;
      pixelsCompared++;
      maxDifference = Math.max(maxDifference, diff);  // Track max across ALL pixels
      
      if (diff > tolerance) {
        problemAreas.push({ position: x, diff });
      }
    }
  } else {
    // Compare left strip (x=0,1,2) with right strip (x=width-3,width-2,width-1)
    // Average RGB values across the 3-pixel strip for each y position
    for (let y = 0; y < height; y++) {
      // Average RGB values from left strip (x=0,1,2)
      let leftR = 0, leftG = 0, leftB = 0;
      for (let x = 0; x < 3; x++) {
        const index = (y * width + x) * 4;
        leftR += pixels[index];
        leftG += pixels[index + 1];
        leftB += pixels[index + 2];
      }
      leftR /= 3;
      leftG /= 3;
      leftB /= 3;
      
      // Average RGB values from right strip (x=width-3,width-2,width-1)
      let rightR = 0, rightG = 0, rightB = 0;
      for (let x = width - 3; x < width; x++) {
        const index = (y * width + x) * 4;
        rightR += pixels[index];
        rightG += pixels[index + 1];
        rightB += pixels[index + 2];
      }
      rightR /= 3;
      rightG /= 3;
      rightB /= 3;
      
      const diff = calculatePixelDifference(
        Math.round(leftR),
        Math.round(leftG),
        Math.round(leftB),
        Math.round(rightR),
        Math.round(rightG),
        Math.round(rightB)
      );
      
      totalDifference += diff;
      pixelsCompared++;
      maxDifference = Math.max(maxDifference, diff);  // Track max across ALL pixels
      
      if (diff > tolerance) {
        problemAreas.push({ position: y, diff });
      }
    }
  }
  
  const avgDifference = totalDifference / pixelsCompared;
  const mismatchPercent = (problemAreas.length / pixelsCompared) * 100;
  
  return {
    match: mismatchPercent <= 20,  // Only flag if >20% of pixels are mismatched
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
    // HALF BRICK: Compare top strip (y=0,1,2) with bottom strip (y=height-3,height-2,height-1), offset by width/2
    const offsetX = Math.floor(offset);
    
    for (let x = 0; x < width; x++) {
      // Average RGB values from top strip (y=0,1,2) at position x
      let topR = 0, topG = 0, topB = 0;
      for (let y = 0; y < 3; y++) {
        const index = (y * width + x) * 4;
        topR += pixels[index];
        topG += pixels[index + 1];
        topB += pixels[index + 2];
      }
      topR /= 3;
      topG /= 3;
      topB /= 3;
      
      // Average RGB values from bottom strip (y=height-3,height-2,height-1) at position (x + offset) % width
      const bottomX = (x + offsetX) % width;
      let bottomR = 0, bottomG = 0, bottomB = 0;
      for (let y = height - 3; y < height; y++) {
        const index = (y * width + bottomX) * 4;
        bottomR += pixels[index];
        bottomG += pixels[index + 1];
        bottomB += pixels[index + 2];
      }
      bottomR /= 3;
      bottomG /= 3;
      bottomB /= 3;
      
      const diff = calculatePixelDifference(
        Math.round(topR),
        Math.round(topG),
        Math.round(topB),
        Math.round(bottomR),
        Math.round(bottomG),
        Math.round(bottomB)
      );
      
      totalDifference += diff;
      pixelsCompared++;
      maxDifference = Math.max(maxDifference, diff);  // Track max across ALL pixels
      
      if (diff > tolerance) {
        problemAreas.push({ position: x, diff });
      }
    }
  } else {
    // HALF DROP: Compare left strip (x=0,1,2) with right strip (x=width-3,width-2,width-1), offset by height/2
    const offsetY = Math.floor(offset);
    
    for (let y = 0; y < height; y++) {
      // Average RGB values from left strip (x=0,1,2) at position y
      let leftR = 0, leftG = 0, leftB = 0;
      for (let x = 0; x < 3; x++) {
        const index = (y * width + x) * 4;
        leftR += pixels[index];
        leftG += pixels[index + 1];
        leftB += pixels[index + 2];
      }
      leftR /= 3;
      leftG /= 3;
      leftB /= 3;
      
      // Average RGB values from right strip (x=width-3,width-2,width-1) at position (y + offset) % height
      const rightY = (y + offsetY) % height;
      let rightR = 0, rightG = 0, rightB = 0;
      for (let x = width - 3; x < width; x++) {
        const index = (rightY * width + x) * 4;
        rightR += pixels[index];
        rightG += pixels[index + 1];
        rightB += pixels[index + 2];
      }
      rightR /= 3;
      rightG /= 3;
      rightB /= 3;
      
      const diff = calculatePixelDifference(
        Math.round(leftR),
        Math.round(leftG),
        Math.round(leftB),
        Math.round(rightR),
        Math.round(rightG),
        Math.round(rightB)
      );
      
      totalDifference += diff;
      pixelsCompared++;
      maxDifference = Math.max(maxDifference, diff);  // Track max across ALL pixels
      
      if (diff > tolerance) {
        problemAreas.push({ position: y, diff });
      }
    }
  }
  
  const avgDifference = totalDifference / pixelsCompared;
  const mismatchPercent = (problemAreas.length / pixelsCompared) * 100;
  
  return {
    match: mismatchPercent <= 20,  // Only flag if >20% of pixels are mismatched
    mismatchPercent: Math.round(mismatchPercent * 10) / 10,
    maxDifference: Math.round(maxDifference),
    avgDifference: Math.round(avgDifference * 10) / 10,
    problemAreas
  };
}

/**
 * Calculate pixel difference using Euclidean distance in RGB space
 * This provides more accurate color distance measurement
 */
function calculatePixelDifference(
  r1: number, g1: number, b1: number,
  r2: number, g2: number, b2: number
): number {
  // Calculate Euclidean distance in RGB space
  return Math.sqrt(
    Math.pow(r1 - r2, 2) +
    Math.pow(g1 - g2, 2) +
    Math.pow(b1 - b2, 2)
  );
}

/**
 * Calculate overall seam quality score (0-100)
 * Score should be 90+ if both edges are good (< 10 difference)
 */
function calculateSeamScore(topBottom: EdgeComparison, leftRight: EdgeComparison): number {
  let score = 100;
  score -= topBottom.avgDifference;
  score -= leftRight.avgDifference;
  return Math.max(0, Math.min(100, Math.round(score)));
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
  if (analysis.topBottom.problemAreas.length > 0) {
    // Draw white outline first for contrast
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(width, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(width, height);
    ctx.stroke();
    
    // Then yellow on top (problem areas)
    ctx.strokeStyle = PROBLEM_COLOR;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(width, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(width, height);
    ctx.stroke();
  } else {
    // Good edge indicator (subtle green)
    ctx.strokeStyle = GOOD_EDGE_COLOR;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(width, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(width, height);
    ctx.stroke();
  }
  
  // Left/Right seam (straight)
  if (analysis.leftRight.problemAreas.length > 0) {
    // Draw white outline first for contrast
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(width, 0);
    ctx.lineTo(width, height);
    ctx.stroke();
    
    // Then yellow on top (problem areas)
    ctx.strokeStyle = PROBLEM_COLOR;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(width, 0);
    ctx.lineTo(width, height);
    ctx.stroke();
  } else {
    // Good edge indicator (subtle green)
    ctx.strokeStyle = GOOD_EDGE_COLOR;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(width, 0);
    ctx.lineTo(width, height);
    ctx.stroke();
  }
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
  if (analysis.topBottom.problemAreas.length > 0) {
    // Draw white outline first for contrast
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(width, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(width, height);
    ctx.stroke();
    
    // Then yellow on top (problem areas)
    ctx.strokeStyle = PROBLEM_COLOR;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(width, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(width, height);
    ctx.stroke();
  } else {
    // Good edge indicator (subtle green)
    ctx.strokeStyle = GOOD_EDGE_COLOR;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(width, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(width, height);
    ctx.stroke();
  }
  
  // Left/Right seam (offset by height/2)
  if (analysis.leftRight.problemAreas.length > 0) {
    // Draw white outline first for contrast
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(width, 0);
    ctx.lineTo(width, height);
    ctx.stroke();
    
    // Then yellow on top (problem areas)
    ctx.strokeStyle = PROBLEM_COLOR;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(width, 0);
    ctx.lineTo(width, height);
    ctx.stroke();
    
    // Draw connecting lines to show offset relationship for problem areas
    ctx.strokeStyle = PROBLEM_COLOR;
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);
    analysis.leftRight.problemAreas.forEach(({ position }) => {
      const matchY = (position + offsetY) % height;
      ctx.beginPath();
      ctx.moveTo(0, position);
      ctx.lineTo(width, matchY);
      ctx.stroke();
    });
    ctx.setLineDash([]);
  } else {
    // Good edge indicator (subtle green)
    ctx.strokeStyle = GOOD_EDGE_COLOR;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(width, 0);
    ctx.lineTo(width, height);
    ctx.stroke();
  }
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
  if (analysis.topBottom.problemAreas.length > 0) {
    // Draw white outline first for contrast
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(width, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(width, height);
    ctx.stroke();
    
    // Then yellow on top (problem areas)
    ctx.strokeStyle = PROBLEM_COLOR;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(width, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(width, height);
    ctx.stroke();
    
    // Draw connecting lines to show offset relationship for problem areas
    ctx.strokeStyle = PROBLEM_COLOR;
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);
    analysis.topBottom.problemAreas.forEach(({ position }) => {
      const matchX = (position + offsetX) % width;
      ctx.beginPath();
      ctx.moveTo(position, 0);
      ctx.lineTo(matchX, height);
      ctx.stroke();
    });
    ctx.setLineDash([]);
  } else {
    // Good edge indicator (subtle green)
    ctx.strokeStyle = GOOD_EDGE_COLOR;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(width, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(width, height);
    ctx.stroke();
  }
  
  // Left/Right seam (straight)
  if (analysis.leftRight.problemAreas.length > 0) {
    // Draw white outline first for contrast
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(width, 0);
    ctx.lineTo(width, height);
    ctx.stroke();
    
    // Then yellow on top (problem areas)
    ctx.strokeStyle = PROBLEM_COLOR;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(width, 0);
    ctx.lineTo(width, height);
    ctx.stroke();
  } else {
    // Good edge indicator (subtle green)
    ctx.strokeStyle = GOOD_EDGE_COLOR;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(width, 0);
    ctx.lineTo(width, height);
    ctx.stroke();
  }
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

export type CornerView = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/**
 * Create 2x2 tile grid canvas (can be cached, reused for panning)
 */
export function createTileGridCanvas(
  originalCanvas: HTMLCanvasElement,
  repeatType: RepeatType
): HTMLCanvasElement {
  const tileW = originalCanvas.width;
  const tileH = originalCanvas.height;
  
  // Create canvas showing 2x2 tiles (make it larger to accommodate offsets)
  const gridCanvas = document.createElement('canvas');
  // For offsets, we need extra space
  const extraWidth = repeatType === 'halfbrick' ? tileW / 2 : 0;
  const extraHeight = repeatType === 'halfdrop' ? tileH / 2 : 0;
  gridCanvas.width = tileW * 2 + extraWidth;
  gridCanvas.height = tileH * 2 + extraHeight;
  
  const ctx = gridCanvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  
  // Draw 4 tiles in 2x2 grid
  // Top-left tile (0, 0)
  ctx.drawImage(originalCanvas, 0, 0);
  
  // Top-right tile
  let topRightX = tileW;
  let topRightY = 0;
  if (repeatType === 'halfdrop') {
    topRightY = tileH / 2;
  }
  ctx.drawImage(originalCanvas, topRightX, topRightY);
  
  // Bottom-left tile
  let bottomLeftX = 0;
  let bottomLeftY = tileH;
  if (repeatType === 'halfbrick') {
    bottomLeftX = tileW / 2;
  }
  ctx.drawImage(originalCanvas, bottomLeftX, bottomLeftY);
  
  // Bottom-right tile
  let bottomRightX = tileW;
  let bottomRightY = tileH;
  if (repeatType === 'halfdrop') {
    bottomRightY = tileH + tileH / 2;
  } else if (repeatType === 'halfbrick') {
    bottomRightX = tileW + tileW / 2;
  }
  ctx.drawImage(originalCanvas, bottomRightX, bottomRightY);
  
  return gridCanvas;
}

/**
 * Create zoomed seam intersection view with pan support
 */
export function createSeamIntersectionView(
  gridCanvas: HTMLCanvasElement,
  panPosition: { x: number; y: number },
  tileWidth: number,
  tileHeight: number,
  repeatType: RepeatType,
  showPinkLines: boolean = true,
  zoomLevel: number = 4
): HTMLCanvasElement {
  const zoom = zoomLevel;
  const canvasSize = 800; // Always draw to 800x800 canvas
  const sourceSize = canvasSize / zoom; // Source size varies with zoom: 400px at 2x, 200px at 4x, 100px at 8x
  const tileW = tileWidth;
  const tileH = tileHeight;
  
  // Now create zoomed view with pan offset
  const zoomedCanvas = document.createElement('canvas');
  zoomedCanvas.width = canvasSize;
  zoomedCanvas.height = canvasSize;
  
  const zoomCtx = zoomedCanvas.getContext('2d')!;
  zoomCtx.imageSmoothingEnabled = false;
  
  // The seam intersection is always at (tileW, tileH) in the grid
  // Start centered on this intersection, then offset by pan position
  // Pan position: positive = viewport moved right/up = show content to left/bottom
  const centerX = tileW - sourceSize / 2;
  const centerY = tileH - sourceSize / 2;
  
  // Apply pan offset (pan is in screen pixels, convert to grid pixels by dividing by zoom)
  // Negative sign: when viewport moves right (panX positive), show content to left (sourceX decreases)
  const sourceX = centerX - panPosition.x / zoom;
  const sourceY = centerY - panPosition.y / zoom;
  
  // Ensure we don't go out of bounds
  const clampedX = Math.max(0, Math.min(sourceX, gridCanvas.width - sourceSize));
  const clampedY = Math.max(0, Math.min(sourceY, gridCanvas.height - sourceSize));
  
  // Draw zoomed area
  zoomCtx.drawImage(
    gridCanvas,
    clampedX, clampedY, sourceSize, sourceSize,  // Source: centered on seam + pan offset, size based on zoom
    0, 0, canvasSize, canvasSize  // Dest: always 800x800
  );
  
  // Draw pink outline showing tile boundaries - these cross through CENTER of view
  if (showPinkLines) {
    zoomCtx.strokeStyle = TILE_EDGE_COLOR;
    zoomCtx.lineWidth = 3;
    
    // Calculate where seams are in the zoomed view
    // The seam in the grid is at (tileW, tileH), map it to zoomed coordinates
    // Seam position in source: tileW, tileH
    // Seam position in zoomed view: (tileW - clampedX) * zoom
    const seamXInZoomed = (tileW - clampedX) * zoom;
    const seamYInZoomed = (tileH - clampedY) * zoom;
    
    // Vertical line (left/right seam) - shows where left edge meets right edge
    zoomCtx.beginPath();
    zoomCtx.moveTo(seamXInZoomed, 0);
    zoomCtx.lineTo(seamXInZoomed, canvasSize);
    zoomCtx.stroke();
    
    // Horizontal line (top/bottom seam) - shows where top edge meets bottom edge
    zoomCtx.beginPath();
    zoomCtx.moveTo(0, seamYInZoomed);
    zoomCtx.lineTo(canvasSize, seamYInZoomed);
    zoomCtx.stroke();
  }
  
  return zoomedCanvas;
}

/**
 * Create zoomed corner view (400% zoom) for pixel-level inspection
 * @deprecated Use createSeamIntersectionView instead for Spoonflower-style seam view
 */
export function createZoomedCornerView(
  originalCanvas: HTMLCanvasElement,
  analysis: SeamAnalysisResult,
  corner: CornerView = 'top-left'
): HTMLCanvasElement {
  const zoom = 4; // 400%
  const cornerSize = 200; // Show 200x200px area from original
  const width = originalCanvas.width;
  const height = originalCanvas.height;
  
  // Calculate source coordinates based on corner
  let sourceX = 0;
  let sourceY = 0;
  
  switch (corner) {
    case 'top-left':
      sourceX = 0;
      sourceY = 0;
      break;
    case 'top-right':
      sourceX = Math.max(0, width - cornerSize);
      sourceY = 0;
      break;
    case 'bottom-left':
      sourceX = 0;
      sourceY = Math.max(0, height - cornerSize);
      break;
    case 'bottom-right':
      sourceX = Math.max(0, width - cornerSize);
      sourceY = Math.max(0, height - cornerSize);
      break;
  }
  
  // Ensure we don't go out of bounds
  const actualCornerSize = Math.min(cornerSize, width - sourceX, height - sourceY);
  
  const zoomedCanvas = document.createElement('canvas');
  zoomedCanvas.width = actualCornerSize * zoom;  // 800px (if cornerSize is 200)
  zoomedCanvas.height = actualCornerSize * zoom; // 800px
  
  const ctx = zoomedCanvas.getContext('2d')!;
  
  // Disable smoothing for pixel-perfect view
  ctx.imageSmoothingEnabled = false;
  
  // Draw zoomed corner
  ctx.drawImage(
    originalCanvas,
    sourceX, sourceY, actualCornerSize, actualCornerSize,  // Source: corner area
    0, 0, actualCornerSize * zoom, actualCornerSize * zoom  // Dest: scaled to zoom size
  );
  
  // Draw pink outline around tile edges (scaled) - only draw edges that are visible in this corner
  ctx.strokeStyle = TILE_EDGE_COLOR;
  ctx.lineWidth = 3;
  
  // Top edge of tile (y=0) - visible if showing top corners
  if (sourceY === 0) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(actualCornerSize * zoom, 0);
    ctx.stroke();
  }
  
  // Bottom edge of tile (y=height-1) - visible if in corner area
  const bottomEdgeY = height - 1;
  if (bottomEdgeY >= sourceY && bottomEdgeY < sourceY + actualCornerSize) {
    const zoomedBottomY = (bottomEdgeY - sourceY) * zoom;
    ctx.beginPath();
    ctx.moveTo(0, zoomedBottomY);
    ctx.lineTo(actualCornerSize * zoom, zoomedBottomY);
    ctx.stroke();
  }
  
  // Left edge of tile (x=0) - visible if showing left corners
  if (sourceX === 0) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, actualCornerSize * zoom);
    ctx.stroke();
  }
  
  // Right edge of tile (x=width-1) - visible if in corner area
  const rightEdgeX = width - 1;
  if (rightEdgeX >= sourceX && rightEdgeX < sourceX + actualCornerSize) {
    const zoomedRightX = (rightEdgeX - sourceX) * zoom;
    ctx.beginPath();
    ctx.moveTo(zoomedRightX, 0);
    ctx.lineTo(zoomedRightX, actualCornerSize * zoom);
    ctx.stroke();
  }
  
  // Highlight problem areas in zoomed view
  ctx.fillStyle = PROBLEM_COLOR;
  
  // Top edge problems (x coordinate = position)
  analysis.topBottom.problemAreas.forEach(({ position }) => {
    const x = position;
    const y = 0;
    
    // Only show if in corner area
    if (x >= sourceX && x < sourceX + actualCornerSize && y >= sourceY && y < sourceY + actualCornerSize) {
      const zoomedX = (x - sourceX) * zoom;
      const zoomedY = (y - sourceY) * zoom;
      ctx.fillRect(zoomedX, zoomedY, zoom, zoom);
    }
  });
  
  // Bottom edge problems (x coordinate = position)
  analysis.topBottom.problemAreas.forEach(({ position }) => {
    const x = position;
    const y = height - 1;
    
    // Only show if in corner area
    if (x >= sourceX && x < sourceX + actualCornerSize && y >= sourceY && y < sourceY + actualCornerSize) {
      const zoomedX = (x - sourceX) * zoom;
      const zoomedY = (y - sourceY) * zoom;
      ctx.fillRect(zoomedX, zoomedY, zoom, zoom);
    }
  });
  
  // Left edge problems (y coordinate = position)
  analysis.leftRight.problemAreas.forEach(({ position }) => {
    const x = 0;
    const y = position;
    
    // Only show if in corner area
    if (x >= sourceX && x < sourceX + actualCornerSize && y >= sourceY && y < sourceY + actualCornerSize) {
      const zoomedX = (x - sourceX) * zoom;
      const zoomedY = (y - sourceY) * zoom;
      ctx.fillRect(zoomedX, zoomedY, zoom, zoom);
    }
  });
  
  // Right edge problems (y coordinate = position)
  analysis.leftRight.problemAreas.forEach(({ position }) => {
    const x = width - 1;
    const y = position;
    
    // Only show if in corner area
    if (x >= sourceX && x < sourceX + actualCornerSize && y >= sourceY && y < sourceY + actualCornerSize) {
      const zoomedX = (x - sourceX) * zoom;
      const zoomedY = (y - sourceY) * zoom;
      ctx.fillRect(zoomedX, zoomedY, zoom, zoom);
    }
  });
  
  return zoomedCanvas;
}



