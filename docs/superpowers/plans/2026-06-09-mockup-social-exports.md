# Clean Mockup → Social-Size Exports — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users export the clean product mockup (no pattern wallpaper behind it) across social sizes — Square, Portrait 4:5, Story, Pinterest — cropped-to-fill, with logo + badge, from the Mockup Modal.

**Architecture:** Reuse the already-rendered full-res mockup canvas (3000×4500). For each selected size, cover-crop it into a 2×-scaled target canvas, then reuse the existing `applyWatermarkToBlob` / `applyBadgeToBlob` compositors. Social-size presets get extracted to one shared module so both modals agree. The clean-mockup export lives in a shared helper called by both Mockup-Modal entry points (AdvancedToolsBar + ActionsSidebar). The Social Export modal is unchanged except for one signpost note.

**Tech Stack:** Next.js + React + TypeScript, HTML Canvas 2D, Vitest (jsdom), JSZip.

**Spec:** `docs/superpowers/specs/2026-06-09-mockup-social-exports-design.md`

## Execution progress

- [x] **Task 1 — DONE** (`04df5d8`): shared `socialSizes.ts` module + test; `RepeatExportModal` rewired.
- [x] **Task 2 — DONE** (`dddafcd`): pure `computeCoverCropRect` + 4 TDD tests. Spec ✅ + quality ✅.
- [x] **Task 3 — DONE** (`243ade4`): canvas blob + multi-size download/zip helper (+ `console.error` from review). Spec ✅ + quality ✅.
- [x] **Task 4 — DONE** (`d4f09de`): Mockup Modal UI + handler in AdvancedToolsBar (+ stale-selection reset + label fix from review). Spec ✅ + quality ✅.
- [~] **Task 5 — COMMITTED, AWAITING SCOPE DECISION** (`68aca30`): ActionsSidebar social export is spec-compliant, but it also rewired the existing "Download mockup" button (preview-res → full 3000×4500). See `docs/superpowers/HANDOFF-mockup-social-exports.md` → "THE DECISION TO MAKE FIRST" (Options 1/2/3). Resume here.
- [ ] Task 6 — Social signpost note (RepeatExportModal)
- [ ] Task 7 — Manual verification (desktop + iPad); user tests before any merge/push.

**Resume:** read `docs/superpowers/HANDOFF-mockup-social-exports.md`, re-ask the Task 5 scope decision, then finalize Task 5 → Task 6 → Task 7 via superpowers:subagent-driven-development on `feat/mockup-social-exports`. Don't push/merge.

---

## File Structure

| File | Responsibility | Create/Modify |
|---|---|---|
| `src/lib/export/socialSizes.ts` | Single source of truth for social size presets + which are mockup-eligible | **Create** |
| `src/__tests__/socialSizes.test.ts` | Unit tests for eligibility filter | **Create** |
| `src/lib/utils/mockupSocialExport.ts` | Cover-crop geometry (pure) + per-size blob + multi-size download/zip | **Create** |
| `src/__tests__/mockupSocialExport.test.ts` | Unit tests for `computeCoverCropRect` | **Create** |
| `src/components/export/RepeatExportModal.tsx` | Import shared presets (refactor); add signpost note | **Modify** |
| `src/components/layout/AdvancedToolsBar.tsx` | Mockup-modal social-export UI + handler (primary entry) | **Modify** |
| `src/components/sidebar/ActionsSidebar.tsx` | Same export via shared helper (secondary entry) | **Modify** |

**Decomposition rationale:** the *math* (cover-crop) is pure and fully unit-testable; the *canvas glue* and *UI* are verified by running the app, matching how this codebase already treats canvas code (see `src/__tests__/patternpalBadge.test.ts`, which tests geometry, not pixels). The download/zip orchestration is centralized in the helper so the two entry points can't drift.

---

## Task 1: Shared social-size presets module

Extract the size presets out of `RepeatExportModal.tsx` so the Mockup Modal can reuse them, and declare which sizes are eligible for clean-mockup export (all except FB Cover).

