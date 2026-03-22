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
  perspective: { topSqueeze: number; bottomSqueeze: number };
  displacement: {
    intensity: number;
    wrinkleFreq: number;
    type: DisplacementType;
  };
  blend: { mode: BlendMode; opacity: number };
}

export interface MockupV2Template {
  id: string;
  name: string;
  description: string;
  category: MockupV2Category;

  canvasSize: { width: number; height: number };

  /** Single-zone templates use these top-level fields. */
  patternArea: { x: number; y: number; width: number; height: number };
  perspective: { topSqueeze: number; bottomSqueeze: number };
  displacement: {
    intensity: number;
    wrinkleFreq: number;
    type: DisplacementType;
  };
  blend: { mode: BlendMode; opacity: number };

  /** Multi-zone templates define zones here. Overrides top-level patternArea/perspective/displacement/blend. */
  zones?: MockupZone[];

  lighting: { enabled: boolean; intensity: number };

  physicalSize: { width: number; height: number; unit: 'in' | 'cm' };

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
