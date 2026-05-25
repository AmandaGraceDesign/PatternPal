import { pushIOSSaveTask } from './iosSaveQueue';

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ reports as MacIntel; distinguish via touch points.
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

function ensureExtension(filename: string, mimeType: string): string {
  // Leave any pre-existing extension intact (image, zip, tiff, etc).
  if (/\.[a-z0-9]{2,5}$/i.test(filename)) return filename;
  const ext =
    mimeType === 'image/jpeg' ? '.jpg' :
    mimeType === 'image/tiff' ? '.tif' :
    mimeType === 'application/zip' ? '.zip' :
    '.png';
  return `${filename}${ext}`;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('canvas.toBlob returned null'))),
      mimeType,
      quality
    );
  });
}

/**
 * Downloads a canvas as an image. On iOS (including Chrome on iOS, which
 * silently drops <a download> + data-URL clicks), uses the Web Share API
 * so users can save to Photos or Files via the native share sheet.
 */
export async function downloadCanvasAsImage(
  canvas: HTMLCanvasElement,
  filename: string,
  mimeType: string = 'image/png',
  quality: number = 1.0
): Promise<void> {
  const blob = await canvasToBlob(canvas, mimeType, quality);
  return downloadBlob(blob, filename, mimeType);
}

/**
 * Like downloadCanvasAsImage but accepts an already-produced Blob. Use when
 * the canvas output has been post-processed (e.g. watermark stamped) and
 * needs to keep the same iOS-aware download UX.
 */
export async function downloadBlobAsImage(
  blob: Blob,
  filename: string,
  mimeType: string = 'image/png',
): Promise<void> {
  return downloadBlob(blob, filename, mimeType);
}

/**
 * Generic blob download with iOS share-sheet fallback. Works for images, ZIPs,
 * TIFFs, etc. On iOS Safari/Chrome <a download> is unreliable, so when the
 * Web Share API can accept files we use the native share sheet (saves to
 * Photos for images, Files for ZIPs). Other platforms get the anchor click.
 */
export async function downloadBlob(
  blob: Blob,
  filename: string,
  mimeType: string,
): Promise<void> {
  const finalFilename = ensureExtension(filename, mimeType);

  // iOS Safari requires navigator.share to be called synchronously inside a
  // user gesture. Since exports await heavy async work before reaching this
  // point, the gesture is expired by now — calling share here silently fails
  // and falls through. Instead, hand the blob to the global IOSSaveSheet, which
  // renders a "Save" button whose click fires share inside a fresh gesture.
  if (isIOS() && typeof navigator.share === 'function') {
    await pushIOSSaveTask(blob, finalFilename, mimeType);
    return;
  }

  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = finalFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
