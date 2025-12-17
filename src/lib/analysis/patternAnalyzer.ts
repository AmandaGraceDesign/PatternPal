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

export interface DensityAnalysis {
  coverageRatio: number; // 0-1
  coverageBand: 'light' | 'medium' | 'heavy';
  maxGapInches: number; // Largest contiguous background gap in print inches
  label: string;
  description: string;
  contextHint: string;
  combinedNote?: string; // Optional combined risk note
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
 * Find largest gap between motifs by sampling background regions
 * Returns the largest linear dimension of isolated gaps (not the entire background)
 */
function findLargestBackgroundGap(
  imageData: ImageData,
  isBackground: (r: number, g: number, b: number, a: number) => boolean
): number {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  const visited = new Set<number>();
  let maxGapDimension = 0;
  
  // Sample at a coarser resolution to find gaps more efficiently
  const sampleStep = Math.max(1, Math.floor(Math.min(width, height) / 100));
  
  for (let y = 0; y < height; y += sampleStep) {
    for (let x = 0; x < width; x += sampleStep) {
      const pixelKey = y * width + x;
      
      if (visited.has(pixelKey)) continue;
      
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];
      
      if (!isBackground(r, g, b, a)) continue;
      
      // Flood fill to find contiguous background region
      const stack: Array<[number, number]> = [[x, y]];
      const regionPixels: Array<[number, number]> = [];
      const regionVisited = new Set<number>();
      let touchesEdge = false;
      
      while (stack.length > 0) {
        const [cx, cy] = stack.pop()!;
        const cKey = cy * width + cx;
        
        if (cx < 0 || cx >= width || cy < 0 || cy >= height) continue;
        if (visited.has(cKey) || regionVisited.has(cKey)) continue;
        
        // Check if region touches image edge (likely the main background, not a gap)
        if (cx === 0 || cx === width - 1 || cy === 0 || cy === height - 1) {
          touchesEdge = true;
        }
        
        const cIdx = (cy * width + cx) * 4;
        const cr = data[cIdx];
        const cg = data[cIdx + 1];
        const cb = data[cIdx + 2];
        const ca = data[cIdx + 3];
        
        if (!isBackground(cr, cg, cb, ca)) continue;
        
        regionVisited.add(cKey);
        visited.add(cKey);
        regionPixels.push([cx, cy]);
        
        // Check neighbors
        stack.push([cx + 1, cy]);
        stack.push([cx - 1, cy]);
        stack.push([cx, cy + 1]);
        stack.push([cx, cy - 1]);
      }
      
      // Only consider regions that don't touch the edge (these are actual gaps between motifs)
      // Also limit to reasonable gap sizes (not the entire background)
      if (regionPixels.length > 0 && !touchesEdge && regionPixels.length < (width * height * 0.3)) {
        // Calculate bounding box to get linear dimensions
        let minX = regionPixels[0][0];
        let maxX = regionPixels[0][0];
        let minY = regionPixels[0][1];
        let maxY = regionPixels[0][1];
        
        for (let i = 1; i < regionPixels.length; i++) {
          const [px, py] = regionPixels[i];
          if (px < minX) minX = px;
          if (px > maxX) maxX = px;
          if (py < minY) minY = py;
          if (py > maxY) maxY = py;
        }
        
        const gapWidth = maxX - minX + 1;
        const gapHeight = maxY - minY + 1;
        
        // Use the larger dimension (width or height) as the gap size
        const gapDimension = Math.max(gapWidth, gapHeight);
        maxGapDimension = Math.max(maxGapDimension, gapDimension);
      } else if (touchesEdge) {
        // Mark edge-touching pixels as visited so we don't process them again
        for (const [px, py] of regionPixels) {
          visited.add(py * width + px);
        }
      }
    }
  }
  
  return maxGapDimension;
}

/**
 * Analyze density and coverage of an image
 */
