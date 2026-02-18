'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { ContrastAnalysis, CompositionAnalysis, ColorHarmonyAnalysis, evaluateColorHarmony } from '@/lib/analysis/patternAnalyzer';

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  return { s, l };
}

function hueName(h: number, s?: number, l?: number): string {
  if (s !== undefined && l !== undefined) {
    if (h >= 15 && h < 50 && s < 0.35) {
      return l > 0.65 ? 'Cream' : 'Tan';
    }
    if (h >= 290 && h < 345 && s < 0.30) {
      return 'Mauve';
    }
  }
  if (h < 15 || h >= 345) return 'Red';
  if (h < 40) return 'Orange';
  if (h < 50) return 'Gold';
  if (h < 65) return 'Yellow';
  if (h < 80) return 'Yellow-Green';
  if (h < 160) return 'Green';
  if (h < 190) return 'Teal';
  if (h < 250) return 'Blue';
  if (h < 290) return 'Purple';
  if (h < 330) return 'Pink';
  return 'Red';
}

interface PatternAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  image: HTMLImageElement | null;
  contrastAnalysis: ContrastAnalysis | null;
  compositionAnalysis: CompositionAnalysis | null;
  colorHarmonyAnalysis?: ColorHarmonyAnalysis | null;
  onColorHarmonyUpdate?: (analysis: ColorHarmonyAnalysis) => void;
  isAnalyzing: boolean;
  isPro: boolean;
  onUpgrade: () => void;
}

