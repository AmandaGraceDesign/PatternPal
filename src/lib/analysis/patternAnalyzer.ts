/**
 * Pattern Analysis Utilities
 * Provides objective measurements and contextual guidance for pattern tiles
 */

export interface ContrastAnalysis {
  globalContrast: number; // 0-1
  band: 'high' | 'moderate' | 'soft' | 'very_low';
  status: 'ok' | 'soft' | 'soft_tonal' | 'risky';
  severity: 'none' | 'info' | 'warning';
  message: string;
  label: string;
  dominantColors: Array<{ r: number; g: number; b: number; luminance: number }>;
  highDetail: boolean;
}

export interface CompositionAnalysis {
  balanceScore: number; // 0-1, higher = more balanced
  distributionPattern: 'all-over' | 'focal-point' | 'directional' | 'structured' | 'organic';
  distributionConfidence: number; // 0-1
  rhythmStrength: number; // 0-1
  band: 'balanced' | 'dynamic' | 'asymmetric';
  severity: 'none' | 'info' | 'warning';
  label: string;
  message: string;
  contextHint: string;
  weightGrid?: number[][]; // 3x3 grid (optional visualization)
}

export interface ColorHarmonyAnalysis {
  band: 'beautiful' | 'mostly' | 'fighting' | 'too_similar';
  severity: 'none' | 'info' | 'warning';
  label: string;
  message: string;
  detectedScheme?: string; // e.g. 'analogous', 'complementary', 'triadic'
  chromaticColors: Array<{
    r: number;
    g: number;
    b: number;
    hue: number;
    isClashing: boolean;
    clashingWith: number[];
  }>;
  clashPairs: Array<[number, number]>;
  tensePairs: Array<[number, number]>;
  totalChromaticCount: number;
  isNeutralDominant: boolean;
}

/**
 * Calculate relative luminance from RGB values (WCAG formula)
 */
