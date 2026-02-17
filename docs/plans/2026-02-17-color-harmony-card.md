# Color Harmony Card Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Color Harmony analysis card to the Pattern Analysis modal that scores how well the pattern's colors work together, displays chromatic color swatches, and flags clashing pairs visually.

**Architecture:** A new `analyzeColorHarmony()` function in `patternAnalyzer.ts` reuses the existing k-means color extraction, filters neutrals, then scores hue spread and clash zones. The result is passed as a new prop through two parent components (`AdvancedToolsBar`, `ActionsSidebar`) into `PatternAnalysisModal`, which renders the new card below the existing Contrast card.

**Tech Stack:** TypeScript, React, Tailwind CSS. No new dependencies. Canvas/ImageData pixel analysis (already in use).

---

## Design Reference

See `docs/plans/2026-02-17-color-harmony-card-design.md` for full algorithm details and copy.

### Four bands at a glance

| Band | Label | Message | Severity | Swatches flagged? |
|------|-------|---------|----------|-------------------|
| `beautiful` | Colors work beautifully together | Your palette has a natural balance that feels intentional. | `none` | None |
| `mostly` | Colors mostly work | A few combinations might create visual tension — worth a second look. | `info` | Clash pairs |
| `fighting` | Colors are fighting each other | Some hues compete for attention in a way that feels unintentional. | `warning` | Clash pairs |
| `too_similar` | Too similar to read as separate colors | Your palette may blend into a single muddy tone on fabric. | `warning` | None (message does the work) |

---

## Task 1: Add `ColorHarmonyAnalysis` interface and `analyzeColorHarmony()` to patternAnalyzer.ts

**Files:**
- Modify: `src/lib/analysis/patternAnalyzer.ts`

**Step 1: Add the interface**

After the existing `CompositionAnalysis` interface (around line 28), add:

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

**Step 2: Add helper — RGB to HSL**

After the existing `getSaturation` helper (around line 340), add:

```typescript
/**
 * Convert RGB to HSL. Returns hue in degrees [0, 360), saturation [0,1], lightness [0,1].
 */
function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;
  const l = (max + min) / 2;

  if (delta === 0) return { h: 0, s: 0, l };

  const s = delta / (1 - Math.abs(2 * l - 1));

  let h = 0;
  if (max === rNorm) {
    h = ((gNorm - bNorm) / delta) % 6;
  } else if (max === gNorm) {
    h = (bNorm - rNorm) / delta + 2;
  } else {
    h = (rNorm - gNorm) / delta + 4;
  }
  h = ((h * 60) + 360) % 360;

  return { h, s, l };
}
```

**Step 3: Add helper — circular hue distance**

Immediately after `rgbToHsl`:

```typescript
/**
 * Circular angular distance between two hues (degrees). Always returns 0–180.
 */
function hueDistance(h1: number, h2: number): number {
  const diff = Math.abs(h1 - h2);
  return Math.min(diff, 360 - diff);
}
```

**Step 4: Add `analyzeColorHarmony()` function**

After `analyzeComposition` at the end of the file, add:

```typescript
/**
 * Analyze color harmony of a pattern based on hue relationships.
 * Contrast and harmony are independent: harmonious colors can still have poor contrast.
 */
export function analyzeColorHarmony(
  image: HTMLImageElement
): ColorHarmonyAnalysis {
  const canvas = document.createElement('canvas');
  const maxSampleSize = 500;
  const scale = Math.min(1, maxSampleSize / Math.max(image.width, image.height));
  canvas.width = Math.floor(image.width * scale);
  canvas.height = Math.floor(image.height * scale);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const dominantColors = extractDominantColors(imageData, 6);

  // Convert to HSL and filter out neutrals
  const withHsl = dominantColors.map(c => ({
    ...c,
    ...rgbToHsl(c.r, c.g, c.b),
  }));

  const chromatic = withHsl.filter(
    c => c.s >= 0.15 && c.l >= 0.1 && c.l <= 0.9
  );

  const totalChromaticCount = chromatic.length;
  const isNeutralDominant = totalChromaticCount < 2;

  if (isNeutralDominant) {
    return {
      band: 'beautiful',
      severity: 'none',
      label: 'Colors work beautifully together',
      message: 'Your palette has a natural balance that feels intentional.',
      chromaticColors: chromatic.slice(0, 6).map(c => ({
        r: c.r, g: c.g, b: c.b, hue: c.h, isClashing: false,
      })),
      totalChromaticCount,
      isNeutralDominant: true,
    };
  }

  // Cap at 6 for scoring and display (already sorted by count from extractDominantColors)
  const top = chromatic.slice(0, 6);

  // Find clashing pairs (25–60° apart)
  const clashingIndices = new Set<number>();
  let totalDist = 0;
  let pairCount = 0;

  for (let i = 0; i < top.length; i++) {
    for (let j = i + 1; j < top.length; j++) {
      const dist = hueDistance(top[i].h, top[j].h);
      totalDist += dist;
      pairCount++;
      if (dist >= 25 && dist <= 60) {
        clashingIndices.add(i);
        clashingIndices.add(j);
      }
    }
  }

  const meanSpread = pairCount > 0 ? totalDist / pairCount : 0;
  const hasClashes = clashingIndices.size > 0;

  // Determine band
  let band: ColorHarmonyAnalysis['band'];
  if (meanSpread < 25) {
    band = 'too_similar';
  } else if (hasClashes) {
    band = 'fighting';
  } else if (meanSpread > 80) {
    band = 'beautiful';
  } else {
    band = 'mostly';
  }

  // For too_similar: don't flag individual swatches
  const flagSwatches = band !== 'too_similar' && band !== 'beautiful';

  const bandCopy: Record<ColorHarmonyAnalysis['band'], { label: string; message: string; severity: ColorHarmonyAnalysis['severity'] }> = {
    beautiful: {
      label: 'Colors work beautifully together',
      message: 'Your palette has a natural balance that feels intentional.',
      severity: 'none',
    },
    mostly: {
      label: 'Colors mostly work',
      message: 'A few combinations might create visual tension — worth a second look.',
      severity: 'info',
    },
    fighting: {
      label: 'Colors are fighting each other',
      message: 'Some hues compete for attention in a way that feels unintentional.',
      severity: 'warning',
    },
    too_similar: {
      label: 'Too similar to read as separate colors',
      message: 'Your palette may blend into a single muddy tone on fabric.',
      severity: 'warning',
    },
  };

  const { label, message, severity } = bandCopy[band];

  return {
    band,
    severity,
    label,
    message,
    chromaticColors: top.map((c, i) => ({
      r: c.r,
      g: c.g,
      b: c.b,
      hue: c.h,
      isClashing: flagSwatches && clashingIndices.has(i),
    })),
    totalChromaticCount,
    isNeutralDominant: false,
  };
}
```

