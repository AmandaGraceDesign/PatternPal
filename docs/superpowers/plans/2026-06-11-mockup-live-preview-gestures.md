# Live Preview + Contextual Crop Framing (Model A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the live `MockupRendererV2` back as the visible preview, draw crop framing + watermark/badge as overlays on it, and make pattern-drag the default gesture with a contextual crop-frame grab (Model A) — fixing the lost pattern-drag and sluggish-scale regressions from the snapshot-based redesign.

**Architecture:** The off-screen live renderer (`left:-10000px`) becomes the on-screen primary preview (`dragEnabled` + `fitContainer`, already wired). `MockupCropStage` is refactored from a snapshot-background widget into a transparent overlay (`absolute inset-0`) layered over the live canvas, owning the crop box, a center grab-bar handle, the dim mask, and the watermark/badge preview. Crop-fraction math is extracted to a pure, unit-tested module shared by the overlay. The per-render `toDataURL` snapshot leaves the hot path and is driven by a trailing throttle, feeding only the size-grid thumbnails. Both modal consumers (`ActionsSidebar`, `AdvancedToolsBar`) get the identical new modal body.

**Tech Stack:** Next.js (React 18, `'use client'`), TypeScript, Tailwind, Pointer Events, Canvas 2D, Vitest + jsdom.

---

## Design source

Approved design (Model A): `docs/superpowers/specs/2026-06-11-mockup-live-preview-gestures-design.md`
Sketch: `docs/superpowers/sketches/mockup-live-preview-gestures.html`

## Key architectural decisions (read before starting)

1. **Grab target = the center grab-bar handle, not the whole box.** The approved design's live label is *"Moving the pattern · grab the gold box to frame"* — i.e. pattern-drag is the **default** and you grab to frame. A bordered box cannot separate "border grabbable / interior not" via `pointer-events` (border and content share one box). So the **only** crop-grab target is a prominent center grab-bar handle (`pointer-events:auto`, ≥44px tall, full crop-box width). Everything else in the overlay is `pointer-events:none`, so pointerdowns fall through to `MockupRendererV2`'s wrapper handlers (pattern drag). This is a deliberate, faithful refinement of the design — it is the only way both gestures coexist in the same area. **Flag it for Mandy's manual device test**; if box-interior grab is wanted instead, it's a one-line change (widen the handle to the box height).

2. **Watermark/badge preview now tracks the ACTIVE size's crop region**, replacing the old always-full-canvas overlay in the consumers. For Full-size/Pinterest the crop region == the full canvas, so it looks unchanged; for Square/Portrait it sits inside the cropped sub-rectangle, matching the exported PNG. This is intentional and an improvement.

3. **Two consumers stay byte-identical in the modal body.** `ActionsSidebar` and `AdvancedToolsBar` duplicate the modal body. After this work the renderer + overlay + throttle wiring must be **character-for-character identical** between them (only their surrounding differences — `AdvancedToolsBar`'s scale control + `renderTileWidth/Height` debounce, and its `{v2Template && ...}` guard vs `ActionsSidebar`'s early `return null` — remain). Do NOT extract a shared `MockupModalBody` (out of scope per design); keep them in sync by hand and diff them at the end.

4. **Curtain template (3600×4500 = 0.8 aspect) crop mismatch is pre-existing and still deferred.** The overlay math assumes `MOCKUP_SRC_ASPECT = 2/3`. Unchanged by this work.

## File structure

| File | Responsibility | Action |
|------|----------------|--------|
| `src/lib/export/cropFraming.ts` | Pure crop-fraction math (mode + fractions) for the preview overlay | **Create** |
| `src/__tests__/cropFraming.test.ts` | Unit tests for the fraction math | **Create** |
| `src/lib/utils/trailingThrottle.ts` | Pure leading+trailing throttle factory for the snapshot | **Create** |
| `src/__tests__/trailingThrottle.test.ts` | Unit tests for the throttle | **Create** |
| `src/components/mockups/MockupDownloadMenu.tsx` | Size grid + download button (no embedded crop stage) | **Modify** |
| `src/components/mockups/MockupCropStage.tsx` | Transparent crop-framing **overlay** over the live canvas | **Rewrite** |
| `src/components/sidebar/ActionsSidebar.tsx` | Un-hide renderer, mount overlay, Model-A wiring, throttled snapshot | **Modify** |
| `src/components/layout/AdvancedToolsBar.tsx` | Same modal-body changes as `ActionsSidebar` (keep scale control) | **Modify** |

**Task order rationale (keeps `tsc` green between tasks):** pure libs first (Tasks 1–2), then drop the stage from the menu (Task 3) so `MockupCropStage` becomes orphaned, then rewrite the orphan (Task 4), then wire it into the two consumers (Tasks 5–6), then gate (Task 7).

---

### Task 1: Extract pure crop-fraction math

**Files:**
- Create: `src/lib/export/cropFraming.ts`
- Test: `src/__tests__/cropFraming.test.ts`

This lifts the inline math currently in `MockupCropStage.tsx:47-62` into a pure, tested function so the overlay and any future consumer share one source of truth.

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/cropFraming.test.ts
import { describe, it, expect } from 'vitest';
import { computePreviewCropFractions } from '../lib/export/cropFraming';
import {
  SOCIAL_SIZE_PRESETS,
  FULL_SIZE_PRESET,
  type SocialSizePreset,
} from '../lib/export/socialSizes';

