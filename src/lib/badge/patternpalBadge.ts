export type BadgeVariant = 'navy' | 'gold';

/** Served from /public. Navy = dark mark for light backgrounds; gold = light
 *  mark for dark backgrounds. Both PNGs are the same artwork, so they share
 *  one aspect ratio. */
const BADGE_ASSETS: Record<BadgeVariant, string> = {
  navy: '/tested-in-patternpal-navy.png',
  gold: '/tested-in-patternpal-gold.png',
};

/** Badge width as a fraction of the exported canvas width. Single tuning knob. */
export const BADGE_WIDTH_PERCENT = 0.2;
/** Corner inset (left + bottom) as a fraction of canvas width. */
const BADGE_INSET_PERCENT = 0.04;
/** Perceptual-luminance threshold (0..1). Above this the background is "light". */
const LUMINANCE_THRESHOLD = 0.5;

/** Trial users always get the badge; paid Pro users can opt out via the toggle. */
export function shouldStampBadge(opts: { isPaidPro: boolean; badgeEnabled: boolean }): boolean {
  return opts.isPaidPro ? opts.badgeEnabled : true;
}

/** Light backgrounds get the navy mark, dark backgrounds get the gold mark. */
export function pickBadgeVariant(luminance: number): BadgeVariant {
  return luminance > LUMINANCE_THRESHOLD ? 'navy' : 'gold';
}

/** Left-inset draw rectangle for the badge. Bottom-left by default; `atTop`
 *  flips it to top-left (used when a bottom banner/logo would cover it). */
export function computeBadgeRect(canvasW: number, canvasH: number, badgeAspect: number, atTop = false) {
  const drawW = Math.max(1, Math.round(canvasW * BADGE_WIDTH_PERCENT));
  const drawH = Math.max(1, Math.round(drawW / badgeAspect));
  const inset = Math.round(canvasW * BADGE_INSET_PERCENT);
  const drawX = inset;
  const drawY = atTop ? inset : canvasH - inset - drawH;
  return { drawX, drawY, drawW, drawH };
}

/** Average perceptual luminance (0..1) of a rectangle of a 2D context.
 *  Samples every 4th pixel for speed. Returns 1 (treated as light) if the
 *  region can't be read. */
export function sampleRegionLuminance(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
): number {
  const sx = Math.max(0, Math.floor(x));
  const sy = Math.max(0, Math.floor(y));
  const sw = Math.max(1, Math.floor(w));
  const sh = Math.max(1, Math.floor(h));
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(sx, sy, sw, sh).data;
  } catch {
    return 1;
  }
  let sum = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 16) {
    sum += (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
    count++;
  }
  return count > 0 ? sum / count : 1;
}

/** Load an image from a URL. Resolves null on failure. */
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** One decode per PNG, mirroring the watermark logo cache. */
const badgeCache = new Map<string, Promise<HTMLImageElement | null>>();
function cachedLoadBadge(src: string): Promise<HTMLImageElement | null> {
  const existing = badgeCache.get(src);
  if (existing) return existing;
  const p = loadImage(src);
  badgeCache.set(src, p);
  return p;
}

/** Composite the contrast-appropriate PatternPAL badge into the bottom-left of
 *  an existing image blob and return a new blob. On any asset/context failure
 *  the input blob is returned unchanged so an export never fails over a badge.
 *  Callers gate with shouldStampBadge(); this function always stamps. */
export async function applyBadgeToBlob(
  blob: Blob, w: number, h: number, format: 'png' | 'jpg', atTop = false,
): Promise<Blob> {
  // Navy is loaded first purely to measure the shared aspect ratio.
  const measure = await cachedLoadBadge(BADGE_ASSETS.navy);
  if (!measure) return blob;
  const rect = computeBadgeRect(w, h, measure.width / measure.height, atTop);

  const img = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return blob;
  ctx.drawImage(img, 0, 0, w, h);

  const luminance = sampleRegionLuminance(ctx, rect.drawX, rect.drawY, rect.drawW, rect.drawH);
  const variant = pickBadgeVariant(luminance);
  const badgeImg = variant === 'navy' ? measure : await cachedLoadBadge(BADGE_ASSETS.gold);
  if (!badgeImg) return blob;
  ctx.drawImage(badgeImg, rect.drawX, rect.drawY, rect.drawW, rect.drawH);

  return new Promise(resolve => {
    canvas.toBlob(
      b => resolve(b ?? blob),
      format === 'jpg' ? 'image/jpeg' : 'image/png',
      format === 'jpg' ? 0.92 : undefined,
    );
  });
}
