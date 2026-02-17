# Composition Analysis Card Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the composition analyzer so it accurately classifies distribution patterns and provides context-aware warnings.

**Architecture:** All changes are in `src/lib/analysis/patternAnalyzer.ts`. Three functions are updated: `analyzeBalanceMetrics`, `classifyDistributionPattern`, and `generateCompositionFeedback`. No interface changes needed.

**Tech Stack:** TypeScript, canvas pixel sampling

---

### Task 1: Update `analyzeBalanceMetrics` with radial balance

**Files:**
- Modify: `src/lib/analysis/patternAnalyzer.ts:435-494`

**Changes:**
1. Add `radialBalance` calculation after centerRatio:
   - Ideal center share = 1/9 (~0.111)
   - radialBalance = 1 - abs(centerWeight/totalWeight - 1/9) * 9  (clamped 0-1)
2. Update `overallBalance` formula:
   - Old: `(leftRightBalance * 0.4) + (topBottomBalance * 0.4) + (1 - min(1, variance)) * 0.2`
   - New: `(leftRightBalance * 0.35) + (topBottomBalance * 0.35) + (radialBalance * 0.30)`
3. Add `radialBalance` to the return type

### Task 2: Fix `classifyDistributionPattern` thresholds

**Files:**
- Modify: `src/lib/analysis/patternAnalyzer.ts:601-632`

**Changes:**
1. all-over: `variance < 0.15` → `variance < 0.08`
2. focal-point: `centerRatio > 0.4` → `centerRatio > 0.25`
3. directional: `maxGradient > 0.7` → `maxGradient > 0.4`
4. structured: `symmetryScore > 0.7` → `symmetryScore > 0.6`

### Task 3: Rewrite `generateCompositionFeedback`

**Files:**
- Modify: `src/lib/analysis/patternAnalyzer.ts:637-717`

**Changes:**
1. Update band thresholds:
   - balanced: > 0.82 (was 0.7)
   - dynamic: 0.55–0.82 (was 0.4–0.7)
   - asymmetric: < 0.55 (was < 0.4)

2. For `balanced` band, use pattern-specific copy (simplified):
   - all-over: "Even Distribution" / "Visual weight is evenly spread — great for seamless repeats."
   - focal-point: "Centered Focal Point" / "Eye is drawn to a central motif with balanced surroundings."
   - directional: "Directional Flow" / "Pattern creates visual movement while staying balanced."
   - structured: "Structured Grid" / "Elements follow a geometric grid with good rhythm."
   - organic: "Organic Distribution" / "Elements are naturally scattered with good overall balance."

3. For `dynamic` band:
   - "Dynamic Composition" / "Visual weight is unevenly distributed but creates intentional energy."
   - contextHint: "Can feel lively — check it reads well at scale."

4. For `asymmetric` band, detect WHY with context-aware warnings:
   - If centerRatio > 0.25 and periphery is sparse: "Isolated motif — will tile as repeating spots"
   - If any edge cell > 2× mean weight: "Edge-heavy — may create grid lines when tiled"
   - Default: "Weight concentrated in one area — may look unbalanced when tiled"
