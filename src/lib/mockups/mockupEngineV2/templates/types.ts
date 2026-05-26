/**
 * Mockup Engine V2 - Type Definitions
 *
 * Defines the template schema used by all V2 mockup types.
 * Imported by pipeline stages, template registry, and renderer.
 */

export type DisplacementType =
  | 'fabric-drape'
  | 'pillow'
  | 'flat-surface'
  | 'cylindrical'
  | 'vertical-drape'
  | 'radial-bulge';

export type BlendMode =
  | 'multiply'
  | 'overlay'
  | 'soft-light'
  | 'hard-light'
  | 'screen'
  | 'color-burn'
  | 'source-over';

export type MockupV2Category =
  | 'apparel'
  | 'home-goods'
  | 'stationery'
  | 'accessories'
  | 'gifting'
  | 'wallpaper'
  | 'fabric';

/**
 * A zone defines a region of a mockup where the pattern is applied
 * with its own perspective, displacement, and mask settings.
 * Multiple zones allow different garment sections (bodice, skirt)
 * to have independent warp/fold behavior while sharing the same pattern.
 */
export interface MockupZone {
  id: string;
  maskPath: string;
  patternArea: { x: number; y: number; width: number; height: number };
  perspective: { topSqueeze: number; bottomSqueeze: number; rightSqueeze?: number };
  displacement: {
    intensity: number;
    wrinkleFreq: number;
    type: DisplacementType;
  };
  blend: { mode: BlendMode; opacity: number };
  /** Override physical width (inches) for tile scaling in this zone.
   *  Falls back to template.physicalSize.width when absent. */
  physicalWidth?: number;
  /** Vertical foreshortening factor for receding surfaces (e.g. table tops).
   *  When > 1, samples more rows from the shared tile and compresses them
   *  vertically, showing more pattern depth in a shallow strip. */
  foreshorten?: number;
  /** Rotation angle in degrees applied to the tiled pattern before perspective
   *  warp. Positive = clockwise. Used for products where the pattern should
   *  appear at an angle (e.g. silk scarves with diagonal print). Default 0. */
  patternAngle?: number;
  /** Pixel shift applied to the tiled pattern within this zone before perspective
   *  warp. Use to phase-shift one zone's tiling so it doesn't line up perfectly
   *  with an adjacent zone (e.g. a folded-back scarf corner, or a tie knot
   *  showing a different part of the print than the body). Honoured with or
   *  without patternAngle. */
  patternOffset?: { x: number; y: number };
}

export interface MockupV2Template {
  id: string;
  name: string;
  description: string;
  category: MockupV2Category;

  canvasSize: { width: number; height: number };

  /** When set, every zone tiles the pattern at this density (canvas pixels per
   *  real inch of fabric). Overrides per-zone `physicalWidth` for tile-size
   *  calculation, so multi-zone templates that show the same fabric across
   *  different garment pieces (e.g. duvet+pillow, tie body+knot) print the
   *  pattern at one consistent visual scale.
   *
   *  Anchor on the dominant zone: e.g., for a duvet+pillow, compute
   *  `duvetZone.patternArea.width / duvetZone.physicalWidth` and use that.
   *  Per-zone `physicalWidth` stays as documentation but no longer drives scale. */
  canvasPxPerInch?: number;

  /** Single-zone templates use these top-level fields. */
  patternArea: { x: number; y: number; width: number; height: number };
  perspective: { topSqueeze: number; bottomSqueeze: number; rightSqueeze?: number };
  displacement: {
    intensity: number;
    wrinkleFreq: number;
    type: DisplacementType;
  };
  blend: { mode: BlendMode; opacity: number };

  /** Rotation angle in degrees applied to the tiled pattern in single-zone templates.
   *  Positive = clockwise. Ignored when `zones` is set (use MockupZone.patternAngle instead). */
  patternAngle?: number;

  /** Multi-zone templates define zones here. Overrides top-level patternArea/perspective/displacement/blend. */
  zones?: MockupZone[];

  /** When set, all zones share one continuous tiled pattern across this bounding box.
   *  Each zone extracts its sub-region from the shared tile instead of tiling independently.
   *  Use for templates where the pattern must flow seamlessly across zones (e.g. tablecloth). */
  sharedPatternArea?: { x: number; y: number; width: number; height: number };

  lighting: { enabled: boolean; intensity: number };

  /** Path to a photo-based displacement map (grayscale PNG, same dimensions as
   *  canvasSize). 128 = no shift, darker/lighter = shift. When present, used
   *  instead of procedural displacement generation. The zone's displacement
   *  intensity still controls the strength of the effect. */
  displacementMapPath?: string;

