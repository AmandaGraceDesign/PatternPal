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
  
  // Sample pixels (every 4th pixel for performance)
  for (let i = 0; i < data.length; i += 16) {
    pixels.push([data[i], data[i + 1], data[i + 2]]);
  }
  
  if (pixels.length === 0) return [];
  
  // Initialize centroids randomly
  const centroids: Array<[number, number, number]> = [];
  for (let i = 0; i < k; i++) {
    const randomPixel = pixels[Math.floor(Math.random() * pixels.length)];
    centroids.push([...randomPixel]);
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
  
  return centroids
    .map((centroid, i) => ({
      r: centroid[0],
      g: centroid[1],
      b: centroid[2],
      count: clusters[i].length,
    }))
    .filter(color => color.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8); // Return top 8
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
    message = 'Contrast range: strong. Motifs should read clearly on most fabrics and wallpapers.';
    label = 'Contrast: Strong';
  } else if (band === 'moderate') {
    status = 'ok';
    severity = 'info';
    message = 'Contrast range: moderate. Pattern should read clearly while still feeling soft.';
    label = 'Contrast: Moderate';
  } else if (band === 'soft') {
    if (highDetail || intendedUse === 'wallpaper') {
      status = 'soft';
      severity = 'info';
      message = 'Contrast is on the softer side. Fine for tonal or blender styles; if you want small details to pop at a distance, consider adding a slightly lighter or darker accent.';
      label = 'Contrast: Soft';
    } else {
      status = 'ok';
      severity = 'none';
      message = 'Soft overall contrast. This will read as a gentle, tonal pattern rather than a bold, graphic print.';
      label = 'Contrast: Soft';
    }
  } else {
    // very_low
    if (intendedUse === 'blender/tonal' && !highDetail) {
      status = 'soft_tonal';
      severity = 'info';
      message = 'Contrast is very soft. Expect a subtle, hazy effect similar to a tonal blender. If you want clearer motif separation, increase light–dark differences slightly.';
      label = 'Contrast: Very Low';
    } else {
      status = 'risky';
      severity = 'warning';
      message = 'Contrast is very low across the design. On fabric or wallpaper, details may blend together and read as a soft haze. If you want motifs to be clearly distinguishable, increase light–dark separation.';
      label = 'Contrast: Very Low (Details may blur)';
    }
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

  // Variance (how evenly distributed)
  const mean = totalWeight / 9;
  let varianceSum = 0;
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) {
      varianceSum += Math.pow(grid[y][x] - mean, 2);
    }
  }
  const variance = Math.sqrt(varianceSum / 9) / (mean + 0.001); // Normalized

  // Overall balance (weighted average)
  const overallBalance = (leftRightBalance * 0.4) + (topBottomBalance * 0.4) + (1 - Math.min(1, variance)) * 0.2;

  return {
    leftRightBalance,
    topBottomBalance,
    centerRatio,
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
  if (metrics.variance < 0.15) {
    return { pattern: 'all-over', confidence: 1 - metrics.variance };
  }

  // Focal Point: High center ratio
  if (metrics.centerRatio > 0.4) {
    return { pattern: 'focal-point', confidence: metrics.centerRatio };
  }

  // Directional: Strong gradient
  const maxGradient = Math.max(horizontalGradient, verticalGradient);
  if (maxGradient > 0.7) {
    return { pattern: 'directional', confidence: Math.min(1, maxGradient) };
  }

  // Structured: High symmetry + medium variance
  if (symmetryScore > 0.7 && metrics.variance > 0.15 && metrics.variance < 0.35) {
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

  if (balanceScore > 0.7) {
    band = 'balanced';
    severity = 'none';
  } else if (balanceScore > 0.4) {
    band = 'dynamic';
    severity = 'info';
  } else {
    band = 'asymmetric';
    severity = 'warning';
  }

  let label: string;
  let message: string;
  let contextHint: string;

  // Pattern-specific messaging
  switch (pattern) {
    case 'all-over':
      label = 'Composition: Balanced All-Over';
      message = 'Visual weight is evenly distributed across the pattern, creating a harmonious all-over design.';
      contextHint = 'This balanced composition works well for fabric yardage and wallpaper where you want consistent visual interest without dominant focal points.';
      break;

    case 'focal-point':
      label = 'Composition: Centered Focal Point';
      message = 'Visual weight concentrates toward the center, drawing the eye to a central motif.';
      contextHint = 'This works beautifully for wallpaper panels or centered placement on products. For seamless repeats, ensure the transition to edges feels intentional.';
      break;

    case 'directional':
      label = 'Composition: Directional Flow';
      message = 'The pattern creates visual movement, guiding the eye across the design.';
      contextHint = 'Directional patterns add dynamic energy. Consider how this flow works when the pattern repeats.';
      break;

    case 'structured':
      label = 'Composition: Structured Grid';
      message = 'Elements follow a geometric grid structure, creating order and rhythm.';
      contextHint = 'The structured layout creates visual predictability and calm. This works especially well for modern, architectural interiors.';
      break;

    case 'organic':
      label = 'Composition: Organic Distribution';
      message = 'Elements are distributed irregularly, creating a natural, hand-drawn feel.';
      contextHint = 'This organic composition feels relaxed and spontaneous. The varied spacing prevents monotony in large-scale installations.';
      break;
  }

  // Override for asymmetric patterns
  if (band === 'asymmetric') {
    // Determine which side is heavier
    let direction = '';
    if (metrics.leftRightBalance < 0.6) {
      const leftWeight = metrics.leftRightBalance < 0.5 ? 'right' : 'left';
      direction = leftWeight === 'left' ? 'Left-Heavy' : 'Right-Heavy';
    } else if (metrics.topBottomBalance < 0.6) {
      const topWeight = metrics.topBottomBalance < 0.5 ? 'bottom' : 'top';
      direction = topWeight === 'top' ? 'Top-Heavy' : 'Bottom-Heavy';
    } else {
      direction = 'Asymmetric';
    }

    label = `Composition: ${direction}`;
    message = 'Visual weight concentrates in one area, creating strong asymmetry.';
    contextHint = 'This composition can feel unbalanced across large areas. If this is intentional (e.g., for a border pattern), great! If you want more balance, consider redistributing elements.';
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


