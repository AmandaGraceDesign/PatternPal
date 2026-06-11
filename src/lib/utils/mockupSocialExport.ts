// src/lib/utils/mockupSocialExport.ts
// Clean-mockup → social-size export. Cover-crops the full-res mockup canvas into
// each target social size, then reuses the existing watermark + badge compositors.

import JSZip from 'jszip';
import { downloadBlob } from './downloadCanvas';
import { applyWatermarkToBlob, type WatermarkConfig } from '../watermark/watermark';
import { applyBadgeToBlob, shouldStampBadge } from '../badge/patternpalBadge';
import { SOCIAL_EXPORT_SCALE, FULL_SIZE_SLUG, type SocialSizePreset } from '../export/socialSizes';
import { injectPngDpi } from './dpiMetadata';

export interface CoverCropRect {
  sx: number;
  sy: number;
  sWidth: number;
  sHeight: number;
}

/** Centered "cover" crop: the largest centered sub-rectangle of the source that
 *  has the target's aspect ratio. Draw it onto the full target canvas to fill it
 *  edge-to-edge with no distortion. */
export function computeCoverCropRect(
  srcW: number,
  srcH: number,
  targetW: number,
  targetH: number,
): CoverCropRect {
  const srcAspect = srcW / srcH;
  const targetAspect = targetW / targetH;

  if (srcAspect > targetAspect) {
    // Source is wider than target -> crop left/right.
    const sWidth = Math.round(srcH * targetAspect);
    return { sx: Math.round((srcW - sWidth) / 2), sy: 0, sWidth, sHeight: srcH };
  }
  // Source is taller than (or equal to) target -> crop top/bottom.
  const sHeight = Math.round(srcW / targetAspect);
  return { sx: 0, sy: Math.round((srcH - sHeight) / 2), sWidth: srcW, sHeight };
}

/** Cover-crop the source canvas into a fresh targetW×targetH canvas, returns PNG blob. */
export async function coverCropToBlob(
  source: HTMLCanvasElement,
  targetW: number,
  targetH: number,
): Promise<Blob> {
  const r = computeCoverCropRect(source.width, source.height, targetW, targetH);
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('coverCropToBlob: no 2d context');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, r.sx, r.sy, r.sWidth, r.sHeight, 0, 0, targetW, targetH);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      b => (b ? resolve(b) : reject(new Error('coverCropToBlob: toBlob returned null'))),
      'image/png',
    ),
  );
}

export interface MockupSocialOpts {
  watermark: WatermarkConfig;
  isPro: boolean;
  badgeEnabled: boolean;
}

/** Produce one social-sized clean-mockup PNG blob: cover-crop -> watermark -> badge. */
export async function exportMockupSocialBlob(
  source: HTMLCanvasElement,
  preset: SocialSizePreset,
  opts: MockupSocialOpts,
): Promise<Blob> {
  const w = preset.pxW * SOCIAL_EXPORT_SCALE;
  const h = preset.pxH * SOCIAL_EXPORT_SCALE;
  let blob = await coverCropToBlob(source, w, h);
  const wm = opts.watermark;
  if (wm.enabled && (wm.text.trim() || wm.logoDataUrl)) {
    blob = await applyWatermarkToBlob(blob, w, h, wm, 'png');
  }
  if (shouldStampBadge({ isPaidPro: opts.isPro, badgeEnabled: opts.badgeEnabled })) {
    blob = await applyBadgeToBlob(blob, w, h, 'png');
  }
  return blob;
}

/** Full-DPI output for the full-size mockup download. Matches the prior header-Download. */
const FULL_SIZE_OUTPUT_DPI = 150;

/** Full-size clean mockup: downscale the full render by ½ (3000×4500 → 1500×2250),
 *  composite watermark/badge, inject 150 DPI. NOT cover-cropped — it's the whole shot. */
export async function exportFullSizeMockupBlob(
  source: HTMLCanvasElement,
  opts: MockupSocialOpts,
): Promise<Blob> {
  const w = Math.round(source.width / 2);
  const h = Math.round(source.height / 2);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('exportFullSizeMockupBlob: no 2d context');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, w, h);
  let blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob(
      b => (b ? resolve(b) : reject(new Error('exportFullSizeMockupBlob: toBlob returned null'))),
      'image/png',
    ),
  );
  const wm = opts.watermark;
  if (wm.enabled && (wm.text.trim() || wm.logoDataUrl)) {
    blob = await applyWatermarkToBlob(blob, w, h, wm, 'png');
  }
  if (shouldStampBadge({ isPaidPro: opts.isPro, badgeEnabled: opts.badgeEnabled })) {
    blob = await applyBadgeToBlob(blob, w, h, 'png');
  }
  return injectPngDpi(blob, FULL_SIZE_OUTPUT_DPI);
}

/** Export all selected sizes. One file -> direct download; many -> a single zip.
 *  Mirrors the Social Export modal's download behavior. Returns any sizes that failed. */
export async function downloadMockupSocialSizes(
  source: HTMLCanvasElement,
  presets: SocialSizePreset[],
  opts: MockupSocialOpts,
  baseName: string,
): Promise<{ failed: SocialSizePreset[] }> {
  const results: { preset: SocialSizePreset; blob: Blob | null }[] = [];
  for (const preset of presets) {
    try {
      const blob = preset.slug === FULL_SIZE_SLUG
        ? await exportFullSizeMockupBlob(source, opts)
        : await exportMockupSocialBlob(source, preset, opts);
      results.push({ preset, blob });
    } catch (err) {
      console.error(`[mockupSocialExport] failed for "${preset.slug}":`, err);
      results.push({ preset, blob: null });
    }
  }
  const ok = results.filter((r): r is { preset: SocialSizePreset; blob: Blob } => r.blob !== null);
  const failed = results.filter(r => r.blob === null).map(r => r.preset);

  if (ok.length === 1) {
    await downloadBlob(ok[0].blob, `${baseName}-${ok[0].preset.slug}.png`, 'image/png');
  } else if (ok.length > 1) {
    const zip = new JSZip();
    for (const r of ok) zip.file(`${baseName}-${r.preset.slug}.png`, r.blob);
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    await downloadBlob(zipBlob, `${baseName}-mockup-social.zip`, 'application/zip');
  }
  return { failed };
}