**Files:**
- Create: `src/lib/export/socialSizes.ts`
- Test: `src/__tests__/socialSizes.test.ts`
- Modify: `src/components/export/RepeatExportModal.tsx:60-93` (replace local definitions with imports)

- [ ] **Step 1: Create the shared module**

Create `src/lib/export/socialSizes.ts`:

```typescript
// src/lib/export/socialSizes.ts
// Single source of truth for social-media export size presets, shared by the
// Social Export modal (pattern graphics) and the Mockup Modal (clean product shots).

export type SizeSlug =
  | 'instagram-post'
  | 'instagram-portrait'
  | 'story'
  | 'pinterest-pin'
  | 'facebook-cover';

export interface SocialSizePreset {
  slug: SizeSlug;
  label: string;
  pxW: number;
  pxH: number;
}

export const SOCIAL_SIZE_PRESETS: SocialSizePreset[] = [
  { slug: 'instagram-post',     label: 'Instagram / Facebook Post',     pxW: 1080, pxH: 1080 },
  { slug: 'instagram-portrait', label: 'Instagram / Facebook Portrait', pxW: 1080, pxH: 1350 },
  { slug: 'story',              label: 'Story / Reel / TikTok',         pxW: 1080, pxH: 1920 },
  { slug: 'pinterest-pin',      label: 'Pinterest Pin',                 pxW: 1000, pxH: 1500 },
  { slug: 'facebook-cover',     label: 'Facebook Cover',                pxW: 1640, pxH: 624  },
];

/** Multiplier applied to preset pxW/pxH at export time (2× the platform size for
 *  anti-alias headroom; platforms recompress larger uploads). Matches the Social
 *  Export convention. */
export const SOCIAL_EXPORT_SCALE = 2;

/** Sizes NOT offered for clean-mockup export: a portrait 2:3 product cover-cropped
 *  into a wide banner shows only a horizontal sliver. */
export const MOCKUP_INELIGIBLE_SLUGS: SizeSlug[] = ['facebook-cover'];

/** Social sizes eligible for the clean-mockup export (all except FB Cover). */
export function mockupSocialSizes(): SocialSizePreset[] {
  return SOCIAL_SIZE_PRESETS.filter(p => !MOCKUP_INELIGIBLE_SLUGS.includes(p.slug));
}
```

- [ ] **Step 2: Write the failing test**

Create `src/__tests__/socialSizes.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  SOCIAL_SIZE_PRESETS,
  mockupSocialSizes,
  MOCKUP_INELIGIBLE_SLUGS,
} from '../lib/export/socialSizes';

describe('mockupSocialSizes', () => {
  it('excludes Facebook Cover', () => {
    const slugs = mockupSocialSizes().map(p => p.slug);
    expect(slugs).not.toContain('facebook-cover');
  });
  it('includes the four croppable sizes', () => {
    const slugs = mockupSocialSizes().map(p => p.slug);
    expect(slugs).toEqual([
      'instagram-post',
      'instagram-portrait',
      'story',
      'pinterest-pin',
    ]);
  });
  it('is exactly the presets minus the ineligible ones', () => {
    expect(mockupSocialSizes().length).toBe(
      SOCIAL_SIZE_PRESETS.length - MOCKUP_INELIGIBLE_SLUGS.length,
    );
  });
});
```

- [ ] **Step 3: Run the test to verify it passes**

Run: `npx vitest run src/__tests__/socialSizes.test.ts`
Expected: 3 passing (the module already exists from Step 1).

- [ ] **Step 4: Refactor RepeatExportModal to import the shared presets**

In `src/components/export/RepeatExportModal.tsx`:
- Delete the local `type SizeSlug = ...` union, the `interface SocialSizePreset { ... }`, the `const SOCIAL_SIZE_PRESETS = [...]`, and the `const SOCIAL_EXPORT_SCALE = 2;` (currently around lines 60-93).
- Add an import near the other `@/lib` imports:

```typescript
import {
  SOCIAL_SIZE_PRESETS,
  SOCIAL_EXPORT_SCALE,
  type SizeSlug,
  type SocialSizePreset,
} from '@/lib/export/socialSizes';
```