**Step 5: Verify TypeScript compiles**

```bash
cd /Users/amandacorcoran/Documents/patternpal-pro && npx tsc --noEmit
```

Expected: no errors related to `patternAnalyzer.ts`.

**Step 6: Commit**

```bash
git add src/lib/analysis/patternAnalyzer.ts
git commit -m "feat: add analyzeColorHarmony() and ColorHarmonyAnalysis interface"
```

---

## Task 2: Wire up `analyzeColorHarmony` in `AdvancedToolsBar.tsx`

**Files:**
- Modify: `src/components/layout/AdvancedToolsBar.tsx`

**Step 1: Update the import**

Find (line ~14):
```typescript
import { analyzeContrast, analyzeComposition, ContrastAnalysis, CompositionAnalysis } from '@/lib/analysis/patternAnalyzer';
```

Replace with:
```typescript
import { analyzeContrast, analyzeComposition, analyzeColorHarmony, ContrastAnalysis, CompositionAnalysis, ColorHarmonyAnalysis } from '@/lib/analysis/patternAnalyzer';
```

**Step 2: Add state**

Find the existing state declarations for `contrastAnalysis` and `compositionAnalysis` and add alongside them:
```typescript
const [colorHarmonyAnalysis, setColorHarmonyAnalysis] = useState<ColorHarmonyAnalysis | null>(null);
```

**Step 3: Call the function in the analysis effect**

Find (lines ~162–165):
```typescript
const contrast = analyzeContrast(image, 'unspecified');
const composition = analyzeComposition(image, 'unspecified');
setContrastAnalysis(contrast);
setCompositionAnalysis(composition);
```

Replace with:
```typescript
const contrast = analyzeContrast(image, 'unspecified');
const composition = analyzeComposition(image, 'unspecified');
const harmony = analyzeColorHarmony(image);
setContrastAnalysis(contrast);
setCompositionAnalysis(composition);
setColorHarmonyAnalysis(harmony);
```

**Step 4: Pass the new prop to `PatternAnalysisModal`**

Find the `<PatternAnalysisModal` render (lines ~267–276) and add:
```typescript
colorHarmonyAnalysis={colorHarmonyAnalysis}
```

**Step 5: Verify TypeScript compiles**

```bash
cd /Users/amandacorcoran/Documents/patternpal-pro && npx tsc --noEmit
```

Expected: error about `colorHarmonyAnalysis` not being a valid prop on `PatternAnalysisModal` — that's fine, we'll fix it in Task 4.

**Step 6: Commit**

```bash
git add src/components/layout/AdvancedToolsBar.tsx
git commit -m "feat: wire analyzeColorHarmony in AdvancedToolsBar"
```

---

## Task 3: Wire up `analyzeColorHarmony` in `ActionsSidebar.tsx`

**Files:**
- Modify: `src/components/sidebar/ActionsSidebar.tsx`

Same three changes as Task 2, applied to `ActionsSidebar.tsx`:

**Step 1: Update the import** (line ~5) — same replacement as Task 2 Step 1.

**Step 2: Add state** — same `colorHarmonyAnalysis` useState as Task 2 Step 2.

**Step 3: Call the function** (lines ~139–143) — same addition as Task 2 Step 3.

**Step 4: Pass the new prop** (lines ~258–267) — add `colorHarmonyAnalysis={colorHarmonyAnalysis}`.

**Step 5: Verify TypeScript compiles**

