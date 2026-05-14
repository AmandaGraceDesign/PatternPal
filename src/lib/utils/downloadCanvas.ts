function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ reports as MacIntel; distinguish via touch points.
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

function ensureExtension(filename: string, mimeType: string): string {
  const ext = mimeType === 'image/jpeg' ? '.jpg' : '.png';
  return /\.(png|jpg|jpeg)$/i.test(filename) ? filename : `${filename}${ext}`;
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
  const finalFilename = ensureExtension(filename, mimeType);
  const blob = await canvasToBlob(canvas, mimeType, quality);

  if (isIOS() && typeof navigator.share === 'function') {
    try {
      const file = new File([blob], finalFilename, { type: mimeType });
      // Only skip if canShare explicitly rejects files; otherwise try share
      // and fall back on error. This forces the native iOS share sheet
      // (centered) instead of Chrome-on-iOS's bottom download bar.
      const canShareFiles =
        typeof navigator.canShare !== 'function' ||
        navigator.canShare({ files: [file] });
      if (canShareFiles) {
        await navigator.share({ files: [file], title: finalFilename });
        return;
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      // Fall through to anchor-download fallback on any other error.
    }
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