Leave everything else (`SOCIAL_PREVIEW_MAX_PX`, `socialPreviewDims`, `SocialSizeRow`, handlers) untouched — they keep working against the imported names.

- [ ] **Step 5: Verify the refactor changed nothing behaviorally**

Run: `npx vitest run` (all existing suites)
Run: `npx tsc --noEmit` (type-check passes — no missing/renamed symbols)
Expected: all green. This is a pure extraction; behavior is identical.

- [ ] **Step 6: Commit**

```bash
git add src/lib/export/socialSizes.ts src/__tests__/socialSizes.test.ts src/components/export/RepeatExportModal.tsx
git commit -m "refactor: extract shared social size presets to lib/export/socialSizes"
```

---

## Task 2: Cover-crop geometry (pure, TDD)

The heart of the feature: given a source canvas and a target size, compute the centered source sub-rectangle to draw (cover behavior).

**Files:**
- Create: `src/lib/utils/mockupSocialExport.ts`
- Test: `src/__tests__/mockupSocialExport.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/mockupSocialExport.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { computeCoverCropRect } from '../lib/utils/mockupSocialExport';

// Source is the full-res mockup: 3000×4500 (2:3 portrait).
const SRC_W = 3000;
const SRC_H = 4500;

describe('computeCoverCropRect', () => {
  it('returns the full source when target matches source aspect (2:3)', () => {
    const r = computeCoverCropRect(SRC_W, SRC_H, 1000, 1500);
    expect(r).toEqual({ sx: 0, sy: 0, sWidth: 3000, sHeight: 4500 });
  });

  it('crops top/bottom for a square target (1:1)', () => {
    const r = computeCoverCropRect(SRC_W, SRC_H, 1000, 1000);
    // keep full width, crop height to 3000, center vertically
    expect(r).toEqual({ sx: 0, sy: 750, sWidth: 3000, sHeight: 3000 });
  });

  it('crops top/bottom harder for a wide target (2:1)', () => {
    const r = computeCoverCropRect(SRC_W, SRC_H, 2000, 1000);
    expect(r).toEqual({ sx: 0, sy: 1500, sWidth: 3000, sHeight: 1500 });
  });

  it('crops the sides for a tall target (1:2)', () => {
    const r = computeCoverCropRect(SRC_W, SRC_H, 1000, 2000);
    expect(r).toEqual({ sx: 375, sy: 0, sWidth: 2250, sHeight: 4500 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/__tests__/mockupSocialExport.test.ts`
Expected: FAIL — `computeCoverCropRect` is not exported (module/file does not exist yet).

- [ ] **Step 3: Implement `computeCoverCropRect`**

Create `src/lib/utils/mockupSocialExport.ts` with just the pure function for now:

```typescript
// src/lib/utils/mockupSocialExport.ts
// Clean-mockup → social-size export. Cover-crops the full-res mockup canvas into
// each target social size, then reuses the existing watermark + badge compositors.

export interface CoverCropRect {
  sx: number;
  sy: number;
  sWidth: number;
  sHeight: number;
}

/** Centered "cover" crop: the largest centered sub-rectangle of the source that
 *  has the target's aspect ratio. Draw it onto the full target canvas to fill it
 *  edge-to-edge with no distortion. */
export function computeCoverCropRect(
  srcW: number,
  srcH: number,
  targetW: number,
  targetH: number,
): CoverCropRect {
  const srcAspect = srcW / srcH;
  const targetAspect = targetW / targetH;

  if (srcAspect > targetAspect) {
    // Source is wider than target -> crop left/right.
    const sWidth = Math.round(srcH * targetAspect);
    return { sx: Math.round((srcW - sWidth) / 2), sy: 0, sWidth, sHeight: srcH };
  }
  // Source is taller than (or equal to) target -> crop top/bottom.
  const sHeight = Math.round(srcW / targetAspect);
  return { sx: 0, sy: Math.round((srcH - sHeight) / 2), sWidth: srcW, sHeight };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/__tests__/mockupSocialExport.test.ts`
Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/mockupSocialExport.ts src/__tests__/mockupSocialExport.test.ts
git commit -m "feat: add cover-crop geometry for mockup social export"
```

---

## Task 3: Canvas export + multi-size download helper

Add the canvas glue: cover-crop to a blob, composite watermark/badge, and orchestrate single-file vs zip download. (Canvas pixel output is verified by running the app in Task 7 — jsdom can't rasterize.)

**Files:**
- Modify: `src/lib/utils/mockupSocialExport.ts` (append)

- [ ] **Step 1: Confirm the WatermarkConfig type is exported**

Run: `grep -n "WatermarkConfig" src/lib/watermark/watermark.ts | head`
Expected: a line like `export interface WatermarkConfig` (it's the type of `applyWatermarkToBlob`'s `wm` param). Use that exact exported name in the import below. If it is exported under a different name, use that name.

- [ ] **Step 2: Append the export + download functions**

Add to `src/lib/utils/mockupSocialExport.ts`:

```typescript
import JSZip from 'jszip';
import { downloadBlob } from '@/lib/utils/downloadCanvas';
import { applyWatermarkToBlob, type WatermarkConfig } from '@/lib/watermark/watermark';
import { applyBadgeToBlob, shouldStampBadge } from '@/lib/badge/patternpalBadge';
import { SOCIAL_EXPORT_SCALE, type SocialSizePreset } from '@/lib/export/socialSizes';

