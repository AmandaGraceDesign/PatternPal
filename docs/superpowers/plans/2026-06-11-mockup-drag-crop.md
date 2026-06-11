# Drag-to-crop Mockup Framing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Top/Center/Bottom preset toggle with a continuous, draggable crop box (Square + Portrait only) so the user can position the product exactly, and fold in bigger row thumbnails + removal of the redundant bottom preview.

**Architecture:** The crop "anchor" becomes a numeric vertical offset `0..1` (0.5 = center = backwards-compatible). The export library threads that number through unchanged. A new `MockupCropStage` component renders the live mockup snapshot with a dimmed overlay and a draggable crop box (Pointer Events, iPad-safe). The shared `MockupDownloadMenu` gains an "active size" and embeds the stage; the bottom `MockupRendererV2` preview stays mounted as the snapshot source but is visually hidden.

**Tech Stack:** React + TypeScript, Vitest, Pointer Events API, Tailwind. Canvas cover-crop export (existing).

**Spec:** `docs/superpowers/specs/2026-06-11-mockup-drag-crop-design.md`

---

## Build state between tasks

This is a coordinated rename (`VAnchor` enum → numeric offset) that touches one lib
module, one shared component, and two large consumers. **Project-wide `tsc` is
expected to be RED from Task 2 through Task 5** because the consumers still pass the
old `anchors`/`onSetAnchor` props until they are rewritten. Each task has its own
narrower verification (Vitest for the lib, render checks for UI). The full green gate
(`tsc` + `vitest` + `eslint`) is **Task 6**. Do not panic about interim type errors
that are explicitly listed as expected.

## File structure

| File | Responsibility | Change |
|------|----------------|--------|
| `src/lib/utils/mockupSocialExport.ts` | cover-crop + export chain | Modify — offset replaces `VAnchor` |
| `src/__tests__/mockupSocialExport.test.ts` | crop-math unit tests | Modify — offset cases |
| `src/components/mockups/MockupCropStage.tsx` | draggable crop box over snapshot | **Create** |
| `src/components/mockups/MockupDownloadMenu.tsx` | size rows + active size + stage | Modify — offsets, bigger thumbs, embed stage |
| `src/components/sidebar/ActionsSidebar.tsx` | consumer #1 | Modify — offsets state, hide bottom preview |
| `src/components/layout/AdvancedToolsBar.tsx` | consumer #2 (mirror) | Modify — same as #1 |

`src/lib/export/socialSizes.ts#cropsVertically` is **unchanged** — it already returns
`true` for exactly Square + Portrait, which are the drag-eligible sizes. The cosmetic
non-2:3-template note from the prior handoff stays out of scope.

---

## Task 1: Numeric offset in the export library

**Files:**
- Modify: `src/lib/utils/mockupSocialExport.ts`
- Test: `src/__tests__/mockupSocialExport.test.ts`

- [ ] **Step 1: Update the unit tests to the offset API (write the failing test)**

Replace the three anchor tests (lines 30–49) in `src/__tests__/mockupSocialExport.test.ts` with offset-based cases. Keep the four existing aspect tests (lines 9–28) exactly as they are — they call `computeCoverCropRect` with no 5th arg and must still pass (default 0.5 = center).

```ts
  it('offset 0 keeps the TOP band of a square crop (sy = 0)', () => {
    const r = computeCoverCropRect(SRC_W, SRC_H, 1000, 1000, 0);
    expect(r).toEqual({ sx: 0, sy: 0, sWidth: 3000, sHeight: 3000 });
  });

  it('offset 0.5 (default) centers a square crop (sy = 750)', () => {
    expect(computeCoverCropRect(SRC_W, SRC_H, 1000, 1000, 0.5))
      .toEqual({ sx: 0, sy: 750, sWidth: 3000, sHeight: 3000 });
    // omitting the arg must match the explicit 0.5
    expect(computeCoverCropRect(SRC_W, SRC_H, 1000, 1000))
      .toEqual(computeCoverCropRect(SRC_W, SRC_H, 1000, 1000, 0.5));
  });

  it('offset 1 keeps the BOTTOM band of a square crop (sy = 1500)', () => {
    const r = computeCoverCropRect(SRC_W, SRC_H, 1000, 1000, 1);
    expect(r).toEqual({ sx: 0, sy: 1500, sWidth: 3000, sHeight: 3000 });
  });

  it('offset interpolates continuously (0.25 → sy = 375)', () => {
    const r = computeCoverCropRect(SRC_W, SRC_H, 1000, 1000, 0.25);
    expect(r).toEqual({ sx: 0, sy: 375, sWidth: 3000, sHeight: 3000 });
  });

  it('clamps out-of-range offsets into [0,1]', () => {
    expect(computeCoverCropRect(SRC_W, SRC_H, 1000, 1000, -1).sy).toBe(0);
    expect(computeCoverCropRect(SRC_W, SRC_H, 1000, 1000, 2).sy).toBe(1500);
  });

  it('ignores the offset when the crop is horizontal (tall target)', () => {
    // 1:2 target crops the SIDES — vertical offset must be a no-op.
    const r = computeCoverCropRect(SRC_W, SRC_H, 1000, 2000, 1);
    expect(r).toEqual({ sx: 375, sy: 0, sWidth: 2250, sHeight: 4500 });
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/__tests__/mockupSocialExport.test.ts`
Expected: FAIL — the new offset cases error/typecheck against the current `VAnchor` signature.

