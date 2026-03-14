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
  // Convert image to data URL so the child tab owns the data
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.drawImage(image, 0, 0);
  const imageDataUrl = canvas.toDataURL('image/png');

  const inspectorWindow = window.open('/seam-inspector', '_blank');
  if (!inspectorWindow) return;

  const handleMessage = (event: MessageEvent) => {
    if (event.origin !== window.location.origin) return;
    if (event.data?.type === 'ready') {
      inspectorWindow.postMessage(
        {
          type: 'init',
          imageUrl: imageDataUrl,
          repeatType,
          dpi,
          filename: filename || 'pattern',
          outlineColor,
        },
        window.location.origin
      );
      window.removeEventListener('message', handleMessage);
    }
  };

  window.addEventListener('message', handleMessage);

  // Clean up listener if window closes before ready
  const checkClosed = setInterval(() => {
    if (inspectorWindow.closed) {
      clearInterval(checkClosed);
      window.removeEventListener('message', handleMessage);
    }
  }, 1000);
}
