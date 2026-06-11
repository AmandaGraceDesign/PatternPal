# Mockup Crop Anchor + Per-Size Previews Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users pick a Top/Center/Bottom crop anchor per social size and see a live crop-framed thumbnail for each, so mockups like a dress-on-a-hanger can keep the product and drop the hanger.

**Architecture:** A vertical anchor parameter threads through the existing crop helper (`computeCoverCropRect` → `coverCropToBlob` → `exportMockupSocialBlob` → `downloadMockupSocialSizes`), defaulting to `center` so untouched exports are byte-identical. The download UI moves from a pill wrap to per-size rows in a new shared `MockupDownloadMenu` component used by both entry points. Each row's thumbnail is one canvas snapshot CSS-cropped with `background-size:cover` + `background-position` — mathematically identical to the export crop, instant on toggle.

**Tech Stack:** TypeScript, React (Next.js client components), vitest (jsdom), Tailwind utility classes.

**Spec:** [docs/superpowers/specs/2026-06-11-mockup-crop-anchor-design.md](../specs/2026-06-11-mockup-crop-anchor-design.md)

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `src/lib/utils/mockupSocialExport.ts` | `VAnchor` type; anchor in crop geometry + export chain | Modify |
| `src/__tests__/mockupSocialExport.test.ts` | Anchor geometry unit tests | Modify |
| `src/lib/export/socialSizes.ts` | `cropsVertically()` rule — which sizes expose a toggle | Modify |
| `src/__tests__/socialSizes.test.ts` | `cropsVertically()` unit tests | Create |
| `src/components/mockups/MockupDownloadMenu.tsx` | Shared presentational rows + thumbnails + anchor toggle | Create |
| `src/components/sidebar/ActionsSidebar.tsx` | Anchor + snapshot state, reset, capture, render menu | Modify |
| `src/components/layout/AdvancedToolsBar.tsx` | Mirror of the above wiring | Modify |

**Guardrails (from spec):** imports in `mockupSocialExport.ts` stay relative (vitest has no `@/` alias); do not touch `RepeatExportModal` or `SOCIAL_SIZE_PRESETS`; default anchor `center`; per-task gates `npx tsc --noEmit`, `npx vitest run`, `npx eslint <file>`.

---

## Task 1: Anchor geometry in `computeCoverCropRect`

**Files:**
- Modify: `src/lib/utils/mockupSocialExport.ts` (lines ~12–39)
- Test: `src/__tests__/mockupSocialExport.test.ts`

- [ ] **Step 1: Add the failing tests**

Append these cases inside the existing `describe('computeCoverCropRect', …)` block in `src/__tests__/mockupSocialExport.test.ts`:

```ts
  it('anchors a square crop to the TOP (sy = 0)', () => {
    const r = computeCoverCropRect(SRC_W, SRC_H, 1000, 1000, 'top');
    expect(r).toEqual({ sx: 0, sy: 0, sWidth: 3000, sHeight: 3000 });
  });

  it('anchors a square crop to CENTER by default (sy = 750)', () => {
    const r = computeCoverCropRect(SRC_W, SRC_H, 1000, 1000);
    expect(r).toEqual({ sx: 0, sy: 750, sWidth: 3000, sHeight: 3000 });
  });

  it('anchors a square crop to the BOTTOM (sy = srcH - sHeight = 1500)', () => {
    const r = computeCoverCropRect(SRC_W, SRC_H, 1000, 1000, 'bottom');
    expect(r).toEqual({ sx: 0, sy: 1500, sWidth: 3000, sHeight: 3000 });
  });

  it('ignores the anchor when the crop is horizontal (tall target)', () => {
    // 1:2 target crops the SIDES — vertical anchor must be a no-op.
    const r = computeCoverCropRect(SRC_W, SRC_H, 1000, 2000, 'bottom');
    expect(r).toEqual({ sx: 375, sy: 0, sWidth: 2250, sHeight: 4500 });
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/__tests__/mockupSocialExport.test.ts`
Expected: FAIL — `computeCoverCropRect` rejects the 5th argument (TS) / the `'top'`/`'bottom'` cases return `sy: 750`.

