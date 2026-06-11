# Unified Mockup Download Menu — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the Mockup Modal's full-size download (header button) and its social-size exports into ONE selectable "Download mockup" menu — a checklist of sizes (Full size + 4 social) with a single Download button (single PNG, or zip if 2+).

**Architecture:** Add a `full-size` size descriptor and a `mockupDownloadSizes()` list builder to `socialSizes.ts`. Teach the shared export loop in `mockupSocialExport.ts` to route `full-size` through a non-cropped ½-downscale + 150-DPI path (today's header-Download behavior) while social slugs keep cover-crop. Both Mockup-Modal entry points (`AdvancedToolsBar`, `ActionsSidebar`) render the unified list and drop the separate header Download button (removed from `MockupModal`).

**Tech Stack:** Next.js + React + TypeScript, HTML Canvas 2D, Vitest (jsdom), JSZip.

**Spec:** `docs/superpowers/specs/2026-06-11-unified-mockup-download-menu-design.md`

**Branch:** continue on `feat/mockup-social-exports` (Tasks 1–6 of the prior plan already merged into this branch's history; this builds on them). Do NOT push/merge — user verifies first.

---

## File Structure

| File | Responsibility | Create/Modify |
|---|---|---|
| `src/lib/export/socialSizes.ts` | Add `full-size` slug + `FULL_SIZE_PRESET` + `mockupDownloadSizes()` (full-size first, then social) | **Modify** |
| `src/__tests__/socialSizes.test.ts` | Test the new `mockupDownloadSizes()` ordering/contents | **Modify** |
| `src/lib/utils/mockupSocialExport.ts` | Add `exportFullSizeMockupBlob()`; route `full-size` inside `downloadMockupSocialSizes()` | **Modify** |
| `src/components/layout/AdvancedToolsBar.tsx` | Replace body social section with unified list; drop header `onDownload`; default-select/reset to `{full-size}` | **Modify** |
| `src/components/sidebar/ActionsSidebar.tsx` | Identical redesign (mirror entry point) | **Modify** |
| `src/components/mockups/MockupModal.tsx` | Remove header "Download" button + now-unused `onDownload`/`isDownloading` props | **Modify** |

**Note on the two UI files:** `AdvancedToolsBar.tsx` and `ActionsSidebar.tsx` contain near-identical Mockup-Modal export blocks. Apply Tasks 3 and 4 as the same change in each. Read each file's current block before editing — line numbers below are approximate.

---

## Task 1: Add the `full-size` descriptor + unified list builder

**Files:**
- Modify: `src/lib/export/socialSizes.ts`
- Test: `src/__tests__/socialSizes.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/__tests__/socialSizes.test.ts`:

```typescript
import { mockupDownloadSizes, FULL_SIZE_SLUG } from '../lib/export/socialSizes';

describe('mockupDownloadSizes', () => {
  it('lists Full size first, then the four croppable social sizes', () => {
    const slugs = mockupDownloadSizes().map(p => p.slug);
    expect(slugs).toEqual([
      'full-size',
      'instagram-post',
      'instagram-portrait',
      'story',
      'pinterest-pin',
    ]);
  });
  it('full-size descriptor outputs 1500×2250', () => {
    const full = mockupDownloadSizes().find(p => p.slug === FULL_SIZE_SLUG)!;
    expect([full.pxW, full.pxH]).toEqual([1500, 2250]);
  });
  it('does not leak full-size into the Social Export presets', () => {
    // SOCIAL_SIZE_PRESETS feeds the (separate) Social Export modal — must stay 5 platform sizes.
    const { SOCIAL_SIZE_PRESETS } = require('../lib/export/socialSizes');
    expect(SOCIAL_SIZE_PRESETS.map((p: { slug: string }) => p.slug)).not.toContain('full-size');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/socialSizes.test.ts`
Expected: FAIL — `mockupDownloadSizes` / `FULL_SIZE_SLUG` not exported.

- [ ] **Step 3: Implement in `socialSizes.ts`**

Add `'full-size'` to the `SizeSlug` union (it currently lists the 5 platform slugs):

```typescript
export type SizeSlug =
  | 'instagram-post'
  | 'instagram-portrait'
  | 'story'
  | 'pinterest-pin'
  | 'facebook-cover'
  | 'full-size';
```

Then append (after `mockupSocialSizes()`):

```typescript
/** Slug for the non-cropped, full-size mockup download (the whole product shot). */
export const FULL_SIZE_SLUG = 'full-size' as const;

/** Full-size mockup output: ½ of the 3000×4500 render = 1500×2250 @ 150 DPI.
 *  Deliberately NOT in SOCIAL_SIZE_PRESETS so the Social Export modal's size list is unaffected. */
export const FULL_SIZE_PRESET: SocialSizePreset = {
  slug: 'full-size',
  label: 'Full size',
  pxW: 1500,
  pxH: 2250,
};

/** Ordered list for the unified Mockup Modal download menu: Full size first, then the
 *  four croppable social sizes (no FB Cover). */
export function mockupDownloadSizes(): SocialSizePreset[] {
  return [FULL_SIZE_PRESET, ...mockupSocialSizes()];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/socialSizes.test.ts`
Expected: PASS (the 3 prior `mockupSocialSizes` tests + the 3 new ones).

- [ ] **Step 5: Commit**

```bash
git add src/lib/export/socialSizes.ts src/__tests__/socialSizes.test.ts
git commit -m "feat: add full-size descriptor + mockupDownloadSizes list builder

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Route `full-size` through the export helper

**Files:**
- Modify: `src/lib/utils/mockupSocialExport.ts`

The file already has `coverCropToBlob`, `exportMockupSocialBlob`, `MockupSocialOpts`, and `downloadMockupSocialSizes` (which loops presets, single-file vs zip via JSZip + `downloadBlob`). Add a non-cropped full-size path and branch the loop on slug. Imports in this file are **relative paths** (no `@/` alias — `vitest.config.ts` has no alias); keep that convention.

- [ ] **Step 1: Add imports + the full-size blob function**

Add near the existing imports:

```typescript
import { injectPngDpi } from './dpiMetadata';
import { FULL_SIZE_SLUG } from '../export/socialSizes';
```

Append after `exportMockupSocialBlob`:

```typescript
/** Full-DPI output for the full-size mockup download. Matches the prior header-Download. */
const FULL_SIZE_OUTPUT_DPI = 150;

/** Full-size clean mockup: downscale the full render by ½ (3000×4500 → 1500×2250),
 *  composite watermark/badge, inject 150 DPI. NOT cover-cropped — it's the whole shot. */
export async function exportFullSizeMockupBlob(
  source: HTMLCanvasElement,
  opts: MockupSocialOpts,
): Promise<Blob> {
  const w = Math.round(source.width / 2);
  const h = Math.round(source.height / 2);
  const dl = document.createElement('canvas');
  dl.width = w;
  dl.height = h;
  const ctx = dl.getContext('2d');
  if (!ctx) throw new Error('exportFullSizeMockupBlob: no 2d context');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, w, h);
  let blob: Blob = await new Promise((resolve, reject) =>
    dl.toBlob(
      b => (b ? resolve(b) : reject(new Error('exportFullSizeMockupBlob: toBlob returned null'))),
      'image/png',
    ),
  );
  const wm = opts.watermark;
  if (wm.enabled && (wm.text.trim() || wm.logoDataUrl)) {
    blob = await applyWatermarkToBlob(blob, w, h, wm, 'png');
  }
  if (shouldStampBadge({ isPaidPro: opts.isPro, badgeEnabled: opts.badgeEnabled })) {
    blob = await applyBadgeToBlob(blob, w, h, 'png');
  }
  return injectPngDpi(blob, FULL_SIZE_OUTPUT_DPI);
}
```

- [ ] **Step 2: Branch the download loop on slug**

In `downloadMockupSocialSizes`, inside the `for (const preset of presets)` loop, replace the single `exportMockupSocialBlob(source, preset, opts)` call with:

```typescript
      const blob = preset.slug === FULL_SIZE_SLUG
        ? await exportFullSizeMockupBlob(source, opts)
        : await exportMockupSocialBlob(source, preset, opts);
      results.push({ preset, blob });
```

(Keep the existing `try/catch` that pushes `{ preset, blob: null }` and the `console.error` on failure. The single-file vs zip logic and `${baseName}-${preset.slug}.png` naming below it are unchanged — a lone full-size selection downloads as `<base>-full-size.png`.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add src/lib/utils/mockupSocialExport.ts
git commit -m "feat: route full-size through downloadMockupSocialSizes (non-cropped, 150 DPI)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Unified "Download mockup" list in AdvancedToolsBar

**Files:**
- Modify: `src/components/layout/AdvancedToolsBar.tsx`

Current state to work from (read these first):
- Imports ~line 21: `mockupSocialSizes`, `type SizeSlug`, `downloadMockupSocialSizes`, `isFreeSocialSize`, `isFreeMockup`.
- `socialSizes` Set state ~line 164; resets `setSocialSizes(new Set())` at the per-template `useEffect` and both modal `onClose` sites.
- `onSocialExport` handler ~lines 484-517.
- Header Download wiring: `onDownload` (the `downloadAfterRenderRef.current` single-file block ~lines 531-608) passed to `MockupModal`; plus `isDownloading` prop.
- Body section "Share to social — clean mockup" ~lines 803-851.
- Shared infra reused as-is: `downloadAfterRenderRef`, `setIsCapturingFullRes`, `isCapturingFullRes`, `isPro`, `proAllowed`, `verifyProAccess`, `setIsUpgradeModalOpen`, `watermark`, `badgeEnabled`, `sanitizeFilename`, `originalFilename`, `mockupName`, `selectedMockup`.

- [ ] **Step 1: Update the import**

Change the `socialSizes` import to add the list builder + full-size slug:

```typescript
import { mockupDownloadSizes, FULL_SIZE_SLUG, type SizeSlug } from '@/lib/export/socialSizes';
```

(Remove `mockupSocialSizes` from this file's imports if it's no longer referenced after this task — verify with grep at the end.)

- [ ] **Step 2: Add a default-selection helper + use it for state init/reset**

Add this small pure helper near the top of the component module (above the component, or inline as a `const`):

```typescript
// Full size is preselected when it's downloadable for the current template/user;
// if it's Pro-locked (free user on a paid template), start with nothing selected.
function defaultDownloadSelection(canFullSize: boolean): Set<SizeSlug> {
  return canFullSize ? new Set<SizeSlug>([FULL_SIZE_SLUG]) : new Set<SizeSlug>();
}
```

Where `canFullSize` for this file = `proAllowed || isFreeMockup(selectedMockup)`.

Replace the three `setSocialSizes(new Set())` resets (per-template `useEffect` + both `onClose`) with:

```typescript
setSocialSizes(defaultDownloadSelection(proAllowed || isFreeMockup(selectedMockup)));
```

And initialize the state the same way if practical (otherwise the `useEffect` reset on first template select covers it).

- [ ] **Step 3: Generalize the handler (rename `onSocialExport` → `onDownloadExport`)**

Replace the preset filter + the Pro guard so it covers the full-size row too:

```typescript
const onDownloadExport = async () => {
  if (socialSizes.size === 0) return;

  const presets = mockupDownloadSizes().filter(p => socialSizes.has(p.slug));

  // Any selected row that isn't free for this user requires Pro.
  const needsPro = presets.some(p =>
    p.slug === FULL_SIZE_SLUG ? !isFreeMockup(selectedMockup) : !isFreeSocialSize(p.slug),
  );
  if (needsPro && !proAllowed) {
    const allowed = await verifyProAccess();
    if (!allowed) { setIsUpgradeModalOpen(true); return; }
  }

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
        mockupCanvas, presets, { watermark, isPro: !!isPro, badgeEnabled }, baseName,
      );
    } finally {
      setIsCapturingFullRes(false);
    }
  };
  setIsCapturingFullRes(true);
};
```

- [ ] **Step 4: Replace the body section JSX**

Swap the "Share to social — clean mockup" block (~803-851) for the unified list. The per-row `locked` differs by slug:

```tsx
<div className="flex flex-col gap-2 border-t border-[#92afa5]/30 pt-3">
  <span className="text-[11px] font-bold uppercase tracking-wide text-[#294051]">
    Download mockup
  </span>
  <div className="flex flex-wrap gap-1.5">
    {mockupDownloadSizes().map(preset => {
      const locked = preset.slug === FULL_SIZE_SLUG
        ? (!isPro && !isFreeMockup(selectedMockup))
        : (!isPro && !isFreeSocialSize(preset.slug));
      const checked = socialSizes.has(preset.slug);
      const label = preset.slug === FULL_SIZE_SLUG
        ? 'Full size'
        : preset.label.replace('Instagram / Facebook ', '');
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
          {locked ? '🔒 ' : ''}{label} {preset.pxW}×{preset.pxH}
        </button>
      );
    })}
  </div>
  <button
    type="button"
    disabled={socialSizes.size === 0 || isCapturingFullRes}
    onClick={onDownloadExport}
    className="text-xs rounded-md px-3 py-2 bg-[#294051] text-white font-semibold disabled:opacity-50"
    style={{ touchAction: 'manipulation' }}
  >
    {isCapturingFullRes
      ? 'Generating…'
      : `Download ${socialSizes.size || ''} file${socialSizes.size === 1 ? '' : 's'}`.replace('  ', ' ')}
  </button>
