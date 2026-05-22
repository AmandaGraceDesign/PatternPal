export type WatermarkFont = 'sans' | 'serif' | 'script';

export interface WatermarkConfig {
  enabled: boolean;
  text: string;
  font: WatermarkFont;
  color: string;
  opacity: number;   // 0–1
  fontSize: number;   // px relative to 1080px-wide canvas
  bgEnabled: boolean;
  bgColor: string;
  /** Data URL of an uploaded transparent PNG logo. When set, the logo is
   *  drawn at the bottom-center above any text. */
  logoDataUrl?: string;
  /** Logo opacity 0..1. Independent from text opacity. */
  logoOpacity: number;
  /** Logo width as a fraction of canvas width (e.g. 0.25 = 25%). */
  logoSizePercent: number;
}

export const WATERMARK_FONTS: { value: WatermarkFont; label: string; css: string; google: string }[] = [
  { value: 'sans', label: 'Montserrat', css: '"Montserrat", sans-serif', google: 'Montserrat:wght@400;600' },
  { value: 'serif', label: 'Playfair', css: '"Playfair Display", serif', google: 'Playfair+Display:wght@400;600' },
  { value: 'script', label: 'Handwritten', css: '"Homemade Apple", cursive', google: 'Homemade+Apple' },
];

let _fontsLoaded = false;
export function loadWatermarkFonts() {
  if (_fontsLoaded) return;
  _fontsLoaded = true;
  const families = WATERMARK_FONTS.map(f => f.google).join('&family=');
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${families}&display=swap`;
  document.head.appendChild(link);
}

export const DEFAULT_WATERMARK: WatermarkConfig = {
  enabled: true,
  text: '',
  font: 'sans',
  color: '#ffffff',
  opacity: 0.5,
  fontSize: 32,
  bgEnabled: false,
  bgColor: '#000000',
  logoDataUrl: undefined,
  logoOpacity: 1,
  logoSizePercent: 0.2,
};

/** Load an image from a data URL or http(s) URL. Returns null on failure. */
export function loadImageFromUrl(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Cache of decoded watermark logos keyed by data URL. Data URLs change only
 *  when the user uploads a new file, so a single decode per upload is enough.
 *  Without this cache, every slider tweak (opacity, size) re-decodes the PNG. */
const watermarkLogoCache = new Map<string, Promise<HTMLImageElement | null>>();
export function cachedLoadLogo(src: string): Promise<HTMLImageElement | null> {
  const existing = watermarkLogoCache.get(src);
  if (existing) return existing;
  const p = loadImageFromUrl(src);
  watermarkLogoCache.set(src, p);
  return p;
}

/** Draw watermark (optional logo above text) at bottom center of a canvas context.
 *  Logo is rendered with its own opacity; text uses wm.opacity. When both are
 *  present the logo stacks above the text with a small gap. */
export function drawWatermark(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  wm: WatermarkConfig,
  scaleFactor: number = 1,
  logoImage: HTMLImageElement | null = null,
) {
  if (!wm.enabled) return;
  const hasText = wm.text.trim().length > 0;
  const hasLogo = !!logoImage;
  if (!hasText && !hasLogo) return;

  const fontDef = WATERMARK_FONTS.find(f => f.value === wm.font) ?? WATERMARK_FONTS[0];
  const fontSize = Math.round(wm.fontSize * scaleFactor);
  const pad = Math.round(8 * scaleFactor);
  const bottomMargin = Math.round(32 * scaleFactor);
  const logoGap = Math.round(12 * scaleFactor);

  ctx.save();

  let cursorY = canvasH - bottomMargin;

  // Text first (drawn with text opacity; baseline = bottom at cursorY)
  if (hasText) {
    ctx.save();
    ctx.globalAlpha = wm.opacity;
    ctx.font = `${fontSize}px ${fontDef.css}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    // Background box behind text
    if (wm.bgEnabled) {
      const metrics = ctx.measureText(wm.text);
      const boxW = metrics.width + pad * 2;
      const boxH = fontSize + pad * 2;
      const boxX = (canvasW - boxW) / 2;
      const boxY = cursorY - fontSize - pad;
      ctx.fillStyle = wm.bgColor;
      ctx.fillRect(Math.round(boxX), Math.round(boxY), Math.round(boxW), Math.round(boxH));
    }
    ctx.fillStyle = wm.color;
    ctx.fillText(wm.text, canvasW / 2, cursorY);
    ctx.restore();
    // Move cursor above the text block (including bg pad) for the logo
    cursorY -= fontSize + (wm.bgEnabled ? pad * 2 : 0) + logoGap;
  }

  // Logo above text (or alone at bottom if no text)
  if (hasLogo) {
    const drawW = Math.max(1, Math.round(canvasW * wm.logoSizePercent));
    const aspect = logoImage.width / logoImage.height;
    const drawH = Math.max(1, Math.round(drawW / aspect));
    const drawX = Math.round((canvasW - drawW) / 2);
    const drawY = Math.round(cursorY - drawH);
    ctx.globalAlpha = wm.logoOpacity;
    ctx.drawImage(logoImage, drawX, drawY, drawW, drawH);
  }

  ctx.restore();
}

/** Stamp watermark onto an existing image blob, return a new blob */
export async function applyWatermarkToBlob(
  blob: Blob, w: number, h: number, wm: WatermarkConfig, format: 'png' | 'jpg',
): Promise<Blob> {
  // Ensure the chosen font is fully loaded before drawing
  const fontDef = WATERMARK_FONTS.find(f => f.value === wm.font) ?? WATERMARK_FONTS[0];
  const fontFamily = fontDef.css.split(',')[0].replace(/"/g, '').trim();
  try { await document.fonts.load(`${wm.fontSize}px "${fontFamily}"`); } catch { /* fallback ok */ }

  // Load logo (if any) before drawing
  const logoImage = wm.logoDataUrl ? await loadImageFromUrl(wm.logoDataUrl) : null;

  const img = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return blob;
  ctx.drawImage(img, 0, 0, w, h);
  drawWatermark(ctx, w, h, wm, w / 1080, logoImage);
  return new Promise(resolve => {
    canvas.toBlob(
      b => resolve(b ?? blob),
      format === 'jpg' ? 'image/jpeg' : 'image/png',
      format === 'jpg' ? 0.92 : undefined,
    );
  });
}