- [ ] **Step 3: Add the `VAnchor` type and anchor parameter**

In `src/lib/utils/mockupSocialExport.ts`, add the type above `CoverCropRect` (after the imports, before `export interface CoverCropRect`):

```ts
/** Vertical crop anchor for cover-cropping a portrait mockup into a shorter target.
 *  Only affects sizes whose crop removes top/bottom (square, portrait). */
export type VAnchor = 'top' | 'center' | 'bottom';
```

Replace `computeCoverCropRect` (the function body) with:

```ts
export function computeCoverCropRect(
  srcW: number,
  srcH: number,
  targetW: number,
  targetH: number,
  anchor: VAnchor = 'center',
): CoverCropRect {
  const srcAspect = srcW / srcH;
  const targetAspect = targetW / targetH;

  if (srcAspect > targetAspect) {
    // Source is wider than target -> crop left/right. Vertical anchor is a no-op here.
    const sWidth = Math.round(srcH * targetAspect);
    return { sx: Math.round((srcW - sWidth) / 2), sy: 0, sWidth, sHeight: srcH };
  }
  // Source is taller than (or equal to) target -> crop top/bottom; anchor picks which.
  const sHeight = Math.round(srcW / targetAspect);
  const sy =
    anchor === 'top'    ? 0
    : anchor === 'bottom' ? srcH - sHeight
    : Math.round((srcH - sHeight) / 2);
  return { sx: 0, sy, sWidth: srcW, sHeight };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/__tests__/mockupSocialExport.test.ts`
Expected: PASS — all cases, including the pre-existing ones (default still centers at `sy: 750`).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/utils/mockupSocialExport.ts src/__tests__/mockupSocialExport.test.ts
git commit -m "feat: vertical crop anchor in computeCoverCropRect"
```

---

## Task 2: Thread the anchor through the export chain

**Files:**
- Modify: `src/lib/utils/mockupSocialExport.ts` (`coverCropToBlob`, `MockupSocialOpts`, `exportMockupSocialBlob`)

No new unit test — this code drives a real canvas, which jsdom cannot exercise; correctness is covered by Task 1's geometry tests plus `tsc`. Verified manually in Task 7.

- [ ] **Step 1: Add `anchor` to `coverCropToBlob`**

Replace the `coverCropToBlob` signature and its `computeCoverCropRect` call:

```ts
export async function coverCropToBlob(
  source: HTMLCanvasElement,
  targetW: number,
  targetH: number,
  anchor: VAnchor = 'center',
): Promise<Blob> {
  const r = computeCoverCropRect(source.width, source.height, targetW, targetH, anchor);
```

(Leave the rest of the function unchanged.)

- [ ] **Step 2: Add `anchors` to `MockupSocialOpts`**

Replace the `MockupSocialOpts` interface:

```ts
export interface MockupSocialOpts {
  watermark: WatermarkConfig;
  isPro: boolean;
  badgeEnabled: boolean;
  /** Per-size vertical anchor. Missing slug => 'center'. Ignored by full size and
   *  by sizes whose crop is horizontal. */
  anchors?: Partial<Record<SizeSlug, VAnchor>>;
}
```

Add `SizeSlug` to the existing import from `../export/socialSizes`:

```ts
import { SOCIAL_EXPORT_SCALE, FULL_SIZE_SLUG, type SocialSizePreset, type SizeSlug } from '../export/socialSizes';
```

- [ ] **Step 3: Pass the resolved anchor in `exportMockupSocialBlob`**

In `exportMockupSocialBlob`, replace the `coverCropToBlob` call line:

```ts
  const anchor = opts.anchors?.[preset.slug] ?? 'center';
  let blob = await coverCropToBlob(source, w, h, anchor);
```

(`downloadMockupSocialSizes` already forwards `opts`, and `exportFullSizeMockupBlob` does not crop, so no other change is needed.)

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Run the full unit suite (regression)**

Run: `npx vitest run`
Expected: all green (the prior 58 + the 4 new anchor cases).

- [ ] **Step 6: Commit**

```bash
git add src/lib/utils/mockupSocialExport.ts
git commit -m "feat: thread per-size anchors through mockup export chain"
```

---

## Task 3: `cropsVertically()` rule in `socialSizes`

**Files:**
- Modify: `src/lib/export/socialSizes.ts`
- Test: `src/__tests__/socialSizes.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/socialSizes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  cropsVertically,
  mockupDownloadSizes,
  FULL_SIZE_PRESET,
} from '../lib/export/socialSizes';

