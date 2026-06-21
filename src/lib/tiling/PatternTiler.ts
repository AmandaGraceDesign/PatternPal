export type RepeatType = 'full-drop' | 'half-drop' | 'half-brick';

export interface TilePos {
  dx: number;
  dy: number;
}

/**
 * Pure tile-placement geometry shared by the full-res and pre-scaled render
 * paths. Returns the top-left destination coordinate of every tile that can
 * touch the viewport, including a 1-tile border, with the same rounding and
 * half-drop / half-brick parity the renderers have always used.
 */
export function tilePositions(
  repeatType: RepeatType,
  scaledW: number,
  scaledH: number,
  panX: number,
  panY: number,
  viewportWidth: number,
  viewportHeight: number,
): TilePos[] {
  const positions: TilePos[] = [];
  if (scaledW <= 0 || scaledH <= 0) return positions;

  if (repeatType === 'half-brick') {
    const startRow = Math.floor(-panY / scaledH) - 1;
    const endRow = Math.ceil((viewportHeight - panY) / scaledH);
    const startCol = Math.floor(-panX / scaledW) - 2;
    const endCol = Math.ceil((viewportWidth - panX) / scaledW) + 1;
    for (let row = startRow; row <= endRow; row++) {
      const xOffset = (((row % 2) + 2) % 2 !== 0) ? Math.round(scaledW / 2) : 0;
      for (let col = startCol; col <= endCol; col++) {
        positions.push({
          dx: Math.round(col * scaledW + xOffset + panX),
          dy: Math.round(row * scaledH + panY),
        });
      }
    }
  } else if (repeatType === 'half-drop') {
    const startCol = Math.floor(-panX / scaledW) - 1;
    const endCol = Math.ceil((viewportWidth - panX) / scaledW);
    const startRow = Math.floor(-panY / scaledH) - 2;
    const endRow = Math.ceil((viewportHeight - panY) / scaledH) + 1;
    for (let col = startCol; col <= endCol; col++) {
      const yOffset = (((col % 2) + 2) % 2 !== 0) ? Math.round(scaledH / 2) : 0;
      for (let row = startRow; row <= endRow; row++) {
        positions.push({
          dx: Math.round(col * scaledW + panX),
          dy: Math.round(row * scaledH + yOffset + panY),
        });
      }
    }
  } else {
    // full-drop
    const startCol = Math.floor(-panX / scaledW) - 1;
    const endCol = Math.ceil((viewportWidth - panX) / scaledW);
    const startRow = Math.floor(-panY / scaledH) - 1;
    const endRow = Math.ceil((viewportHeight - panY) / scaledH);
    for (let col = startCol; col <= endCol; col++) {
      for (let row = startRow; row <= endRow; row++) {
        positions.push({
          dx: Math.round(col * scaledW + panX),
          dy: Math.round(row * scaledH + panY),
        });
      }
    }
  }
  return positions;
}

export class PatternTiler {
  private ctx: CanvasRenderingContext2D;
  private viewportWidth: number;
  private viewportHeight: number;

  constructor(ctx: CanvasRenderingContext2D, viewportWidth: number, viewportHeight: number) {
    this.ctx = ctx;
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
  }