function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(val => {
    val = val / 255;
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Simple k-means clustering for dominant color extraction
 */
function extractDominantColors(
  imageData: ImageData,
  k: number = 6,
  maxIterations: number = 20
): Array<{ r: number; g: number; b: number; count: number }> {
  const data = imageData.data;
  const pixels: Array<[number, number, number]> = [];
  
  // Sample every 2nd pixel (stride 8 in RGBA) to catch minority colors
  for (let i = 0; i < data.length; i += 8) {
    pixels.push([data[i], data[i + 1], data[i + 2]]);
  }
  
  if (pixels.length === 0) return [];
  
  // Initialize centroids with k-means++ (spreads seeds across distinct colors)
  const centroids: Array<[number, number, number]> = [];
  centroids.push([...pixels[Math.floor(Math.random() * pixels.length)]]);

  for (let i = 1; i < k; i++) {
    // Compute squared distance from each pixel to its nearest existing centroid
    const distances = pixels.map(pixel => {
      let minDist = Infinity;
      for (const c of centroids) {
        const dist =
          (pixel[0] - c[0]) ** 2 +
          (pixel[1] - c[1]) ** 2 +
          (pixel[2] - c[2]) ** 2;
        if (dist < minDist) minDist = dist;
      }
      return minDist;
    });

    // Weighted random selection — pixels far from existing centroids are more likely
    const totalDist = distances.reduce((a, b) => a + b, 0);
    if (totalDist === 0) {
      centroids.push([...pixels[Math.floor(Math.random() * pixels.length)]]);
      continue;
    }
    let r = Math.random() * totalDist;
    for (let j = 0; j < distances.length; j++) {
      r -= distances[j];
      if (r <= 0) {
        centroids.push([...pixels[j]]);
        break;
      }
    }
    // Fallback in case of floating-point drift
    if (centroids.length <= i) {
      centroids.push([...pixels[pixels.length - 1]]);
    }
  }
  
  // K-means iterations
  for (let iter = 0; iter < maxIterations; iter++) {
    // Assign pixels to nearest centroid
    const clusters: Array<Array<[number, number, number]>> = Array(k).fill(null).map(() => []);
    
    for (const pixel of pixels) {
      let minDist = Infinity;
      let nearestCluster = 0;
      
      for (let i = 0; i < centroids.length; i++) {
        const dist = Math.sqrt(
          Math.pow(pixel[0] - centroids[i][0], 2) +
          Math.pow(pixel[1] - centroids[i][1], 2) +
          Math.pow(pixel[2] - centroids[i][2], 2)
        );
        if (dist < minDist) {
          minDist = dist;
          nearestCluster = i;
        }
      }
      
      clusters[nearestCluster].push(pixel);
    }
    
    // Update centroids
    let converged = true;
    for (let i = 0; i < k; i++) {
      if (clusters[i].length === 0) continue;
      
      const sum = clusters[i].reduce(
        (acc, pixel) => [acc[0] + pixel[0], acc[1] + pixel[1], acc[2] + pixel[2]],
        [0, 0, 0]
      );
      
      const newCentroid: [number, number, number] = [
        Math.round(sum[0] / clusters[i].length),
        Math.round(sum[1] / clusters[i].length),
        Math.round(sum[2] / clusters[i].length),
      ];
      
      // Check convergence
      const dist = Math.sqrt(
        Math.pow(newCentroid[0] - centroids[i][0], 2) +
        Math.pow(newCentroid[1] - centroids[i][1], 2) +
        Math.pow(newCentroid[2] - centroids[i][2], 2)
      );
      
      if (dist > 1) converged = false;
      centroids[i] = newCentroid;
    }
    
    if (converged) break;
  }
  
  // Count pixels in each cluster and return dominant colors
  const clusters: Array<Array<[number, number, number]>> = Array(k).fill(null).map(() => []);
  for (const pixel of pixels) {
    let minDist = Infinity;
    let nearestCluster = 0;
    
    for (let i = 0; i < centroids.length; i++) {
      const dist = Math.sqrt(
        Math.pow(pixel[0] - centroids[i][0], 2) +
        Math.pow(pixel[1] - centroids[i][1], 2) +
        Math.pow(pixel[2] - centroids[i][2], 2)
      );
      if (dist < minDist) {
        minDist = dist;
        nearestCluster = i;
      }
    }
    
    clusters[nearestCluster].push(pixel);
  }
  
  // Build result and merge near-duplicate centroids (< 25 RGB distance)
  const results = centroids
    .map((centroid, i) => ({
      r: centroid[0],
      g: centroid[1],
      b: centroid[2],
      count: clusters[i].length,
    }))
    .filter(color => color.count > 0)
    .sort((a, b) => b.count - a.count);

  const merged: typeof results = [];
  for (const color of results) {
    const duplicate = merged.find(m => {
      const dist = Math.sqrt(
        (m.r - color.r) ** 2 + (m.g - color.g) ** 2 + (m.b - color.b) ** 2
      );
      return dist < 25;
    });
    if (duplicate) {
      duplicate.count += color.count;
    } else {
      merged.push({ ...color });
    }
  }

  return merged.slice(0, 8);
}

/**
 * Detect if image has high detail (small features)
 */
function detectDetailScale(imageData: ImageData): boolean {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  
  // Simple edge detection using Sobel operator
  const threshold = 30; // Edge detection threshold
  let smallFeatureCount = 0;
  let totalFeatureCount = 0;
  
  // Sample a grid for performance
  const step = Math.max(1, Math.floor(width / 100));
  
  for (let y = step; y < height - step; y += step) {
    for (let x = step; x < width - step; x += step) {
      
      // Simple gradient magnitude
      const gx = Math.abs(
        data[((y - step) * width + (x - step)) * 4] -
        data[((y - step) * width + (x + step)) * 4] +
        2 * (data[(y * width + (x - step)) * 4] - data[(y * width + (x + step)) * 4]) +
        data[((y + step) * width + (x - step)) * 4] -
        data[((y + step) * width + (x + step)) * 4]
      );
      
      const gy = Math.abs(
        data[((y - step) * width + (x - step)) * 4] -
        data[((y + step) * width + (x - step)) * 4] +
        2 * (data[((y - step) * width + x) * 4] - data[((y + step) * width + x) * 4]) +
        data[((y - step) * width + (x + step)) * 4] -
        data[((y + step) * width + (x + step)) * 4]
      );
      
      const magnitude = Math.sqrt(gx * gx + gy * gy);
      
      if (magnitude > threshold) {
        totalFeatureCount++;
        // Estimate feature size (simplified - just check if it's a small edge)
        if (magnitude < threshold * 2) {
          smallFeatureCount++;
        }
      }
    }
  }
  
  // High detail if significant portion of features are small
  return totalFeatureCount > 0 && (smallFeatureCount / totalFeatureCount) > 0.3;
}

/**
 * Analyze contrast of an image using dominant colors
 */
export function analyzeContrast(
  image: HTMLImageElement,
  intendedUse: 'fabric' | 'wallpaper' | 'blender/tonal' | 'unspecified' = 'unspecified'
): ContrastAnalysis {
  // Create a canvas to sample pixels
  const canvas = document.createElement('canvas');
  const maxSampleSize = 500; // Sample at most 500x500 for performance
  const scale = Math.min(1, maxSampleSize / Math.max(image.width, image.height));
  
  canvas.width = Math.floor(image.width * scale);
  canvas.height = Math.floor(image.height * scale);
  
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get canvas context');
  }
  
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  
  // Extract dominant colors
  const dominantColors = extractDominantColors(imageData, 6);
  
  if (dominantColors.length === 0) {
    // Fallback if no colors found
    return {
      globalContrast: 0,
      band: 'very_low',
      status: 'risky',
      severity: 'warning',
      message: 'Unable to analyze contrast.',
      label: 'Contrast: Unknown',
      dominantColors: [],
      highDetail: false,
    };
  }
  
  // Compute relative luminance for each dominant color
  const colorsWithLuminance = dominantColors.map(color => ({
    ...color,
    luminance: getRelativeLuminance(color.r, color.g, color.b),
  }));
  
  // Find L_min and L_max
  const luminances = colorsWithLuminance.map(c => c.luminance);
  const L_min = Math.min(...luminances);
  const L_max = Math.max(...luminances);
  const globalContrast = L_max - L_min;
  
  // Detect detail scale
  const highDetail = detectDetailScale(imageData);
  
  // Determine contrast band
  let band: 'high' | 'moderate' | 'soft' | 'very_low';
  if (globalContrast >= 0.45) {
    band = 'high';
  } else if (globalContrast >= 0.25) {
    band = 'moderate';
  } else if (globalContrast >= 0.12) {
    band = 'soft';
  } else {
    band = 'very_low';
  }
  
  // Decision logic with context-aware messaging
  let status: 'ok' | 'soft' | 'soft_tonal' | 'risky';
  let severity: 'none' | 'info' | 'warning';
  let message: string;
  let label: string;
  
  if (band === 'high') {
    status = 'ok';
    severity = 'none';
    message = 'Bold, dramatic patterns where motifs really pop.';
    label = 'High Contrast';
  } else if (band === 'moderate') {
    status = 'ok';
    severity = 'info';
    message = 'Balanced patterns that read clearly.';
    label = 'Moderate Contrast';
  } else if (band === 'soft') {
    status = 'soft';
    severity = 'info';
    message = 'Subtle, tonal patterns — check they don\'t look too flat.';
    label = 'Soft Contrast';
  } else {
    // very_low
    status = 'risky';
    severity = 'warning';
    message = 'Warning! Motifs may disappear or look muddy on fabric.';
    label = 'Very Low Contrast';
  }
  
  return {
    globalContrast,
    band,
    status,
    severity,
    message,
    label,
    dominantColors: colorsWithLuminance,
    highDetail,
  };
}

/**
 * Helper: Get saturation from RGB
 */
function getSaturation(r: number, g: number, b: number): number {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;

  if (max === 0) return 0;
  return delta / max;
}

/**
 * Convert RGB to HSL. Returns hue in degrees [0, 360), saturation [0,1], lightness [0,1].
 */
function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;
  const l = (max + min) / 2;

  if (delta === 0) return { h: 0, s: 0, l };

  const s = delta / (1 - Math.abs(2 * l - 1));

  let h = 0;
  if (max === rNorm) {
    h = ((gNorm - bNorm) / delta) % 6;
  } else if (max === gNorm) {
    h = (bNorm - rNorm) / delta + 2;
  } else {
    h = (rNorm - gNorm) / delta + 4;
  }
  h = ((h * 60) + 360) % 360;

  return { h, s, l };
}