/** Cover-crop the source canvas into a fresh targetW×targetH canvas, returns PNG blob. */
export async function coverCropToBlob(
  source: HTMLCanvasElement,
  targetW: number,
  targetH: number,
): Promise<Blob> {
  const r = computeCoverCropRect(source.width, source.height, targetW, targetH);
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('coverCropToBlob: no 2d context');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, r.sx, r.sy, r.sWidth, r.sHeight, 0, 0, targetW, targetH);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      b => (b ? resolve(b) : reject(new Error('coverCropToBlob: toBlob returned null'))),
      'image/png',
    ),
  );
}

export interface MockupSocialOpts {
  watermark: WatermarkConfig;
  isPro: boolean;
  badgeEnabled: boolean;
}

/** Produce one social-sized clean-mockup PNG blob: cover-crop -> watermark -> badge. */
export async function exportMockupSocialBlob(
  source: HTMLCanvasElement,
  preset: SocialSizePreset,
  opts: MockupSocialOpts,
): Promise<Blob> {
  const w = preset.pxW * SOCIAL_EXPORT_SCALE;
  const h = preset.pxH * SOCIAL_EXPORT_SCALE;
  let blob = await coverCropToBlob(source, w, h);
  const wm = opts.watermark;
  if (wm.enabled && (wm.text.trim() || wm.logoDataUrl)) {
    blob = await applyWatermarkToBlob(blob, w, h, wm, 'png');
  }
  if (shouldStampBadge({ isPaidPro: opts.isPro, badgeEnabled: opts.badgeEnabled })) {
    blob = await applyBadgeToBlob(blob, w, h, 'png');
  }
  return blob;
}

/** Export all selected sizes. One file -> direct download; many -> a single zip.
 *  Mirrors the Social Export modal's download behavior. Returns any sizes that failed. */