  physicalSize: { width: number; height: number; unit: 'in' | 'cm' };

  /** Human-readable size label shown in the mockup gallery, e.g. "Size 5 Kids (13.5×20.5\")" */
  sizeLabel?: string;

  /** Optional shadow overlay (RGBA PNG, canvas-sized). Composited on top of the
   *  finished pattern+base composite using `multiply` blend (fixed). Use to bake
   *  in product-photo shadows that should darken the pattern in folds/creases. */
  shadowPath?: string;
  /** Opacity for the shadow overlay. Default 1.0. */
  shadowOpacity?: number;
  /** Extra shadow overlay PNGs stacked on top of shadowPath, each at multiply blend.
   *  Used when a scene has multiple shadow regions (e.g. tie + jacket). */
  additionalShadowPaths?: string[];
  /** Per-additional-shadow opacity (parallel to additionalShadowPaths). Falls back
   *  to shadowOpacity when an entry is missing. */
  additionalShadowOpacities?: number[];
  /** Display label for the primary shadow slider. Default "Shadow". */
  shadowLabel?: string;
  /** Display labels for additional shadow sliders (parallel to additionalShadowPaths). */
  additionalShadowLabels?: string[];
  /** Initial enabled state for each additional shadow (parallel to additionalShadowPaths).
   *  Missing entries default to true. Used to start a layer off by default —
   *  e.g. the jacket shadow on mens-tie. Users can still toggle it on. */
  additionalShadowDefaultEnableds?: boolean[];

  /** Optional highlight overlay (RGBA PNG, canvas-sized). Composited on top of
   *  the finished pattern+base composite using `soft-light` blend (fixed). Use
   *  to add gentle product-photo highlights that lift the pattern on raised areas.
   *  When present, the auto-derived `lighting` soft-light pass is suppressed. */
  highlightPath?: string;
  /** Opacity for the highlight overlay. Default 1.0. */
  highlightOpacity?: number;
  /** Extra highlight overlay PNGs stacked on top of highlightPath, each at soft-light blend. */
  additionalHighlightPaths?: string[];
  /** Per-additional-highlight opacity (parallel to additionalHighlightPaths). */
  additionalHighlightOpacities?: number[];
  /** Display label for the primary highlight slider. Default "Highlight". */
  highlightLabel?: string;
  /** Display labels for additional highlight sliders. */
  additionalHighlightLabels?: string[];
  /** Initial enabled state for each additional highlight (parallel to additionalHighlightPaths).
   *  Missing entries default to true. */
  additionalHighlightDefaultEnableds?: boolean[];
  /** Display label for the color overlay toggle. Default "Accent color". */
  colorOverlayLabel?: string;

  /** Optional accent color overlay (e.g., onesie trim, wrapping paper bow).
   *  Fills the masked region with a solid color (auto-detected from pattern
   *  background or user-chosen) and composites it onto the final result. */
  colorOverlay?: {
    maskPath: string;
    /** Default color when no user override is provided. If 'auto', extract
     *  the dominant background colour from the pattern image at render time. */
    defaultColor: string | 'auto';
    /** Blend mode used to composite the accent color onto the final canvas.
     *  Defaults to 'multiply' (legacy behavior). 'linear-burn' is a custom
     *  ImageData pass since canvas has no native equivalent. */
    blendMode?: GlobalCompositeOperation | 'linear-burn';
    /** Opacity for the composite step (0..1). Defaults to 1.0. Lower values let
     *  more of the photo's natural lighting bleed through — matches PSD mockups
     *  that use Color Fill at <100% opacity. */
    opacity?: number;
    /** When true, skip the contrast-boosted shading pre-multiplication and the
     *  soft-light highlight recovery pass. Just multiplies the flat accent color
     *  onto the photo (matches a vanilla Photoshop Color Fill + Multiply layer). */
    flatMultiply?: boolean;
  };
  /** Initial state of the color overlay toggle. Defaults to true (overlay
   *  enabled when the template is selected). Set to false for templates where
   *  the overlay is a secondary accent the user usually wants off — e.g. the
   *  jacket region on mens-tie. Users can still flip the toggle on. */
  colorOverlayDefaultEnabled?: boolean;

  productBase:
    | {
        type: 'procedural';
        brightness: number;
        shape: DisplacementType;
      }
    | {
        type: 'image';
        imagePath: string;
        maskPath?: string;
      };
}