/**
 * Circular angular distance between two hues (degrees). Always returns 0–180.
 */
function hueDistance(h1: number, h2: number): number {
  const diff = Math.abs(h1 - h2);
  return Math.min(diff, 360 - diff);
}

/**
 * Smallest arc (in degrees) that contains all given hues.
 * Used to detect analogous palettes (spread <= 90°).
 */
function circularHueSpread(hues: number[]): number {
  if (hues.length < 2) return 0;
  const sorted = [...hues].sort((a, b) => a - b);
  let maxGap = 0;
  for (let i = 1; i < sorted.length; i++) {
    maxGap = Math.max(maxGap, sorted[i] - sorted[i - 1]);
  }
  const wrapGap = (360 - sorted[sorted.length - 1]) + sorted[0];
  maxGap = Math.max(maxGap, wrapGap);
  return 360 - maxGap;
}

/**
 * Human-readable name for a hue angle.
 * When saturation and lightness are provided, distinguishes muted variants
 * (e.g. Tan vs Orange, Mauve vs Pink).
 */
function hueName(h: number, s?: number, l?: number): string {
  // Muted warm hues: low saturation → Tan/Cream instead of Orange/Yellow
  if (s !== undefined && l !== undefined) {
    if (h >= 15 && h < 50 && s < 0.35) {
      return l > 0.65 ? 'Cream' : 'Tan';
    }
    if (h >= 290 && h < 345 && s < 0.30) {
      return 'Mauve';
    }
  }
  if (h < 15 || h >= 345) return 'Red';
  if (h < 40) return 'Orange';
  if (h < 50) return 'Gold';
  if (h < 65) return 'Yellow';
  if (h < 80) return 'Yellow-Green';
  if (h < 160) return 'Green';
  if (h < 190) return 'Teal';
  if (h < 250) return 'Blue';
  if (h < 290) return 'Purple';
  if (h < 330) return 'Pink';
  return 'Red';
}

/**
 * Calculate visual weight grid (3x3) based on luminance and saturation
 */
function calculateVisualWeightGrid(imageData: ImageData): number[][] {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;

  const grid: number[][] = Array(3).fill(null).map(() => Array(3).fill(0));
  const cellWidth = width / 3;
  const cellHeight = height / 3;

  // Sample every 4th pixel for performance
  for (let y = 0; y < height; y += 4) {
    for (let x = 0; x < width; x += 4) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

      if (a < 10) continue; // Skip transparent pixels

      const luminance = getRelativeLuminance(r, g, b);
      const saturation = getSaturation(r, g, b);

      // Darkness = 1 - luminance (darker = heavier weight)
      const darkness = 1 - luminance;

      // Visual weight = darkness (60%) + saturation (40%)
      const weight = (darkness * 0.6) + (saturation * 0.4);

      // Determine which grid cell this pixel belongs to
      const gridX = Math.min(2, Math.floor(x / cellWidth));
      const gridY = Math.min(2, Math.floor(y / cellHeight));

      grid[gridY][gridX] += weight;
    }
  }

  // Normalize by cell size (approximate pixel count per cell)
  const cellArea = (cellWidth * cellHeight) / 16; // Divided by 16 due to sampling every 4th pixel
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) {
      grid[y][x] = grid[y][x] / cellArea;
    }
  }

  return grid;
}