const preset = (slug: string): SocialSizePreset =>
  SOCIAL_SIZE_PRESETS.find(p => p.slug === slug)!;

describe('computePreviewCropFractions', () => {
  it('square (1:1) is a vertical crop: full width, height slides with offset', () => {
    const r = computePreviewCropFractions(preset('instagram-post'), 0.5);
    expect(r.mode).toBe('vertical');
    expect(r.widthFraction).toBeCloseTo(1, 5);
    expect(r.leftFraction).toBeCloseTo(0, 5);
    expect(r.heightFraction).toBeCloseTo(2 / 3, 5);
    expect(r.travel).toBeCloseTo(1 / 3, 5);
    expect(r.topFraction).toBeCloseTo((1 / 3) * 0.5, 5);
  });

  it('square offset 0 pins the box to the top, offset 1 to the bottom', () => {
    expect(computePreviewCropFractions(preset('instagram-post'), 0).topFraction).toBeCloseTo(0, 5);
    expect(computePreviewCropFractions(preset('instagram-post'), 1).topFraction).toBeCloseTo(1 / 3, 5);
  });

  it('portrait (4:5) is a vertical crop with a taller box than square', () => {
    const r = computePreviewCropFractions(preset('instagram-portrait'), 0.5);
    expect(r.mode).toBe('vertical');
    expect(r.heightFraction).toBeCloseTo((2 / 3) / 0.8, 5); // 0.8333…
    expect(r.travel).toBeCloseTo(1 - (2 / 3) / 0.8, 5);
  });

  it('story (9:16) is a horizontal crop: full height, centered narrower band, no travel', () => {
    const r = computePreviewCropFractions(preset('story'), 0.5);
    expect(r.mode).toBe('horizontal');
    expect(r.heightFraction).toBeCloseTo(1, 5);
    expect(r.topFraction).toBeCloseTo(0, 5);
    expect(r.travel).toBeCloseTo(0, 5);
    expect(r.widthFraction).toBeCloseTo((1080 / 1920) / (2 / 3), 5); // 0.84375
    expect(r.leftFraction).toBeCloseTo((1 - (1080 / 1920) / (2 / 3)) / 2, 5);
  });

  it('pinterest (2:3) matches the source — no crop, whole frame', () => {
    const r = computePreviewCropFractions(preset('pinterest-pin'), 0.5);
    expect(r.mode).toBe('none');
    expect(r.widthFraction).toBeCloseTo(1, 5);
    expect(r.heightFraction).toBeCloseTo(1, 5);
    expect(r.travel).toBeCloseTo(0, 5);
  });

  it('full-size is never cropped — whole frame', () => {
    const r = computePreviewCropFractions(FULL_SIZE_PRESET, 0.5);
    expect(r.mode).toBe('none');
    expect(r.widthFraction).toBeCloseTo(1, 5);
    expect(r.heightFraction).toBeCloseTo(1, 5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/cropFraming.test.ts`
Expected: FAIL — `Failed to resolve import "../lib/export/cropFraming"`.

- [ ] **Step 3: Write the minimal implementation**

```typescript
// src/lib/export/cropFraming.ts
import { cropsVertically, MOCKUP_SRC_ASPECT, type SocialSizePreset } from './socialSizes';

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

export type CropMode = 'vertical' | 'horizontal' | 'none';

export interface PreviewCropFractions {
  /** 'vertical' = draggable box (square/portrait); 'horizontal' = static centered band
   *  (story); 'none' = whole frame (pinterest/full size). */
  mode: CropMode;
  leftFraction: number;
  topFraction: number;
  widthFraction: number;
  heightFraction: number;
  /** Fraction of the frame height the box can travel (0 when not vertical). */
  travel: number;
}

/**
 * Crop sub-rectangle of the live 2:3 mockup canvas that a given social size exports,
 * expressed as 0..1 fractions of the canvas. Mirrors `computeCoverCropRect` (the export
 * path) with srcAspect = MOCKUP_SRC_ASPECT so the on-screen crop box, the offset drag,
 * and the watermark/badge overlay all coincide with the exported PNG.
 */
export function computePreviewCropFractions(
  preset: SocialSizePreset,
  offset: number,
): PreviewCropFractions {
  const targetAspect = preset.pxW / preset.pxH;
  const vertical = cropsVertically(preset);
  const horizontal = !vertical && MOCKUP_SRC_ASPECT > targetAspect;

  let widthFraction = 1;
  let heightFraction = 1;
  let leftFraction = 0;
  let topFraction = 0;

  if (vertical) {
    heightFraction = clamp01(MOCKUP_SRC_ASPECT / targetAspect);
    topFraction = (1 - heightFraction) * clamp01(offset);
  } else if (horizontal) {
    widthFraction = clamp01(targetAspect / MOCKUP_SRC_ASPECT);
    leftFraction = (1 - widthFraction) / 2;
  }

  return {
    mode: vertical ? 'vertical' : horizontal ? 'horizontal' : 'none',
    leftFraction,
    topFraction,
    widthFraction,
    heightFraction,
    travel: 1 - heightFraction,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/cropFraming.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/export/cropFraming.ts src/__tests__/cropFraming.test.ts
git commit -m "feat: extract pure preview crop-fraction math (shared with overlay)"
```

---

### Task 2: Trailing throttle for the snapshot

**Files:**
- Create: `src/lib/utils/trailingThrottle.ts`
- Test: `src/__tests__/trailingThrottle.test.ts`

A leading+trailing throttle so the `toDataURL` snapshot fires immediately on the first render (instant thumbnails) then coalesces the rapid drag-render burst into one trailing call (naturally skipping mid-drag).

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/trailingThrottle.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTrailingThrottle } from '../lib/utils/trailingThrottle';

describe('createTrailingThrottle', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('fires immediately on the first call (leading edge)', () => {
    const fn = vi.fn();
    const t = createTrailingThrottle(fn, 300);
    t.call();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('coalesces a burst into a single trailing call', () => {
    const fn = vi.fn();
    const t = createTrailingThrottle(fn, 300);
    t.call(); // leading -> 1
    t.call();
    t.call();
    t.call(); // still within window -> scheduled trailing
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(2); // one trailing
  });

  it('does not schedule a trailing call when only the leading call happened', () => {
    const fn = vi.fn();
    const t = createTrailingThrottle(fn, 300);
    t.call();
    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('cancel() drops a pending trailing call', () => {
    const fn = vi.fn();
    const t = createTrailingThrottle(fn, 300);
    t.call();
    t.call(); // schedules trailing
    t.cancel();
    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/trailingThrottle.test.ts`
Expected: FAIL — `Failed to resolve import "../lib/utils/trailingThrottle"`.

- [ ] **Step 3: Write the minimal implementation**

```typescript
// src/lib/utils/trailingThrottle.ts

export interface TrailingThrottle {
  /** Fire on the leading edge if idle; otherwise schedule one trailing call. */
  call: () => void;
  /** Drop any pending trailing call. */
  cancel: () => void;
}

/**
 * Leading + trailing throttle. The first `call()` runs `fn` synchronously; further
 * calls inside `ms` are coalesced into a single trailing `fn` run at the end of the
 * window. Used to keep `toDataURL` off the per-render hot path: thumbnails appear at
 * once, then update once after a drag/scale burst settles.
 */
export function createTrailingThrottle(fn: () => void, ms: number): TrailingThrottle {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let trailingQueued = false;

  const startWindow = () => {
    timer = setTimeout(() => {
      timer = null;
      if (trailingQueued) {
        trailingQueued = false;
        fn();
        startWindow(); // honor any calls that land during the trailing run's window
      }
    }, ms);
  };

  return {
    call() {
      if (timer === null) {
        fn();
        startWindow();
      } else {
        trailingQueued = true;
      }
    },
    cancel() {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      trailingQueued = false;
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/trailingThrottle.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/trailingThrottle.ts src/__tests__/trailingThrottle.test.ts
git commit -m "feat: leading+trailing throttle util for snapshot capture"
```

---

### Task 3: Drop the embedded crop stage from the download menu

**Files:**
- Modify: `src/components/mockups/MockupDownloadMenu.tsx`

The menu becomes size-grid + download only. The crop overlay moves onto the live preview (Tasks 4–6). The per-size thumbnails still use `snapshotUrl` + `offsets` for their `backgroundPosition` framing, so those props stay. `onSetOffset`, `watermark`, and `badgeVisible` move out (they belong to the overlay now).

- [ ] **Step 1: Remove the `<MockupCropStage>` block and its import**

Delete the import line (`MockupDownloadMenu.tsx:` near top):
```typescript
import MockupCropStage from './MockupCropStage';
```
Delete the embedded stage JSX (currently `MockupDownloadMenu.tsx:58-67`):
```tsx
{/* Crop stage for the active size (replaces the old bottom preview). */}
<MockupCropStage
  snapshotUrl={snapshotUrl}
  preset={activePreset}
  offset={offsets[activeSlug] ?? 0.5}
  onChangeOffset={next => onSetOffset(activeSlug, next)}
  isBusy={isBusy}
  watermark={watermark}
  badgeVisible={badgeVisible}
/>
```

- [ ] **Step 2: Trim the props interface**

In `MockupDownloadMenuProps` remove `onSetOffset`, `watermark`, and `badgeVisible`. Keep `offsets` (thumbnail framing), `snapshotUrl` (thumbnail image), `activeSlug` + `onSetActive` (which size the live overlay frames). The interface becomes:

```typescript
export interface MockupDownloadMenuProps {
  selected: Set<SizeSlug>;
  onToggleSize: (slug: SizeSlug) => void;
  /** Per-size vertical crop offset 0..1 (0.5 = center) — frames the row thumbnails. */
  offsets: Record<SizeSlug, number>;
  /** Which size the live preview overlay is framing (highlighted in the grid). */
  activeSlug: SizeSlug;
  onSetActive: (slug: SizeSlug) => void;
  /** Throttled data-URL snapshot of the live mockup canvas; null until first render. */
  snapshotUrl: string | null;
  isLocked: (preset: SocialSizePreset) => boolean;
  onLockedClick: () => void;
  isBusy: boolean;
  onDownload: () => void;
}
```

Remove `onSetOffset`, `watermark`, `badgeVisible` from the destructured params and any now-unused imports (`WatermarkConfig`). Keep `activePreset` derivation only if still referenced; if `activePreset` is now unused after removing the stage, delete its line (`MockupDownloadMenu.tsx:50`) to satisfy eslint `no-unused-vars`.

- [ ] **Step 3: Verify the file type-checks in isolation**

Run: `npx tsc --noEmit`
Expected: exit 0. (`MockupCropStage` is now imported by nobody — that is fine; it's an exported module. Consumers still type-check because they don't yet pass the removed props — confirm: they currently pass `watermark`/`badgeVisible`/`onSetOffset` to the menu, so this step WILL surface those as errors in `ActionsSidebar`/`AdvancedToolsBar`.)

If `tsc` reports the consumers passing now-removed props, that is expected and fixed in Tasks 5–6. To keep this task green on its own, also do Step 4.

- [ ] **Step 4: Stop passing the removed props from both consumers (minimal stop-gap)**

In `src/components/sidebar/ActionsSidebar.tsx` (the `<MockupDownloadMenu …>` at ~597-623) and `src/components/layout/AdvancedToolsBar.tsx` (~755-781), delete only these three lines from each `<MockupDownloadMenu>`:
```tsx
onSetOffset={(slug, offset) =>
  setSocialOffsets(prev => ({ ...prev, [slug]: offset }))
}
```
```tsx
watermark={watermark}
```
```tsx
badgeVisible={shouldStampBadge({ isPaidPro: isPro, badgeEnabled })}
```
(The `socialOffsets`/`setSocialOffsets` state stays — it's still read for the overlay and thumbnails and will be set by the overlay in Tasks 5–6.)

- [ ] **Step 5: Type-check and run the suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: `tsc` exit 0; vitest 69 prior + 10 new = passing. (If `setSocialOffsets` is now flagged unused, leave it — it's reintroduced in Tasks 5–6; if eslint blocks, proceed and let Task 7's gate confirm. Prefer keeping the state.)

- [ ] **Step 6: Commit**

```bash
git add src/components/mockups/MockupDownloadMenu.tsx src/components/sidebar/ActionsSidebar.tsx src/components/layout/AdvancedToolsBar.tsx
git commit -m "refactor: download menu is grid+download only (crop moves to live preview)"
```

---

### Task 4: Rewrite MockupCropStage as a transparent overlay

**Files:**
- Rewrite: `src/components/mockups/MockupCropStage.tsx`

Replace the snapshot-background widget with a transparent overlay (`absolute inset-0`) that sits over the live canvas. It renders: the dim mask (vertical mode), the gold crop box (visual only), the **center grab-bar handle** (the sole `pointer-events:auto` grab target), the static centered band (horizontal mode), the watermark/badge preview in the crop region, and the live action label. All non-handle elements are `pointer-events:none` so pattern-drag falls through to the renderer.

- [ ] **Step 1: Replace the entire file**

```tsx
// src/components/mockups/MockupCropStage.tsx
'use client';

import { useRef, useState } from 'react';
import { FULL_SIZE_SLUG, type SocialSizePreset } from '@/lib/export/socialSizes';
import { computePreviewCropFractions } from '@/lib/export/cropFraming';
import { WatermarkConfig } from '@/lib/watermark/watermark';
import WatermarkPreviewOverlay from '@/components/watermark/WatermarkPreviewOverlay';
import BadgePreviewOverlay from '@/components/badge/BadgePreviewOverlay';

export interface MockupCropStageProps {
  /** The size currently being framed on the live preview. */
  preset: SocialSizePreset;
  /** Current vertical offset 0..1 for this size (0.5 = center). */
  offset: number;
  /** Called with the new clamped offset as the user drags the frame. */
  onChangeOffset: (next: number) => void;
  isBusy: boolean;
  /** Watermark config — previewed over the crop region exactly where export stamps it. */
  watermark: WatermarkConfig;
  /** Whether the "Tested in PatternPAL" badge will be stamped on export. */
  badgeVisible: boolean;
}

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

/**
 * Transparent crop-framing overlay drawn over the live MockupRendererV2 canvas.
 * `absolute inset-0` over the 2:3 canvas wrapper (containerType: inline-size).
 *
 * Model A gesture split: every element here is pointer-events:none EXCEPT the center
 * grab-bar handle, so pointerdowns anywhere else fall through to the renderer's pattern
 * drag. Grabbing the handle slides the vertical crop offset.
 */
export default function MockupCropStage({
  preset,
  offset,
  onChangeOffset,
  isBusy,
  watermark,
  badgeVisible,
}: MockupCropStageProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [draggingCrop, setDraggingCrop] = useState(false);

  const { mode, leftFraction, topFraction, widthFraction, heightFraction, travel } =
    computePreviewCropFractions(preset, offset);

  function offsetFromClientY(clientY: number): number {
    const el = frameRef.current;
    if (!el || travel <= 0) return offset;
    const rect = el.getBoundingClientRect();
    // Position the box so its CENTER tracks the pointer, then convert to offset.
    const boxH = heightFraction * rect.height;
    const top = clamp01((clientY - rect.top - boxH / 2) / rect.height);
    return clamp01(top / travel);
  }

  function handleDown(e: React.PointerEvent) {
    if (mode !== 'vertical' || isBusy) return;
    e.preventDefault();
    e.stopPropagation(); // never let the renderer also start a pattern drag
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDraggingCrop(true);
    onChangeOffset(offsetFromClientY(e.clientY));
  }
  function handleMove(e: React.PointerEvent) {
    if (mode !== 'vertical' || isBusy) return;
    if (e.buttons === 0) return;
    e.stopPropagation();
    onChangeOffset(offsetFromClientY(e.clientY));
  }
  function handleUp(e: React.PointerEvent) {
    if (mode !== 'vertical') return;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    setDraggingCrop(false);
  }

  // Handle sits centered on the crop box; ≥44px tall touch target.
  const boxCenterPct = (topFraction + heightFraction / 2) * 100;

  const label =
    preset.slug === FULL_SIZE_SLUG
      ? 'Full size — drag to move the pattern'
      : mode === 'vertical'
        ? draggingCrop
          ? 'Sliding the crop frame ↕'
          : 'Moving the pattern · grab the gold bar to frame'
        : mode === 'horizontal'
          ? 'This size frames automatically · drag to move the pattern'
          : 'Drag to move the pattern';

  return (
    <div ref={frameRef} className="pointer-events-none absolute inset-0 select-none">
      {mode === 'vertical' && (
        <>
          {/* dim above + below the crop box */}
          <div
            className="absolute left-0 right-0 top-0 bg-[#294051]/45"
            style={{ height: `${topFraction * 100}%` }}
          />
          <div
            className="absolute left-0 right-0 bottom-0 bg-[#294051]/45"
            style={{ height: `${(travel - topFraction) * 100}%` }}
          />
          {/* gold crop box (visual only) */}
          <div
            className="absolute left-0 right-0 border-[3px] border-[#e0c26e]"
            style={{ top: `${topFraction * 100}%`, height: `${heightFraction * 100}%` }}
          />
          {/* center grab-bar handle — the ONLY crop-grab target */}
          <div
            className="pointer-events-auto absolute left-1/2 flex items-center justify-center gap-1 rounded-full bg-[#e0c26e] shadow-md cursor-grab active:cursor-grabbing"
            style={{
              top: `${boxCenterPct}%`,
              transform: 'translate(-50%, -50%)',
              width: 72,
              height: 44,
              touchAction: 'none',
            }}
            onPointerDown={handleDown}
            onPointerMove={handleMove}
            onPointerUp={handleUp}
            onPointerCancel={handleUp}
            aria-label="Drag to frame this size vertically"
          >
            <span className="block h-[3px] w-5 rounded-full bg-[#294051]/70" />
            <span className="block h-[3px] w-5 rounded-full bg-[#294051]/70" />
          </div>
        </>
      )}

      {mode === 'horizontal' && (
        <>
          {/* dim left + right of the centered band */}
          <div
            className="absolute top-0 bottom-0 left-0 bg-[#294051]/45"
            style={{ width: `${leftFraction * 100}%` }}
          />
          <div
            className="absolute top-0 bottom-0 right-0 bg-[#294051]/45"
            style={{ width: `${leftFraction * 100}%` }}
          />
          <div
            className="absolute top-0 bottom-0 border-[3px] border-[#e0c26e]"
            style={{ left: `${leftFraction * 100}%`, width: `${widthFraction * 100}%` }}
          />
        </>
      )}

      {/* Watermark + badge previewed inside the crop region. containerType: inline-size
          makes the overlays' cqw units reference the crop width, so the logo lands where
          the export stamps it on the cropped PNG. */}
      <div
        className="pointer-events-none absolute"
        style={{
          left: `${leftFraction * 100}%`,
          top: `${topFraction * 100}%`,
          width: `${widthFraction * 100}%`,
          height: `${heightFraction * 100}%`,
          containerType: 'inline-size',
        }}
      >
        <WatermarkPreviewOverlay watermark={watermark} />
        <BadgePreviewOverlay visible={badgeVisible} />
      </div>

      {/* Live action label */}
      <div className="pointer-events-none absolute left-1/2 bottom-2 -translate-x-1/2">
        <span className="rounded-full bg-[#294051]/80 px-3 py-1 text-[11px] font-medium text-white whitespace-nowrap">
          {label}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0. (Overlay is still imported by nobody — orphaned until Tasks 5–6 — which is fine.)

- [ ] **Step 3: Lint the file**

Run: `npx eslint src/components/mockups/MockupCropStage.tsx`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/mockups/MockupCropStage.tsx
git commit -m "refactor: MockupCropStage is a live-canvas overlay with grab-bar handle (Model A)"
```

---

### Task 5: ActionsSidebar — un-hide renderer, mount overlay, throttle snapshot

**Files:**
- Modify: `src/components/sidebar/ActionsSidebar.tsx`

Un-hide the live renderer (it's the primary preview now), mount the crop overlay over it, move watermark/badge into the overlay, and replace the per-render `toDataURL` with the throttled snapshot.

- [ ] **Step 1: Add imports**

Near the existing imports add:
```typescript
import MockupCropStage from '@/components/mockups/MockupCropStage';
import { createTrailingThrottle } from '@/lib/utils/trailingThrottle';
import { FULL_SIZE_PRESET, SOCIAL_SIZE_PRESETS } from '@/lib/export/socialSizes';
```
(Confirm `FULL_SIZE_SLUG` is already imported; keep it. If `SOCIAL_SIZE_PRESETS`/`FULL_SIZE_PRESET` are already imported, don't duplicate.)

- [ ] **Step 2: Create the throttled snapshot (lazy ref) and unmount cleanup**

Inside the component body, near the other refs/state (around the `mockupSnapshotUrl` state, `ActionsSidebar.tsx:81`), add:
```typescript
const snapshotThrottleRef = useRef<ReturnType<typeof createTrailingThrottle> | null>(null);
if (!snapshotThrottleRef.current) {
  snapshotThrottleRef.current = createTrailingThrottle(() => {
    const c = document.querySelector(
      '[data-mockup-modal] .mockup-canvas, [data-mockup-modal] canvas',
    ) as HTMLCanvasElement | null;
    if (c) setMockupSnapshotUrl(c.toDataURL('image/png'));
  }, 350);
}
useEffect(() => () => snapshotThrottleRef.current?.cancel(), []);
```
(Ensure `useEffect` is imported from React.)

- [ ] **Step 3: Resolve the active preset for the overlay**

Where `activeSlug` is in scope (component body), add a derived preset used by the overlay:
```typescript
const activePreset =
  activeSlug === FULL_SIZE_SLUG
    ? FULL_SIZE_PRESET
    : (SOCIAL_SIZE_PRESETS.find(p => p.slug === activeSlug) ?? FULL_SIZE_PRESET);
```

- [ ] **Step 4: Un-hide the renderer wrapper and mount the overlay + watermark inside it**

The off-screen wrapper is `ActionsSidebar.tsx:629-716`. Make two changes to the outer wrapper `<div aria-hidden …>`:

Replace its opening tag:
```tsx
<div
  aria-hidden
  className="bg-white"
  style={{ position: 'absolute', left: '-10000px', top: 0, width: 600, pointerEvents: 'none' }}
>
```
with an on-screen, centered, interactive wrapper:
```tsx
<div className="bg-white w-full flex justify-center">
```
(Drop `aria-hidden`, the off-screen positioning, and `pointerEvents:none` — the preview is now visible and interactive.)

Inside, the tight `containerType: inline-size` wrapper (`ActionsSidebar.tsx:645-...` — the `<div className="relative" style={{ width: min(...), aspectRatio, containerType }}>` holding the renderer) currently contains `WatermarkPreviewOverlay` + `BadgePreviewOverlay` + `MockupRendererV2`. Change it to: keep `MockupRendererV2`, **remove** the two standalone full-canvas overlays, and **add** `MockupCropStage` as the overlay sibling AFTER the renderer:

Delete these two lines (the always-full-canvas preview overlays):
```tsx
<WatermarkPreviewOverlay watermark={watermark} />
<BadgePreviewOverlay visible={shouldStampBadge({ isPaidPro: isPro, badgeEnabled })} />
```
Then immediately AFTER the `<MockupRendererV2 … />` closing tag (still inside the `containerType` wrapper), add:
```tsx
<MockupCropStage
  preset={activePreset}
  offset={socialOffsets[activeSlug] ?? 0.5}
  onChangeOffset={next => setSocialOffsets(prev => ({ ...prev, [activeSlug]: next }))}
  isBusy={isCapturingFullRes}
  watermark={watermark}
  badgeVisible={shouldStampBadge({ isPaidPro: isPro, badgeEnabled })}
/>
```

- [ ] **Step 5: Swap the hot-path snapshot for the throttle**

In the `MockupRendererV2` `onRenderComplete` (`ActionsSidebar.tsx:696-710`), replace the inline `toDataURL` block. Change:
```tsx
onRenderComplete={() => {
  if (downloadAfterRenderRef.current) {
    const cb = downloadAfterRenderRef.current;
    downloadAfterRenderRef.current = null;
    cb();
  }
  if (!isCapturingFullRes) {
    const c = document.querySelector(
      '[data-mockup-modal] .mockup-canvas, [data-mockup-modal] canvas',
    ) as HTMLCanvasElement | null;
    if (c) setMockupSnapshotUrl(c.toDataURL('image/png'));
  }
}}
```
to:
```tsx
onRenderComplete={() => {
  if (downloadAfterRenderRef.current) {
    const cb = downloadAfterRenderRef.current;
    downloadAfterRenderRef.current = null;
    cb();
  }
  // Snapshot for the size-grid thumbnails only — throttled off the render hot path.
  if (!isCapturingFullRes) snapshotThrottleRef.current?.call();
}}
```

- [ ] **Step 6: Remove any stale "off-screen / inert" comments**

Run: `grep -n "10000\|inert\|off-screen\|offscreen\|hidden snapshot" src/components/sidebar/ActionsSidebar.tsx`
Delete any now-false comments referencing the off-screen/hidden snapshot source in the mockup modal body.

- [ ] **Step 7: Type-check, lint, test**

Run: `npx tsc --noEmit && npx eslint src/components/sidebar/ActionsSidebar.tsx && npx vitest run`
Expected: `tsc` exit 0; eslint 0 errors (pre-existing warnings OK); vitest all passing. If `WatermarkPreviewOverlay`/`BadgePreviewOverlay` imports are now unused in this file, remove them.

- [ ] **Step 8: Commit**

```bash
git add src/components/sidebar/ActionsSidebar.tsx
git commit -m "feat: ActionsSidebar live preview + crop overlay + throttled snapshot (Model A)"
```

---

### Task 6: AdvancedToolsBar — mirror the ActionsSidebar modal body

**Files:**
- Modify: `src/components/layout/AdvancedToolsBar.tsx`

Apply the **identical** modal-body changes from Task 5. Preserve this file's unique parts: the scale control (`mockupScaleOverride`) and its debounced `renderTileWidth`/`renderTileHeight` feeding `MockupRendererV2`, plus the `{v2Template && (…)}` conditional (vs `ActionsSidebar`'s early `return null`).

- [ ] **Step 1: Add imports**

Same as Task 5 Step 1:
```typescript
import MockupCropStage from '@/components/mockups/MockupCropStage';
import { createTrailingThrottle } from '@/lib/utils/trailingThrottle';
import { FULL_SIZE_PRESET, SOCIAL_SIZE_PRESETS } from '@/lib/export/socialSizes';
```
(Skip any already present. Ensure `useEffect` is imported.)

- [ ] **Step 2: Throttled snapshot ref + cleanup**

Near `mockupSnapshotUrl` state (`AdvancedToolsBar.tsx:183`) add the same block as Task 5 Step 2:
```typescript
const snapshotThrottleRef = useRef<ReturnType<typeof createTrailingThrottle> | null>(null);
if (!snapshotThrottleRef.current) {
  snapshotThrottleRef.current = createTrailingThrottle(() => {
    const c = document.querySelector(
      '[data-mockup-modal] .mockup-canvas, [data-mockup-modal] canvas',
    ) as HTMLCanvasElement | null;
    if (c) setMockupSnapshotUrl(c.toDataURL('image/png'));
  }, 350);
}
useEffect(() => () => snapshotThrottleRef.current?.cancel(), []);
```

- [ ] **Step 3: Active preset**

Same as Task 5 Step 3 (uses this file's `activeSlug`):
```typescript
const activePreset =
  activeSlug === FULL_SIZE_SLUG
    ? FULL_SIZE_PRESET
    : (SOCIAL_SIZE_PRESETS.find(p => p.slug === activeSlug) ?? FULL_SIZE_PRESET);
```

- [ ] **Step 4: Un-hide the renderer wrapper + mount overlay**

The off-screen wrapper is `AdvancedToolsBar.tsx:787-869`. Replace the opening tag:
```tsx
<div
  aria-hidden
  className="bg-white"
  style={{ position: 'absolute', left: '-10000px', top: 0, width: 600, pointerEvents: 'none' }}
>
```
with:
```tsx
<div className="bg-white w-full flex justify-center">
```
Inside the `{v2Template && (` … `containerType: inline-size` wrapper (`AdvancedToolsBar.tsx:804-...`): remove the two standalone overlays
```tsx
<WatermarkPreviewOverlay watermark={watermark} />
<BadgePreviewOverlay visible={shouldStampBadge({ isPaidPro: isPro, badgeEnabled })} />
```
and add, immediately AFTER the `<MockupRendererV2 … />` (inside the `containerType` wrapper):
```tsx
<MockupCropStage
  preset={activePreset}
  offset={socialOffsets[activeSlug] ?? 0.5}
  onChangeOffset={next => setSocialOffsets(prev => ({ ...prev, [activeSlug]: next }))}
  isBusy={isCapturingFullRes}
  watermark={watermark}
  badgeVisible={shouldStampBadge({ isPaidPro: isPro, badgeEnabled })}
/>
```

- [ ] **Step 5: Throttle the snapshot**

In `onRenderComplete` (`AdvancedToolsBar.tsx:850-864`), replace the `if (!isCapturingFullRes) { … toDataURL … }` block with:
```tsx
  // Snapshot for the size-grid thumbnails only — throttled off the render hot path.
  if (!isCapturingFullRes) snapshotThrottleRef.current?.call();
```
(Keep the `downloadAfterRenderRef` block above it untouched.)

- [ ] **Step 6: Remove stale comments**

Run: `grep -n "10000\|inert\|off-screen\|offscreen\|hidden snapshot\|Definite 600px\|WIDTH-DRIVEN" src/components/layout/AdvancedToolsBar.tsx`
Update/remove the now-false off-screen comments (the `Definite 600px wrapper` / `WIDTH-DRIVEN` sizing comments still apply to the on-screen wrapper — keep those, they document the non-collapsing sizing that is still needed).

- [ ] **Step 7: Type-check, lint, test**

Run: `npx tsc --noEmit && npx eslint src/components/layout/AdvancedToolsBar.tsx && npx vitest run`
Expected: `tsc` exit 0; eslint 0 errors; vitest all passing. Remove now-unused `WatermarkPreviewOverlay`/`BadgePreviewOverlay` imports if flagged.

- [ ] **Step 8: Diff the two modal bodies to confirm they stayed in sync**

Run:
```bash
diff <(sed -n '/MockupCropStage/,/^\s*\/>/p' src/components/sidebar/ActionsSidebar.tsx) \
     <(sed -n '/MockupCropStage/,/^\s*\/>/p' src/components/layout/AdvancedToolsBar.tsx)
```
Expected: the `<MockupCropStage …/>` blocks are identical (empty diff). Eyeball the `onRenderComplete` and renderer wrapper in both — they must match except for `tileWidth`/`tileHeight` (`tileWidth` vs `renderTileWidth`).

- [ ] **Step 9: Commit**

```bash
git add src/components/layout/AdvancedToolsBar.tsx
git commit -m "feat: AdvancedToolsBar live preview + crop overlay + throttled snapshot (Model A)"
```

---

### Task 7: Automated gate + manual device verification

**Files:** none (verification only)

- [ ] **Step 1: Full automated gate**

Run:
```bash
npx tsc --noEmit && npx vitest run && npx eslint src/components/mockups/MockupCropStage.tsx src/components/mockups/MockupDownloadMenu.tsx src/components/sidebar/ActionsSidebar.tsx src/components/layout/AdvancedToolsBar.tsx src/lib/export/cropFraming.ts src/lib/utils/trailingThrottle.ts
```
Expected: `tsc` exit 0; vitest 69 prior + 10 new passing; eslint 0 errors (pre-existing warnings OK).

- [ ] **Step 2: Confirm the snapshot/anchor dead code is gone**

Run: `grep -rn "snapshotUrl=" src/components/mockups/MockupDownloadMenu.tsx` (still present — thumbnails) and
`grep -rn "MockupCropStage" src` — expected: defined once, imported by `ActionsSidebar` + `AdvancedToolsBar` only (NOT by `MockupDownloadMenu`).

- [ ] **Step 3: Boot the app**

Run: `npm run dev`
Open the mockup modal from BOTH entry points (ActionsSidebar download panel + AdvancedToolsBar).

- [ ] **Step 4: Manual desktop checklist**

- [ ] The visible preview is the live mockup canvas (not a frozen snapshot).
- [ ] **Pattern drag works again:** dragging on the product moves the pattern tiles (the regression is fixed).
- [ ] **Scale is responsive:** changing tile scale updates the preview promptly (no large-PNG round-trip lag). *(AdvancedToolsBar scale control only.)*
- [ ] Tap **Square** row → gold box + center grab-bar appear; drag the bar up/down → frame slides; the row thumbnail framing agrees with the box.
- [ ] Repeat for **Portrait**.
- [ ] **Story** shows a static centered band (no grab bar); **Pinterest / Full size** show no crop box. Pattern drag still works on all of them.
- [ ] The action label reads "Moving the pattern · grab the gold bar to frame" when idle on a croppable size, and "Sliding the crop frame ↕" while dragging the bar.
- [ ] Download Square + Portrait → open PNGs → framing matches where you left the bar; watermark/badge land where the overlay previewed them.
- [ ] Download everything centered (untouched) → output byte-compatible with pre-feature center export.

- [ ] **Step 5: Manual iPad / Apple Pencil checklist (mandatory parity)**

- [ ] Grab bar drags smoothly with **finger AND Pencil**; the page does not scroll while dragging (`touch-action:none`).
- [ ] Pattern drag works with finger AND Pencil in the non-handle areas.
- [ ] The grab bar is an easy ≥44px target; the crop box stays in bounds at offset extremes.

- [ ] **Step 6: Curtain template note (deferred limitation)**

- [ ] On the **Curtain** template (3600×4500 = 0.8 aspect), confirm the known geometry mismatch is unchanged (not made worse). It remains deferred — do not fix here.

- [ ] **Step 7: If a fixup was needed, commit it**

```bash
git commit -am "test: verify live preview + Model A crop across desktop + iPad/Pencil"
```

---

## Self-review checklist (completed during authoring)

- **Spec coverage:** live renderer on-screen as primary preview (Tasks 5–6) ✓; crop framing as overlay on live canvas (Task 4) ✓; Model A contextual gesture — pattern default, grab to frame (Tasks 4–6) ✓; watermark/badge on crop region (Task 4) ✓; size list + download retained, crop removed from menu (Task 3) ✓; throttled thumbnail snapshot, removed from hot path (Tasks 2, 5, 6) ✓; iPad/Pencil parity (Task 7) ✓; data-flow `socialOffsets`/`patternOffsets` preserved (Tasks 3–6) ✓; both consumers kept in sync (Task 6 Step 8) ✓; Curtain deferred (Task 7 Step 6) ✓.
- **Type consistency:** `computePreviewCropFractions(preset, offset) → { mode, leftFraction, topFraction, widthFraction, heightFraction, travel }` used identically in Task 1 and Task 4. `createTrailingThrottle(fn, ms) → { call, cancel }` used identically in Tasks 2, 5, 6. `MockupCropStage` props (Task 4) match exactly what the consumers pass (Tasks 5–6): `preset, offset, onChangeOffset, isBusy, watermark, badgeVisible`. `MockupDownloadMenu` trimmed props (Task 3) match what consumers still pass after Task 3 Step 4.
- **Placeholder scan:** none — all steps carry concrete code, exact file:line anchors, and runnable commands.
- **Deviation flagged:** handle-only grab target (vs literal "crop box" grab) is documented as decision #1 and surfaced in the Task 7 manual test for Mandy's judgment.
