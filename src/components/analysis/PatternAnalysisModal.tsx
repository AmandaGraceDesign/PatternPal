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
  const [contrastLearnMore, setContrastLearnMore] = useState(false);
  const [harmonyLearnMore, setHarmonyLearnMore] = useState(false);
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

  // Reset accordion state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setContrastLearnMore(false);
      setHarmonyLearnMore(false);
    }
  }, [isOpen]);

  // Learn More content — contrast
  const contrastLearnMoreContent: Record<string, string[]> = {
    high: [
      'High contrast means strong separation between motifs and background — through value, color, or both. This is your friend for bold statement prints, children\'s fabric, graphic geometrics, and product thumbnails where you need to grab attention.',
      'Keep in mind: on large-scale wallpaper or home dec (bedding, curtains), high contrast can feel visually intense. If your design is highly detailed, it can tip into "busy" territory — make sure the eye has a place to rest.',
      'To soften slightly without losing impact: try muting one saturated color or adding a mid-tone element to bridge the gap between your lightest and darkest values.',
    ],
    moderate: [
      'Moderate contrast is the Goldilocks zone for commercial surface design — enough separation to read clearly, but not so much that it feels harsh.',
      'Why designers love this range: it\'s licensing-friendly (works across product types without modification), photographs well for listings, and pairs nicely with bolder prints in a collection. These are your workhorse patterns.',
      'One thing to check: at very small scales (2"-4"), moderate contrast can soften further when printed. Preview at your smallest intended size to make sure details still read.',
    ],
    soft: [
      'Soft contrast creates a tonal, understated look. This is gorgeous when intentional — think tone-on-tone damasks, dreamy nursery pastels, or blenders that support a hero print.',
      'Be careful: printing softens contrast further. What looks subtly beautiful on screen could be nearly invisible on cotton or canvas. In Spoonflower or Etsy thumbnails, soft patterns can look like solids and shoppers may scroll past.',
      'If intentional: preview at your smallest intended scale. Market these as "tone-on-tone" or "textured" patterns. If unintentional: increase value difference between motifs and background, boost saturation on motifs, or add a subtle outline to key elements.',
    ],
    very_low: [
      'Very low contrast means minimal visual separation — from a distance or at small scale, this reads as a near-solid or faint texture.',
      'When this is a win: textured solids and subtle blenders are a legitimate and very sellable category. If you\'re creating a linen-look, woven texture, or barely-there organic pattern — this reading makes sense. These are workhorses in collections.',
      'When to take action: if you expect visible motifs, adjust before exporting. On most substrates these will be hard to see. The #1 fix is increasing value difference — darken your darkest elements or lighten your lightest. Even a 10-15% value shift can take you from "invisible" to "subtly beautiful."',
    ],
  };

  // Learn More content — harmony (by band)
  const harmonyLearnMoreContent: Record<string, string[]> = {
    beautiful: [
      'A harmonious palette means your colors have a natural relationship the eye reads as "on purpose." When colors feel right together, buyers respond to the pattern without being able to articulate why — it just works.',
      'A strong color harmony also means your pattern holds up across substrates and printing methods. Colors that work together on screen tend to stay cohesive when printed on cotton, polyester, or wallpaper.',
    ],
    mostly: [
      'Visual tension happens when color combinations compete in a way that draws the eye for the wrong reason — the viewer notices the colors instead of appreciating the pattern.',
      'Common causes: an accent that doesn\'t quite fit the scheme, two colors too close in hue but different in saturation (an uneasy "almost matching" effect), or a warm color in an otherwise cool palette.',
      'How to fix: identify the awkward pairing by covering colors one at a time. Try shifting the outlier 10-15% in hue, saturation, or value. Sometimes swapping one color for its neighbor on the wheel is all it takes.',
      'Some tension is intentional and powerful! If you\'re deliberately using an unexpected color as a focal point, own it — the key is it should feel like a confident choice, not an accident.',
    ],
    fighting: [
      'Clashing colors fight for dominance instead of working together, pulling focus away from your motifs. On printed products this effect is even more pronounced — what looks edgy on screen can feel jarring on a pillow or overwhelming on wallpaper.',
      'Why this happens: colors close but not close enough on the wheel (like red and magenta) create an uneasy vibration. Multiple high-saturation colors at similar values compete — the eye doesn\'t know where to land.',
      'Fastest fix: establish a color hierarchy — choose one dominant color, mute the others. You can also add a neutral (white, cream, charcoal) as a buffer between competing colors.',
      'When clashing is intentional: make sure the whole palette feels deliberately rebellious, not just one accidental outlier. Half-clashing reads as a mistake; fully-clashing reads as a statement.',
    ],
    too_similar: [
      'When colors are too similar in hue, saturation, and value, they lose individual identity — especially in print. What looks like three distinct colors on your bright screen can merge into one tone on fabric. Printing naturally compresses color differences.',
      'The result: motifs disappear into each other. Buyers see a textured solid (at best) or a muddy print (at worst). This is one of the most common reasons patterns underperform on POD platforms.',
      'Three levers to fix it: (1) Value contrast — make some colors significantly lighter or darker. (2) Saturation contrast — pair muted colors with one or two vibrant versions. (3) Hue shift — move colors further apart on the wheel.',
      'Test after adjusting: preview on mockups and squint. If you can still distinguish key elements while squinting, you have enough separation.',
    ],
  };

  // Learn More content — harmony scheme-specific (shown inside beautiful band)
  const schemeLearnMoreContent: Record<string, string[]> = {
    tonal: [
      'Tonal palettes are incredibly versatile. Because your colors share similar saturation and intensity, they create visual calm — perfect for blenders, nursery designs, and home decor where the pattern needs to live in a room without overwhelming.',
      'Tonal palettes photograph beautifully for product listings because they feel curated. Just make sure there\'s still enough value difference so motifs remain distinct (check your contrast score).',
    ],
    'warm-cool contrast': [
      'The temperature difference creates a push-pull effect — warm tones come forward, cool tones recede — giving your pattern dimension even on a flat surface.',
      'Especially effective on larger surfaces like wallpaper, bedding, and curtains where that depth keeps the pattern from feeling flat. Also great for collections, since warm and cool tones naturally create "hero" and "supporting" roles.',
    ],
    contrast: [
      'Clear accent-to-background contrast means motifs are easy to read across products and scales. Especially important for POD thumbnails — buyers can actually see your design at a glance.',
      'This palette structure gives you flexibility: you can adjust scale without losing readability, because the color relationships do the heavy lifting. Works well for bold patterns, children\'s fabric, and statement prints.',
    ],
    monochromatic: [
      'Monochromatic palettes are a surface designer\'s secret weapon. Because all colors share the same hue family, the pattern feels instantly cohesive — incredibly versatile as a coordinate or blender.',
      'These sell well in home decor (wallpaper, pillows, bedding) because customers can easily match with existing decor. Just ensure you have at least 3 distinct value steps so motifs don\'t flatten.',
    ],
    analogous: [
      'Analogous palettes mimic how colors appear in nature — sunset gradients, forest greens, ocean blues. The eye moves smoothly without jarring transitions, making these feel soothing and organic.',
      'Excellent for florals, botanicals, and nature-inspired patterns. Watch for enough value contrast between colors so motifs don\'t blend. If your analogous colors are similar in lightness, darken or lighten one or two for more definition.',
    ],
    complementary: [
      'Complementary colors (opposites on the wheel) create maximum color contrast — energetic, dynamic, and unmissable. A classic relationship for statement prints and children\'s fabric.',
      'The trade-off: at full saturation, complementary colors can feel intense on large applications. Consider muting one side slightly — let one color dominate while the other plays a supporting accent role.',
    ],
    'split-complementary': [
      'Split-complementary gives you the energy of complementary colors but with more variety and less risk of feeling too intense. A sophisticated choice for complex patterns.',
      'You have a natural "dominant" color and two accent colors that both contrast with it but also relate to each other. Each motif type can own a color while still feeling cohesive.',
    ],
    triadic: [
      'Triadic palettes offer strong visual variety while maintaining balance. Fantastic for playful, energetic patterns — children\'s fabric, bold home decor, and graphic prints.',
      'Key to making it work: let one color dominate (~60%), use the second as support (~30%), and save the third as an accent (~10%). If all three compete equally, the pattern can feel chaotic.',
    ],
    tetradic: [
      'Tetradic palettes use two complementary pairs, giving the most color variety. When balanced well, they create stunning, layered patterns.',
      'The challenge is hierarchy: choose one dominant, one secondary, and use the remaining two as accents. Make sure at least one or two colors are more muted. When done right, tetradic palettes feel lush and reward close inspection.',
    ],
  };

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
                  {/* Learn More accordion */}
                  <button
                    onClick={() => setContrastLearnMore(!contrastLearnMore)}
                    className="mt-2 text-[11px] font-medium text-[#8b7d5e] hover:text-[#6b5d3e] flex items-center gap-1 transition-colors"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      className={`transition-transform ${contrastLearnMore ? 'rotate-90' : ''}`}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    {contrastLearnMore ? 'Show Less' : 'Learn More'}
                  </button>
                  {contrastLearnMore && contrastLearnMoreContent[contrastAnalysis.band] && (
                    <div className="mt-2 space-y-2 text-xs text-[#6b7280] leading-relaxed bg-[#faf9f7] rounded-lg p-3 border border-[#f0ede8]">
                      {contrastLearnMoreContent[contrastAnalysis.band].map((para, i) => (
                        <p key={i}>{para}</p>
                      ))}
                    </div>
                  )}
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
                  <p className="text-sm text-[#374151] leading-relaxed mb-2">
                    {effectiveAnalysis.message}
                  </p>
                  {/* Learn More accordion */}
                  <button
                    onClick={() => setHarmonyLearnMore(!harmonyLearnMore)}
                    className="mb-3 text-[11px] font-medium text-[#8b7d5e] hover:text-[#6b5d3e] flex items-center gap-1 transition-colors"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      className={`transition-transform ${harmonyLearnMore ? 'rotate-90' : ''}`}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    {harmonyLearnMore ? 'Show Less' : 'Learn More'}
                  </button>
                  {harmonyLearnMore && (
                    <div className="mb-3 space-y-2 text-xs text-[#6b7280] leading-relaxed bg-[#faf9f7] rounded-lg p-3 border border-[#f0ede8]">
                      {/* Band-level Learn More */}
                      {harmonyLearnMoreContent[effectiveAnalysis.band]?.map((para, i) => (
                        <p key={`band-${i}`}>{para}</p>
                      ))}
                      {/* Scheme-specific Learn More (only for beautiful band with a detected scheme) */}
                      {effectiveAnalysis.band === 'beautiful' && effectiveAnalysis.detectedScheme && schemeLearnMoreContent[effectiveAnalysis.detectedScheme] && (
                        <>
                          <hr className="border-[#e8e4dc] my-1" />
                          {schemeLearnMoreContent[effectiveAnalysis.detectedScheme].map((para, i) => (
                            <p key={`scheme-${i}`}>{para}</p>
                          ))}
                        </>
                      )}
                    </div>
                  )}

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