/**
 * Analyze balance metrics from weight grid
 */
function analyzeBalanceMetrics(grid: number[][]): {
  leftRightBalance: number;
  topBottomBalance: number;
  centerRatio: number;
  radialBalance: number;
  variance: number;
  overallBalance: number;
} {
  // Calculate total weight for normalization
  let totalWeight = 0;
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) {
      totalWeight += grid[y][x];
    }
  }

  if (totalWeight === 0) {
    return {
      leftRightBalance: 1,
      topBottomBalance: 1,
      centerRatio: 0,
      radialBalance: 1,
      variance: 0,
      overallBalance: 1,
    };
  }

  // Left vs Right
  const leftWeight = grid[0][0] + grid[1][0] + grid[2][0];
  const rightWeight = grid[0][2] + grid[1][2] + grid[2][2];
  const leftRightBalance = 1 - Math.abs(leftWeight - rightWeight) / totalWeight;

  // Top vs Bottom
  const topWeight = grid[0][0] + grid[0][1] + grid[0][2];
  const bottomWeight = grid[2][0] + grid[2][1] + grid[2][2];
  const topBottomBalance = 1 - Math.abs(topWeight - bottomWeight) / totalWeight;

  // Center vs Periphery
  const centerWeight = grid[1][1];
  const centerRatio = centerWeight / totalWeight;

  // Radial balance: how close center's share is to the ideal 1/9
  const idealCenterShare = 1 / 9;
  const radialBalance = Math.max(0, 1 - Math.abs(centerRatio - idealCenterShare) * 9);

  // Variance (how evenly distributed)
  const mean = totalWeight / 9;
  let varianceSum = 0;
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) {
      varianceSum += Math.pow(grid[y][x] - mean, 2);
    }
  }
  const variance = Math.sqrt(varianceSum / 9) / (mean + 0.001); // Normalized

  // Overall balance: L/R (35%) + T/B (35%) + radial (30%)
  const overallBalance = (leftRightBalance * 0.35) + (topBottomBalance * 0.35) + (radialBalance * 0.30);

  return {
    leftRightBalance,
    topBottomBalance,
    centerRatio,
    radialBalance,
    variance,
    overallBalance,
  };
}

/**
 * Calculate horizontal gradient to detect left-to-right flow
 */
function calculateHorizontalGradient(grid: number[][]): number {
  // Calculate average weight for left, middle, right columns
  const left = (grid[0][0] + grid[1][0] + grid[2][0]) / 3;
  const middle = (grid[0][1] + grid[1][1] + grid[2][1]) / 3;
  const right = (grid[0][2] + grid[1][2] + grid[2][2]) / 3;

  // Calculate correlation with increasing/decreasing gradient
  const increasingCorr = (middle - left) + (right - middle);
  const decreasingCorr = (left - middle) + (middle - right);

  return Math.max(Math.abs(increasingCorr), Math.abs(decreasingCorr));
}

/**
 * Calculate vertical gradient to detect top-to-bottom flow
 */
function calculateVerticalGradient(grid: number[][]): number {
  // Calculate average weight for top, middle, bottom rows
  const top = (grid[0][0] + grid[0][1] + grid[0][2]) / 3;
  const middle = (grid[1][0] + grid[1][1] + grid[1][2]) / 3;
  const bottom = (grid[2][0] + grid[2][1] + grid[2][2]) / 3;

  // Calculate correlation with increasing/decreasing gradient
  const increasingCorr = (middle - top) + (bottom - middle);
  const decreasingCorr = (top - middle) + (middle - bottom);

  return Math.max(Math.abs(increasingCorr), Math.abs(decreasingCorr));
}

/**
 * Calculate symmetry score to detect grid patterns
 */
function calculateSymmetryScore(grid: number[][]): number {
  let symmetryScore = 0;
  let comparisons = 0;

  // Check horizontal symmetry
  for (let y = 0; y < 3; y++) {
    const diff = Math.abs(grid[y][0] - grid[y][2]);
    symmetryScore += 1 - Math.min(1, diff);
    comparisons++;
  }

  // Check vertical symmetry
  for (let x = 0; x < 3; x++) {
    const diff = Math.abs(grid[0][x] - grid[2][x]);
    symmetryScore += 1 - Math.min(1, diff);
    comparisons++;
  }

  return symmetryScore / comparisons;
}

/**
 * Calculate rhythm strength using autocorrelation (simplified)
 */
