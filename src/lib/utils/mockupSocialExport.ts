// src/lib/utils/mockupSocialExport.ts
// Clean-mockup → social-size export. Cover-crops the full-res mockup canvas into
// each target social size, then reuses the existing watermark + badge compositors.

import JSZip from 'jszip';
import { downloadBlob, isIOS } from './downloadCanvas';
import { pushIOSSaveTaskMulti } from './iosSaveQueue';
import { applyWatermarkToBlob, type WatermarkConfig } from '../watermark/watermark';
import { applyBadgeToBlob, shouldStampBadge } from '../badge/patternpalBadge';
import { SOCIAL_EXPORT_SCALE, FULL_SIZE_SLUG, type SocialSizePreset, type SizeSlug } from '../export/socialSizes';
import { injectPngDpi } from './dpiMetadata';

export interface CoverCropRect {
  sx: number;
  sy: number;
  sWidth: number;
  sHeight: number;
}

/** Clamp helper for the 0..1 vertical crop offset. */
const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

/** Cover crop: the largest sub-rectangle of the source that has the target's aspect
 *  ratio. `offset` (0..1) places that rectangle vertically when the source is taller
 *  than the target (square/portrait targets): 0 = top, 0.5 = center, 1 = bottom.
 *  It is a no-op when the source is wider than the target (the crop is horizontal). */
export function computeCoverCropRect(
  srcW: number,
  srcH: number,
  targetW: number,
  targetH: number,
  offset = 0.5,
): CoverCropRect {
  const srcAspect = srcW / srcH;
  const targetAspect = targetW / targetH;

  if (srcAspect > targetAspect) {
    // Source is wider than target -> crop left/right. Vertical offset is a no-op here.
    const sWidth = Math.round(srcH * targetAspect);
    return { sx: Math.round((srcW - sWidth) / 2), sy: 0, sWidth, sHeight: srcH };
  }
  // Source is taller than (or equal to) target -> crop top/bottom; offset picks which.
  const sHeight = Math.round(srcW / targetAspect);
  const sy = Math.round((srcH - sHeight) * clamp01(offset));
  return { sx: 0, sy, sWidth: srcW, sHeight };
}

/** Cover-crop the source canvas into a fresh targetW×targetH canvas, returns PNG blob. */
export async function coverCropToBlob(
  source: HTMLCanvasElement,
  targetW: number,
  targetH: number,
  offset = 0.5,
): Promise<Blob> {
  const r = computeCoverCropRect(source.width, source.height, targetW, targetH, offset);
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
  /** Per-size vertical crop offset 0..1 (0.5 = center). Missing slug => 0.5.
   *  Ignored by full size and by sizes whose crop is horizontal. */
  offsets?: Partial<Record<SizeSlug, number>>;
}

/** Produce one social-sized clean-mockup PNG blob: cover-crop -> watermark -> badge. */
export async function exportMockupSocialBlob(
  source: HTMLCanvasElement,
  preset: SocialSizePreset,
  opts: MockupSocialOpts,
): Promise<Blob> {
  const w = preset.pxW * SOCIAL_EXPORT_SCALE;
  const h = preset.pxH * SOCIAL_EXPORT_SCALE;
  const offset = opts.offsets?.[preset.slug] ?? 0.5;
  let blob = await coverCropToBlob(source, w, h, offset);
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
  // Encode every selected size in parallel. Each size is an independent
  // crop→watermark→badge→encode chain off the same source canvas, so there's no
  // ordering dependency; running them serially just stacked their latencies.
  // The selection is small (the few rows the user ticked, not the full grid), so
  // this stays well within iPad's memory headroom. Per-size try/catch keeps one
  // failure from sinking the rest.
  const results = await Promise.all(
    presets.map(async (preset): Promise<{ preset: SocialSizePreset; blob: Blob | null }> => {
      try {
        const blob = preset.slug === FULL_SIZE_SLUG
          ? await exportFullSizeMockupBlob(source, opts)
          : await exportMockupSocialBlob(source, preset, opts);
        return { preset, blob };
      } catch (err) {
        console.error(`[mockupSocialExport] failed for "${preset.slug}":`, err);
        return { preset, blob: null };
      }
    }),
  );
  const ok = results.filter((r): r is { preset: SocialSizePreset; blob: Blob } => r.blob !== null);
  const failed = results.filter(r => r.blob === null).map(r => r.preset);

  if (ok.length === 1) {
    await downloadBlob(ok[0].blob, `${baseName}-${ok[0].preset.slug}.png`, 'image/png');
  } else if (ok.length > 1) {
    // On iOS, share all images as a batch so the native sheet offers "Save N
    // Images" straight to Photos. A zip can only land in Files, never Photos —
    // which is exactly what users hit when downloading several mockup sizes at
    // once. Desktop keeps the zip (one tidy file beats N save dialogs there).
    if (isIOS() && typeof navigator.share === 'function') {
      await pushIOSSaveTaskMulti(
        ok.map(r => ({
          blob: r.blob,
          filename: `${baseName}-${r.preset.slug}.png`,
          mimeType: 'image/png',
        })),
      );
    } else {
      const zip = new JSZip();
      for (const r of ok) zip.file(`${baseName}-${r.preset.slug}.png`, r.blob);
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      await downloadBlob(zipBlob, `${baseName}-mockup-social.zip`, 'application/zip');
    }
  }
  return { failed };
}