</div>
```

- [ ] **Step 5: Remove the header Download wiring**

Delete the `onDownload={...}` single-file callback block (~531-608) and stop passing `onDownload` / `isDownloading` to `MockupModal` (Task 5 removes them from `MockupModal`'s props). Keep `downloadAfterRenderRef`, `setIsCapturingFullRes`, `isCapturingFullRes` — the unified `onDownloadExport` still uses them. Remove any now-unused imports (e.g. `applyWatermarkToBlob`, `applyBadgeToBlob`, `injectPngDpi`, `downloadBlobAsImage`, `shouldStampBadge`) ONLY if grep confirms zero remaining uses in this file.

- [ ] **Step 6: Type-check + lint**

Run: `npx tsc --noEmit`
Run: `npx eslint src/components/layout/AdvancedToolsBar.tsx`
Run: `grep -n "mockupSocialSizes\|onSocialExport\|isDownloading\|downloadCanvasAsImage" src/components/layout/AdvancedToolsBar.tsx` (expect no stale references)
Expected: tsc clean; no NEW eslint warnings.

- [ ] **Step 7: Commit**

```bash
git add src/components/layout/AdvancedToolsBar.tsx
git commit -m "feat: unified Download mockup menu in AdvancedToolsBar (retire header button)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Mirror the redesign in ActionsSidebar