function calculateRhythmStrength(imageData: ImageData): number {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;

  // Sample luminance values along horizontal and vertical lines
  const sampleStep = Math.max(1, Math.floor(Math.min(width, height) / 50));
  const samples: number[] = [];

  // Sample middle row and middle column
  const midY = Math.floor(height / 2);
  const midX = Math.floor(width / 2);

  for (let x = 0; x < width; x += sampleStep) {
    const idx = (midY * width + x) * 4;
    const lum = getRelativeLuminance(data[idx], data[idx + 1], data[idx + 2]);
    samples.push(lum);
  }

  for (let y = 0; y < height; y += sampleStep) {
    const idx = (y * width + midX) * 4;
    const lum = getRelativeLuminance(data[idx], data[idx + 1], data[idx + 2]);
    samples.push(lum);
  }

  if (samples.length < 4) return 0;

  // Simple rhythm detection: count transitions
  let transitions = 0;
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;

  for (let i = 1; i < samples.length; i++) {
    const prev = samples[i - 1] > mean;
    const curr = samples[i] > mean;
    if (prev !== curr) transitions++;
  }

  // Normalize: more transitions = stronger rhythm
  const rhythmStrength = Math.min(1, transitions / (samples.length * 0.4));

  return rhythmStrength;
}

/**
 * Classify distribution pattern
 */
function classifyDistributionPattern(
  grid: number[][],
  metrics: ReturnType<typeof analyzeBalanceMetrics>
): { pattern: CompositionAnalysis['distributionPattern']; confidence: number } {
  const horizontalGradient = calculateHorizontalGradient(grid);
  const verticalGradient = calculateVerticalGradient(grid);
  const symmetryScore = calculateSymmetryScore(grid);

  // All-Over: Low variance, even distribution
  if (metrics.variance < 0.08) {
    return { pattern: 'all-over', confidence: 1 - metrics.variance };
  }

  // Focal Point: High center ratio
  if (metrics.centerRatio > 0.25) {
    return { pattern: 'focal-point', confidence: metrics.centerRatio };
  }

  // Directional: Strong gradient
  const maxGradient = Math.max(horizontalGradient, verticalGradient);
  if (maxGradient > 0.4) {
    return { pattern: 'directional', confidence: Math.min(1, maxGradient) };
  }

  // Structured: High symmetry + medium variance
  if (symmetryScore > 0.6 && metrics.variance > 0.08 && metrics.variance < 0.35) {
    return { pattern: 'structured', confidence: symmetryScore };
  }

  // Organic: Default case
  return { pattern: 'organic', confidence: 0.6 };
}

/**
 * Generate composition feedback based on pattern analysis
 */
function generateCompositionFeedback(
  pattern: CompositionAnalysis['distributionPattern'],
  metrics: ReturnType<typeof analyzeBalanceMetrics>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _intendedUse: string
): Pick<CompositionAnalysis, 'label' | 'message' | 'contextHint' | 'band' | 'severity'> {
  const balanceScore = metrics.overallBalance;

  // Determine band
  let band: CompositionAnalysis['band'];
  let severity: CompositionAnalysis['severity'];

  if (balanceScore > 0.82) {
    band = 'balanced';
    severity = 'none';
  } else if (balanceScore > 0.55) {
    band = 'dynamic';
    severity = 'info';
  } else {
    band = 'asymmetric';
    severity = 'warning';
  }

  let label: string;
  let message: string;
  let contextHint: string;

  if (band === 'balanced') {
    // Pattern-specific copy for balanced compositions
    switch (pattern) {
      case 'all-over':
        label = 'Even Distribution';
        message = 'Visual weight is evenly spread — great for seamless repeats.';
        contextHint = 'Works well for fabric yardage and wallpaper.';
        break;
      case 'focal-point':
        label = 'Centered Focal Point';
        message = 'Eye is drawn to a central motif with balanced surroundings.';
        contextHint = 'Beautiful for panels or centered product placement.';
        break;
      case 'directional':
        label = 'Directional Flow';
        message = 'Pattern creates visual movement while staying balanced.';
        contextHint = 'Adds energy without feeling uneven.';
        break;
      case 'structured':
        label = 'Structured Grid';
        message = 'Elements follow a geometric grid with good rhythm.';
        contextHint = 'Creates calm, predictable visual order.';
        break;
      case 'organic':
        label = 'Organic Distribution';
        message = 'Elements are naturally scattered with good overall balance.';
        contextHint = 'Feels relaxed and hand-drawn.';
        break;
    }
  } else if (band === 'dynamic') {
    label = 'Dynamic Composition';
    message = 'Visual weight is unevenly distributed but creates intentional energy.';
    contextHint = 'Can feel lively — check it reads well at scale.';
  } else {
    // Asymmetric — detect WHY and give context-aware warning
    const mean = metrics.variance > 0 ? 1 / 9 : 0; // normalized mean weight share

    if (metrics.centerRatio > 0.25) {
      // Heavy center, sparse edges = isolated motif
      label = 'Isolated Motif';
      message = 'Isolated motif — will tile as repeating spots.';
      contextHint = 'Consider spreading visual weight outward so the repeat feels less spotty.';
    } else if (metrics.leftRightBalance < 0.5 || metrics.topBottomBalance < 0.5) {
      // Weight piled on one edge
      label = 'Edge-Heavy';
      message = 'Edge-heavy — may create grid lines when tiled.';
      contextHint = 'Try redistributing elements so edges don\'t stack up in the repeat.';
    } else {
      label = 'Asymmetric';
      message = 'Weight concentrated in one area — may look unbalanced when tiled.';
      contextHint = 'If this is intentional (e.g., border pattern), great! Otherwise, consider redistributing elements.';
    }
  }

  return { label, message, contextHint, band, severity };
}

