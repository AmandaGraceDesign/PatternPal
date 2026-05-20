import type { MockupV2Template } from './templates/types';

const round = Math.round;

function scaleRect<T extends { x: number; y: number; width: number; height: number }>(
  r: T,
  f: number,
): T {
  return { ...r, x: round(r.x * f), y: round(r.y * f), width: round(r.width * f), height: round(r.height * f) };
}

/**
 * Returns a shallow-cloned template whose pixel-space dimensions (canvasSize,
 * patternArea, zone.patternArea, zone.patternOffset, sharedPatternArea) have
 * been multiplied by `factor`. Physical size, perspective squeezes, repeats,
 * angles, and opacities are untouched — they're either inches or unitless.
 *
 * Used to render gallery thumbnails at a fraction of full-canvas resolution
 * while still going through the same pipeline. PNG assets are scaled at
 * drawImage time, so paths don't need to change.
 */
export function scaleTemplate(template: MockupV2Template, factor: number): MockupV2Template {
  if (factor >= 1) return template;
  const scaled: MockupV2Template = {
    ...template,
    canvasSize: {
      width: round(template.canvasSize.width * factor),
      height: round(template.canvasSize.height * factor),
    },
    patternArea: scaleRect(template.patternArea, factor),
  };
  if (template.zones) {
    scaled.zones = template.zones.map(z => ({
      ...z,
      patternArea: scaleRect(z.patternArea, factor),
      patternOffset: z.patternOffset
        ? { x: round(z.patternOffset.x * factor), y: round(z.patternOffset.y * factor) }
        : z.patternOffset,
    }));
  }
  if (template.sharedPatternArea) {
    scaled.sharedPatternArea = scaleRect(template.sharedPatternArea, factor);
  }
  return scaled;
}

/** Computes scale factor needed so the longest canvas dimension fits within `maxDim`. */
export function computeScaleFactor(template: MockupV2Template, maxDim: number): number {
  const longest = Math.max(template.canvasSize.width, template.canvasSize.height);
  if (longest <= maxDim) return 1;
  return maxDim / longest;
}
