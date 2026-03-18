'use client';

import { useState, useEffect, useMemo, useRef, useCallback, MutableRefObject } from 'react';
import {
  calculateRepeatFillDimensions,
  generateRepeatFillExport,
  generateSocialFillBlob,
  RepeatFillCalcResult,
  SOCIAL_DPI,
  SocialFillBlobConfig,
} from '@/lib/utils/repeatFillExport';
import { convertToFullDrop } from '@/lib/utils/convertToFullDrop';
import { sanitizeFilename } from '@/lib/utils/sanitizeFilename';
import JSZip from 'jszip';

interface RepeatExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  image: HTMLImageElement | null;
  currentDPI: number;
  tileWidth: number;   // inches (effective/scaled from canvas)
  tileHeight: number;  // inches (effective/scaled from canvas)
  repeatType: 'full-drop' | 'half-drop' | 'half-brick';
  originalFilename: string | null;
}

interface SizePreset {
  label: string;
  w: number;
  h: number;
}

const SIZE_PRESETS: SizePreset[] = [
  { label: '12\u00d712"', w: 12, h: 12 },
];

const PREVIEW_WIDTH = 250;
const MIN_SCALE = 0.02;
const MAX_SCALE = 1.0;

type SizeSlug =
  | 'instagram-post'
  | 'instagram-portrait'
  | 'story'
  | 'pinterest-pin'
  | 'facebook-cover';

interface SocialSizePreset {
  slug: SizeSlug;
  label: string;
  pxW: number;
  pxH: number;
}

const SOCIAL_SIZE_PRESETS: SocialSizePreset[] = [
  { slug: 'instagram-post',      label: 'Instagram / Facebook Post',     pxW: 1080, pxH: 1080 },
  { slug: 'instagram-portrait',  label: 'Instagram / Facebook Portrait',  pxW: 1080, pxH: 1350 },
  { slug: 'story',               label: 'Story / Reel / TikTok',          pxW: 1080, pxH: 1920 },
  { slug: 'pinterest-pin',       label: 'Pinterest Pin',                  pxW: 1000, pxH: 1500 },
  { slug: 'facebook-cover',      label: 'Facebook Cover',                 pxW: 1640, pxH: 624  },
];

const SOCIAL_PREVIEW_MAX_PX = 240; // max dimension for per-size preview thumbnail

type ModalMode = 'picker' | 'cricut' | 'social';
type SocialStep = 'select' | 'preview';

/** Preview canvas dimensions: max 90px on longest side, exact aspect ratio */
function socialPreviewDims(pxW: number, pxH: number): { w: number; h: number } {
  const aspect = pxW / pxH;
  if (pxW >= pxH) {
    return { w: SOCIAL_PREVIEW_MAX_PX, h: Math.round(SOCIAL_PREVIEW_MAX_PX / aspect) };
  } else {
    return { w: Math.round(SOCIAL_PREVIEW_MAX_PX * aspect), h: SOCIAL_PREVIEW_MAX_PX };
  }
}

/** Scale that produces exactly targetRepeatsX repeats at 96 DPI */
function socialScaleForRepeatsX(
  targetPxW: number,
  tileWidthInches: number,
  widthMultiplier: number,
  targetRepeatsX: number
): number {
  return targetPxW / (tileWidthInches * SOCIAL_DPI * widthMultiplier * targetRepeatsX);
}

interface SocialSizeRowProps {
  preset: SocialSizePreset;
  isChecked: boolean;
  onToggle: () => void;
  isExporting: boolean;
}

function SocialSizeRow({ preset, isChecked, onToggle, isExporting }: SocialSizeRowProps) {
  return (
    <div className={`border rounded-md overflow-hidden transition-colors ${
      isChecked ? 'border-[#e0c26e] bg-[#faf3e0]' : 'border-[#e5e7eb] bg-white'
    }`}>
      <label className="flex items-center justify-between px-3 py-2.5 cursor-pointer">
        <div className="flex items-center gap-2.5">
          <input
            type="checkbox"
            checked={isChecked}
            onChange={onToggle}
            disabled={isExporting}
            style={{ accentColor: '#e0c26e', width: 14, height: 14 }}
          />
          <span className={`text-xs ${isChecked ? 'font-semibold text-[#294051]' : 'text-[#374151]'}`}>
            {preset.label}
          </span>
        </div>
        <span className="text-[10px] text-[#9ca3af]">{preset.pxW}×{preset.pxH}</span>
      </label>
    </div>
  );
}

interface SocialPreviewSlideProps {
  preset: SocialSizePreset;
  image: HTMLImageElement;
  tileWidth: number;
  tileHeight: number;
  repeatType: 'full-drop' | 'half-drop' | 'half-brick';
  originalFilename: string | null;
  socialFormat: 'png' | 'jpg';
  scalesRef: MutableRefObject<Record<SizeSlug, number>>;
  isExporting: boolean;
}