/**
 * Analyze composition and visual balance of a pattern
 */
export function analyzeComposition(
  image: HTMLImageElement,
  intendedUse: 'fabric' | 'wallpaper' | 'blender/tonal' | 'unspecified' = 'unspecified'
): CompositionAnalysis {
  // Create a canvas to sample pixels (downsample to ~400x400 for consistency)
  const canvas = document.createElement('canvas');
  const targetSize = 400;
  const scale = Math.min(1, targetSize / Math.max(image.width, image.height));

  canvas.width = Math.floor(image.width * scale);
  canvas.height = Math.floor(image.height * scale);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // Calculate visual weight grid
  const weightGrid = calculateVisualWeightGrid(imageData);

  // Analyze balance metrics
  const metrics = analyzeBalanceMetrics(weightGrid);

  // Classify distribution pattern
  const { pattern, confidence } = classifyDistributionPattern(weightGrid, metrics);

  // Calculate rhythm strength
  const rhythmStrength = calculateRhythmStrength(imageData);

  // Generate feedback
  const feedback = generateCompositionFeedback(pattern, metrics, intendedUse);

  return {
    balanceScore: metrics.overallBalance,
    distributionPattern: pattern,
    distributionConfidence: confidence,
    rhythmStrength,
    band: feedback.band,
    severity: feedback.severity,
    label: feedback.label,
    message: feedback.message,
    contextHint: feedback.contextHint,
    weightGrid,
  };
}

/**
 * Analyze color harmony of a pattern based on hue relationships.
 * Contrast and harmony are independent: harmonious colors can still have poor contrast.
 */
/**
 * Evaluate harmony from an explicit list of RGB colors.
 * Used both by initial image analysis and by manual color edits from the UI.
 */
/**
 * Detect which color scheme best fits a set of unique hues.
 * Returns the scheme name and a fit score (0-1, higher = better match).
 * Tolerance values are generous to account for real-world palette imprecision.
 */
function detectColorScheme(uniqueHues: number[]): { scheme: string; fit: number } {
  if (uniqueHues.length < 2) return { scheme: 'monochromatic', fit: 1 };

  const spread = circularHueSpread(uniqueHues);

  // Analogous: all hues within ~90° arc
  if (spread <= 90) {
    return { scheme: 'analogous', fit: 1 - (spread / 90) * 0.3 };
  }

  const tol = 40; // tolerance in degrees for scheme matching

  // Try multiple clustering gap sizes to find the best scheme fit.
  // Real-world palettes have bridge colors (e.g., greens between teal and gold)
  // that need wider gaps to cluster with their nearest anchor.
  for (const gap of [50, 70, 90]) {
    const groups = clusterHuesIntoGroups(uniqueHues, gap);

    if (groups.length === 2) {
      const g1Avg = circularMean(groups[0]);
      const g2Avg = circularMean(groups[1]);
      const groupDist = hueDistance(g1Avg, g2Avg);
      // Complementary: two groups roughly opposite
      if (groupDist >= 180 - tol) {
        return { scheme: 'complementary', fit: 1 - Math.abs(groupDist - 180) / 180 };
      }
      // Split-complementary: two groups 100-160° apart
      if (groupDist >= 100) {
        return { scheme: 'split-complementary', fit: 0.8 };
      }
    }

    if (groups.length === 3) {
      const avgs = groups.map(g => circularMean(g));
      const dists = [
        hueDistance(avgs[0], avgs[1]),
        hueDistance(avgs[1], avgs[2]),
        hueDistance(avgs[0], avgs[2]),
      ];
      // Triadic: three groups roughly equidistant
      if (dists.every(d => d >= 80 && d <= 160)) {
        return { scheme: 'triadic', fit: 0.85 };
      }
    }

    if (groups.length === 4) {
      const avgs = groups.map(g => circularMean(g));
      const pairings = [[0,1,2,3], [0,2,1,3], [0,3,1,2]];
      for (const [a, b, c, d] of pairings) {
        const d1 = hueDistance(avgs[a], avgs[b]);
        const d2 = hueDistance(avgs[c], avgs[d]);
        if (d1 >= 140 && d2 >= 140) {
          return { scheme: 'tetradic', fit: 0.85 };
        }
      }
    }
  }

  // Warm-cool contrast: one side of the wheel vs the other with optional bridges.
  // Warm = 0-70° and 330-360°, Cool = 160-270°, Bridge = the rest.
  const warm = uniqueHues.filter(h => h < 70 || h >= 330);
  const cool = uniqueHues.filter(h => h >= 160 && h < 270);
  if (warm.length >= 1 && cool.length >= 1) {
    return { scheme: 'warm-cool contrast', fit: 0.75 };
  }

  return { scheme: 'none', fit: 0 };
}

