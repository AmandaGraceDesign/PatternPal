# Composition Analysis Card — Design

Date: 2026-02-17

## Problem

The current composition analyzer almost always returns "all-over" regardless of input. The variance threshold (0.15) for the "all-over" classification is too generous for a 3×3 weight grid, swallowing nearly every tile. The balance formula also lacks radial weighting, and the "asymmetric" band gives no context about *why* the pattern fails.

## Changes

### 1. New Balance Formula

Replace the current `overallBalance`:
```
old: (L/R × 0.4) + (T/B × 0.4) + (1 - variance) × 0.2
new: (L/R × 0.35) + (T/B × 0.35) + (radialBalance × 0.30)
```

**Radial balance** = how evenly weight is distributed between center zone and periphery:
- Center zone = grid[1][1] (single center cell)
- Periphery = sum of all 8 surrounding cells
- `radialBalance = 1 - |centerWeight/totalWeight - 1/9|` (1/9 = ideal even share)

### 2. New Thresholds

| Balance Score | Band | Severity |
|---------------|------|----------|
| > 0.82 | `balanced` | `none` |
| 0.55 – 0.82 | `dynamic` | `info` |
| < 0.55 | `asymmetric` | `warning` |

Old thresholds were 0.7 / 0.4 — too lenient.

### 3. Fixed Distribution Classifier

Tighten thresholds so tiles actually get classified correctly:

| Pattern | Old Threshold | New Threshold |
|---------|--------------|---------------|
| all-over | variance < 0.15 | variance < 0.08 |
| focal-point | centerRatio > 0.4 | centerRatio > 0.25 |
| directional | gradient > 0.7 | gradient > 0.4 |
| structured | symmetry > 0.7 | symmetry > 0.6 |

### 4. Context-Aware Warning Labels

When band = `asymmetric`, instead of generic "Visual weight concentrates in one area," detect WHY:

| Condition | Label | Message |
|-----------|-------|---------|
| centerRatio > 0.25 AND periphery sparse | Isolated motif | Isolated motif — will tile as repeating spots |
| Edge cells dominate (any edge cell > 2× mean) | Edge-heavy | Edge-heavy — may create grid lines when tiled |
| Default asymmetric | Asymmetric | Weight concentrated in one area — may look unbalanced when tiled |

### 5. Copy Updates

For `balanced` and `dynamic` bands, keep distribution pattern labels but update copy to be simpler:

| Band + Pattern | Label | Message | Context Hint |
|---------------|-------|---------|-------------|
| balanced + all-over | Even Distribution | Visual weight is evenly spread — great for seamless repeats. | Works well for fabric yardage and wallpaper. |
| balanced + focal-point | Centered Focal Point | Eye is drawn to a central motif with balanced surroundings. | Beautiful for panels or centered product placement. |
| balanced + directional | Directional Flow | Pattern creates visual movement while staying balanced. | Adds energy without feeling uneven. |
| balanced + structured | Structured Grid | Elements follow a geometric grid with good rhythm. | Creates calm, predictable visual order. |
| balanced + organic | Organic Distribution | Elements are naturally scattered with good overall balance. | Feels relaxed and hand-drawn. |
| dynamic + any | Dynamic Composition | Visual weight is unevenly distributed but creates intentional energy. | Can feel lively — check it reads well at scale. |

## Files Changed

1. `src/lib/analysis/patternAnalyzer.ts`:
   - `analyzeBalanceMetrics()` — add radialBalance, update overallBalance formula
   - `classifyDistributionPattern()` — tighten all thresholds
   - `generateCompositionFeedback()` — new thresholds, new warning labels, updated copy

## Interface

No changes to `CompositionAnalysis` interface — same fields, better data.