export async function downloadMockupSocialSizes(
  source: HTMLCanvasElement,
  presets: SocialSizePreset[],
  opts: MockupSocialOpts,
  baseName: string,
): Promise<{ failed: SocialSizePreset[] }> {
  const results: { preset: SocialSizePreset; blob: Blob | null }[] = [];
  for (const preset of presets) {
    try {
      results.push({ preset, blob: await exportMockupSocialBlob(source, preset, opts) });
    } catch {
      results.push({ preset, blob: null });
    }
  }
  const ok = results.filter((r): r is { preset: SocialSizePreset; blob: Blob } => r.blob !== null);
  const failed = results.filter(r => r.blob === null).map(r => r.preset);

  if (ok.length === 1) {
    await downloadBlob(ok[0].blob, `${baseName}-${ok[0].preset.slug}.png`, 'image/png');
  } else if (ok.length > 1) {
    const zip = new JSZip();
    for (const r of ok) zip.file(`${baseName}-${r.preset.slug}.png`, r.blob);
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    await downloadBlob(zipBlob, `${baseName}-mockup-social.zip`, 'application/zip');
  }
  return { failed };
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: passes. If `WatermarkConfig` import errors, fix the name per Step 1.

- [ ] **Step 4: Commit**

```bash
git add src/lib/utils/mockupSocialExport.ts
git commit -m "feat: add mockup social-size blob + multi-size download helper"
```

---

## Task 4: Mockup Modal social-export UI + handler (AdvancedToolsBar — primary entry)

Add size selection + an export action inside the Mockup Modal. Reuses the existing full-res capture mechanism (`downloadAfterRenderRef` + `setIsCapturingFullRes`), then calls `downloadMockupSocialSizes` with the captured canvas.

**Files:**
- Modify: `src/components/layout/AdvancedToolsBar.tsx` (imports near line 21; new state near the other mockup state ~line 142; new handler + UI inside the `MockupModal` children block starting ~line 568)

- [ ] **Step 1: Add imports**

Near the existing `@/lib/utils` imports (around line 21-22):

```typescript
import { mockupSocialSizes, type SizeSlug } from '@/lib/export/socialSizes';
import { downloadMockupSocialSizes } from '@/lib/utils/mockupSocialExport';
import { isFreeSocialSize } from '@/lib/mockups/freeTier';
```

(`isFreeMockup` is already imported in this file; confirm `isFreeSocialSize` isn't already imported before adding.)

- [ ] **Step 2: Add selection state**

Next to the other mockup modal state (around line 142-159, where `selectedMockup`, `watermark`, `badgeEnabled` live):

```typescript
// Selected social sizes for the clean-mockup export (Mockup Modal).
const [socialSizes, setSocialSizes] = useState<Set<SizeSlug>>(new Set());
```

- [ ] **Step 3: Add the social-export handler**

Add this `async` callback alongside the existing `onDownload` (inside the same component scope so it closes over `watermark`, `isPro`, `badgeEnabled`, `selectedMockup`, `originalFilename`, `mockupName`, `downloadAfterRenderRef`, `setIsCapturingFullRes`). It mirrors `onDownload`'s capture pattern but loops sizes:

```typescript
const onSocialExport = async () => {
  if (socialSizes.size === 0) return;

  // Free users may export the free mockups; locked templates need Pro.
  if (!proAllowed && !isFreeMockup(selectedMockup)) {
    const allowed = await verifyProAccess();
    if (!allowed) { setIsUpgradeModalOpen(true); return; }
  }

  const presets = mockupSocialSizes().filter(p => socialSizes.has(p.slug));
  const templateSlug = mockupName?.toLowerCase().replace(/\s+/g, '-') || 'mockup';
  const baseName = sanitizeFilename(
    originalFilename ? `${originalFilename}-${templateSlug}` : `mockup-${templateSlug}`,
    'mockup',
  );

  downloadAfterRenderRef.current = async () => {
    try {
      const mockupCanvas = document.querySelector(
        '[data-mockup-modal] .mockup-canvas, [data-mockup-modal] canvas',
      ) as HTMLCanvasElement | null;
      if (!mockupCanvas) return;
      await downloadMockupSocialSizes(
        mockupCanvas,
        presets,
        { watermark, isPro: !!isPro, badgeEnabled },
        baseName,
      );
    } finally {
      setIsCapturingFullRes(false);
    }
  };
  setIsCapturingFullRes(true);
};
```

- [ ] **Step 4: Add the UI block**

Inside the `MockupModal` children — within the `<div className="flex flex-col gap-3">` block (opens ~line 568), append a section after the existing controls. Free users see only the square size selectable; the rest are locked to Pro:

```tsx
<div className="flex flex-col gap-2 border-t border-[#92afa5]/30 pt-3">
  <span className="text-[11px] font-bold uppercase tracking-wide text-[#294051]">
    Share to social — clean mockup
  </span>
  <div className="flex flex-wrap gap-1.5">
    {mockupSocialSizes().map(preset => {
      const locked = !isPro && !isFreeSocialSize(preset.slug);
      const checked = socialSizes.has(preset.slug);
      return (
        <button
          key={preset.slug}
          type="button"
          disabled={isCapturingFullRes}
          onClick={() => {
            if (locked) { setIsUpgradeModalOpen(true); return; }
            setSocialSizes(prev => {
              const next = new Set(prev);
              next.has(preset.slug) ? next.delete(preset.slug) : next.add(preset.slug);
              return next;
            });
          }}
          className={`text-xs rounded-md px-2.5 py-1.5 border transition-colors ${
            locked
              ? 'border-[#e5e7eb] bg-[#f9fafb] text-[#9ca3af]'
              : checked
                ? 'border-[#e0c26e] bg-[#faf3e0] text-[#294051] font-semibold'
                : 'border-[#e5e7eb] bg-white text-[#374151]'
          }`}
          style={{ touchAction: 'manipulation' }}
        >
          {locked ? '🔒 ' : ''}{preset.label.replace('Instagram / Facebook ', '')} {preset.pxW}×{preset.pxH}
        </button>
      );
    })}
  </div>
  <button
    type="button"
    disabled={socialSizes.size === 0 || isCapturingFullRes}
    onClick={onSocialExport}
    className="text-xs rounded-md px-3 py-2 bg-[#294051] text-white font-semibold disabled:opacity-50"
    style={{ touchAction: 'manipulation' }}
  >
    {isCapturingFullRes ? 'Generating…' : `Export ${socialSizes.size || ''} social size${socialSizes.size === 1 ? '' : 's'}`}
  </button>
</div>
```

> Note: `proAllowed`, `verifyProAccess`, `setIsUpgradeModalOpen`, `sanitizeFilename`, `isFreeMockup`, `originalFilename`, `mockupName`, `isPro`, `watermark`, `badgeEnabled`, `downloadAfterRenderRef`, `setIsCapturingFullRes`, and `isCapturingFullRes` are all already defined in this component (used by the existing `onDownload`). No new infrastructure needed.

- [ ] **Step 5: Type-check + lint**

Run: `npx tsc --noEmit`
Run: `npx eslint src/components/layout/AdvancedToolsBar.tsx`
Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/AdvancedToolsBar.tsx
git commit -m "feat: add clean-mockup social-size export to Mockup Modal (AdvancedToolsBar)"
```

---

## Task 5: Wire the second entry point (ActionsSidebar)

`ActionsSidebar.tsx` opens the same Mockup Modal independently (download logic at lines 387-409). Add the identical export path there using the same shared helper so the two entries stay consistent.

**Files:**
- Modify: `src/components/sidebar/ActionsSidebar.tsx`

- [ ] **Step 1: Read the existing mockup download block**

Run: `grep -n "downloadAfterRender\|setIsCapturingFullRes\|MockupModal\|applyBadgeToBlob\|watermark" src/components/sidebar/ActionsSidebar.tsx`
This shows the exact local variable names (they may differ slightly from AdvancedToolsBar — e.g. badge/watermark state). Use the names this file actually defines.

- [ ] **Step 2: Add imports**

```typescript
import { mockupSocialSizes, type SizeSlug } from '@/lib/export/socialSizes';
import { downloadMockupSocialSizes } from '@/lib/utils/mockupSocialExport';
import { isFreeSocialSize } from '@/lib/mockups/freeTier';
```

(`downloadBlobAsImage`, `isFreeMockup` may already be imported — don't duplicate.)

- [ ] **Step 3: Add the same selection state + handler + UI**

Replicate Task 4 Steps 2-4 in this component, substituting this file's local names for watermark/badge/pro state as found in Step 1. The handler body — the `downloadAfterRenderRef.current` capture + `downloadMockupSocialSizes(mockupCanvas, presets, { watermark, isPro, badgeEnabled }, baseName)` call — is identical because the heavy lifting lives in the shared helper. The UI block (size chips + Export button) is the same JSX.

> If `ActionsSidebar` uses a different mechanism than `downloadAfterRenderRef` to capture the full-res canvas, follow its existing `onDownload` pattern for *capturing the canvas*, then call `downloadMockupSocialSizes` with the captured canvas. Only the capture mechanism may differ; the export call does not.

- [ ] **Step 4: Type-check + lint**

Run: `npx tsc --noEmit`
Run: `npx eslint src/components/sidebar/ActionsSidebar.tsx`
Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/sidebar/ActionsSidebar.tsx
git commit -m "feat: add clean-mockup social-size export to Mockup Modal (ActionsSidebar entry)"
```

---

## Task 6: Social Export modal signpost note

Tell users who want a clean full-size mockup where to go, without changing any Social Export behavior.

**Files:**
- Modify: `src/components/export/RepeatExportModal.tsx` (near the mockup-overlay control)

- [ ] **Step 1: Locate the mockup-overlay control**

Run: `grep -n "mockup\|Mockup\|overlay" src/components/export/RepeatExportModal.tsx | head -30`
Find the JSX where the per-size mockup overlay toggle is rendered (the control that sets `mockupsRef`/`mockupCfg`).

- [ ] **Step 2: Add the note**

Adjacent to that control, add a static helper note:

```tsx
<p className="text-[11px] text-[#6b7280] leading-snug mt-1">
  💡 Want just the mockup at full size (no pattern background)?
  Export it from the Mockup Modal.
</p>
```

Match the surrounding className conventions if they differ; this is purely informational text, no logic.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add src/components/export/RepeatExportModal.tsx
git commit -m "feat: signpost clean-mockup export from the Social Export modal"
```

---

## Task 7: Manual verification (desktop + iPad)

Canvas output and modal UX can't be asserted in jsdom — verify by running the app. Use the `verify` skill if available.

- [ ] **Step 1: Build + run**

Run: `npm run dev`
Open the app, load a pattern, open the Mockup Modal on a template.

- [ ] **Step 2: Verify clean-mockup exports (Pro)**

- Drag the pattern to a deliberately off-center placement.
- Select all four sizes, click Export. Confirm a zip downloads with 4 PNGs.
- Open each: dimensions are Square 2160×2160, Portrait 2160×2700, Story 2160×3840, Pinterest 2000×3000 (each = preset × 2). Product fills the frame edge-to-edge, centered crop, **no pattern wallpaper behind it**, and **your dragged placement is reflected**.
- Confirm logo + "Tested in PatternPAL" badge appear.
- Select a single size → confirm a single PNG (no zip) downloads.

- [ ] **Step 3: Verify free-tier gating**

- As a free user on a free template: only the Square chip is selectable; the other three show 🔒 and open the upgrade modal on click.
- Exported square has the badge and no logo.

- [ ] **Step 4: Verify FB Cover is absent**

- Confirm no Facebook Cover chip appears in the Mockup Modal export row.

- [ ] **Step 5: Verify Social Export modal unchanged + note present**

- Open the Social Export modal: all 5 sizes, pattern fill, and pattern+mockup composite still work exactly as before.
- The signpost note is visible near the mockup-overlay control.

- [ ] **Step 6: Verify on iPad / touch**

- Repeat Step 2 on an iPad (or touch emulation): chips toggle on tap, Export works, no hover-only affordances. (≈half of users are iPad/Pencil.)

- [ ] **Step 7: Final commit (if any fixes were needed)**

```bash
git add -A
git commit -m "fix: address mockup social export issues found in manual verification"
```

---

## Self-Review Notes (author)

- **Spec coverage:** sizes (Task 1 eligibility + Task 4 UI), crop-to-fill (Task 2), logo+badge reuse (Task 3), full-res drag placement (Task 4 captures the same canvas `onDownload` uses → placement honored), gating (Task 4/5), FB Cover exclusion (Task 1), Social note (Task 6), two entry points (Task 4 + Task 5), iPad parity (Task 7 Step 6). All covered.
- **Non-goals untouched:** no background fill / transparent PNG / composite-divergence fix — none introduced.
- **Type consistency:** `SizeSlug`, `SocialSizePreset`, `SOCIAL_EXPORT_SCALE` defined once in Task 1 and imported everywhere; `computeCoverCropRect`/`coverCropToBlob`/`exportMockupSocialBlob`/`downloadMockupSocialSizes`/`MockupSocialOpts` defined in Tasks 2-3 and used unchanged in 4-5.