/**
 * Cluster hues into groups where members are within `maxGap` degrees of each other.
 */
function clusterHuesIntoGroups(hues: number[], maxGap: number): number[][] {
  const sorted = [...hues].sort((a, b) => a - b);
  const groups: number[][] = [[sorted[0]]];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] <= maxGap) {
      groups[groups.length - 1].push(sorted[i]);
    } else {
      groups.push([sorted[i]]);
    }
  }
  // Check wrap-around: if first and last are close, merge them
  if (groups.length > 1) {
    const first = groups[0];
    const last = groups[groups.length - 1];
    if ((360 - last[last.length - 1] + first[0]) <= maxGap) {
      groups[0] = [...last, ...first];
      groups.pop();
    }
  }
  return groups;
}

/**
 * Circular mean of a set of angles (degrees).
 */
function circularMean(angles: number[]): number {
  const sinSum = angles.reduce((s, a) => s + Math.sin(a * Math.PI / 180), 0);
  const cosSum = angles.reduce((s, a) => s + Math.cos(a * Math.PI / 180), 0);
  let mean = Math.atan2(sinSum / angles.length, cosSum / angles.length) * 180 / Math.PI;
  if (mean < 0) mean += 360;
  return mean;
}

export function evaluateColorHarmony(
  colors: Array<{ r: number; g: number; b: number }>
): ColorHarmonyAnalysis {
  const withHsl = colors.map(c => ({
    ...c,
    ...rgbToHsl(c.r, c.g, c.b),
  }));

  const isChromaticColor = (c: { s: number; l: number }) =>
    c.s >= 0.08 && c.l >= 0.05 && c.l <= 0.95;

  const chromatic = withHsl.filter(isChromaticColor);

  // All colors (including neutrals like white/black) for display as swatches.
  // Users can manually add any color — neutrals should still appear, just not
  // participate in clash detection.
  const allTop = withHsl.slice(0, 6);

  const totalChromaticCount = chromatic.length;
  const isNeutralDominant = totalChromaticCount < 2;

  if (isNeutralDominant) {
    return {
      band: 'beautiful',
      severity: 'none',
      label: 'Colors work beautifully together',
      message: 'Your palette has a natural balance that feels intentional.',
      chromaticColors: allTop.map(c => ({
        r: c.r, g: c.g, b: c.b, hue: c.h, isClashing: false, clashingWith: [],
      })),
      clashPairs: [],
      tensePairs: [],
      totalChromaticCount,
      isNeutralDominant: true,
    };
  }

  const top = chromatic.slice(0, 6);
  const allHues = top.map(c => c.h);

  // Deduplicate hues: merge hues within 15° into one representative
  const uniqueHues: number[] = [];
  for (const h of allHues) {
    if (!uniqueHues.some(u => hueDistance(u, h) < 15)) {
      uniqueHues.push(h);
    }
  }

  // Detect color scheme
  const { scheme, fit } = detectColorScheme(uniqueHues);
  let isRecognizedScheme = scheme !== 'none' && fit > 0.3;
  let effectiveScheme = scheme;

  // Muted/tonal palettes: when most colors are desaturated, they harmonize
  // regardless of hue distance (earth tones, dusty pastels, etc.)
  const avgSat = top.reduce((s, c) => s + c.s, 0) / top.length;
  const maxSat = Math.max(...top.map(c => c.s));
  if (!isRecognizedScheme && maxSat < 0.55 && avgSat < 0.40) {
    isRecognizedScheme = true;
    effectiveScheme = 'tonal';
  }

  // Dominant background check: colors are sorted by pixel count (most dominant first).
  // If the most dominant color acts as a background (darkest or lightest) and other
  // colors each have meaningful lightness contrast against it, they're separated by
  // the background — they never directly compete. This is how most patterns work:
  // a dark/light background with accent colors placed on top.
  if (!isRecognizedScheme && top.length >= 3) {
    const dominant = top[0];
    const accents = top.slice(1);
    const dominantL = dominant.l;
    // Check if dominant is clearly dark or light (acting as background)
    const isDominantExtreme = dominantL < 0.30 || dominantL > 0.70;
    if (isDominantExtreme) {
      // Check that each accent has meaningful lightness contrast against the dominant
      const allContrastWell = accents.every(c =>
        Math.abs(c.l - dominantL) > 0.15
      );
      if (allContrastWell) {
        isRecognizedScheme = true;
        effectiveScheme = 'contrast';
      }
    }
  }

  // Compute pairwise distances for fallback analysis
  const allPairsWithDist: Array<{ pair: [number, number]; dist: number }> = [];
  let totalDist = 0;
  let pairCount = 0;

  for (let i = 0; i < top.length; i++) {
    for (let j = i + 1; j < top.length; j++) {
      const dist = hueDistance(top[i].h, top[j].h);
      totalDist += dist;
      pairCount++;
      allPairsWithDist.push({ pair: [i, j], dist });
    }
  }

  const meanSpread = pairCount > 0 ? totalDist / pairCount : 0;

  // Find clashing pairs (25–60° apart) — only if NO recognized scheme was detected
  const clashingIndices = new Set<number>();
  const clashPairs: Array<[number, number]> = [];
  const clashingWithMap = new Map<number, number[]>();

  if (!isRecognizedScheme) {
    for (const { pair: [i, j], dist } of allPairsWithDist) {
      if (dist >= 25 && dist <= 60) {
        clashingIndices.add(i);
        clashingIndices.add(j);
        clashPairs.push([i, j]);
        if (!clashingWithMap.has(i)) clashingWithMap.set(i, []);
        if (!clashingWithMap.has(j)) clashingWithMap.set(j, []);
        clashingWithMap.get(i)!.push(j);
        clashingWithMap.get(j)!.push(i);
      }
    }
  }

  // For 'mostly' band: show the most noteworthy pairs
  const tensePairs: Array<[number, number]> = allPairsWithDist
    .filter(p => p.dist > 10)
    .sort((a, b) => b.dist - a.dist)
    .slice(0, 2)
    .map(p => p.pair);

  const hasClashes = clashingIndices.size > 0;

  // Band assignment — scheme-aware
  let band: ColorHarmonyAnalysis['band'];
  if (meanSpread < 25 && uniqueHues.length <= 2) {
    band = 'too_similar';
  } else if (isRecognizedScheme) {
    band = 'beautiful';
  } else if (hasClashes) {
    band = 'fighting';
  } else {
    band = 'mostly';
  }

  const flagSwatches = band !== 'too_similar' && band !== 'beautiful';

  // Build message — include detected scheme for beautiful palettes
  const schemeName: Record<string, string> = {
    monochromatic: 'monochromatic',
    analogous: 'analogous',
    complementary: 'complementary',
    'split-complementary': 'split-complementary',
    triadic: 'triadic',
    tetradic: 'tetradic',
    tonal: 'tonal',
    'warm-cool contrast': 'warm-cool',
    contrast: 'contrast',
  };

  const schemeMessages: Record<string, string> = {
    tonal: 'These muted, earthy tones share a similar intensity — they naturally harmonize regardless of hue.',
    'warm-cool contrast': 'Warm and cool tones play off each other — a timeless combination that creates depth and visual interest.',
    contrast: 'Your accent colors each stand out clearly against the background — the palette reads as intentional and balanced.',
  };

  const bandCopy: Record<ColorHarmonyAnalysis['band'], { label: string; message: string; severity: ColorHarmonyAnalysis['severity'] }> = {
    beautiful: {
      label: 'Colors work beautifully together',
      message: schemeMessages[effectiveScheme]
        ?? (isRecognizedScheme && schemeName[effectiveScheme]
          ? `This is a ${schemeName[effectiveScheme]} palette — a classic color relationship that feels intentional and balanced.`
          : 'Your palette has a natural balance that feels intentional.'),
      severity: 'none',
    },
    mostly: {
      label: 'Colors mostly work',
      message: 'A few combinations might create visual tension — worth a second look.',
      severity: 'info',
    },
    fighting: {
      label: 'Colors are fighting each other',
      message: 'Some hues compete for attention in a way that feels unintentional.',
      severity: 'warning',
    },
    too_similar: {
      label: 'Too similar to read as separate colors',
      message: 'Your palette may blend into a single muddy tone on fabric.',
      severity: 'warning',
    },
  };

  const { label, message, severity } = bandCopy[band];

  return {
    band,
    severity,
    label,
    message,
    detectedScheme: isRecognizedScheme ? effectiveScheme : undefined,
    chromaticColors: [
      // Chromatic colors (participate in harmony analysis)
      ...top.map((c, i) => ({
        r: c.r,
        g: c.g,
        b: c.b,
        hue: c.h,
        isClashing: flagSwatches && clashingIndices.has(i),
        clashingWith: flagSwatches ? (clashingWithMap.get(i) ?? []) : [],
      })),
      // Neutral colors (white, black, grays) — always shown, never clashing
      ...withHsl.filter(c => !isChromaticColor(c)).slice(0, 6 - top.length).map(c => ({
        r: c.r,
        g: c.g,
        b: c.b,
        hue: c.h,
        isClashing: false,
        clashingWith: [] as number[],
      })),
    ],
    clashPairs: flagSwatches ? clashPairs : [],
    tensePairs: band === 'mostly' ? tensePairs : [],
    totalChromaticCount,
    isNeutralDominant: false,
  };
}

/**
 * Analyze color harmony of a pattern by extracting dominant colors from the image.
 */
export function analyzeColorHarmony(
  image: HTMLImageElement
): ColorHarmonyAnalysis {
  const canvas = document.createElement('canvas');
  const maxSampleSize = 800;
  const scale = Math.min(1, maxSampleSize / Math.max(image.width, image.height));
  canvas.width = Math.floor(image.width * scale);
  canvas.height = Math.floor(image.height * scale);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  // Nearest-neighbor: prevents blending minority colors into the background
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  // Over-cluster to k=12 so minority colors get their own bucket, then merge down
  const dominantColors = extractDominantColors(imageData, 12);

  return evaluateColorHarmony(dominantColors);
}
