export type RepeatType = 'full-drop' | 'half-drop' | 'half-brick';

export class PatternTiler {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private displayWidth: number;
  private displayHeight: number;

  constructor(canvas: HTMLCanvasElement, displayWidth?: number, displayHeight?: number) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');
    this.ctx = ctx;
    
    // Use provided display dimensions, or fall back to canvas CSS size
    // This accounts for DPR scaling where internal canvas size != display size
    if (displayWidth !== undefined && displayHeight !== undefined) {
      this.displayWidth = displayWidth;
      this.displayHeight = displayHeight;
    } else {
      // Fallback: use canvas CSS size (display size)
      const style = window.getComputedStyle(canvas);
      this.displayWidth = parseInt(style.width) || canvas.width;
      this.displayHeight = parseInt(style.height) || canvas.height;
    }
    
    // Enable high-quality image smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
  }

  clear() {
    // Fill with navy background before clearing
    this.ctx.fillStyle = '#294051'; // navy blue background
    this.ctx.fillRect(0, 0, this.displayWidth, this.displayHeight);
    // Clear any remaining artifacts
    this.ctx.clearRect(0, 0, this.displayWidth, this.displayHeight);
  }

  renderFullDrop(image: HTMLImageElement) {
    const w = image.width;
    const h = image.height;
    
    console.log('🔍 PatternTiler.renderFullDrop:', {
      imageWidth: w,
      imageHeight: h,
      displayWidth: this.displayWidth,
      displayHeight: this.displayHeight,
    });
    
    // Add extra tiles to ensure full canvas coverage
    const cols = Math.ceil(this.displayWidth / w) + 2;
    const rows = Math.ceil(this.displayHeight / h) + 2;

    // Start from -1 to cover edges
    for (let x = -1; x < cols; x++) {
      for (let y = -1; y < rows; y++) {
        this.ctx.drawImage(image, x * w, y * h, w, h);
      }
    }
  }

  renderHalfDrop(image: HTMLImageElement) {
    const w = image.width;
    const h = image.height;
    const cols = Math.ceil(this.displayWidth / w) + 1;
    const rows = Math.ceil(this.displayHeight / h) + 1;

    for (let x = 0; x < cols; x++) {
      const x0 = Math.round(x * w);
      const x1 = Math.round((x + 1) * w);
      const drawW = x1 - x0;

      for (let y = -1; y < rows; y++) {
        let logicalY = y * h;
        if (x % 2 !== 0) {
          logicalY += h / 2;
        }

        // Calculate Y-bounds based on the logical sequence to ensure adjacency
        // We treat the grid as continuous, so we calculate start/end relative to the logical index
        // But for half-drop, the standard integer indexing might be tricky.
        // Safer approach: Calculate y0, drawH based on original H, but round position.
        // However, to ensure perfect vertical stack:

        const y0 = Math.round(logicalY);
        // For height, we must ensure that the Next tile starts at exactly y0 + drawH
        // The next tile in this column is at logicalY + h
        const yNext = Math.round(logicalY + h);
        const drawH = yNext - y0;

        this.ctx.drawImage(image, x0, y0, drawW, drawH);
      }
    }
  }

  renderHalfBrick(image: HTMLImageElement) {
    const w = image.width;
    const h = image.height;
    const cols = Math.ceil(this.displayWidth / w) + 1;
    const rows = Math.ceil(this.displayHeight / h) + 1;

    for (let y = 0; y < rows; y++) {
      const y0 = Math.round(y * h);
      const y1 = Math.round((y + 1) * h);
      const drawH = y1 - y0;

      for (let x = -1; x < cols; x++) {
        let logicalX = x * w;
        if (y % 2 !== 0) {
          logicalX += w / 2;
        }

        const x0 = Math.round(logicalX);
        const xNext = Math.round(logicalX + w);
        const drawW = xNext - x0;

        this.ctx.drawImage(image, x0, y0, drawW, drawH);
      }
    }
  }

  render(image: HTMLImageElement, repeatType: RepeatType) {
    this.clear();

    switch (repeatType) {
      case 'full-drop':
        this.renderFullDrop(image);
        break;
      case 'half-drop':
        this.renderHalfDrop(image);
        break;
      case 'half-brick':
        this.renderHalfBrick(image);
        break;
    }
  }
}