- [ ] **Step 3: Replace `VAnchor` with a numeric offset in the library**

In `src/lib/utils/mockupSocialExport.ts`:

Delete the `VAnchor` type (lines 12–14) and replace `computeCoverCropRect` (lines 27–49) with:

```ts
/** Clamp helper for the 0..1 vertical crop offset. */
const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

/** Cover crop: the largest sub-rectangle of the source that has the target's aspect
 *  ratio. `offset` (0..1) places that rectangle vertically when the source is taller
 *  than the target (square/portrait targets): 0 = top, 0.5 = center, 1 = bottom.
 *  It is a no-op when the source is wider than the target (the crop is horizontal). */
export function computeCoverCropRect(
  srcW: number,
  srcH: number,
  targetW: number,
  targetH: number,
  offset = 0.5,
): CoverCropRect {
  const srcAspect = srcW / srcH;
  const targetAspect = targetW / targetH;

  if (srcAspect > targetAspect) {
    // Source is wider than target -> crop left/right. Vertical offset is a no-op here.
    const sWidth = Math.round(srcH * targetAspect);
    return { sx: Math.round((srcW - sWidth) / 2), sy: 0, sWidth, sHeight: srcH };
  }
  // Source is taller than (or equal to) target -> crop top/bottom; offset picks which.
  const sHeight = Math.round(srcW / targetAspect);
  const sy = Math.round((srcH - sHeight) * clamp01(offset));
  return { sx: 0, sy, sWidth: srcW, sHeight };
}
```

Update `coverCropToBlob` (lines 52–58): rename the `anchor: VAnchor = 'center'`
parameter to `offset = 0.5` and pass `offset` into `computeCoverCropRect`:

```ts
export async function coverCropToBlob(
  source: HTMLCanvasElement,
  targetW: number,
  targetH: number,
  offset = 0.5,
): Promise<Blob> {
  const r = computeCoverCropRect(source.width, source.height, targetW, targetH, offset);
```

