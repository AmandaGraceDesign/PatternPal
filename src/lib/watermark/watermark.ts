export type WatermarkFont = 'sans' | 'serif' | 'script';
export type WatermarkAnchorH = 'left' | 'center' | 'right';
export type WatermarkAnchorV = 'top' | 'middle' | 'bottom';

export interface WatermarkConfig {
  enabled: boolean;
  text: string;
  font: WatermarkFont;
  color: string;
  opacity: number;   // 0–1
  fontSize: number;   // px relative to 1080px-wide canvas
  bgEnabled: boolean;
  bgColor: string;
  /** Data URL of an uploaded transparent PNG logo. */
  logoDataUrl?: string;
  /** Logo opacity 0..1. Independent from text opacity. */
  logoOpacity: number;
  /** Logo width as a fraction of canvas width (e.g. 0.25 = 25%). */
  logoSizePercent: number;

  // ---- banner overlay (added 2026-07) ----
  /** Which overlay to render. 'logo' = free-floating logo (legacy);
   *  'banner' = full-width band with logo + title/subtitle. */
  mode: 'logo' | 'banner';
  /** Shared placement. In logo mode: the logo's anchor point. In banner mode:
   *  anchorV picks the band edge; anchorH places the logo within the band. */
  anchorH: WatermarkAnchorH;
  anchorV: WatermarkAnchorV;
  /** Banner text (both optional; blank = logo-only band). */
  bannerTitle: string;
  bannerSubtitle: string;
  /** Band fill color + opacity (0..1). */
  bandColor: string;
  bandOpacity: number;
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
  // Black by default: banner text sits on the default WHITE band, so white
  // text would be invisible. Logo mode surfaces no caption text, so this
  // default is only ever visible in banner mode (legacy logo-only output is
  // unaffected — it draws no text).
  color: '#000000',
  opacity: 0.5,
  fontSize: 32,
  bgEnabled: false,
  bgColor: '#000000',
  logoDataUrl: undefined,
  logoOpacity: 1,
  logoSizePercent: 0.2,
  mode: 'logo',
  anchorH: 'center',
  anchorV: 'bottom',
  bannerTitle: '',
  bannerSubtitle: '',
  bandColor: '#ffffff',
  bandOpacity: 0.8,
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

/** Top-left pixel position for a logo of (logoW × logoH) at a 9-point anchor,
 *  inset by `margin` on the outer edges. Pure — unit tested. */
export function computeLogoRect(
  canvasW: number,
  canvasH: number,
  logoW: number,
  logoH: number,
  anchorH: WatermarkAnchorH,
  anchorV: WatermarkAnchorV,
  margin: number,
): { x: number; y: number } {
  let x: number;
  if (anchorH === 'left') x = margin;
  else if (anchorH === 'right') x = canvasW - logoW - margin;
  else x = (canvasW - logoW) / 2;
  let y: number;
  if (anchorV === 'top') y = margin;
  else if (anchorV === 'middle') y = (canvasH - logoH) / 2;
  else y = canvasH - logoH - margin;
  return { x: Math.round(x), y: Math.round(y) };
}

/** Band height = taller of (logo, stacked text) + vertical padding. */
export function computeBannerBandHeight(
  logoH: number,
  titleSize: number,
  subtitleSize: number,
  hasTitle: boolean,
  hasSubtitle: boolean,
  padding: number,
  lineGap: number,
): number {
  const textH =
    (hasTitle ? titleSize : 0) +
    (hasSubtitle ? subtitleSize : 0) +
    (hasTitle && hasSubtitle ? lineGap : 0);
  return Math.round(Math.max(logoH, textH) + padding * 2);
}

/** Full-width band rect positioned at the chosen vertical edge. */
export function computeBannerBandRect(
  canvasW: number,
  canvasH: number,
  anchorV: WatermarkAnchorV,
  bandHeight: number,
): { x: number; y: number; width: number; height: number } {
  let y: number;
  if (anchorV === 'top') y = 0;
  else if (anchorV === 'middle') y = Math.round((canvasH - bandHeight) / 2);
  else y = canvasH - bandHeight;
  return { x: 0, y, width: canvasW, height: bandHeight };
}

/** Position the logo (vertically centered in the band) and the text block.
 *  center anchor → logo centered, no text. left/right → logo on that side,
 *  text on the opposite side, aligned toward the logo. */
export function computeBannerContentLayout(
  band: { x: number; y: number; width: number; height: number },
  anchorH: WatermarkAnchorH,
  logoW: number,
  logoH: number,
  showText: boolean,
  padding: number,
  gap: number,
): { logo: { x: number; y: number }; text: { x: number; align: 'left' | 'right'; centerY: number } | null } {
  const logoY = Math.round(band.y + (band.height - logoH) / 2);
  const centerY = Math.round(band.y + band.height / 2);
  if (anchorH === 'center') {
    const logoX = Math.round(band.x + (band.width - logoW) / 2);
    return { logo: { x: logoX, y: logoY }, text: null };
  }
  if (anchorH === 'left') {
    const logoX = band.x + padding;
    return { logo: { x: logoX, y: logoY }, text: showText ? { x: logoX + logoW + gap, align: 'left', centerY } : null };
  }
  const logoX = band.x + band.width - padding - logoW;
  return { logo: { x: logoX, y: logoY }, text: showText ? { x: logoX - gap, align: 'right', centerY } : null };
}

/** Whether the watermark has any renderable content (ignores `enabled`).
 *  Banner mode counts title/subtitle; logo mode counts the legacy caption. */
export function watermarkHasContent(wm: WatermarkConfig): boolean {
  if (wm.mode === 'banner') {
    return !!wm.logoDataUrl || wm.bannerTitle.trim().length > 0 || wm.bannerSubtitle.trim().length > 0;
  }
  return !!wm.logoDataUrl || wm.text.trim().length > 0;
}

/** True when the watermark would sit under a bottom-LEFT PatternPAL badge — a
 *  full-width bottom banner, or a bottom-left/center logo. Callers move the
 *  badge to the top in that case so it never covers the user's mark. */
export function badgeCollidesAtBottomLeft(wm: WatermarkConfig): boolean {
  if (!wm.enabled || !watermarkHasContent(wm)) return false;
  if (wm.anchorV !== 'bottom') return false;
  if (wm.mode === 'banner') return true;        // full-width bottom band
  return wm.anchorH !== 'right';                 // bottom-left or bottom-center logo
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
  if (wm.mode === 'banner') {
    drawBannerWatermark(ctx, canvasW, canvasH, wm, scaleFactor, logoImage);
    return;
  }
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

  // Logo — anchored by anchorH/anchorV. The default center+bottom preserves
  // the legacy "stack above caption text" behavior; other anchors use the
  // 9-point helper.
  if (hasLogo) {
    const drawW = Math.max(1, Math.round(canvasW * wm.logoSizePercent));
    const aspect = logoImage.width / logoImage.height;
    const drawH = Math.max(1, Math.round(drawW / aspect));
    let drawX: number;
    let drawY: number;
    if (wm.anchorH === 'center' && wm.anchorV === 'bottom') {
      drawX = Math.round((canvasW - drawW) / 2);
      drawY = Math.round(cursorY - drawH);
    } else {
      const r = computeLogoRect(canvasW, canvasH, drawW, drawH, wm.anchorH, wm.anchorV, bottomMargin);
      drawX = r.x;
      drawY = r.y;
    }
    ctx.globalAlpha = wm.logoOpacity;
    ctx.drawImage(logoImage, drawX, drawY, drawW, drawH);
  }

  ctx.restore();
}

/** Render the banner overlay: a full-width band at the chosen edge, with the
 *  logo on its anchorH side and an optional bold title + lighter subtitle. */
export function drawBannerWatermark(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  wm: WatermarkConfig,
  scaleFactor: number,
  logoImage: HTMLImageElement | null,
): void {
  const hasTitle = wm.bannerTitle.trim().length > 0;
  const hasSubtitle = wm.bannerSubtitle.trim().length > 0;
  const hasLogo = !!logoImage;
  // Centre anchor is a logo-only band (no text).
  const showText = wm.anchorH !== 'center' && (hasTitle || hasSubtitle);
  if (!hasLogo && !showText) return;

  const fontDef = WATERMARK_FONTS.find(f => f.value === wm.font) ?? WATERMARK_FONTS[0];
  const titleSize = Math.round(wm.fontSize * scaleFactor);
  const subtitleSize = Math.round(wm.fontSize * 0.7 * scaleFactor);
  const padding = Math.round(16 * scaleFactor);
  const gap = Math.round(16 * scaleFactor);
  const lineGap = Math.round(4 * scaleFactor);

  let logoW = 0;
  let logoH = 0;
  if (hasLogo && logoImage) {
    logoW = Math.max(1, Math.round(canvasW * wm.logoSizePercent));
    const aspect = logoImage.width / logoImage.height;
    logoH = Math.max(1, Math.round(logoW / aspect));
  }

  const bandHeight = computeBannerBandHeight(
    logoH, titleSize, subtitleSize,
    showText && hasTitle, showText && hasSubtitle,
    padding, lineGap,
  );
  const band = computeBannerBandRect(canvasW, canvasH, wm.anchorV, bandHeight);

  ctx.save();

  // Band fill (semi-transparent so the pattern shows through).
  ctx.globalAlpha = wm.bandOpacity;
  ctx.fillStyle = wm.bandColor;
  ctx.fillRect(band.x, band.y, band.width, band.height);
  ctx.globalAlpha = 1;

  const layout = computeBannerContentLayout(band, wm.anchorH, logoW, logoH, showText, padding, gap);

  if (hasLogo && logoImage) {
    ctx.globalAlpha = wm.logoOpacity;
    ctx.drawImage(logoImage, layout.logo.x, layout.logo.y, logoW, logoH);
    ctx.globalAlpha = 1;
  }

  if (showText && layout.text) {
    ctx.fillStyle = wm.color;
    ctx.textAlign = layout.text.align;
    ctx.textBaseline = 'middle';
    const cy = layout.text.centerY;
    if (hasTitle && hasSubtitle) {
      ctx.font = `600 ${titleSize}px ${fontDef.css}`;
      ctx.fillText(wm.bannerTitle, layout.text.x, cy - Math.round(subtitleSize / 2 + lineGap / 2));
      ctx.font = `400 ${subtitleSize}px ${fontDef.css}`;
      ctx.fillText(wm.bannerSubtitle, layout.text.x, cy + Math.round(titleSize / 2 + lineGap / 2));
    } else if (hasTitle) {
      ctx.font = `600 ${titleSize}px ${fontDef.css}`;
      ctx.fillText(wm.bannerTitle, layout.text.x, cy);
    } else {
      ctx.font = `400 ${subtitleSize}px ${fontDef.css}`;
      ctx.fillText(wm.bannerSubtitle, layout.text.x, cy);
    }
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