  clear() {
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, this.viewportWidth, this.viewportHeight);
  }

  render(
    sourceImage: HTMLImageElement,
    repeatType: RepeatType,
    scale: number,
    panX: number,
    panY: number
  ) {
    this.clear();

    const srcW = sourceImage.naturalWidth;
    const srcH = sourceImage.naturalHeight;
    // Round tile dimensions to avoid sub-pixel gaps between tiles
    const scaledW = Math.ceil(srcW * scale);
    const scaledH = Math.ceil(srcH * scale);

    if (scaledW <= 0 || scaledH <= 0) return;

    switch (repeatType) {
      case 'full-drop':
        this.renderFullDrop(sourceImage, srcW, srcH, scaledW, scaledH, panX, panY);
        break;
      case 'half-drop':
        this.renderHalfDrop(sourceImage, srcW, srcH, scaledW, scaledH, panX, panY);
        break;
      case 'half-brick':
        this.renderHalfBrick(sourceImage, srcW, srcH, scaledW, scaledH, panX, panY);
        break;
    }
  }

  private renderFullDrop(
    img: HTMLImageElement, srcW: number, srcH: number,
    scaledW: number, scaledH: number, panX: number, panY: number
  ) {
    for (const { dx, dy } of tilePositions('full-drop', scaledW, scaledH, panX, panY, this.viewportWidth, this.viewportHeight)) {
      this.drawTile(img, srcW, srcH, dx, dy, scaledW, scaledH);
    }
  }

  private renderHalfDrop(
    img: HTMLImageElement, srcW: number, srcH: number,
    scaledW: number, scaledH: number, panX: number, panY: number
  ) {
    for (const { dx, dy } of tilePositions('half-drop', scaledW, scaledH, panX, panY, this.viewportWidth, this.viewportHeight)) {
      this.drawTile(img, srcW, srcH, dx, dy, scaledW, scaledH);
    }
  }

  private renderHalfBrick(
    img: HTMLImageElement, srcW: number, srcH: number,
    scaledW: number, scaledH: number, panX: number, panY: number
  ) {
    for (const { dx, dy } of tilePositions('half-brick', scaledW, scaledH, panX, panY, this.viewportWidth, this.viewportHeight)) {
      this.drawTile(img, srcW, srcH, dx, dy, scaledW, scaledH);
    }
  }

  /**
   * Legacy method for callers that pre-scale their tile image.
   * Tiles the source at 1:1 pixel size with no panning.
   */
  renderPreScaled(source: HTMLImageElement | HTMLCanvasElement, repeatType: RepeatType) {
    this.clear();
    const w = source instanceof HTMLImageElement
      ? (source.naturalWidth || source.width)
      : source.width;
    const h = source instanceof HTMLImageElement
      ? (source.naturalHeight || source.height)
      : source.height;

    if (w <= 0 || h <= 0) return;

    const drawTile = (dx: number, dy: number) => {
      if (dx + w <= 0 || dy + h <= 0 || dx >= this.viewportWidth || dy >= this.viewportHeight) return;
      // +1px overlap prevents sub-pixel anti-aliasing gaps between tiles
      this.ctx.drawImage(source, Math.floor(dx), Math.floor(dy), Math.ceil(w) + 1, Math.ceil(h) + 1);
    };

    const startCol = -1;
    const endCol = Math.ceil(this.viewportWidth / w) + 1;
    const startRow = -1;
    const endRow = Math.ceil(this.viewportHeight / h) + 1;

    for (let col = startCol; col <= endCol; col++) {
      for (let row = startRow; row <= endRow; row++) {
        let dx = col * w;
        let dy = row * h;
        if (repeatType === 'half-drop') {
          dy += (((col % 2) + 2) % 2 !== 0) ? h / 2 : 0;
        } else if (repeatType === 'half-brick') {
          dx += (((row % 2) + 2) % 2 !== 0) ? w / 2 : 0;
        }
        drawTile(dx, dy);
      }
    }
  }

  private drawTile(
    img: HTMLImageElement,
    srcW: number, srcH: number,
    dx: number, dy: number,
    dw: number, dh: number
  ) {
    if (dx + dw <= 0 || dy + dh <= 0 || dx >= this.viewportWidth || dy >= this.viewportHeight) return;

    let clipDx = dx;
    let clipDy = dy;
    let clipDw = dw;
    let clipDh = dh;
    let sx = 0;
    let sy = 0;

    if (clipDx < 0) {
      const clip = -clipDx;
      sx = (clip / dw) * srcW;
      clipDw -= clip;
      clipDx = 0;
    }
    if (clipDy < 0) {
      const clip = -clipDy;
      sy = (clip / dh) * srcH;
      clipDh -= clip;
      clipDy = 0;
    }
    if (clipDx + clipDw > this.viewportWidth) {
      clipDw = this.viewportWidth - clipDx;
    }
    if (clipDy + clipDh > this.viewportHeight) {
      clipDh = this.viewportHeight - clipDy;
    }

    const sw = (clipDw / dw) * srcW;
    const sh = (clipDh / dh) * srcH;

    if (sw <= 0 || sh <= 0 || clipDw <= 0 || clipDh <= 0) return;

    this.ctx.drawImage(img, sx, sy, sw, sh, clipDx, clipDy, clipDw, clipDh);
  }
}