(Leave the rest of `coverCropToBlob`'s body unchanged.)

Update `MockupSocialOpts` (lines 75–82): replace the `anchors` field:

```ts
export interface MockupSocialOpts {
  watermark: WatermarkConfig;
  isPro: boolean;
  badgeEnabled: boolean;
  /** Per-size vertical crop offset 0..1 (0.5 = center). Missing slug => 0.5.
   *  Ignored by full size and by sizes whose crop is horizontal. */
  offsets?: Partial<Record<SizeSlug, number>>;
}
```

Update `exportMockupSocialBlob` (line 92): replace the anchor lookup:

```ts
  const offset = opts.offsets?.[preset.slug] ?? 0.5;
  let blob = await coverCropToBlob(source, w, h, offset);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/__tests__/mockupSocialExport.test.ts`
Expected: PASS — all aspect tests + new offset tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/mockupSocialExport.ts src/__tests__/mockupSocialExport.test.ts
git commit -m "feat: numeric vertical crop offset replaces VAnchor enum"
```

---

## Task 2: MockupCropStage component

**Files:**
- Create: `src/components/mockups/MockupCropStage.tsx`

A presentational, controlled component: it shows the mockup snapshot, a dimmed
overlay, and (for vertically-cropping sizes) a draggable crop box. Drag updates a
`0..1` offset via `onChangeOffset`. Pointer Events + `touch-action: none` make it work
identically with mouse, finger, and Pencil.

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { useRef } from 'react';
import { cropsVertically, FULL_SIZE_SLUG, type SocialSizePreset } from '@/lib/export/socialSizes';

export interface MockupCropStageProps {
  /** Data-URL snapshot of the live mockup canvas; null until first render. */
  snapshotUrl: string | null;
  /** The size currently being framed. */
  preset: SocialSizePreset;
  /** Current vertical offset 0..1 for this size (0.5 = center). */
  offset: number;
  /** Called with the new clamped offset as the user drags. */
  onChangeOffset: (next: number) => void;
  isBusy: boolean;
}

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

export default function MockupCropStage({
  snapshotUrl,
  preset,
  offset,
  onChangeOffset,
  isBusy,
}: MockupCropStageProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const draggable = cropsVertically(preset);

  // The crop box keeps full source WIDTH and has the target's aspect, so its
  // height as a fraction of the (2:3) snapshot height is what slides vertically.
  // boxHeightFraction = (snapshotAspect) / (targetAspect)
  //   snapshotAspect = srcW/srcH (≈0.667 for the 2:3 render)
  //   targetAspect   = preset.pxW/preset.pxH
  // We don't know srcW/srcH here, but the snapshot is the 2:3 render, so use 2/3.
  const SNAP_ASPECT = 2 / 3;
  const targetAspect = preset.pxW / preset.pxH;
  const boxHeightFraction = draggable ? clamp01(SNAP_ASPECT / targetAspect) : 1;
  const travel = 1 - boxHeightFraction; // fraction of stage height the box can move
  const boxTopFraction = travel * clamp01(offset);

  function offsetFromClientY(clientY: number): number {
    const el = frameRef.current;
    if (!el || travel <= 0) return offset;
    const rect = el.getBoundingClientRect();
    // Position the box so its CENTER tracks the pointer, then convert to offset.
    const boxH = boxHeightFraction * rect.height;
    const top = clamp01((clientY - rect.top - boxH / 2) / rect.height);
    return clamp01(top / travel);
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (!draggable || isBusy) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    onChangeOffset(offsetFromClientY(e.clientY));
  }
  function handlePointerMove(e: React.PointerEvent) {
    if (!draggable || isBusy) return;
    if (e.buttons === 0) return; // not dragging
    onChangeOffset(offsetFromClientY(e.clientY));
  }

  if (!snapshotUrl) {
    return (
      <div className="flex items-center justify-center rounded-lg bg-[#f4e8c8] text-[12px] text-[#9aa3ab]"
           style={{ aspectRatio: '2 / 3', width: 240 }}>
        Rendering preview…
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        ref={frameRef}
        className="relative overflow-hidden rounded-lg select-none"
        style={{
          width: 240,
          aspectRatio: '2 / 3',
          backgroundImage: `url(${snapshotUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          touchAction: 'none',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
      >
        {draggable ? (
          <>
            {/* dim above + below the box */}
            <div className="absolute left-0 right-0 top-0 bg-[#294051]/45"
                 style={{ height: `${boxTopFraction * 100}%` }} />
            <div className="absolute left-0 right-0 bottom-0 bg-[#294051]/45"
                 style={{ height: `${(travel - boxTopFraction) * 100}%` }} />
            {/* crop box */}
            <div className="absolute left-0 right-0 border-[3px] border-[#e0c26e] cursor-grab active:cursor-grabbing"
                 style={{ top: `${boxTopFraction * 100}%`, height: `${boxHeightFraction * 100}%` }} />
          </>
        ) : null}
      </div>
      <p className="text-[12px] text-[#705046] text-center max-w-[240px]">
        {preset.slug === FULL_SIZE_SLUG
          ? 'Full size — the whole mockup, no crop.'
          : draggable
            ? 'Drag the box up or down to frame this size.'
            : 'This size frames automatically — no manual crop.'}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Verify it type-checks in isolation**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep MockupCropStage || echo "no MockupCropStage type errors"`
Expected: `no MockupCropStage type errors` (other files may already be red per the Build-state note — that's fine; we only care this new file is clean).

- [ ] **Step 3: Commit**

```bash
git add src/components/mockups/MockupCropStage.tsx
git commit -m "feat: MockupCropStage draggable crop box (pointer events, iPad-safe)"
```

---

## Task 3: Rewrite MockupDownloadMenu for offsets + active size + stage

**Files:**
- Modify: `src/components/mockups/MockupDownloadMenu.tsx`

- [ ] **Step 1: Replace the props and anchor scaffolding**

Replace the top of the file (lines 1–35, the imports, `ANCHOR_POSITION`, `ANCHORS`,
props interface, and `rowLabel`) with:

```tsx
'use client';

import { mockupDownloadSizes, cropsVertically, FULL_SIZE_SLUG, type SizeSlug, type SocialSizePreset } from '@/lib/export/socialSizes';
import MockupCropStage from './MockupCropStage';

export interface MockupDownloadMenuProps {
  selected: Set<SizeSlug>;
  onToggleSize: (slug: SizeSlug) => void;
  /** Per-size vertical crop offset 0..1 (0.5 = center). */
  offsets: Record<SizeSlug, number>;
  onSetOffset: (slug: SizeSlug, offset: number) => void;
  /** Which size is being framed in the crop stage. */
  activeSlug: SizeSlug;
  onSetActive: (slug: SizeSlug) => void;
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
```

- [ ] **Step 2: Replace the component body**

Replace the function signature + body (current lines 37–151) with:

```tsx
export default function MockupDownloadMenu({
  selected,
  onToggleSize,
  offsets,
  onSetOffset,
  activeSlug,
  onSetActive,
  snapshotUrl,
  isLocked,
  onLockedClick,
  isBusy,
  onDownload,
}: MockupDownloadMenuProps) {
  const sizes = mockupDownloadSizes();
  const activePreset = sizes.find(p => p.slug === activeSlug) ?? sizes[0];

  return (
    <div className="flex flex-col gap-3 border-t border-[#92afa5]/30 pt-3">
      <span className="text-[11px] font-bold uppercase tracking-wide text-[#294051]">
        Download mockup
      </span>

      {/* Crop stage for the active size (replaces the old bottom preview). */}
      <MockupCropStage
        snapshotUrl={snapshotUrl}
        preset={activePreset}
        offset={offsets[activeSlug] ?? 0.5}
        onChangeOffset={next => onSetOffset(activeSlug, next)}
        isBusy={isBusy}
      />

      <div className="flex flex-col">
        {sizes.map(preset => {
          const locked = isLocked(preset);
          const checked = selected.has(preset.slug);
          const offset = offsets[preset.slug] ?? 0.5;
          const isActive = preset.slug === activeSlug;
          const draggable = cropsVertically(preset);

          return (
            <div
              key={preset.slug}
              className={`flex items-center gap-3 py-2 border-t border-[#f0ece2] first:border-t-0 ${
                isActive ? 'bg-[#f4e8c8] rounded-md px-1' : ''
              }`}
            >
              {/* Select toggle */}
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

              {/* Bigger crop-framed thumbnail — tap to make this size active */}
              <button
                type="button"
                onClick={() => onSetActive(preset.slug)}
                aria-label={`Frame ${rowLabel(preset)}`}
                aria-pressed={isActive}
                className={`flex-none rounded border overflow-hidden ${
                  isActive ? 'border-[#e0c26e] ring-2 ring-[#e0c26e]' : 'border-[#cbb37a]'
                }`}
                style={{
                  width: 64,
                  aspectRatio: `${preset.pxW} / ${preset.pxH}`,
                  backgroundColor: '#f4e8c8',
                  backgroundImage: snapshotUrl ? `url(${snapshotUrl})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: `50% ${offset * 100}%`,
                  backgroundRepeat: 'no-repeat',
                  touchAction: 'manipulation',
                }}
              />

              {/* Name + dims */}
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-[#294051] truncate">
                  {rowLabel(preset)}
                </div>
                <div className="text-[11px] text-[#9aa3ab] tabular-nums">
                  {preset.pxW}×{preset.pxH}
                  {draggable ? (isActive ? ' · editing' : '') : ' · no crop'}
                </div>
              </div>
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

- [ ] **Step 3: Verify the menu + stage type-check together**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "MockupDownloadMenu|MockupCropStage" || echo "menu+stage clean"`
Expected: `menu+stage clean` (ActionsSidebar/AdvancedToolsBar are still red — expected, fixed next).

- [ ] **Step 4: Commit**

```bash
git add src/components/mockups/MockupDownloadMenu.tsx
git commit -m "feat: download menu uses per-size offsets, active size + crop stage"
```

---

## Task 4: Wire ActionsSidebar

**Files:**
- Modify: `src/components/sidebar/ActionsSidebar.tsx`

- [ ] **Step 1: Swap the anchor helpers/state for offsets + active size**

Replace `allCenterAnchors` (lines 34–41) with:

```tsx
// All per-size crop offsets default to 0.5 (center) so an untouched export is
// byte-identical to the pre-crop behavior.
function allCenterOffsets(): Record<SizeSlug, number> {
  return mockupDownloadSizes().reduce((acc, p) => {
    acc[p.slug] = 0.5;
    return acc;
  }, {} as Record<SizeSlug, number>);
}
```

Update the import on line 19 — remove `type VAnchor`:

```tsx
import { downloadMockupSocialSizes } from '@/lib/utils/mockupSocialExport';
```

Replace the state declaration (lines 77–79) and add an active-size state right after:

```tsx
  const [socialOffsets, setSocialOffsets] = useState<Record<SizeSlug, number>>(
    () => allCenterOffsets(),
  );
  const [activeSlug, setActiveSlug] = useState<SizeSlug>(FULL_SIZE_SLUG);
```

- [ ] **Step 2: Update the export call**

At the export call site (line 271), replace `anchors: socialAnchors` with
`offsets: socialOffsets`:

```tsx
          { watermark, isPro: !!isPro, badgeEnabled, offsets: socialOffsets },
```

- [ ] **Step 3: Update the MockupDownloadMenu props**

Replace the `anchors`/`onSetAnchor` props (lines 603–606) with offsets + active:

```tsx
              offsets={socialOffsets}
              onSetOffset={(slug, offset) =>
                setSocialOffsets(prev => ({ ...prev, [slug]: offset }))
              }
              activeSlug={activeSlug}
              onSetActive={setActiveSlug}
```

- [ ] **Step 4: Hide the bottom preview (keep it as snapshot source)**

The `<MockupRendererV2>` block (≈ lines 618–699) is the snapshot source and must stay
mounted. Make its outer wrapper visually hidden but still laid out & painting. Change
the preview wrapper `<div className="flex items-center justify-center bg-white rounded-lg p-4">`
(line 619) to move it off-screen instead of removing it:

```tsx
            {/* Snapshot source for the crop stage/thumbnails. Kept mounted &
                rendering, but moved off-screen — the crop stage is now the visible
                preview. (Pattern-drag on this preview is intentionally retired; see
                plan risk note.) */}
            <div
              aria-hidden
              className="bg-white"
              style={{ position: 'absolute', left: '-10000px', top: 0, width: 600, pointerEvents: 'none' }}
            >
```

Leave the inner content (the `w-[600px]` wrapper, overlays, `MockupRendererV2`,
`onRenderComplete`) unchanged so the snapshot keeps updating. Close the div as before.

- [ ] **Step 5: Verify ActionsSidebar type-checks**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep ActionsSidebar || echo "ActionsSidebar clean"`
Expected: `ActionsSidebar clean`.

- [ ] **Step 6: Commit**

```bash
git add src/components/sidebar/ActionsSidebar.tsx
git commit -m "feat: ActionsSidebar drag-crop offsets + hidden snapshot source"
```

---

## Task 5: Wire AdvancedToolsBar (mirror of Task 4)

**Files:**
- Modify: `src/components/layout/AdvancedToolsBar.tsx`

This file mirrors ActionsSidebar. Apply the same five edits at the corresponding
lines (the grep map: helper ≈ 44–48, import ≈ 22, state ≈ 179–181, export call ≈ 535,
menu props ≈ 760–764, preview wrapper ≈ 808–812).

- [ ] **Step 1: Replace `allCenterAnchors` (lines 44–48)**

```tsx
// All per-size crop offsets default to 0.5 (center) so an untouched export is
// byte-identical to the pre-crop behavior.
function allCenterOffsets(): Record<SizeSlug, number> {
  return mockupDownloadSizes().reduce((acc, p) => {
    acc[p.slug] = 0.5;
    return acc;
  }, {} as Record<SizeSlug, number>);
}
```

- [ ] **Step 2: Remove `type VAnchor` from the import (line 22)**

```tsx
import { downloadMockupSocialSizes } from '@/lib/utils/mockupSocialExport';
```

- [ ] **Step 3: Replace the state (lines 179–181) and add active size**

```tsx
  const [socialOffsets, setSocialOffsets] = useState<Record<SizeSlug, number>>(
    () => allCenterOffsets(),
  );
  const [activeSlug, setActiveSlug] = useState<SizeSlug>(FULL_SIZE_SLUG);
```

Confirm `FULL_SIZE_SLUG` is imported in this file; it is used by `mockupDownloadSizes`
already. If not imported, add it to the `socialSizes` import.

- [ ] **Step 4: Update the export call (line 535)**

```tsx
                { watermark, isPro: !!isPro, badgeEnabled, offsets: socialOffsets },
```

- [ ] **Step 5: Update the menu props (lines 760–764)**

```tsx
                offsets={socialOffsets}
                onSetOffset={(slug, offset) =>
                  setSocialOffsets(prev => ({ ...prev, [slug]: offset }))
                }
                activeSlug={activeSlug}
                onSetActive={setActiveSlug}
                snapshotUrl={mockupSnapshotUrl}
```

(Keep the other existing props — `selected`, `onToggleSize`, `isLocked`,
`onLockedClick`, `isBusy`, `onDownload` — as they are.)

- [ ] **Step 6: Hide the bottom preview wrapper (≈ line 808)**

Find the outer wrapper `<div>` that contains the `MockupRendererV2` preview block (the
one wrapping the `w-[600px]` inner box) and replace its opening tag with an off-screen,
`aria-hidden` wrapper so it stays mounted and painting but invisible:

```tsx
            {/* Snapshot source for the crop stage/thumbnails. Kept mounted &
                rendering, but moved off-screen — the crop stage is now the visible
                preview. (Pattern-drag on this preview is intentionally retired; see
                plan risk note.) */}
            <div
              aria-hidden
              className="bg-white"
              style={{ position: 'absolute', left: '-10000px', top: 0, width: 600, pointerEvents: 'none' }}
            >
```

Leave the inner content (the `w-[600px]` wrapper, overlays, `MockupRendererV2`,
`onRenderComplete`) and the closing `</div>` unchanged so the snapshot keeps updating.

- [ ] **Step 7: Verify AdvancedToolsBar type-checks**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep AdvancedToolsBar || echo "AdvancedToolsBar clean"`
Expected: `AdvancedToolsBar clean`.

- [ ] **Step 8: Commit**

```bash
git add src/components/layout/AdvancedToolsBar.tsx
git commit -m "feat: AdvancedToolsBar drag-crop offsets + hidden snapshot source"
```

---

## Task 6: Full gate + manual verification

**Files:** none (verification only)

- [ ] **Step 1: Type-check the whole project (now expected green)**

Run: `npx tsc --noEmit`
Expected: exit 0, no errors. (No lingering `VAnchor`, `anchors`, `socialAnchors`, or
`onSetAnchor` references anywhere — grep to confirm: `grep -rn "VAnchor\|socialAnchors\|onSetAnchor\|allCenterAnchors" src` returns nothing.)

- [ ] **Step 2: Run the test suite**

Run: `npx vitest run`
Expected: PASS — all tests green (the prior 67 + the new offset cases), zero failures.

- [ ] **Step 3: Lint**

Run: `npx eslint src/components/mockups/MockupCropStage.tsx src/components/mockups/MockupDownloadMenu.tsx src/components/sidebar/ActionsSidebar.tsx src/components/layout/AdvancedToolsBar.tsx`
Expected: 0 errors.

- [ ] **Step 4: Manual — desktop**

Run: `npm run dev`, open the mockup modal (both entry points: the ActionsSidebar
download panel and the AdvancedToolsBar). For each:
- Confirm the bottom full-size preview is gone and the crop stage shows instead.
- Tap the Square row → stage shows a square box; drag it up/down; confirm the row
  thumbnail and stage agree as you drag.
- Repeat for Portrait. Confirm Story/Pinterest/Full show "no manual crop"/"no crop".
- Download Square + Portrait; open the PNGs; confirm the exported framing matches
  where you dragged the box (top drag → top of product kept, etc.).
- Download with everything centered (untouched) and confirm output is unchanged from
  before this feature (backwards-compat).

- [ ] **Step 5: Manual — iPad/Pencil (mandatory parity)**

On an iPad (or touch emulation): confirm the crop box drags smoothly with finger and
Pencil, the page doesn't scroll while dragging (`touch-action: none` working), and the
box stays within bounds. This is a hard requirement — do not mark complete without it.

- [ ] **Step 6: Final commit (if any verification fixups were needed)**

```bash
git add -A
git commit -m "test: verify drag-crop across desktop + iPad, exports backwards-compatible"
```

---

## Risk / decision note

**Pattern-drag on the bottom preview is retired.** The old `MockupRendererV2` preview
had `dragEnabled` (repositioning the tiled pattern by dragging the preview). Moving it
off-screen to serve only as the snapshot source removes that interaction from the
modal. The brainstorm explicitly chose to remove the bottom preview (ask #2); if Mandy
still relies on dragging the pattern there, the fallback is to keep the renderer
visible at a small size above the crop stage rather than off-screen. Flag this during
the Task 6 manual review.