export default function PatternAnalysisModal({
  isOpen,
  onClose,
  image,
  contrastAnalysis,
  compositionAnalysis,
  colorHarmonyAnalysis,
  onColorHarmonyUpdate,
  isAnalyzing,
  isPro,
  onUpgrade,
}: PatternAnalysisModalProps) {
  const [editedColors, setEditedColors] = useState<Array<{ r: number; g: number; b: number }> | null>(null);
  const [isPickingColor, setIsPickingColor] = useState(false);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Reset edited colors when modal closes or analysis changes
  useEffect(() => {
    setEditedColors(null);
  }, [colorHarmonyAnalysis, isOpen]);

  // Effective analysis: re-evaluate if user has edited colors, otherwise use prop
  const effectiveAnalysis = editedColors
    ? evaluateColorHarmony(editedColors)
    : colorHarmonyAnalysis;

  const getBaseColors = useCallback(() => {
    if (editedColors) return editedColors;
    return colorHarmonyAnalysis?.chromaticColors.map(c => ({ r: c.r, g: c.g, b: c.b })) ?? [];
  }, [editedColors, colorHarmonyAnalysis]);

  const handleAddColor = useCallback(async () => {
    if ('EyeDropper' in window) {
      try {
        // Hide modal so eyedropper picks true colors, not darkened ones
        setIsPickingColor(true);
        const dropper = new EyeDropper();
        const result = await dropper.open();
        setIsPickingColor(false);
        const hex = result.sRGBHex;
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const newColors = [...getBaseColors(), { r, g, b }];
        setEditedColors(newColors);
        onColorHarmonyUpdate?.(evaluateColorHarmony(newColors));
      } catch {
        // User cancelled the eyedropper
        setIsPickingColor(false);
      }
    } else {
      colorInputRef.current?.click();
    }
  }, [getBaseColors, onColorHarmonyUpdate]);

  const handleColorInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const hex = e.target.value;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const newColors = [...getBaseColors(), { r, g, b }];
    setEditedColors(newColors);
    onColorHarmonyUpdate?.(evaluateColorHarmony(newColors));
  }, [getBaseColors, onColorHarmonyUpdate]);

  const handleRemoveColor = useCallback((index: number) => {
    const newColors = getBaseColors().filter((_, i) => i !== index);
    setEditedColors(newColors);
    onColorHarmonyUpdate?.(evaluateColorHarmony(newColors));
  }, [getBaseColors, onColorHarmonyUpdate]);

  const handleResetColors = useCallback(() => {
    setEditedColors(null);
    if (colorHarmonyAnalysis) onColorHarmonyUpdate?.(colorHarmonyAnalysis);
  }, [colorHarmonyAnalysis, onColorHarmonyUpdate]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={modalRef}
      className={`fixed inset-0 z-[1000] flex items-center justify-center transition-opacity ${isPickingColor ? 'opacity-0 pointer-events-none' : 'bg-black/50'}`}
      onClick={onClose}
    >
      <div
        className="relative w-[calc(100vw-32px)] max-w-lg max-h-[85vh] bg-white rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-[#3a3d44]">
          <div className="flex items-center gap-2 flex-1">
            <div className="w-8 h-8 rounded-lg bg-[#fbbf24] flex items-center justify-center text-lg">
              📊
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Pattern Analysis</h3>
              <p className="text-[10px] text-white/70">Contrast & Composition</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white p-1"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Disclaimer */}
        <p className="text-[10px] text-gray-400 text-center py-2 px-4 border-b border-gray-100">
          Results are for educational purposes — this tool may not read every pattern perfectly.
        </p>

        {/* Content */}
        <div className="overflow-y-auto p-4 space-y-4" style={{ maxHeight: 'calc(85vh - 82px)' }}>
          {!isPro ? (
            // Non-Pro: Show blurred preview with upgrade CTA
            <>
              {/* Blurred Contrast Preview */}
              <div className="relative">
                <div className="p-4 bg-white border border-[#e5e7eb] rounded-lg" style={{ filter: 'blur(6px)', opacity: 0.6 }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">◐</span>
                    <span className="text-sm font-semibold text-[#294051]">Contrast Check</span>
                  </div>
                  <div className="text-xs text-[#374151] mb-1">GOOD Contrast</div>
                  <div className="text-xs text-[#374151] mb-2">Global contrast: 68%</div>
                  <p className="text-sm text-[#374151]">
                    Your pattern demonstrates good contrast that will print clearly...
                  </p>
                </div>
              </div>

              {/* Blurred Composition Preview */}
              <div className="relative">
                <div className="p-4 bg-white border border-[#e5e7eb] rounded-lg" style={{ filter: 'blur(6px)', opacity: 0.6 }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">🎯</span>
                    <span className="text-sm font-semibold text-[#294051]">Composition Analysis</span>
                  </div>
                  <div className="text-xs text-[#374151] mb-1">Balanced Composition</div>
                  <div className="text-xs text-[#374151] mb-2">Pattern: Even Distribution • Balance: 85%</div>
                  <p className="text-sm text-[#374151]">
                    The pattern shows balanced visual weight with good flow...
                  </p>
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-white px-4 py-2 rounded-lg shadow-lg border-2 border-[#fbbf24]">
                    <div className="text-sm font-semibold text-[#294051] flex items-center gap-2">
                      🔒 Unlock full analysis with Pro
                    </div>
                  </div>
                </div>
              </div>

              {/* Blurred Harmony Preview */}
              <div className="relative">
                <div className="p-4 bg-white border border-[#e5e7eb] rounded-lg" style={{ filter: 'blur(6px)', opacity: 0.6 }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">🎨</span>
                    <span className="text-sm font-semibold text-[#294051]">Color Harmony</span>
                  </div>
                  <div className="text-xs text-[#374151] mb-1">Colors work beautifully together</div>
                  <div className="flex gap-2 mt-2">
                    {['#e07b54', '#d4a853', '#7ab87a', '#5b8db8', '#9b6bb5'].map((c, i) => (
                      <div key={i} className="w-8 h-8 rounded-full" style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Upgrade CTA */}
              <button
                onClick={onUpgrade}
                className="w-full px-6 py-3 bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] hover:from-[#f59e0b] hover:to-[#d97706] text-white font-semibold rounded-lg transition-all"
              >
                Start 7-Day Free Trial →
              </button>
              <div className="text-center text-xs text-gray-500">
                or upgrade now for $7.99/month
              </div>
            </>
          ) : !image ? (
            <div className="text-sm text-gray-500 text-center py-8">
              Upload a pattern tile to see analysis
            </div>
          ) : isAnalyzing ? (
            <div className="text-sm text-gray-500 text-center py-8">
              Analyzing...
            </div>
          ) : (
            // Pro: Show both analyses
            <>
              {/* Contrast Analysis */}
              {contrastAnalysis && (
                <div className="p-4 bg-white border border-[#e5e7eb] rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">◐</span>
                    <span className="text-sm font-semibold text-[#294051]">Contrast Check</span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-[#294051]">
                      {contrastAnalysis.label}
                    </span>
                    <span className={`px-2 py-0.5 text-[10px] font-medium rounded uppercase ${
                      contrastAnalysis.severity === 'none' ? 'bg-emerald-100 text-emerald-700' :
                      contrastAnalysis.severity === 'info' ? 'bg-blue-100 text-blue-700' :
                      'bg-orange-100 text-orange-700'
                    }`}>
                      {contrastAnalysis.band === 'very_low' ? 'VERY LOW' : contrastAnalysis.band.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-xs text-[#374151] mb-2">
                    Global contrast: {(contrastAnalysis.globalContrast * 100).toFixed(0)}%
                  </div>
                  <p className="text-sm text-[#374151] leading-relaxed">
                    {contrastAnalysis.message}
                  </p>
                </div>
              )}

              {/* Composition Analysis */}
              {compositionAnalysis && (
                <div className="p-4 bg-white border border-[#e5e7eb] rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">🎯</span>
                    <span className="text-sm font-semibold text-[#294051]">Composition Analysis</span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-[#294051]">
                      {compositionAnalysis.label}
                    </span>
                    <span className={`px-2 py-0.5 text-[10px] font-medium rounded uppercase ${
                      compositionAnalysis.band === 'balanced' ? 'bg-emerald-100 text-emerald-700' :
                      compositionAnalysis.band === 'dynamic' ? 'bg-blue-100 text-blue-700' :
                      'bg-orange-100 text-orange-700'
                    }`}>
                      {compositionAnalysis.band}
                    </span>
                  </div>
                  <div className="text-xs text-[#374151] mb-2">
                    Pattern: {compositionAnalysis.distributionPattern.replace('-', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                    {' \u2022 '}Balance: {(compositionAnalysis.balanceScore * 100).toFixed(0)}%
                  </div>
                  <p className="text-sm text-[#374151] leading-relaxed mb-2">
                    {compositionAnalysis.message}
                  </p>
                  <p className="text-xs text-[#6b7280] leading-relaxed italic">
                    {compositionAnalysis.contextHint}
                  </p>
                </div>
              )}

              {/* Color Harmony Analysis */}
              {effectiveAnalysis && (
                <div className="p-4 bg-white border border-[#e5e7eb] rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">🎨</span>
                    <span className="text-sm font-semibold text-[#294051]">Color Harmony</span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-[#294051]">
                      {effectiveAnalysis.label}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {effectiveAnalysis.detectedScheme && (
                        <span className="px-2 py-0.5 text-[10px] font-medium rounded uppercase bg-[#f3f0e8] text-[#8b7d5e]">
                          {effectiveAnalysis.detectedScheme}
                        </span>
                      )}
                      <span className={`px-2 py-0.5 text-[10px] font-medium rounded uppercase ${
                        effectiveAnalysis.severity === 'none' ? 'bg-emerald-100 text-emerald-700' :
                        effectiveAnalysis.severity === 'info' ? 'bg-blue-100 text-blue-700' :
                        'bg-orange-100 text-orange-700'
                      }`}>
                        {effectiveAnalysis.band === 'too_similar' ? 'TOO SIMILAR' :
                         effectiveAnalysis.band === 'beautiful' ? 'HARMONIOUS' :
                         effectiveAnalysis.band === 'mostly' ? 'MOSTLY' : 'CLASHING'}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-[#374151] leading-relaxed mb-3">
                    {effectiveAnalysis.message}
                  </p>

                  {/* Swatches */}
                  {effectiveAnalysis.isNeutralDominant ? (
                    <p className="text-xs text-[#6b7280] italic">
                      Mostly neutral palette — no strong color conflicts detected.
                    </p>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 flex-wrap">
                        {effectiveAnalysis.chromaticColors.map((color, i) => (
                          <div
                            key={`swatch-${i}`}
                            className="relative group"
                            title={color.isClashing ? 'This color may be clashing' : undefined}
                          >
                            <div
                              className={`w-8 h-8 rounded-full ${
                                color.isClashing
                                  ? 'ring-2 ring-orange-400 ring-offset-1'
                                  : ''
                              }`}
                              style={{ backgroundColor: `rgb(${color.r}, ${color.g}, ${color.b})` }}
                            />
                            {/* Clashing icon — hidden on hover when remove button shows */}
                            {color.isClashing && (
                              <span className="absolute -top-1 -right-1 text-[10px] leading-none group-hover:opacity-0 transition-opacity">⚠️</span>
                            )}
                            {/* Remove button — visible on hover */}
                            <button
                              onClick={() => handleRemoveColor(i)}
                              className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Remove this color"
                            >
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}

                        {/* Add color button */}
                        <button
                          onClick={handleAddColor}
                          className="w-8 h-8 rounded-full border-2 border-dashed border-[#e0c26e] hover:border-[#e8d28e] hover:bg-[#e0c26e]/10 flex items-center justify-center transition-colors"
                          title={'EyeDropper' in window ? 'Pick a color from the pattern' : 'Add a color'}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e0c26e" strokeWidth={2.5}>
                            <path strokeLinecap="round" d="M12 5v14M5 12h14" />
                          </svg>
                        </button>
                      </div>

                      {/* Clash / tense pair details */}
                      {(effectiveAnalysis.clashPairs.length > 0 || effectiveAnalysis.tensePairs.length > 0) && (
                        <div className="mt-3 space-y-1.5">
                          {effectiveAnalysis.clashPairs.map(([a, b], i) => {
                            const colorA = effectiveAnalysis.chromaticColors[a];
                            const colorB = effectiveAnalysis.chromaticColors[b];
                            if (!colorA || !colorB) return null;
                            const hslA = rgbToHsl(colorA.r, colorA.g, colorA.b);
                            const hslB = rgbToHsl(colorB.r, colorB.g, colorB.b);
                            const nameA = hueName(colorA.hue, hslA.s, hslA.l);
                            const nameB = hueName(colorB.hue, hslB.s, hslB.l);
                            const sameName = nameA === nameB;
                            return (
                              <div key={`clash-${i}`} className="flex items-start gap-1.5 text-[10px] text-[#6b7280]">
                                <div className="flex items-center gap-1 shrink-0 mt-0.5">
                                  <div className="w-3 h-3 rounded-full ring-1 ring-orange-300" style={{ backgroundColor: `rgb(${colorA.r},${colorA.g},${colorA.b})` }} />
                                  <span>+</span>
                                  <div className="w-3 h-3 rounded-full ring-1 ring-orange-300" style={{ backgroundColor: `rgb(${colorB.r},${colorB.g},${colorB.b})` }} />
                                </div>
                                <span>
                                  {sameName
                                    ? `These ${nameA.toLowerCase()}s are similar but not close enough to feel intentional. Try making them closer or more distinct.`
                                    : `${nameA} and ${nameB} compete for attention. Try making one dominant or shifting one closer to the other.`
                                  }
                                </span>
                              </div>
                            );
                          })}
                          {effectiveAnalysis.tensePairs.map(([a, b], i) => {
                            const colorA = effectiveAnalysis.chromaticColors[a];
                            const colorB = effectiveAnalysis.chromaticColors[b];
                            if (!colorA || !colorB) return null;
                            const hslA = rgbToHsl(colorA.r, colorA.g, colorA.b);
                            const hslB = rgbToHsl(colorB.r, colorB.g, colorB.b);
                            const nameA = hueName(colorA.hue, hslA.s, hslA.l);
                            const nameB = hueName(colorB.hue, hslB.s, hslB.l);
                            const sameName = nameA === nameB;
                            return (
                              <div key={`tense-${i}`} className="flex items-start gap-1.5 text-[10px] text-[#6b7280]">
                                <div className="flex items-center gap-1 shrink-0 mt-0.5">
                                  <div className="w-3 h-3 rounded-full ring-1 ring-blue-200" style={{ backgroundColor: `rgb(${colorA.r},${colorA.g},${colorA.b})` }} />
                                  <span>+</span>
                                  <div className="w-3 h-3 rounded-full ring-1 ring-blue-200" style={{ backgroundColor: `rgb(${colorB.r},${colorB.g},${colorB.b})` }} />
                                </div>
                                <span>
                                  {sameName
                                    ? `These ${nameA.toLowerCase()}s are close — could feel muddy at small scale. Consider more separation.`
                                    : `${nameA} and ${nameB} may create slight tension. Worth a second look at scale.`
                                  }
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {effectiveAnalysis.totalChromaticCount > 6 && (
                        <p className="text-[10px] text-[#9ca3af] mt-2">
                          Showing 6 of {effectiveAnalysis.totalChromaticCount} colors
                        </p>
                      )}

                      {/* Reset link — only when user has made edits */}
                      {editedColors && (
                        <button
                          onClick={handleResetColors}
                          className="text-[10px] text-[#e0c26e] hover:text-[#d4a853] underline mt-2"
                        >
                          Reset to auto-detected colors
                        </button>
                      )}
                    </>
                  )}

                  {/* Hidden color input for browsers without EyeDropper */}
                  <input
                    ref={colorInputRef}
                    type="color"
                    className="sr-only"
                    onChange={handleColorInputChange}
                    tabIndex={-1}
                  />
                </div>
              )}

              {!contrastAnalysis && !compositionAnalysis && !effectiveAnalysis && (
                <div className="text-sm text-gray-500 text-center py-8">
                  No analysis data available
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
