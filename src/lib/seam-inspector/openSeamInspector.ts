'use client';

interface SeamInspectorParams {
  image: HTMLImageElement;
  repeatType: 'full-drop' | 'half-drop' | 'half-brick';
  dpi: number;
  filename: string | null;
  outlineColor?: string;
}

export function openSeamInspector({
  image,
  repeatType,
  dpi,
  filename,
  outlineColor = '#ec4899',
}: SeamInspectorParams): void {
  // Convert image to data URL — postMessage can handle large payloads
  // (structured cloning, no storage quota limits)
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.drawImage(image, 0, 0);
  const imageDataUrl = canvas.toDataURL('image/png');

  const payload = {
    type: 'init' as const,
    imageUrl: imageDataUrl,
    repeatType,
    dpi,
    filename: filename || 'pattern',
    outlineColor,
  };

  const childTab = window.open('/seam-inspector', '_blank');
  if (!childTab) return;

  let sent = false;

  const handleMessage = (event: MessageEvent) => {
    if (event.origin !== window.location.origin) return;
    if (event.source !== childTab) return;
    if (event.data?.type !== 'ready') return;

    if (!sent) {
      sent = true;
      childTab.postMessage(payload, window.location.origin);
    }

    window.removeEventListener('message', handleMessage);
  };

  window.addEventListener('message', handleMessage);

  // Clean up listener if child tab closes without completing handshake
  const cleanup = setInterval(() => {
    if (childTab.closed) {
      clearInterval(cleanup);
      window.removeEventListener('message', handleMessage);
    }
  }, 1000);
}