describe('cropsVertically', () => {
  const bySlug = (slug: string) =>
    mockupDownloadSizes().find(p => p.slug === slug)!;

  it('is true for square (instagram-post) — crops top/bottom', () => {
    expect(cropsVertically(bySlug('instagram-post'))).toBe(true);
  });

  it('is true for portrait (instagram-portrait)', () => {
    expect(cropsVertically(bySlug('instagram-portrait'))).toBe(true);
  });

  it('is false for pinterest-pin — same 2:3 as source, no crop', () => {
    expect(cropsVertically(bySlug('pinterest-pin'))).toBe(false);
  });

  it('is false for story — crops sides, not top/bottom', () => {
    expect(cropsVertically(bySlug('story'))).toBe(false);
  });

  it('is false for full size — never cropped', () => {
    expect(cropsVertically(FULL_SIZE_PRESET)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/__tests__/socialSizes.test.ts`
Expected: FAIL — `cropsVertically` is not exported.

- [ ] **Step 3: Implement `cropsVertically`**

Append to `src/lib/export/socialSizes.ts`:

```ts
/** Aspect of the full mockup render (3000×4500). */
export const MOCKUP_SRC_ASPECT = 2 / 3;

/** True when cover-cropping this size from the 2:3 mockup removes top/bottom — i.e.
 *  a vertical Top/Center/Bottom anchor changes the output. Square and Portrait only:
 *  Pinterest is the same 2:3 (no crop), Story crops the sides, Full size isn't cropped.
 *  Mirrors the taller-source branch of computeCoverCropRect. */
export function cropsVertically(preset: SocialSizePreset): boolean {
  if (preset.slug === FULL_SIZE_SLUG) return false;
  return MOCKUP_SRC_ASPECT < preset.pxW / preset.pxH;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/__tests__/socialSizes.test.ts`
Expected: PASS — all 5 cases.

- [ ] **Step 5: Commit**

```bash
git add src/lib/export/socialSizes.ts src/__tests__/socialSizes.test.ts
git commit -m "feat: cropsVertically rule for which sizes expose a crop anchor"
```

---

## Task 4: Shared `MockupDownloadMenu` component

**Files:**
- Create: `src/components/mockups/MockupDownloadMenu.tsx`

This is a presentational component: all state lives in the parent. No unit test (presentational React; framing math is already covered by Tasks 1 & 3). Verified by `tsc`/`eslint` here and manually in Task 7.

- [ ] **Step 1: Create the component**

Create `src/components/mockups/MockupDownloadMenu.tsx`:

```tsx
'use client';

import { mockupDownloadSizes, cropsVertically, FULL_SIZE_SLUG, type SizeSlug, type SocialSizePreset } from '@/lib/export/socialSizes';
import type { VAnchor } from '@/lib/utils/mockupSocialExport';

const ANCHOR_POSITION: Record<VAnchor, string> = {
  top: '50% 0%',
  center: '50% 50%',
  bottom: '50% 100%',
};

const ANCHORS: { value: VAnchor; label: string }[] = [
  { value: 'top', label: 'Top' },
  { value: 'center', label: 'Center' },
  { value: 'bottom', label: 'Bottom' },
];

export interface MockupDownloadMenuProps {
  selected: Set<SizeSlug>;
  onToggleSize: (slug: SizeSlug) => void;
  anchors: Record<SizeSlug, VAnchor>;
  onSetAnchor: (slug: SizeSlug, anchor: VAnchor) => void;
  /** Data-URL snapshot of the live mockup canvas; null until first render completes. */
  snapshotUrl: string | null;
  isLocked: (preset: SocialSizePreset) => boolean;
  onLockedClick: () => void;
  isBusy: boolean;
  onDownload: () => void;
}

function rowLabel(preset: SocialSizePreset): string {
  return preset.slug === FULL_SIZE_SLUG
    ? 'Full size'
    : preset.label.replace('Instagram / Facebook ', '');
}

export default function MockupDownloadMenu({
  selected,
  onToggleSize,
  anchors,
  onSetAnchor,
  snapshotUrl,
  isLocked,
  onLockedClick,
  isBusy,
  onDownload,
}: MockupDownloadMenuProps) {
  return (
    <div className="flex flex-col gap-2 border-t border-[#92afa5]/30 pt-3">
      <span className="text-[11px] font-bold uppercase tracking-wide text-[#294051]">
        Download mockup
      </span>

      <div className="flex flex-col">
        {mockupDownloadSizes().map(preset => {
          const locked = isLocked(preset);
          const checked = selected.has(preset.slug);
          const anchor = anchors[preset.slug] ?? 'center';
          const showAnchor = cropsVertically(preset);

          return (
            <div
              key={preset.slug}
              className="flex items-center gap-3 py-2 border-t border-[#f0ece2] first:border-t-0"
            >
              {/* Select toggle (checkbox-as-button for big tap target) */}
              <button
                type="button"
                disabled={isBusy}
                onClick={() => (locked ? onLockedClick() : onToggleSize(preset.slug))}
                aria-pressed={checked}
                aria-label={`${checked ? 'Deselect' : 'Select'} ${rowLabel(preset)}`}
                className={`flex-none w-5 h-5 rounded border-2 flex items-center justify-center text-[12px] ${
                  checked
                    ? 'bg-[#e0c26e] border-[#e0c26e] text-[#294051]'
                    : 'bg-white border-[#cbb37a] text-transparent'
                } disabled:opacity-50`}
                style={{ touchAction: 'manipulation' }}
              >
                {locked ? '🔒' : checked ? '✓' : ''}
              </button>

              {/* Crop-framed thumbnail */}
              <div
                className="flex-none rounded border border-[#cbb37a] bg-[#f4e8c8] overflow-hidden"
                style={{
                  width: 40,
                  aspectRatio: `${preset.pxW} / ${preset.pxH}`,
                  backgroundImage: snapshotUrl ? `url(${snapshotUrl})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: ANCHOR_POSITION[anchor],
                  backgroundRepeat: 'no-repeat',
                }}
                aria-hidden
              />

              {/* Name + dims */}
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-[#294051] truncate">
                  {rowLabel(preset)}
                </div>
                <div className="text-[11px] text-[#9aa3ab] tabular-nums">
                  {preset.pxW}×{preset.pxH}
                </div>
              </div>

              {/* Anchor toggle — only where the crop is vertical */}
              {showAnchor ? (
                <div className="flex-none inline-flex rounded-md border border-[#cbb37a] overflow-hidden">
                  {ANCHORS.map(a => (
                    <button
                      key={a.value}
                      type="button"
                      disabled={isBusy}
                      onClick={() => onSetAnchor(preset.slug, a.value)}
                      aria-pressed={anchor === a.value}
                      className={`text-[11px] px-2.5 py-1.5 font-medium ${
                        anchor === a.value
                          ? 'bg-[#e0c26e] text-[#294051]'
                          : 'bg-white text-[#705046]'
                      } disabled:opacity-50`}
                      style={{ touchAction: 'manipulation' }}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              ) : (
                <span className="flex-none text-[11px] text-[#bdc4ca] pr-1">
                  {preset.slug === FULL_SIZE_SLUG ? 'no crop' : 'no anchor'}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        disabled={selected.size === 0 || isBusy}
        onClick={onDownload}
        className="text-xs rounded-md px-3 py-2 bg-[#294051] text-white font-semibold disabled:opacity-50"
        style={{ touchAction: 'manipulation' }}
      >
        {isBusy
          ? 'Generating…'
          : `Download ${selected.size || ''} file${selected.size === 1 ? '' : 's'}`.replace('  ', ' ')}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/components/mockups/MockupDownloadMenu.tsx`
Expected: no errors, no new warnings.

- [ ] **Step 3: Commit**

```bash
git add src/components/mockups/MockupDownloadMenu.tsx
git commit -m "feat: shared MockupDownloadMenu with per-size crop preview + anchor"
```

---

## Task 5: Wire `MockupDownloadMenu` into `ActionsSidebar`

**Files:**
- Modify: `src/components/sidebar/ActionsSidebar.tsx`

- [ ] **Step 1: Add imports**

Add to the existing imports near the top:

```tsx
import MockupDownloadMenu from '@/components/mockups/MockupDownloadMenu';
import { mockupDownloadSizes, cropsVertically, FULL_SIZE_SLUG, type SizeSlug, type SocialSizePreset } from '@/lib/export/socialSizes';
import type { VAnchor } from '@/lib/utils/mockupSocialExport';
```

(Replace the **existing** `mockupDownloadSizes`/`FULL_SIZE_SLUG`/`SizeSlug` import line so there's no duplicate — fold `cropsVertically` and `SocialSizePreset` into it, and add the `VAnchor` import.)

- [ ] **Step 2: Add anchor + snapshot state and an all-center helper**

Next to the `socialSizes` state declaration, add:

```tsx
const [socialAnchors, setSocialAnchors] = useState<Record<SizeSlug, VAnchor>>(
  () => allCenterAnchors(),
);
const [mockupSnapshotUrl, setMockupSnapshotUrl] = useState<string | null>(null);
```

Add this module-scope helper near `defaultDownloadSelection` (top of file, outside the component):

```tsx
function allCenterAnchors(): Record<SizeSlug, VAnchor> {
  return mockupDownloadSizes().reduce((acc, p) => {
    acc[p.slug] = 'center';
    return acc;
  }, {} as Record<SizeSlug, VAnchor>);
}
```

- [ ] **Step 3: Reset anchors + snapshot on template change**

In the `useEffect` keyed on `[selectedMockup, proAllowed]` (the one that calls `setSocialSizes(defaultDownloadSelection(...))`), add right after that line:

```tsx
    setSocialAnchors(allCenterAnchors());
    setMockupSnapshotUrl(null);
```

- [ ] **Step 4: Reset anchors + snapshot on modal close**

In the `MockupModal` `onClose` handler (where `setSocialSizes(defaultDownloadSelection(...))` is called), add right after it:

```tsx
            setSocialAnchors(allCenterAnchors());
            setMockupSnapshotUrl(null);
```

- [ ] **Step 5: Capture the snapshot in `onRenderComplete`**

In the `MockupRendererV2` `onRenderComplete` callback, after the existing `downloadAfterRenderRef` block, add:

```tsx
                        // Snapshot the preview canvas for the crop thumbnails.
                        // Skip during full-res capture (huge canvas, mid-download).
                        if (!isCapturingFullRes) {
                          const c = document.querySelector(
                            '[data-mockup-modal] .mockup-canvas, [data-mockup-modal] canvas',
                          ) as HTMLCanvasElement | null;
                          if (c) setMockupSnapshotUrl(c.toDataURL('image/png'));
                        }
```

- [ ] **Step 6: Pass anchors into the export call**

In `downloadAfterRenderRef.current`’s call to `downloadMockupSocialSizes`, add `anchors` to the opts object:

```tsx
                    await downloadMockupSocialSizes(
                      mockupCanvas,
                      presets,
                      { watermark, isPro: !!isPro, badgeEnabled, anchors: socialAnchors },
                      baseName,
                    );
```

- [ ] **Step 7: Replace the inline pill menu with the shared component**

Replace the entire `<div className="flex flex-col gap-2 border-t …"> … </div>` download-menu block (the one rendering the pill `mockupDownloadSizes().map(...)` and the Download button) with:

```tsx
                <MockupDownloadMenu
                  selected={socialSizes}
                  onToggleSize={(slug) =>
                    setSocialSizes(prev => {
                      const next = new Set(prev);
                      if (next.has(slug)) next.delete(slug); else next.add(slug);
                      return next;
                    })
                  }
                  anchors={socialAnchors}
                  onSetAnchor={(slug, anchor) =>
                    setSocialAnchors(prev => ({ ...prev, [slug]: anchor }))
                  }
                  snapshotUrl={mockupSnapshotUrl}
                  isLocked={(preset: SocialSizePreset) =>
                    preset.slug === FULL_SIZE_SLUG
                      ? (!isPro && !isFreeMockup(selectedMockup))
                      : (!isPro && !isFreeSocialSize(preset.slug))
                  }
                  onLockedClick={() => setIsUpgradeModalOpen(true)}
                  isBusy={isCapturingFullRes}
                  onDownload={onDownloadExport}
                />
```

Note: `onDownloadExport` is the function currently defined inline in the `(() => { … })()` IIFE wrapping the menu. Lift its body so it is a plain `const onDownloadExport = async () => { … }` in the same JSX scope (or hoist into the component body) and delete the IIFE wrapper, so the component can receive it as a prop.

- [ ] **Step 8: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/components/sidebar/ActionsSidebar.tsx`
Expected: no errors, no new warnings. If `isFreeSocialSize`/`isFreeMockup` show as unused elsewhere, they are still used here — keep them.

- [ ] **Step 9: Commit**

```bash
git add src/components/sidebar/ActionsSidebar.tsx
git commit -m "feat: per-size crop anchor + previews in ActionsSidebar download menu"
```

---

## Task 6: Mirror the wiring into `AdvancedToolsBar`

**Files:**
- Modify: `src/components/layout/AdvancedToolsBar.tsx`

This repeats Task 5 against the mirror entry point. The two files must stay identical in this region (the recurring parity lesson). Apply the **same** Steps 1–7 as Task 5, adapting to this file's local variable names (`v2Template`, the `onDownloadExport` at line ~488, the `onRenderComplete` at line ~843, the menu block at lines ~730–782).

- [ ] **Step 1: Add the same imports** (Task 5 Step 1) — fold `cropsVertically`, `SocialSizePreset`, add `VAnchor` and `MockupDownloadMenu`.

- [ ] **Step 2: Add `socialAnchors` + `mockupSnapshotUrl` state and the `allCenterAnchors()` module helper** (Task 5 Step 2), placed next to this file's `socialSizes` state (line ~168).

- [ ] **Step 3: Reset on template change** — in the `[selectedMockup, proAllowed]` effect (line ~187, after `setSocialSizes(defaultDownloadSelection(...))`), add:

```tsx
    setSocialAnchors(allCenterAnchors());
    setMockupSnapshotUrl(null);
```

- [ ] **Step 4: Reset on modal close** — add the same two lines after this file's `setSocialSizes(defaultDownloadSelection(...))` in the close handler.

- [ ] **Step 5: Capture snapshot** — in `onRenderComplete` (line ~843), after the `downloadAfterRenderRef` block, add the same snapshot capture from Task 5 Step 5.

- [ ] **Step 6: Pass `anchors: socialAnchors`** into this file's `downloadMockupSocialSizes` opts (inside `downloadAfterRenderRef.current`, near line ~511).

- [ ] **Step 7: Replace the pill menu block** (lines ~730–782) with the `<MockupDownloadMenu … />` usage from Task 5 Step 7, using this file's `onDownloadExport` (line ~488) and the same `isLocked`/`onLockedClick`/`isBusy` props. Note: this file gates `WatermarkPanel` behind `isPro` — leave that untouched; only the download-menu block changes.

- [ ] **Step 8: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/components/layout/AdvancedToolsBar.tsx`
Expected: no errors, no new warnings.

- [ ] **Step 9: Diff the two menus for parity**

Run: `git diff --no-index <(sed -n '/MockupDownloadMenu/,/\/>/p' src/components/sidebar/ActionsSidebar.tsx) <(sed -n '/MockupDownloadMenu/,/\/>/p' src/components/layout/AdvancedToolsBar.tsx) || true`
Expected: the `<MockupDownloadMenu … />` prop blocks are identical (any difference should be only in surrounding local variable names, not the menu usage).

- [ ] **Step 10: Commit**

```bash
git add src/components/layout/AdvancedToolsBar.tsx
git commit -m "feat: per-size crop anchor + previews in AdvancedToolsBar download menu"
```

---

## Task 7: Full gate + manual verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full gate**

Run: `npx tsc --noEmit && npx vitest run && npx eslint src/lib/utils/mockupSocialExport.ts src/lib/export/socialSizes.ts src/components/mockups/MockupDownloadMenu.tsx src/components/sidebar/ActionsSidebar.tsx src/components/layout/AdvancedToolsBar.tsx`
Expected: tsc clean; vitest green (prior 58 + 4 anchor + 5 cropsVertically = 67); eslint no new warnings.

- [ ] **Step 2: Manual — desktop**

Run the app. Open a mockup (ideally a dress-on-hanger template). In the Download menu:
- Confirm each size shows a thumbnail; Full size shows "no crop", Story "no anchor", Pinterest "no anchor"; Square and Portrait show Top/Center/Bottom.
- Set Square → **Bottom**. Confirm its thumbnail reframes lower (hem kept, hanger dropped) instantly.
- Download Square; confirm the PNG matches the thumbnail framing.
- Confirm Full size still downloads unchanged.

- [ ] **Step 3: Manual — iPad**

On iPad (touch): confirm the Top/Center/Bottom buttons and the row select toggle respond to taps (no hover dependence), targets are comfortable, and toggling an anchor updates the thumbnail.

- [ ] **Step 4: Manual — both entry points match**

Open the mockup from both the ActionsSidebar path and the AdvancedToolsBar path; confirm the Download menu looks and behaves identically.

- [ ] **Step 5: Final commit (if any verification tweaks were needed)**

```bash
git add -A
git commit -m "fix: crop-anchor verification adjustments"
```

(Skip if Steps 1–4 passed with no changes.)

---

## Notes for the implementer

- **Why default `center` everywhere:** anyone who never touches a toggle gets byte-identical exports to today — this is the safety guarantee in the spec.
- **Why the thumbnail can't drift from the export:** `background-size:cover` + a percentage `background-position` is the exact CSS equivalent of `computeCoverCropRect`'s cover math. Top=`0%`, Center=`50%`, Bottom=`100%` map to `sy` 0 / `(srcH-sHeight)/2` / `srcH-sHeight`.
- **Snapshot timing:** `onRenderComplete` fires after each preview render; we snapshot then, skipping the full-res capture render. State resets (null) on template change and close so a stale product never shows.
- **Parity is load-bearing:** Tasks 5 and 6 are deliberately the same change twice. Keep the `<MockupDownloadMenu>` usage identical between the two files.
