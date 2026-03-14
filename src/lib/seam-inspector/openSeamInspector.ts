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

  // Store data in sessionStorage — the new tab opened via window.open()
  // receives a copy of the opener's sessionStorage
  const payload = JSON.stringify({
    imageUrl: imageDataUrl,
    repeatType,
    dpi,
    filename: filename || 'pattern',
    outlineColor,
  });

  try {
    sessionStorage.setItem('__seam_inspector_data', payload);
  } catch {
    // sessionStorage full — fall back to localStorage with cleanup
    localStorage.setItem('__seam_inspector_data', payload);
  }

  window.open('/seam-inspector', '_blank');
}
