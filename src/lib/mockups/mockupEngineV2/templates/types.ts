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
}

export interface MockupV2Template {
  id: string;
  name: string;
  description: string;
  category: MockupV2Category;

  canvasSize: { width: number; height: number };

  /** Single-zone templates use these top-level fields. */
  patternArea: { x: number; y: number; width: number; height: number };
  perspective: { topSqueeze: number; bottomSqueeze: number; rightSqueeze?: number };
  displacement: {
    intensity: number;
    wrinkleFreq: number;
    type: DisplacementType;
  };
  blend: { mode: BlendMode; opacity: number };

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

  /** Optional accent color overlay (e.g., onesie trim, wrapping paper bow).
   *  Fills the masked region with a solid color (auto-detected from pattern
   *  background or user-chosen) and composites it onto the final result. */
  colorOverlay?: {
    maskPath: string;
    /** Default color when no user override is provided. If 'auto', extract
     *  the dominant background colour from the pattern image at render time. */
    defaultColor: string | 'auto';
  };

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