export function analyzeDensity(
  image: HTMLImageElement,
  dpi: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _tileWidth: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _tileHeight: number
): DensityAnalysis {
  // Downsample to 512x512 for analysis
  const targetSize = 512;
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, targetSize / Math.max(image.width, image.height));
  
  canvas.width = Math.floor(image.width * scale);
  canvas.height = Math.floor(image.height * scale);
  
  // Ensure we're close to 512x512
  if (canvas.width > targetSize || canvas.height > targetSize) {
    const finalScale = targetSize / Math.max(canvas.width, canvas.height);
    canvas.width = Math.floor(canvas.width * finalScale);
    canvas.height = Math.floor(canvas.height * finalScale);
  }
  
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get canvas context');
  }
  
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  // Extract dominant colors to identify background
  const dominantColors = extractDominantColors(imageData, 8);
  
  // Identify background: typically the most common color
  // Sort by count first (most common first)
  const colorsWithLum = dominantColors.map(color => ({
    ...color,
    luminance: getRelativeLuminance(color.r, color.g, color.b),
  })).sort((a, b) => b.count - a.count);
  
  // Background is most likely the most common color (by pixel count)
  // This handles colored backgrounds better than just looking for the lightest
  const backgroundColor = colorsWithLum[0];
  
  // Calculate how much more common the top color is than others
  const topColorCount = colorsWithLum[0].count;
  const secondColorCount = colorsWithLum.length > 1 ? colorsWithLum[1].count : 0;
  const isDominantBackground = topColorCount > secondColorCount * 1.5; // Top color is significantly more common
  
  // Use adaptive threshold based on color distribution
  // Calculate average color distance between dominant colors
  let avgColorDist = 0;
  let distCount = 0;
  for (let i = 0; i < Math.min(4, colorsWithLum.length); i++) {
    for (let j = i + 1; j < Math.min(4, colorsWithLum.length); j++) {
      const dist = Math.sqrt(
        Math.pow(colorsWithLum[i].r - colorsWithLum[j].r, 2) +
        Math.pow(colorsWithLum[i].g - colorsWithLum[j].g, 2) +
        Math.pow(colorsWithLum[i].b - colorsWithLum[j].b, 2)
      );
      avgColorDist += dist;
      distCount++;
    }
  }
  avgColorDist = distCount > 0 ? avgColorDist / distCount : 100;
  
  // Use adaptive threshold for background detection
  // If the background is clearly dominant, we can be more generous
  // But we need to be careful not to include foreground colors
  const baseThreshold = isDominantBackground 
    ? Math.max(35, Math.min(50, avgColorDist * 0.35)) // Cap at 50 to avoid being too generous
    : Math.max(30, Math.min(45, avgColorDist * 0.3));
  
  // Function to determine if pixel is background
  const isBackground = (r: number, g: number, b: number, a: number): boolean => {
    if (a < 10) return true; // Transparent is background
    
    const luminance = getRelativeLuminance(r, g, b);
    
    // Check if it's very light (near-white/cream) - but only if background is also light
    // This helps with light backgrounds but shouldn't affect dark backgrounds
    if (backgroundColor.luminance > 0.7 && luminance > 0.85) return true;
    
    // Check if color is close to background color
    const colorDist = Math.sqrt(
      Math.pow(r - backgroundColor.r, 2) +
      Math.pow(g - backgroundColor.g, 2) +
      Math.pow(b - backgroundColor.b, 2)
    );
    
    // Also check luminance similarity - if luminance is very different, it's likely foreground
    const luminanceDiff = Math.abs(luminance - backgroundColor.luminance);
    const maxLuminanceDiff = 0.15; // Allow some variation but not too much
    
    // Pixel is background if color is close AND luminance is similar
    return colorDist < baseThreshold && luminanceDiff < maxLuminanceDiff;
  };
  
  // Calculate coverage ratio
  let foregroundPixels = 0;
  const totalPixels = canvas.width * canvas.height;
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    
    if (!isBackground(r, g, b, a)) {
      foregroundPixels++;
    }
  }
  
  const coverageRatio = foregroundPixels / totalPixels;
  
  // Find largest contiguous background gap
  const maxGapPixels = findLargestBackgroundGap(imageData, isBackground);
  
  // Convert gap size to print inches
  const pixelsPerInch = (canvas.width / image.width) * dpi;
  const maxGapInches = maxGapPixels / pixelsPerInch;
  
  // Determine coverage band
  let coverageBand: 'light' | 'medium' | 'heavy';
  if (coverageRatio < 0.25) {
    coverageBand = 'light';
  } else if (coverageRatio < 0.6) {
    coverageBand = 'medium';
  } else {
    coverageBand = 'heavy';
  }
  
  // Generate descriptive label, description, and context hint
  let label: string;
  let description: string;
  let contextHint: string;
  
  if (coverageBand === 'light') {
    label = 'Coverage: Light';
    description = `Motifs cover roughly ${Math.round(coverageRatio * 100)}% of the tile; background is very visible. Largest open spaces are about ${maxGapInches.toFixed(1)} in at print size.`;
    contextHint = 'This reads as airy and spacious. Works well for large-scale wallpaper or designs where you want plenty of breathing room.';
  } else if (coverageBand === 'medium') {
    label = 'Coverage: Medium';
    description = `Motifs cover roughly ${Math.round(coverageRatio * 100)}% of the tile with a balance of background and foreground. Largest open spaces are about ${maxGapInches.toFixed(1)} in at print size.`;
    contextHint = 'This reads as a medium pattern density, suitable for many fabric and wallpaper applications.';
  } else {
    // heavy
    label = 'Coverage: Heavy';
    description = `Motifs cover roughly ${Math.round(coverageRatio * 100)}% of the tile with minimal background showing. Most open spaces are smaller than ${maxGapInches.toFixed(1)} in at print size.`;
    contextHint = 'This reads as a continuous, high-energy surface, similar to a blender or maximalist all-over print. For small rooms or very large scales, it can feel intense; increase open space if you prefer a lighter look.';
  }
  
  return {
    coverageRatio,
    coverageBand,
    maxGapInches,
    label,
    description,
    contextHint,
  };
}