function SocialPreviewSlide({
  preset, image, tileWidth, tileHeight, repeatType,
  originalFilename, socialFormat, scalesRef, isExporting,
}: SocialPreviewSlideProps) {
  const [, forceUpdate] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const scale = scalesRef.current[preset.slug] ?? 1.0;
  const wMult = getWidthMultiplier(repeatType);
  const tilePixelW = tileWidth * scale * SOCIAL_DPI * wMult;
  const tileAspect = (tileWidth * wMult) / tileHeight;
  const tilePixelH = tilePixelW / tileAspect;
  const repeatsX = Math.max(1, Math.round(preset.pxW / tilePixelW));
  const repeatsY = Math.max(1, Math.round(preset.pxH / tilePixelH));

  const canScaleUp = repeatsX > 1;
  const canScaleDown = socialScaleForRepeatsX(preset.pxW, tileWidth, wMult, repeatsX + 1) >= MIN_SCALE;

  const handleScaleDown = () => {
    const newScale = socialScaleForRepeatsX(preset.pxW, tileWidth, wMult, repeatsX + 1);
    if (newScale >= MIN_SCALE) {
      scalesRef.current[preset.slug] = newScale;
      forceUpdate(n => n + 1);
    }
  };

  const handleScaleUp = () => {
    if (repeatsX <= 1) return;
    const newScale = socialScaleForRepeatsX(preset.pxW, tileWidth, wMult, repeatsX - 1);
    if (newScale <= MAX_SCALE) {
      scalesRef.current[preset.slug] = Math.min(newScale, MAX_SCALE);
      forceUpdate(n => n + 1);
    }
  };

  const { w: previewW, h: previewH } = socialPreviewDims(preset.pxW, preset.pxH);

  useEffect(() => {
    if (!canvasRef.current || !image) return;
    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = previewW * dpr;
    canvas.height = previewH * dpr;
    canvas.style.width = `${previewW}px`;
    canvas.style.height = `${previewH}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, previewW, previewH);
    const mapped = mapRepeatType(repeatType);
    const tileSource: HTMLCanvasElement | HTMLImageElement =
      mapped === 'fulldrop' ? image : convertToFullDrop(image, mapped);
    const tilePW = previewW / repeatsX;
    const tilePH = previewH / repeatsY;
    for (let x = 0; x < repeatsX; x++) {
      for (let y = 0; y < repeatsY; y++) {
        ctx.drawImage(tileSource, Math.floor(x * tilePW), Math.floor(y * tilePH), Math.ceil(tilePW) + 1, Math.ceil(tilePH) + 1);
      }
    }
  }, [image, repeatType, repeatsX, repeatsY, previewW, previewH]);

  const scaledTileW = tileWidth * scale;
  const scaledTileH = tileHeight * scale;
  const baseName = sanitizeFilename(originalFilename || 'pattern', 'pattern');
  const fileName = `${baseName}-${preset.slug}.${socialFormat}`;

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Big preview canvas */}
      <canvas
        ref={canvasRef}
        className="border border-[#e5e7eb] rounded-md shadow-sm bg-white"
      />

      {/* Scale controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleScaleDown}
          disabled={isExporting || !canScaleDown}
          className="w-8 h-8 flex items-center justify-center rounded-md border border-[#e5e7eb] bg-white text-[#374151] text-base font-bold hover:bg-[#f5f5f5] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Smaller tiles, more repeats"
        >−</button>
        <span className="text-xs text-[#555] min-w-[80px] text-center">
          {scaledTileW.toFixed(2)}&quot; × {scaledTileH.toFixed(2)}&quot;
        </span>
        <button
          onClick={handleScaleUp}
          disabled={isExporting || !canScaleUp}
          className="w-8 h-8 flex items-center justify-center rounded-md border border-[#e5e7eb] bg-white text-[#374151] text-base font-bold hover:bg-[#f5f5f5] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Larger tiles, fewer repeats"
        >+</button>
      </div>

      {/* Info */}
      <div className="text-center space-y-1">
        <div className="text-xs text-[#555]">
          <span className="font-semibold text-[#294051]">{repeatsX} × {repeatsY}</span> repeats
        </div>
        <div className="text-[11px] text-[#9ca3af]">{preset.pxW} × {preset.pxH} px</div>
        <div className="text-[11px] text-[#9ca3af]">{fileName}</div>
      </div>
    </div>
  );
}

function mapRepeatType(
  repeatType: 'full-drop' | 'half-drop' | 'half-brick'
): string {
  switch (repeatType) {
    case 'full-drop':
      return 'fulldrop';
    case 'half-drop':
      return 'halfdrop';
    case 'half-brick':
      return 'halfbrick';
  }
}

/**
 * Get the converted tile width multiplier for the repeat type.
 * Half-drop doubles the width; half-brick keeps it the same.
 */
function getWidthMultiplier(repeatType: 'full-drop' | 'half-drop' | 'half-brick'): number {
  return repeatType === 'half-drop' ? 2 : 1;
}

/**
 * Compute the export scale that produces exactly `targetRepeatsX` repeats across.
 * convertedW = tileWidth * exportScale * widthMultiplier
 * repeatsX = round(targetW / convertedW)
 * For exactly N: exportScale = targetW / (tileWidth * widthMultiplier * N)
 */
function scaleForRepeatsX(
  targetW: number,
  tileWidth: number,
  widthMultiplier: number,
  targetRepeatsX: number
): number {
  return targetW / (tileWidth * widthMultiplier * targetRepeatsX);
}

export default function RepeatExportModal({
  isOpen,
  onClose,
  image,
  currentDPI,
  tileWidth,
  tileHeight,
  repeatType,
  originalFilename,
}: RepeatExportModalProps) {
  const [targetW, setTargetW] = useState(12);
  const [targetH, setTargetH] = useState(12);
  const [selectedDPI, setSelectedDPI] = useState<150 | 300>(300);
  const [format, setFormat] = useState<'png' | 'jpg'>('png');
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customW, setCustomW] = useState('');
  const [customH, setCustomH] = useState('');
  const [useCustom, setUseCustom] = useState(false);

  // Local export scale factor (isolated from main canvas)
  const [exportScale, setExportScale] = useState(1.0);

  const [mode, setMode] = useState<ModalMode>('picker');
  const [socialFormat, setSocialFormat] = useState<'png' | 'jpg'>('jpg');
  const [checkedSizes, setCheckedSizes] = useState<Set<SizeSlug>>(new Set());
  const [socialStep, setSocialStep] = useState<SocialStep>('select');
  const [previewIndex, setPreviewIndex] = useState(0);
  const scalesRef = useRef<Record<SizeSlug, number>>({} as Record<SizeSlug, number>);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  // Sync Select All checkbox indeterminate state (can't be done declaratively in JSX)
  useEffect(() => {
    if (!selectAllRef.current) return;
    const count = checkedSizes.size;
    if (count === 0) {
      selectAllRef.current.checked = false;
      selectAllRef.current.indeterminate = false;
    } else if (count === SOCIAL_SIZE_PRESETS.length) {
      selectAllRef.current.checked = true;
      selectAllRef.current.indeterminate = false;
    } else {
      selectAllRef.current.checked = false;
      selectAllRef.current.indeterminate = true;
    }
  }, [checkedSizes]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setIsExporting(false);
      setExportScale(1.0);
      setMode('picker');
      setSocialFormat('jpg');
      setCheckedSizes(new Set());
      scalesRef.current = {} as Record<SizeSlug, number>;
      setSocialStep('select');
      setPreviewIndex(0);
    }
  }, [isOpen]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isExporting) onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, isExporting]);

  // Effective tile dimensions with local export scale applied
  const scaledTileW = tileWidth * exportScale;
  const scaledTileH = tileHeight * exportScale;

  // Width multiplier for converted tile
  const wMult = getWidthMultiplier(repeatType);

  // Calculate dimensions live
  const calc: RepeatFillCalcResult | null = useMemo(() => {
    if (!image) return null;
    return calculateRepeatFillDimensions(
      image,
      repeatType,
      targetW,
      targetH,
      selectedDPI,
      scaledTileW,
      scaledTileH
    );
  }, [image, repeatType, targetW, targetH, selectedDPI, scaledTileW, scaledTileH]);

  // Scale step handlers: jump to next repeatsX that actually changes the output
  const handleScaleDown = useCallback(() => {
    if (!calc) return;
    const newRepeatsX = calc.repeatsX + 1;
    const newScale = scaleForRepeatsX(targetW, tileWidth, wMult, newRepeatsX);
    if (newScale >= MIN_SCALE) {
      setExportScale(newScale);
    }
  }, [calc, targetW, tileWidth, wMult]);

  const handleScaleUp = useCallback(() => {
    if (!calc || calc.repeatsX <= 1) return;
    const newRepeatsX = calc.repeatsX - 1;
    const newScale = scaleForRepeatsX(targetW, tileWidth, wMult, newRepeatsX);
    if (newScale <= MAX_SCALE) {
      setExportScale(Math.min(newScale, MAX_SCALE));
    }
  }, [calc, targetW, tileWidth, wMult]);

  // Can we go bigger / smaller?
  const canScaleUp = calc ? calc.repeatsX > 1 : false;
  const canScaleDown = calc
    ? scaleForRepeatsX(targetW, tileWidth, wMult, calc.repeatsX + 1) >= MIN_SCALE
    : false;

  // Draw live preview canvas
  const drawPreview = useCallback(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !image || !calc) return;

    const mapped = mapRepeatType(repeatType);
    const tileSource: HTMLCanvasElement | HTMLImageElement =
      mapped === 'fulldrop' ? image : convertToFullDrop(image, mapped);

    const aspect = calc.outputPxW / calc.outputPxH;
    const dpr = window.devicePixelRatio || 1;
    const pW = PREVIEW_WIDTH;
    const pH = Math.round(pW / aspect);

    canvas.width = pW * dpr;
    canvas.height = pH * dpr;
    canvas.style.height = `${pH}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, pW, pH);

    const tileW = pW / calc.repeatsX;
    const tileH = pH / calc.repeatsY;

    // Draw tiles at integer pixel boundaries with +1px overlap to prevent
    // sub-pixel anti-aliasing gaps (white lines) between tiles.
    for (let x = 0; x < calc.repeatsX; x++) {
      for (let y = 0; y < calc.repeatsY; y++) {
        const dx = Math.floor(x * tileW);
        const dy = Math.floor(y * tileH);
        const dw = Math.ceil(tileW) + 1;
        const dh = Math.ceil(tileH) + 1;
        ctx.drawImage(tileSource, dx, dy, dw, dh);
      }
    }
  }, [image, calc, repeatType]);

  useEffect(() => {
    drawPreview();
  }, [drawPreview]);

  const handlePresetClick = (preset: SizePreset) => {
    setTargetW(preset.w);
    setTargetH(preset.h);
    setUseCustom(false);
    setCustomW('');
    setCustomH('');
  };

  const handleApplyCustom = () => {
    const w = parseFloat(customW);
    const h = parseFloat(customH);
    if (w > 0 && h > 0) {
      setTargetW(w);
      setTargetH(h);
      setUseCustom(true);
    }
  };

  const isPresetActive = (p: SizePreset) =>
    !useCustom && targetW === p.w && targetH === p.h;

  const handleExport = async () => {
    if (!image) return;

    setIsExporting(true);
    setError(null);

    try {
      await generateRepeatFillExport({
        image,
        repeatType,
        targetWidthInches: targetW,
        targetHeightInches: targetH,
        dpi: selectedDPI,
        format,
        tileWidthInches: scaledTileW,
        tileHeightInches: scaledTileH,
        originalFilename,
      });

      setTimeout(() => {
        onClose();
        setIsExporting(false);
      }, 500);
    } catch (err) {
      console.error('Pattern Fill Export error:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to generate export. Try a smaller size or lower DPI.'
      );
      setIsExporting(false);
    }
  };

  const handleSelectAll = () => {
    if (checkedSizes.size === SOCIAL_SIZE_PRESETS.length) {
      setCheckedSizes(new Set());
    } else {
      const all = new Set<SizeSlug>(SOCIAL_SIZE_PRESETS.map(p => p.slug));
      // Initialize scale for any newly checked sizes
      all.forEach(slug => {
        if (!(slug in scalesRef.current)) {
          scalesRef.current[slug] = 1.0;
        }
      });
      setCheckedSizes(all);
    }
  };

  const handleToggleSize = (slug: SizeSlug) => {
    setCheckedSizes(prev => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
        if (!(slug in scalesRef.current)) {
          scalesRef.current[slug] = 1.0;
        }
      }
      return next;
    });
  };

  const handleSocialExport = async () => {
    if (!image || checkedSizes.size === 0) return;
    setIsExporting(true);
    setError(null);

    try {
      // Single pro gate before any rendering
      const res = await fetch('/api/pro/verify', { method: 'POST' });
      if (!res.ok) throw new Error('Pro subscription required.');

      const slugsToExport = SOCIAL_SIZE_PRESETS.filter(p => checkedSizes.has(p.slug));
      const results: { slug: SizeSlug; label: string; blob: Blob | null }[] = [];

      for (const preset of slugsToExport) {
        const scale = scalesRef.current[preset.slug] ?? 1.0;
        try {
          const blob = await generateSocialFillBlob({
            image,
            repeatType,
            targetPxW: preset.pxW,
            targetPxH: preset.pxH,
            format: socialFormat,
            tileWidthInches: tileWidth,
            tileHeightInches: tileHeight,
            exportScale: scale,
          });
          results.push({ slug: preset.slug, label: preset.label, blob });
        } catch {
          results.push({ slug: preset.slug, label: preset.label, blob: null });
        }
      }

      const successful = results.filter((r): r is { slug: SizeSlug; label: string; blob: Blob } => r.blob !== null);
      const failed = results.filter(r => r.blob === null);
      const baseName = sanitizeFilename(originalFilename || 'pattern', 'pattern');
      const ext = socialFormat;

      if (successful.length === 0) {
        throw new Error('All exports failed. Try a smaller scale or different format.');
      }

      if (successful.length === 1) {
        // Single file — direct download
        const { slug, blob } = successful[0];
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${baseName}-${slug}.${ext}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        // Multiple files — zip
        const zip = new JSZip();
        for (const { slug, blob } of successful) {
          zip.file(`${baseName}-${slug}.${ext}`, blob);
        }
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${baseName}-social-media.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }

      // Warn about partial failures
      if (failed.length > 0) {
        setError(`Could not export: ${failed.map(f => f.label).join(', ')}. Others downloaded successfully.`);
        setIsExporting(false);
      } else {
        setTimeout(() => {
          onClose();
          setIsExporting(false);
        }, 500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed. Please try again.');
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  const repeatLabel =
    repeatType === 'half-drop'
      ? 'Half-Drop'
      : repeatType === 'half-brick'
      ? 'Half-Brick'
      : 'Full-Drop';

  // Effective DPI of the source image at current scaled tile size
  const effectiveDPI = image ? Math.round(image.naturalWidth / scaledTileW) : currentDPI;

  // Check if output height differs from requested target
  const heightAdjusted = calc
    ? Math.abs(calc.outputHeightInches - targetH) > 0.05
    : false;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={!isExporting ? onClose : undefined}
    >
      <div
        className="relative max-w-2xl w-full max-h-[90vh] bg-white rounded-lg shadow-2xl overflow-hidden border border-[#92afa5]/30"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#92afa5]/30 flex items-center justify-between bg-[#e0c26e]">
          <div className="flex items-center gap-3">
            {mode !== 'picker' && (
              <button
                onClick={() => {
                  if (mode === 'social' && socialStep === 'preview') {
                    setSocialStep('select');
                  } else {
                    setMode('picker');
                  }
                }}
                className="text-white/80 hover:text-white text-xs transition-colors"
                disabled={isExporting}
              >
                ← Back
              </button>
            )}
            <h3 className="text-sm font-semibold text-white">
              {mode === 'picker' ? 'Pattern Fill Export' :
               mode === 'cricut' ? 'Cricut / Silhouette Export' :
               'Social Media Export'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#705046] hover:text-[#294051] transition-all duration-200"
            aria-label="Close"
            disabled={isExporting}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Destination picker */}
        {mode === 'picker' && (
          <div className="p-6 space-y-4">
            <p className="text-sm text-center text-[#6b7280]">What are you exporting for?</p>
            <div className="space-y-3">
              <button
                onClick={() => setMode('cricut')}
                className="w-full text-left px-4 py-4 border-2 border-[#e0c26e] rounded-lg bg-[#faf3e0] hover:bg-[#f5ecd0] transition-colors"
              >
                <div className="text-sm font-semibold text-[#294051]">🖨 Cricut / Silhouette</div>
                <div className="text-xs text-[#9ca3af] mt-1">Digital paper · print files · Etsy / Creative Fabrica</div>
              </button>
              <button
                onClick={() => setMode('social')}
                className="w-full text-left px-4 py-4 border-2 border-[#e5e7eb] rounded-lg bg-white hover:bg-[#f9fafb] transition-colors"
              >
                <div className="text-sm font-semibold text-[#294051]">📱 Social Media</div>
                <div className="text-xs text-[#9ca3af] mt-1">Instagram · Pinterest · TikTok · Facebook</div>
              </button>
            </div>
          </div>
        )}

        {/* Cricut */}
        {mode === 'cricut' && (
          <div className="p-6 overflow-auto max-h-[calc(90vh-120px)]">
            {!image ? (
              <div className="text-center py-8">
                <p className="text-sm text-[#6b7280]">
                  No pattern loaded. Please upload a pattern first.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Info Banner */}
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-xs text-blue-800 leading-relaxed">
                    <span className="font-semibold">Digital Paper Export</span> —
                    Creates a ready-to-use pattern fill image for Cricut Design
                    Space and Silhouette Studio. This bakes multiple repeats of
                    your tile into one flat image, which eliminates the white
                    grid line bug in Silhouette. 12&times;12&quot; at 300 DPI is
                    the standard for selling digital papers on Etsy and Creative
                    Fabrica.
                  </p>
                </div>
  
                {/* Current Tile Info */}
                <div className="p-4 bg-[#f5f5f5] rounded-md border border-[#e5e7eb]">
                  <h4 className="text-xs font-semibold text-[#294051] mb-2 uppercase tracking-wide">
                    Current Tile
                  </h4>
                  <div className="text-sm text-[#374151] space-y-1">
                    <p>
                      Size: {tileWidth.toFixed(2)}&quot; &times; {tileHeight.toFixed(2)}&quot; ({Math.round(image.naturalWidth / tileWidth)} DPI)
                    </p>
                    <p>
                      Pixels: {image.naturalWidth} &times; {image.naturalHeight} &bull;
                      Repeat: {repeatLabel}
                    </p>
                    {repeatType !== 'full-drop' && (
                      <p className="text-xs text-[#6b7280] mt-1">
                        Auto-converts to full-drop tile (
                        {repeatType === 'half-drop'
                          ? `${(tileWidth * 2).toFixed(2)}" \u00d7 ${tileHeight.toFixed(2)}"`
                          : `${tileWidth.toFixed(2)}" \u00d7 ${(tileHeight * 2).toFixed(2)}"`}
                        ) before tiling.
                      </p>
                    )}
                  </div>
                </div>
  
                {/* Target Size */}
                <div>
                  <h4 className="text-xs font-semibold text-[#294051] mb-3 uppercase tracking-wide">
                    Target Size
                  </h4>
                  <div className="flex items-center gap-3 mb-3">
                    <button
                      onClick={() => handlePresetClick(SIZE_PRESETS[0])}
                      className={`px-4 py-2 rounded-md border text-xs font-semibold transition-colors ${
                        isPresetActive(SIZE_PRESETS[0])
                          ? 'bg-[#faf3e0] border-[#e0c26e] text-[#294051]'
                          : 'bg-white border-[#e5e7eb] text-[#374151] hover:bg-[#f5f5f5]'
                      }`}
                      disabled={isExporting}
                    >
                      12&times;12&quot; Standard
                    </button>
                    <span className="text-[10px] text-[#9ca3af]">Recommended</span>
                  </div>
  
                  {/* Custom size inputs */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#6b7280]">Custom size:</span>
                    <input
                      type="number"
                      min="1"
                      max="40"
                      step="0.5"
                      value={customW}
                      onChange={(e) => setCustomW(e.target.value)}
                      placeholder="W"
                      className="w-16 px-2 py-1.5 text-xs border border-[#e5e7eb] rounded-md focus:outline-none focus:border-[#e0c26e] text-[#374151]"
                      disabled={isExporting}
                    />
                    <span className="text-xs text-[#6b7280]">&times;</span>
                    <input
                      type="number"
                      min="1"
                      max="40"
                      step="0.5"
                      value={customH}
                      onChange={(e) => setCustomH(e.target.value)}
                      placeholder="H"
                      className="w-16 px-2 py-1.5 text-xs border border-[#e5e7eb] rounded-md focus:outline-none focus:border-[#e0c26e] text-[#374151]"
                      disabled={isExporting}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleApplyCustom();
                        }
                      }}
                    />
                    <span className="text-xs text-[#6b7280]">inches</span>
                    <button
                      onClick={handleApplyCustom}
                      disabled={
                        isExporting ||
                        !customW ||
                        !customH ||
                        parseFloat(customW) <= 0 ||
                        parseFloat(customH) <= 0
                      }
                      className="px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ backgroundColor: '#e0c26e', color: 'white' }}
                    >
                      Apply
                    </button>
                  </div>
                </div>
  
                {/* DPI */}
                <div>
                  <h4 className="text-xs font-semibold text-[#294051] mb-2 uppercase tracking-wide">
                    Target DPI
                  </h4>
                  <p className="text-sm text-[#374151] font-medium">
                    300 DPI{' '}
                    <span className="text-[10px] text-[#9ca3af] font-normal ml-1">
                      Print-quality standard
                    </span>
                  </p>
                  <label className="flex items-center cursor-pointer mt-2">
                    <input
                      type="checkbox"
                      checked={selectedDPI === 150}
                      onChange={() =>
                        setSelectedDPI(selectedDPI === 150 ? 300 : 150)
                      }
                      className="mr-2 w-3 h-3 border-[#e5e7eb] rounded focus:ring-1"
                      style={{ accentColor: '#e0c26e' }}
                      disabled={isExporting}
                    />
                    <span className="text-[11px] text-[#9ca3af]">
                      Use 150 DPI instead (smaller file)
                    </span>
                  </label>
                  {calc?.isUpscaled && (
                    <p className="text-xs text-orange-600 mt-2">
                      Your tile is {effectiveDPI} DPI — each repeat will be
                      upscaled at {selectedDPI} DPI. Consider using 150 DPI to
                      avoid softening.
                    </p>
                  )}
                </div>
  
                {/* Format Toggle */}
                <div>
                  <h4 className="text-xs font-semibold text-[#294051] mb-3 uppercase tracking-wide">
                    Format
                  </h4>
                  <div className="flex gap-3">
                    <label className="flex items-center cursor-pointer group">
                      <input
                        type="radio"
                        name="fill-format"
                        value="png"
                        checked={format === 'png'}
                        onChange={() => setFormat('png')}
                        className="mr-2 w-3 h-3 border-[#e5e7eb] focus:ring-1"
                        style={{ accentColor: '#e0c26e' }}
                        disabled={isExporting}
                      />
                      <span className="text-sm text-[#374151] group-hover:text-[#294051]">
                        PNG (Lossless)
                      </span>
                    </label>
                    <label className="flex items-center cursor-pointer group">
                      <input
                        type="radio"
                        name="fill-format"
                        value="jpg"
                        checked={format === 'jpg'}
                        onChange={() => setFormat('jpg')}
                        className="mr-2 w-3 h-3 border-[#e5e7eb] focus:ring-1"
                        style={{ accentColor: '#e0c26e' }}
                        disabled={isExporting}
                      />
                      <span className="text-sm text-[#374151] group-hover:text-[#294051]">
                        JPG (Smaller File)
                      </span>
                    </label>
                  </div>
                </div>
  
                {/* Output Preview with Live Canvas + Scale Buttons */}
                {calc && (
                  <div className="p-4 bg-[#f5f5f5] rounded-md border border-[#e5e7eb]">
                    <h4 className="text-xs font-semibold text-[#294051] mb-3 uppercase tracking-wide">
                      Output Preview
                    </h4>
                    <div className="flex gap-4">
                      {/* Preview canvas with +/- buttons */}
                      <div className="flex-shrink-0">
                        <canvas
                          ref={previewCanvasRef}
                          className="border border-[#e5e7eb] rounded bg-white"
                          style={{ width: PREVIEW_WIDTH, imageRendering: 'auto' }}
                        />
                        {/* Scale adjustment buttons */}
                        <div className="flex items-center justify-center gap-2 mt-2">
                          <button
                            onClick={handleScaleDown}
                            disabled={isExporting || !canScaleDown}
                            className="w-7 h-7 flex items-center justify-center rounded-md border border-[#e5e7eb] bg-white text-[#374151] text-sm font-bold hover:bg-[#f5f5f5] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Smaller tiles, more repeats"
                          >
                            &minus;
                          </button>
                          <span className="text-[10px] text-[#6b7280] min-w-[90px] text-center">
                            {scaledTileW.toFixed(2)}&quot; &times; {scaledTileH.toFixed(2)}&quot;
                          </span>
                          <button
                            onClick={handleScaleUp}
                            disabled={isExporting || !canScaleUp}
                            className="w-7 h-7 flex items-center justify-center rounded-md border border-[#e5e7eb] bg-white text-[#374151] text-sm font-bold hover:bg-[#f5f5f5] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Larger tiles, fewer repeats"
                          >
                            +
                          </button>
                        </div>
                        <p className="text-[10px] text-[#9ca3af] text-center mt-1">
                          Adjust tile scale
                        </p>
                      </div>
                      {/* Text info */}
                      <div className="text-sm text-[#374151] space-y-1 min-w-0">
                        <p>
                          <span className="font-medium">
                            {calc.outputWidthInches.toFixed(1)}&quot; &times; {calc.outputHeightInches.toFixed(1)}&quot;
                          </span>{' '}
                          <span className="text-xs text-[#6b7280]">
                            ({calc.outputPxW} &times; {calc.outputPxH} px)
                          </span>
                        </p>
                        <p>
                          {calc.repeatsX} &times; {calc.repeatsY} whole repeats ={' '}
                          {calc.repeatsX * calc.repeatsY} tiles
                        </p>
                        {calc.wasConverted && (
                          <p className="text-xs text-emerald-700 mt-1">
                            {repeatLabel} auto-converted to full-drop for seamless
                            tiling.
                          </p>
                        )}
                        {heightAdjusted && (
                          <p className="text-xs text-[#6b7280] mt-1">
                            Height adjusted from {targetH}&quot; to{' '}
                            {calc.outputHeightInches.toFixed(1)}&quot; for whole repeats
                            at correct aspect ratio.
                          </p>
                        )}
                      </div>
                    </div>
  
                    {/* Commercial-ready indicator */}
                    {(() => {
                      const is12x12 =
                        Math.abs(calc.outputWidthInches - 12) < 0.05 &&
                        Math.abs(calc.outputHeightInches - 12) < 0.05;
                      return is12x12 ? (
                        <div className="mt-3 p-2.5 bg-emerald-50 border border-emerald-200 rounded-md">
                          <p className="text-xs text-emerald-800 leading-relaxed">
                            <span className="font-semibold">Perfect 12 &times; 12</span> —
                            this is a commercial-quality digital paper, ready to
                            sell on Etsy, Creative Fabrica, or any marketplace.
                          </p>
                        </div>
                      ) : (
                        <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded-md">
                          <p className="text-xs text-red-800 leading-relaxed">
                            This export is{' '}
                            {calc.outputWidthInches.toFixed(1)}&quot; &times;{' '}
                            {calc.outputHeightInches.toFixed(1)}&quot; — it works
                            great as a pattern fill in Cricut and Silhouette, but
                            doesn&apos;t meet the 12 &times; 12 standard for
                            selling digital papers. Try adjusting the scale with
                            +/&minus; to find a repeat count that hits 12 &times; 12.
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                )}
  
                {/* Error */}
                {error && (
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-md">
                    <p className="text-xs text-orange-700">{error}</p>
                  </div>
                )}
  
                {/* Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={onClose}
                    className="flex-1 px-4 py-2.5 text-xs font-medium bg-white border border-[#e5e7eb] rounded-md text-[#374151] hover:bg-[#f5f5f5] transition-colors"
                    disabled={isExporting}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleExport}
                    disabled={isExporting || !image}
                    className="flex-1 px-4 py-2.5 text-xs font-medium text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: '#e0c26e' }}
                    onMouseEnter={(e) => {
                      if (!e.currentTarget.disabled) {
                        e.currentTarget.style.backgroundColor = '#c9a94e';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!e.currentTarget.disabled) {
                        e.currentTarget.style.backgroundColor = '#e0c26e';
                      }
                    }}
                  >
                    {isExporting ? 'Exporting...' : 'Export Fill Image'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Social media path */}
        {mode === 'social' && (
          <>
            {/* Step 1: Select sizes */}
            {socialStep === 'select' && (
              <div className="p-4 space-y-4 overflow-auto max-h-[calc(90vh-120px)]">
                {!image ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-[#6b7280]">No pattern loaded. Please upload a pattern first.</p>
                  </div>
                ) : (
                  <>
                    {/* Format toggle */}
                    <div className="flex items-center gap-4">
                      <span className="text-[10px] font-semibold text-[#294051] uppercase tracking-wide">Format</span>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio" name="social-format" value="jpg"
                          checked={socialFormat === 'jpg'}
                          onChange={() => setSocialFormat('jpg')}
                          style={{ accentColor: '#e0c26e' }}
                        />
                        <span className="text-xs text-[#374151]">JPG</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio" name="social-format" value="png"
                          checked={socialFormat === 'png'}
                          onChange={() => setSocialFormat('png')}
                          style={{ accentColor: '#e0c26e' }}
                        />
                        <span className="text-xs text-[#374151]">PNG</span>
                      </label>
                    </div>

                    {/* Select All */}
                    <div>
                      <h4 className="text-[10px] font-semibold text-[#294051] uppercase tracking-wide mb-2">Select Sizes</h4>
                      <label className="flex items-center gap-2 px-3 py-2 bg-[#faf3e0] border border-[#e0c26e]/40 rounded-md cursor-pointer mb-2">
                        <input
                          ref={selectAllRef}
                          type="checkbox"
                          onChange={handleSelectAll}
                          style={{ accentColor: '#e0c26e', width: 13, height: 13 }}
                        />
                        <span className="text-xs font-semibold text-[#294051]">Select All</span>
                      </label>
                      <div className="space-y-2">
                        {SOCIAL_SIZE_PRESETS.map(preset => (
                          <SocialSizeRow
                            key={preset.slug}
                            preset={preset}
                            isChecked={checkedSizes.has(preset.slug)}
                            onToggle={() => handleToggleSize(preset.slug)}
                            isExporting={false}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-3 pt-1">
                      <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 text-xs font-medium bg-white border border-[#e5e7eb] rounded-md text-[#374151] hover:bg-[#f5f5f5] transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => { setPreviewIndex(0); setSocialStep('preview'); }}
                        disabled={checkedSizes.size === 0}
                        className="flex-1 px-4 py-2.5 text-xs font-medium text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ backgroundColor: '#e0c26e' }}
                      >
                        {checkedSizes.size === 0 ? 'Select a Size' : `Preview & Export`}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Step 2: Preview wizard */}
            {socialStep === 'preview' && image && (() => {
              const selectedPresets = SOCIAL_SIZE_PRESETS.filter(p => checkedSizes.has(p.slug));
              const current = selectedPresets[previewIndex];
              const isFirst = previewIndex === 0;
              const isLast = previewIndex === selectedPresets.length - 1;
              if (!current) return null;
              return (
                <div className="p-4 overflow-auto max-h-[calc(90vh-120px)]">
                  {/* Progress indicator */}
                  <div className="text-center mb-4">
                    <span className="text-[10px] font-semibold text-[#294051] uppercase tracking-wide">{current.label}</span>
                    <span className="text-[10px] text-[#9ca3af] ml-2">{previewIndex + 1} of {selectedPresets.length}</span>
                  </div>

                  <SocialPreviewSlide
                    preset={current}
                    image={image}
                    tileWidth={tileWidth}
                    tileHeight={tileHeight}
                    repeatType={repeatType}
                    originalFilename={originalFilename}
                    socialFormat={socialFormat}
                    scalesRef={scalesRef}
                    isExporting={isExporting}
                  />

                  {/* Error */}
                  {error && (
                    <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-md">
                      <p className="text-xs text-orange-700">{error}</p>
                    </div>
                  )}

                  {/* Navigation */}
                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => isFirst ? setSocialStep('select') : setPreviewIndex(i => i - 1)}
                      disabled={isExporting}
                      className="flex-1 px-4 py-2.5 text-xs font-medium bg-white border border-[#e5e7eb] rounded-md text-[#374151] hover:bg-[#f5f5f5] transition-colors disabled:opacity-50"
                    >
                      ← {isFirst ? 'Back to Sizes' : 'Prev'}
                    </button>
                    {isLast ? (
                      <button
                        onClick={handleSocialExport}
                        disabled={isExporting}
                        className="flex-1 px-4 py-2.5 text-xs font-medium text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ backgroundColor: '#e0c26e' }}
                      >
                        {isExporting ? 'Exporting...' : selectedPresets.length === 1 ? 'Export 1 Image' : `Export ${selectedPresets.length} Images`}
                      </button>
                    ) : (
                      <button
                        onClick={() => setPreviewIndex(i => i + 1)}
                        disabled={isExporting}
                        className="flex-1 px-4 py-2.5 text-xs font-medium text-white rounded-md transition-colors"
                        style={{ backgroundColor: '#e0c26e' }}
                      >
                        Next →
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}
