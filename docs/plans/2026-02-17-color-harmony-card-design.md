# Color Harmony Card — Design

Date: 2026-02-17

## Context

PatternPal Pro's Pattern Analysis modal already has a Contrast card. This adds a Color Harmony card below it. Contrast and harmony are orthogonal: you can have a harmonious palette with terrible contrast, or clashing colors with great contrast. The card scores harmony independently.

## User-Facing Copy

Four bands, plain English, no jargon:

| Band | Label | Message |
|------|-------|---------|
| `beautiful` | Colors work beautifully together | Your palette has a natural balance that feels intentional. |
| `mostly` | Colors mostly work | A few combinations might create visual tension — worth a second look. |
| `fighting` | Colors are fighting each other | Some hues compete for attention in a way that feels unintentional. |
| `too_similar` | Too similar to read as separate colors | Your palette may blend into a single muddy tone on fabric. |

## Algorithm

### Step 1: Extract dominant colors
Reuse existing `extractDominantColors` (k-means, up to 8 colors with RGB + count).

### Step 2: Filter neutrals
Remove any color where:
- saturation < 0.15, OR
- lightness < 0.1 (too dark/black), OR
- lightness > 0.9 (too light/white)

Rationale: neutrals don't clash or harmonize — they're background. A gray + teal + cream palette should not be penalized for the gray and cream.

### Step 3: Handle edge cases
- Fewer than 2 chromatic colors remaining → band = `beautiful` (intentionally neutral palette)

### Step 4: Cap and record
- Record `totalChromaticCount` before capping
- Take top 6 by pixel count for scoring and display

### Step 5: Pairwise hue distance
Convert each chromatic color to HSL. Compute circular angular distance between all pairs:
```
dist = min(|h1 - h2|, 360 - |h1 - h2|)
```

### Step 6: Flag clashing pairs
A pair is clashing if its hue distance is in the **25–60° range** — close enough to feel related but far enough to fight visually.

Mark each color in a clashing pair as `isClashing: true`.

### Step 7: Compute mean spread
Mean of all pairwise distances across chromatic colors.

### Step 8: Band decision
```
spread < 25°              → too_similar
any clash pairs present   → fighting  (unless already too_similar)
spread > 80°, no clashes  → beautiful
otherwise                 → mostly
```

## Interface

```typescript
export interface ColorHarmonyAnalysis {
  band: 'beautiful' | 'mostly' | 'fighting' | 'too_similar';
  severity: 'none' | 'info' | 'warning';
  label: string;
  message: string;
  chromaticColors: Array<{
    r: number;
    g: number;
    b: number;
    hue: number;
    isClashing: boolean;
  }>;
  totalChromaticCount: number;
  isNeutralDominant: boolean;
}
```

## Modal UI

Card structure (mirrors Contrast card):
- Icon: 🎨, heading: "Color Harmony"
- Label (bold) + severity badge (same color logic as contrast card)
- Message text
- Swatch row: up to 6 color circles
  - `beautiful`: all swatches, none flagged
  - `mostly` / `fighting`: clashing swatches get orange ⚠️ ring
  - `too_similar`: all swatches shown, none flagged — message explains
- If `totalChromaticCount > 6`: gray note "Showing 6 of N colors"
- If `isNeutralDominant`: show note "Mostly neutral palette — no strong color conflicts detected" instead of swatches

## Files Changed

1. `src/lib/analysis/patternAnalyzer.ts` — add `ColorHarmonyAnalysis` interface and `analyzeColorHarmony()` function
2. `src/components/analysis/PatternAnalysisModal.tsx` — add `colorHarmonyAnalysis` prop and render the card
3. Parent component(s) that call `analyzeContrast` — also call `analyzeColorHarmony` and pass result to modal

## Severity Mapping

| Band | Severity | Badge color |
|------|----------|-------------|
| `beautiful` | `none` | emerald |
| `mostly` | `info` | blue |
| `fighting` | `warning` | orange |
| `too_similar` | `warning` | orange |