**Files:**
- Modify: `src/components/sidebar/ActionsSidebar.tsx`

This file has the same structure: `socialSizes` state (~line 61), the single-file `onDownload` block (~lines 375-439, now downscale+150 DPI from the earlier Option-2 work), `onSocialExport` (~line 597), the body chips (~632-681), and it renders `MockupModal`. Apply the **same** changes as Task 3, substituting this file's names. Note: in this file `selectedMockup`, `getV2Template`, `originalFilename` are used to build `baseName` (template name comes from `getV2Template(selectedMockup)?.name` here, not `mockupName`).

- [ ] **Step 1: Update import** — same as Task 3 Step 1 (`mockupDownloadSizes`, `FULL_SIZE_SLUG`, `type SizeSlug`); drop `mockupSocialSizes` if unreferenced after.

- [ ] **Step 2: Default selection + resets** — add the same `defaultDownloadSelection` helper; replace this file's `setSocialSizes(new Set())` reset site(s) with `setSocialSizes(defaultDownloadSelection(proAllowed || isFreeMockup(selectedMockup)))`. `canFullSize` here = `proAllowed || isFreeMockup(selectedMockup)`.

- [ ] **Step 3: Generalize handler** — replace this file's `onSocialExport` with the `onDownloadExport` body from Task 3 Step 3, but build `baseName` using this file's pattern:

```typescript
  const template = getV2Template(selectedMockup);
  const templateSlug = template?.name?.toLowerCase().replace(/\s+/g, '-') || 'mockup';
  const baseName = sanitizeFilename(
    originalFilename ? `${originalFilename}-${templateSlug}` : `mockup-${templateSlug}`,
    'mockup',
  );
```

- [ ] **Step 4: Replace body chips** with the unified list JSX from Task 3 Step 4 (identical).

- [ ] **Step 5: Remove the old single-file `onDownload` block + header Download wiring** (the ~375-439 `downloadAfterRenderRef.current` block and the `onDownload`/`isDownloading` props passed to `MockupModal`). Keep `downloadAfterRenderRef`/`setIsCapturingFullRes`. Remove now-unused imports (`injectPngDpi`, `applyWatermarkToBlob`, `applyBadgeToBlob`, `shouldStampBadge`, `downloadBlobAsImage`) ONLY if grep confirms zero remaining uses.

- [ ] **Step 6: Type-check + lint**

Run: `npx tsc --noEmit`
Run: `npx eslint src/components/sidebar/ActionsSidebar.tsx`
Run: `grep -n "mockupSocialSizes\|onSocialExport\|isDownloading" src/components/sidebar/ActionsSidebar.tsx`
Expected: tsc clean; no NEW eslint warnings; no stale refs.

- [ ] **Step 7: Commit**