```bash
cd /Users/amandacorcoran/Documents/patternpal-pro && npx tsc --noEmit
```

**Step 6: Commit**

```bash
git add src/components/sidebar/ActionsSidebar.tsx
git commit -m "feat: wire analyzeColorHarmony in ActionsSidebar"
```

---

## Task 4: Add Color Harmony card to `PatternAnalysisModal.tsx`

**Files:**
- Modify: `src/components/analysis/PatternAnalysisModal.tsx`

**Step 1: Update the import**

Find:
```typescript
import { ContrastAnalysis, CompositionAnalysis } from '@/lib/analysis/patternAnalyzer';
```

Replace with:
```typescript
import { ContrastAnalysis, CompositionAnalysis, ColorHarmonyAnalysis } from '@/lib/analysis/patternAnalyzer';
```

**Step 2: Add prop to interface**

Find `PatternAnalysisModalProps` interface and add:
```typescript
colorHarmonyAnalysis: ColorHarmonyAnalysis | null;
```

**Step 3: Destructure the new prop**

Add `colorHarmonyAnalysis` to the destructured props in the function signature.

**Step 4: Add the Color Harmony card (Pro section)**

After the closing `</div>` of the Composition Analysis card (around line 191), and before the `{!contrastAnalysis && !compositionAnalysis &&` fallback, add:

```tsx
{/* Color Harmony Analysis */}
{colorHarmonyAnalysis && (
  <div className="p-4 bg-white border border-[#e5e7eb] rounded-lg">
    <div className="flex items-center gap-2 mb-2">
      <span className="text-lg">🎨</span>
      <span className="text-sm font-semibold text-[#294051]">Color Harmony</span>
    </div>
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs font-semibold text-[#294051]">
        {colorHarmonyAnalysis.label}
      </span>
      <span className={`px-2 py-0.5 text-[10px] font-medium rounded uppercase ${
        colorHarmonyAnalysis.severity === 'none' ? 'bg-emerald-100 text-emerald-700' :
        colorHarmonyAnalysis.severity === 'info' ? 'bg-blue-100 text-blue-700' :
        'bg-orange-100 text-orange-700'
      }`}>
        {colorHarmonyAnalysis.band === 'too_similar' ? 'TOO SIMILAR' :
         colorHarmonyAnalysis.band === 'beautiful' ? 'HARMONIOUS' :
         colorHarmonyAnalysis.band === 'mostly' ? 'MOSTLY' : 'CLASHING'}
      </span>
    </div>
    <p className="text-sm text-[#374151] leading-relaxed mb-3">
      {colorHarmonyAnalysis.message}
    </p>

    {/* Swatches */}
    {colorHarmonyAnalysis.isNeutralDominant ? (
      <p className="text-xs text-[#6b7280] italic">
        Mostly neutral palette — no strong color conflicts detected.
      </p>
    ) : (
      <>
        <div className="flex items-center gap-2 flex-wrap">
          {colorHarmonyAnalysis.chromaticColors.map((color, i) => (
            <div
              key={i}
              className="relative"
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
              {color.isClashing && (
                <span className="absolute -top-1 -right-1 text-[10px] leading-none">⚠️</span>
              )}
            </div>
          ))}
        </div>
        {colorHarmonyAnalysis.totalChromaticCount > 6 && (
          <p className="text-[10px] text-[#9ca3af] mt-2">
            Showing 6 of {colorHarmonyAnalysis.totalChromaticCount} colors
          </p>
        )}
      </>
    )}
  </div>
)}
```

**Step 5: Update the fallback condition**

Find:
```typescript
{!contrastAnalysis && !compositionAnalysis && (
```

Replace with:
```typescript
{!contrastAnalysis && !compositionAnalysis && !colorHarmonyAnalysis && (
```

**Step 6: Also add a blurred preview for non-Pro users**

In the non-Pro blurred preview section, after the blurred Composition preview div (around line 109), add a third blurred card:

```tsx
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
```

**Step 7: Verify TypeScript compiles cleanly**

```bash
cd /Users/amandacorcoran/Documents/patternpal-pro && npx tsc --noEmit
```

Expected: no errors.

**Step 8: Commit**

```bash
git add src/components/analysis/PatternAnalysisModal.tsx
git commit -m "feat: add Color Harmony card to PatternAnalysisModal"
```

---

## Task 5: Smoke test in browser

**Step 1: Start dev server**

```bash
cd /Users/amandacorcoran/Documents/patternpal-pro && npm run dev
```

**Step 2: Manual checks**

Upload a pattern tile and open Pattern Analysis. Verify:

- [ ] Color Harmony card appears below Contrast card
- [ ] Swatches are visible and the right colors
- [ ] A high-contrast multicolor tile (e.g. red + blue + green) shows clash flags
- [ ] A tonal/monochrome tile shows "Too similar" message with no swatch flags
- [ ] A neutral-dominant tile (grays + cream) shows "Mostly neutral palette" note
- [ ] Non-Pro modal shows three blurred preview cards
- [ ] No console errors

**Step 3: Final commit if any tweaks needed**

```bash
git add -p
git commit -m "fix: color harmony card tweaks from smoke test"
```