```bash
git add src/components/sidebar/ActionsSidebar.tsx
git commit -m "feat: unified Download mockup menu in ActionsSidebar (mirror entry point)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Remove the header Download button from MockupModal

**Files:**
- Modify: `src/components/mockups/MockupModal.tsx`

The header button lives ~lines 66-82 and reads `onDownload` + `isDownloading` props. After Tasks 3-4 nothing passes them.

- [ ] **Step 1: Confirm no other callers**

Run: `grep -rn "MockupModal" src/ | grep -v "MockupModal.tsx:"`
Run: `grep -rn "onDownload\|isDownloading" src/components/mockups/MockupModal.tsx`
Confirm only `AdvancedToolsBar` and `ActionsSidebar` render `MockupModal`, and both no longer pass `onDownload`/`isDownloading`.

- [ ] **Step 2: Remove the button + props**

Delete the header `<button>` that calls `onDownload` (~66-82) and remove `onDownload` and `isDownloading` from the component's props interface and destructure. Leave the close button and the rest of the header intact.

- [ ] **Step 3: Type-check + lint + tests**

Run: `npx tsc --noEmit`
Run: `npx eslint src/components/mockups/MockupModal.tsx`
Run: `npx vitest run`
Expected: tsc clean; no NEW eslint warnings; tests green.

- [ ] **Step 4: Commit**

```bash
git add src/components/mockups/MockupModal.tsx
git commit -m "feat: remove redundant header Download button from MockupModal

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Manual verification (desktop + iPad)

Canvas output isn't assertable in jsdom — verify by running the app. ~half of users are iPad/Pencil; touch parity is mandatory.

- [ ] **Step 1:** `npm run dev`; load a pattern; open the Mockup Modal on a template (both via AdvancedToolsBar and via ActionsSidebar entry).

- [ ] **Step 2 — unified menu present:** One "Download mockup" list with rows Full size 1500×2250, Post 1080×1080, Portrait 1080×1350, Story 1080×1920, Pinterest 1000×1500. **No** top-right header Download button. Full size checked by default.

- [ ] **Step 3 — single + zip:** With only Full size checked → click Download → a single `…-full-size.png` at **1500×2250 @ 150 DPI** with logo + badge (matches the old header download). Then select Full size + all four → Download → one zip with 5 PNGs at correct dims (Post 2160×2160, Portrait 2160×2700, Story 2160×3840, Pinterest 2000×3000, Full 1500×2250). Social ones cover-cropped, no pattern wallpaper, dragged placement honored; Full size is the whole shot.

- [ ] **Step 4 — gating:** Free user on a free template: Full size + Post selectable; Portrait/Story/Pinterest 🔒 → upgrade modal. Free user on a Pro template: Full size 🔒, nothing selected by default, Download disabled until a free option (none) — confirm 🔒 opens upgrade.

- [ ] **Step 5 — both entry points** behave identically (AdvancedToolsBar modal and ActionsSidebar modal).

- [ ] **Step 6 — iPad/touch:** rows toggle on tap, Download works, no hover-only affordances.

- [ ] **Step 7:** Social Export modal (`RepeatExportModal`) unchanged; Task-6 signpost note still present and accurate.

- [ ] **Step 8 — final commit (if fixes needed):**

```bash
git add -A
git commit -m "fix: address unified download menu issues found in manual verification

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

**Do NOT push or merge — the user does that after verification.**

---

## Self-Review (author)

- **Spec coverage:** one unified list (Task 3/4 UI) · Full size as first item, non-cropped 1500×2250 @ 150 DPI (Task 1 descriptor + Task 2 `exportFullSizeMockupBlob`) · single-file vs zip incl. mixed (Task 2 reuses existing loop) · gating preserved per-row (Task 3/4 `locked` branch + `needsPro` guard) · default = `{full-size}` when unlocked, reset on template change/close (Task 3/4 Step 2) · both entry points (Task 3 + Task 4) · header button removed (Task 5) · signpost note untouched (verified Task 6 Step 7) · iPad (Task 6 Step 6). All covered.
- **Type consistency:** `SizeSlug` gains `'full-size'` (Task 1) and is used identically in 3/4; `FULL_SIZE_SLUG`, `FULL_SIZE_PRESET`, `mockupDownloadSizes`, `exportFullSizeMockupBlob` defined once and referenced unchanged. `downloadMockupSocialSizes` signature unchanged — callers just pass a different presets array.
- **Non-goals untouched:** no background fill / transparent PNG / FB Cover mockup / custom crop. Social Export modal logic untouched.
