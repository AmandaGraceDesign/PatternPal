# Free-Tier Mockups + Social Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let free users (anon + signed-in free) open/download 4 curated mockups and make an Instagram-square social export, with the catalog otherwise visible-but-locked, while logo watermark stays Pro-only and the "Tested in PatternPAL" badge stays permanent on free output.

**Architecture:** A single source-of-truth module (`freeTier.ts`) exports the 4 free template IDs + the free social size slug and two pure predicates. The mockup gallery, mockup-download handler, and social-export modal all read those predicates to gate per-item (which templates, which size) rather than walling the whole feature. No usage counters — the gate is *what's offered*, not *how many times*. Free output relies on the existing badge logic (`shouldStampBadge` already stamps all non-paid users).

**Tech Stack:** Next.js 16 / React 19 / TypeScript, Tailwind v4, Vitest. Spec: [docs/superpowers/specs/2026-05-30-free-tier-mockups-social-design.md](../specs/2026-05-30-free-tier-mockups-social-design.md).

---

## File Structure

- **Create** `src/lib/mockups/freeTier.ts` — `FREE_MOCKUP_IDS`, `FREE_SOCIAL_SIZE_SLUG`, `isFreeMockup(id)`, `isFreeSocialSize(slug)`. Single source of truth.
- **Create** `src/__tests__/freeTier.test.ts` — unit tests for the predicates/constants.
- **Modify** `src/components/mockups/MockupGalleryModal.tsx` — remove the blanket `!isPro` wall; per-card lock for non-free templates.
- **Modify** `src/components/layout/AdvancedToolsBar.tsx` — Social card opens the modal for everyone; allow free download of free templates; gate the mockup-modal `WatermarkPanel` to Pro; pass `onUpgrade` to the social modal.
- **Modify** `src/components/export/RepeatExportModal.tsx` — for non-Pro: lock non-IG size rows, restrict mockup-overlay choices to the free set, hide the `WatermarkPanel`, default to Instagram square.

> **Verification note (user preference):** Mandy tests UI herself. Automated steps cover the pure module (`vitest`) and a typecheck (`npm run build`). UI tasks end with **"start dev server, hand to Mandy"** + a manual checklist — do NOT drive the browser.

---

### Task 1: Free-tier source-of-truth module (TDD)

**Files:**
- Create: `src/lib/mockups/freeTier.ts`
- Test: `src/__tests__/freeTier.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/freeTier.test.ts
import { describe, it, expect } from 'vitest';
import {
  FREE_MOCKUP_IDS,
  FREE_SOCIAL_SIZE_SLUG,
  isFreeMockup,
  isFreeSocialSize,
} from '../lib/mockups/freeTier';

describe('free-tier constants', () => {
  it('exposes exactly the four curated free mockups', () => {
    expect([...FREE_MOCKUP_IDS].sort()).toEqual(
      ['onesie', 'throw-pillow', 'wallpaper', 'wrapping-paper'].sort(),
    );
  });
  it('uses the Instagram square as the free social size', () => {
    expect(FREE_SOCIAL_SIZE_SLUG).toBe('instagram-post');
  });
});

describe('isFreeMockup', () => {
  it('returns true for a curated free template', () => {
    expect(isFreeMockup('onesie')).toBe(true);
    expect(isFreeMockup('wrapping-paper')).toBe(true);
  });
  it('returns false for a locked template', () => {
    expect(isFreeMockup('mens-tie')).toBe(false);
    expect(isFreeMockup('nursery-wallpaper')).toBe(false);
  });
});

describe('isFreeSocialSize', () => {
  it('only the Instagram square is free', () => {
    expect(isFreeSocialSize('instagram-post')).toBe(true);
    expect(isFreeSocialSize('story')).toBe(false);
    expect(isFreeSocialSize('pinterest-pin')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/freeTier.test.ts`
Expected: FAIL — cannot find module `../lib/mockups/freeTier`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/mockups/freeTier.ts
/**
 * Single source of truth for what the free tier (anonymous + signed-in free)
 * can use. The gate is *what's offered*, not a usage count: only these mockup
 * templates are openable/downloadable, and only this social size is exportable.
 * Logo watermark stays Pro-only; the PatternPAL badge stays permanent on free
 * output via shouldStampBadge().
 */
export const FREE_MOCKUP_IDS = [
  'onesie',         // Baby Onesie
  'throw-pillow',   // Throw Pillow
  'wallpaper',      // Entry Wallpaper ("bench wallpaper")
  'wrapping-paper', // Wrapping Paper (Gift Box)
] as const;

/** Slug from SOCIAL_SIZE_PRESETS in RepeatExportModal — the 1080×1080 square. */
export const FREE_SOCIAL_SIZE_SLUG = 'instagram-post';

export function isFreeMockup(id: string): boolean {
  return (FREE_MOCKUP_IDS as readonly string[]).includes(id);
}

export function isFreeSocialSize(slug: string): boolean {
  return slug === FREE_SOCIAL_SIZE_SLUG;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/freeTier.test.ts`
Expected: PASS (all assertions green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/mockups/freeTier.ts src/__tests__/freeTier.test.ts
git commit -m "feat(free-tier): add free mockup/social source-of-truth module"
```

---

### Task 2: Open the mockup gallery to free users with per-card locks

**Files:**
- Modify: `src/components/mockups/MockupGalleryModal.tsx`

Currently (lines 126–129) non-Pro users get `<UpgradeModal>` instead of the gallery. Replace that wall with per-card gating so free users see the full catalog, can open the 4 free templates, and get the upgrade prompt only when clicking a locked card.

- [ ] **Step 1: Import the predicate**

At the top of `src/components/mockups/MockupGalleryModal.tsx`, add to the imports:

```ts
import { isFreeMockup } from '@/lib/mockups/freeTier';
```

- [ ] **Step 2: Remove the blanket Pro wall**

Delete these lines (the `if (!isPro)` early return, ~126–129):

```tsx
  // Pro gate — non-pro users see UpgradeModal instead of gallery
  if (!isPro) {
    return <UpgradeModal isOpen onClose={onClose} />;
  }
```

(Leave the `UpgradeModal` import in place — it is no longer used here, so ALSO remove the now-unused import line `import UpgradeModal from '@/components/export/UpgradeModal';` at the top to keep the lint clean.)

- [ ] **Step 3: Lock non-free cards in the template map**

In the `filteredTemplates.map((template, index) => ( ... ))` block, replace the card wrapper `<div>` (the one with `onClick={() => onSelectMockup(template.id)}`, ~line 200–205) with a locked-aware version. Compute `locked` and branch the click + add a lock overlay:

```tsx
              filteredTemplates.map((template, index) => {
                const locked = !isPro && !isFreeMockup(template.id);
                return (
                <div
                  key={template.id}
                  className="group relative cursor-pointer rounded-xl overflow-hidden bg-gray-50 transition-transform hover:scale-[1.02] active:scale-[0.98]"
                  onClick={() => (locked ? onUpgrade() : onSelectMockup(template.id))}
                >
                  {/* Thumbnail area — aspect-square wrapper for visual consistency */}
                  <div className="aspect-square overflow-hidden bg-gray-100">
                    <MockupRendererV2
                      template={template}
                      patternImage={index < revealedCount ? image : null}
                      tileWidth={tileWidth}
                      tileHeight={tileHeight}
                      dpi={dpi}
                      repeatType={repeatType}
                      maxRenderDimension={600}
                      preview
                      colorOverlayEnabled={template.colorOverlayDefaultEnabled ?? true}
                      additionalShadowEnableds={template.additionalShadowDefaultEnableds}
                      additionalHighlightEnableds={template.additionalHighlightDefaultEnableds}
                    />
                  </div>

                  {/* Lock overlay for non-free templates (free users only) */}
                  {locked && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/45 text-white">
                      <span className="text-lg leading-none">🔒</span>
                      <span className="mt-1 text-[10px] font-bold uppercase tracking-wide">Pro</span>
                    </div>
                  )}

                  {/* Card label */}
                  <div className="px-2 py-1.5">
                    <p className="text-xs font-semibold text-[#294051] truncate">
                      {template.name}
                    </p>
                    <p className="text-[10px] text-[#d97706] font-medium truncate">
                      {template.sizeLabel ??
                        `${template.physicalSize.width}×${template.physicalSize.height}"`}
                    </p>
                  </div>
                </div>
                );
              })
```

(Note: the only structural changes vs. the original are: `map` arrow now uses a block body with `return (`, the wrapper `<div>` gains `relative` + the `locked` ternary on `onClick`, and the lock overlay block is added. The closing `))` of the original map becomes `})`.)

- [ ] **Step 4: Typecheck**

Run: `npm run build`
Expected: build completes with no TypeScript errors. (If it flags the removed `UpgradeModal` import as still-used elsewhere, leave that import; otherwise it must be removed.)

- [ ] **Step 5: Commit**

```bash
git add src/components/mockups/MockupGalleryModal.tsx
git commit -m "feat(free-tier): open mockup gallery with per-card Pro locks"
```

---

### Task 3: Allow free download of free mockups + gate logo watermark to Pro

**Files:**
- Modify: `src/components/layout/AdvancedToolsBar.tsx`

Two changes in the `MockupModal` wiring: (a) the download handler currently blocks every non-Pro user (line ~499) — it must allow free users when the selected template is a free mockup; (b) the `WatermarkPanel` in the mockup footer (line ~750) is shown to everyone — it must be Pro-only so free users can't add a logo overlay. The badge already stamps free users automatically (`shouldStampBadge` with `isPaidPro: isPro`), so no badge change is needed.

- [ ] **Step 1: Import the predicate**

Add to the imports at the top of `src/components/layout/AdvancedToolsBar.tsx`:

```ts
import { isFreeMockup } from '@/lib/mockups/freeTier';
```

- [ ] **Step 2: Let free users download a free mockup**

In the `MockupModal` `onDownload` handler, replace the existing gate block (lines ~499–505):

```tsx
              if (!proAllowed) {
                const allowed = await verifyProAccess();
                if (!allowed) {
                  setIsUpgradeModalOpen(true);
                  return;
                }
              }
```

with a version that lets free templates through:

```tsx
              // Free users may download the curated free mockups (badge stays
              // stamped). Locked templates still require Pro verification.
              if (!proAllowed && !isFreeMockup(selectedMockup)) {
                const allowed = await verifyProAccess();
                if (!allowed) {
                  setIsUpgradeModalOpen(true);
                  return;
                }
              }
```

- [ ] **Step 3: Gate the mockup-modal WatermarkPanel to Pro**

Replace the WatermarkPanel render in the mockup footer (line ~749–750):

```tsx
              {/* Watermark (text + logo) — same UX as social export */}
              <WatermarkPanel watermark={watermark} setWatermark={setWatermark} />
```

with a Pro-gated version (logo watermark is Pro-only on every free tier):

```tsx
              {/* Watermark (text + logo) — Pro only; free tiers can't overlay a logo */}
              {isPro && (
                <WatermarkPanel watermark={watermark} setWatermark={setWatermark} />
              )}
```

(`badgeEnabled` defaults to `true` and `watermark` defaults to disabled, so a free user's download gets the permanent badge and no logo. The `PatternpalBadgeToggle` directly below already has `locked={!isPro}` — leave it.)

- [ ] **Step 4: Typecheck**

Run: `npm run build`
Expected: build completes with no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/AdvancedToolsBar.tsx
git commit -m "feat(free-tier): allow free mockup downloads, keep logo watermark Pro-only"
```

---

### Task 4: Open the Social Media Export card to free users

**Files:**
- Modify: `src/components/layout/AdvancedToolsBar.tsx`

The Social card currently routes through `handleProToolClick` (opens UpgradeModal for non-Pro). Open it for everyone — the modal itself (Task 5) enforces the free limits. Also pass an `onUpgrade` callback so locked size rows can prompt upgrade.

- [ ] **Step 1: Open the Social card**

Replace the Social Media Export card's `onClick` (line ~333):

```tsx
            onClick={() => handleProToolClick(() => setRepeatModalMode('social'))}
```

with a direct open:

```tsx
            onClick={() => setRepeatModalMode('social')}
```

- [ ] **Step 2: Pass onUpgrade to the social modal**

In the `<RepeatExportModal ... />` render (lines ~372–383), add an `onUpgrade` prop after `isPro={isPro}`:

```tsx
        isPro={isPro}
        onUpgrade={() => setIsUpgradeModalOpen(true)}
```

- [ ] **Step 3: Typecheck**

Run: `npm run build`
Expected: TypeScript error — `onUpgrade` is not a known prop of `RepeatExportModal`. This is expected; Task 5 adds the prop. (If implementing Task 4 and 5 together, no error.)

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/AdvancedToolsBar.tsx
git commit -m "feat(free-tier): open Social Media Export card to free users"
```

---

### Task 5: Restrict the social export to free limits for non-Pro users

**Files:**
- Modify: `src/components/export/RepeatExportModal.tsx`

For non-Pro users: only the Instagram-square size is selectable (other rows locked → upgrade), the mockup-overlay picker shows only the 4 free templates, the `WatermarkPanel` is hidden, "Select All" is hidden, and the default selected size is the IG square. Badge already stamps non-paid users via `shouldStampBadge`.

- [ ] **Step 1: Add imports + onUpgrade prop**

Add the predicate import near the other imports (top of file):

```ts
import { isFreeMockup, isFreeSocialSize, FREE_SOCIAL_SIZE_SLUG } from '@/lib/mockups/freeTier';
```

In the props interface (the block containing `isPro?: boolean;` at line ~45), add:

```ts
  /** Opens the upgrade modal when a free user clicks a locked size. */
  onUpgrade?: () => void;
```

And destructure it in the component signature alongside `isPro` (near line ~528):

```ts
  isPro,
  onUpgrade,
```

- [ ] **Step 2: Add `locked` support to SocialSizeRow**

Replace the `SocialSizeRowProps` interface and `SocialSizeRow` function (lines ~115–144) with a locked-aware version:

```tsx
interface SocialSizeRowProps {
  preset: SocialSizePreset;
  isChecked: boolean;
  onToggle: () => void;
  isExporting: boolean;
  locked?: boolean;
  onLockedClick?: () => void;
}

function SocialSizeRow({ preset, isChecked, onToggle, isExporting, locked = false, onLockedClick }: SocialSizeRowProps) {
  if (locked) {
    return (
      <button
        type="button"
        onClick={onLockedClick}
        className="w-full border border-[#e5e7eb] rounded-md overflow-hidden bg-[#f9fafb] opacity-80"
        style={{ touchAction: 'manipulation' }}
      >
        <div className="flex items-center justify-between px-3 py-2.5">
          <div className="flex items-center gap-2.5">
            <span className="text-base leading-none">🔒</span>
            <span className="text-xs text-[#9ca3af]">{preset.label}</span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wide text-[#d97706]">Pro</span>
        </div>
      </button>
    );
  }
  return (
    <div className={`border rounded-md overflow-hidden transition-colors ${
      isChecked ? 'border-[#e0c26e] bg-[#faf3e0]' : 'border-[#e5e7eb] bg-white'
    }`}>
      <label className="flex items-center justify-between px-3 py-2.5 cursor-pointer">
        <div className="flex items-center gap-2.5">
          <input
            type="checkbox"
            checked={isChecked}
            onChange={onToggle}
            disabled={isExporting}
            style={{ accentColor: '#e0c26e', width: 14, height: 14 }}
          />
          <span className={`text-xs ${isChecked ? 'font-semibold text-[#294051]' : 'text-[#374151]'}`}>
            {preset.label}
          </span>
        </div>
        <span className="text-[10px] text-[#9ca3af]">{preset.pxW}×{preset.pxH}</span>
      </label>
    </div>
  );
}
```

- [ ] **Step 3: Default free users to the IG square on open**

Find the social-mode reset effect (the one that clears `mockupsRef.current` near line ~583, which runs when the modal opens in social mode). Immediately after it clears state, default the checked size for non-Pro. Locate the `setCheckedSizes` initialization for social mode and, for non-Pro, set it to the free size. If the existing open-effect sets `checkedSizes` to empty for social, change it so non-Pro starts with the IG square:

```tsx
      // Free users can only export the Instagram square — preselect it.
      setCheckedSizes(isPro ? new Set<SizeSlug>() : new Set<SizeSlug>([FREE_SOCIAL_SIZE_SLUG as SizeSlug]));
```

(If the modal currently opens social mode with no preselected size, this guarantees the free user always has the IG square checked and can proceed straight to Preview & Export.)

- [ ] **Step 4: Lock non-free size rows + hide Select All for free**

In the social `select` step, replace the "Select All" label block (lines ~1331–1341) so it only renders for Pro:

```tsx
                    <div>
                      <h4 className="text-[10px] font-semibold text-[#294051] uppercase tracking-wide mb-2">Select Sizes</h4>
                      {isPro && (
                      <label className="flex items-center gap-2 px-3 py-2 bg-[#faf3e0] border border-[#e0c26e]/40 rounded-md cursor-pointer mb-2">
                        <input
                          ref={selectAllRef}
                          type="checkbox"
                          onChange={handleSelectAll}
                          style={{ accentColor: '#e0c26e', width: 13, height: 13 }}
                        />
                        <span className="text-xs font-semibold text-[#294051]">Select All</span>
                      </label>
                      )}
```

Then replace the `SOCIAL_SIZE_PRESETS.map(...)` size-row render (lines ~1343–1351) with a locked-aware version:

```tsx
                        {SOCIAL_SIZE_PRESETS.map(preset => {
                          const locked = !isPro && !isFreeSocialSize(preset.slug);
                          return (
                          <SocialSizeRow
                            key={preset.slug}
                            preset={preset}
                            isChecked={checkedSizes.has(preset.slug)}
                            onToggle={() => handleToggleSize(preset.slug)}
                            isExporting={false}
                            locked={locked}
                            onLockedClick={() => onUpgrade?.()}
                          />
                          );
                        })}
```

- [ ] **Step 5: Hide the WatermarkPanel from free users**

Replace the social `WatermarkPanel` render (lines ~1355–1356):

```tsx
                    {/* Watermark */}
                    <WatermarkPanel watermark={watermark} setWatermark={setWatermark} />
```

with:

```tsx
                    {/* Watermark — Pro only; free tiers can't overlay a logo */}
                    {isPro && (
                      <WatermarkPanel watermark={watermark} setWatermark={setWatermark} />
                    )}
```

- [ ] **Step 6: Restrict the mockup-overlay picker to the free set**

In the mockup-overlay thumbnail picker, replace the iteration source `SOCIAL_V2_MOCKUP_IDS.map(id => {` (line ~433) with a filtered list for non-Pro users. Just above the `<div className="flex gap-2 flex-wrap ...">` (line ~432) introduce the available list, then map over it:

```tsx
            <div className="flex gap-2 flex-wrap max-h-[180px] overflow-y-auto">
              {(isPro ? SOCIAL_V2_MOCKUP_IDS : SOCIAL_V2_MOCKUP_IDS.filter(isFreeMockup)).map(id => {
```

(`SocialPreviewSlide` / the overlay picker receives `isPro` — confirm it is in scope there. If the picker is inside a child component that does not already receive `isPro`, thread an `isPro` prop into that component from its parent render. Search the file for where the picker is defined and ensure `isPro` is available; add it to that component's props if missing.)

- [ ] **Step 7: Default the mockup overlay to a free template for non-Pro**

`DEFAULT_MOCKUP_OVERLAY` (line ~157) uses `SOCIAL_V2_MOCKUP_IDS[0]`. If that first template is not a free mockup, a free user's overlay would default to a locked template id (rendered but not selectable). Where the per-size `mockupsRef` entry is initialized, ensure non-Pro defaults to a free id. In the init for `mockupsRef.current[slug]` (and `DEFAULT_MOCKUP_OVERLAY` usage), use:

```ts
const defaultMockupId = isPro ? SOCIAL_V2_MOCKUP_IDS[0] : FREE_MOCKUP_IDS[0];
```

and use `defaultMockupId` as the initial `templateId`. (Add `FREE_MOCKUP_IDS` to the Task-5 import line from `freeTier`.)

- [ ] **Step 8: Typecheck + run unit tests**

Run: `npm run build`
Expected: build completes with no TypeScript errors.

Run: `npx vitest run`
Expected: all tests pass (including `freeTier.test.ts` and the existing `patternpalBadge.test.ts`).

- [ ] **Step 9: Commit**

```bash
git add src/components/export/RepeatExportModal.tsx
git commit -m "feat(free-tier): restrict social export to IG square + free mockups for non-Pro"
```

---

### Task 6: Manual verification (hand to Mandy) + final build

**Files:** none (verification only)

- [ ] **Step 1: Full build + tests**

Run: `npm run build && npx vitest run`
Expected: build succeeds, all tests pass.

- [ ] **Step 2: Start the dev server and hand off**

Start the dev server (do not drive the browser — Mandy tests):

Run: `npm run dev`

Then give Mandy this checklist to verify in the browser, signed OUT (anon), signed-in FREE, and as PRO:

**Anon (within 3 free tests) & Signed-in free — should behave identically:**
- [ ] Mockups card opens the gallery (no immediate upgrade wall).
- [ ] Baby Onesie, Throw Pillow, Entry Wallpaper, Wrapping Paper (Gift Box) open normally.
- [ ] Every other mockup shows a 🔒 PRO overlay and opening it triggers the Upgrade modal.
- [ ] Downloading a free mockup works and the file has the "Tested in PatternPAL" badge.
- [ ] No logo-watermark panel appears in the mockup view (badge toggle shows but is locked).
- [ ] Social Media Export card opens the modal (no upgrade wall).
- [ ] Only "Instagram / Facebook Post" (1080×1080) is selectable and is preselected; all other sizes show 🔒 PRO and clicking one opens the Upgrade modal.
- [ ] The mockup-overlay picker in social shows only the 4 free mockups.
- [ ] No logo-watermark panel in the social modal; the exported social image carries the badge.
- [ ] Anon: after 3 tests, the sign-in prompt appears; signing in (free) keeps the same access.

**Pro — unchanged:**
- [ ] Full mockup catalog opens, all downloadable.
- [ ] Logo-watermark panel present in both mockup + social views; badge toggle removable.
- [ ] All social sizes selectable, Select All present.

**iPad / touch (project standard):**
- [ ] Lock overlays + locked size rows respond to tap (Pointer Events / `touch-action`), no hover dependence.

- [ ] **Step 3: Commit any fixes Mandy reports**

After Mandy confirms (or reports issues), address fixes and commit with descriptive messages. Do not mark the feature complete until she confirms the checklist passes.

---

## Self-Review

**Spec coverage:**
- 4 free mockups, freely re-downloadable, badge permanent, no logo watermark → Tasks 1, 2, 3. ✓
- Full catalog visible-but-locked for both anon & signed-in free → Task 2 (per-card lock; `isFreeMockup` is tier-agnostic for non-Pro). ✓
- IG-square social export only, freely re-downloadable, badge permanent, no logo watermark → Tasks 4, 5. ✓
- Social features the 4 free mockups → Task 5 Steps 6–7. ✓
- No usage counters → confirmed; nothing added. ✓
- Anon → signed-in free conversion via existing `openSignIn` → unchanged (`app/page.tsx` `canRunFreeTest`); no task needed. ✓
- Pro unchanged → all gating is `!isPro` branches. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code. Step 6/7 of Task 5 contains a conditional instruction ("if `isPro` not in scope, thread it") — this is a real, bounded contingency with the exact fix stated, not a placeholder.

**Type consistency:** `isFreeMockup` / `isFreeSocialSize` / `FREE_MOCKUP_IDS` / `FREE_SOCIAL_SIZE_SLUG` are defined in Task 1 and used identically in Tasks 2, 3, 5. `onUpgrade?: () => void` added to props in Task 5 and passed in Task 4. `SizeSlug` cast matches the existing type used by `checkedSizes`.

**Risk note:** Task 5 touches a large file (`RepeatExportModal.tsx`); the `isPro`-in-scope check for the overlay picker (Step 6) is the one spot needing a look at the surrounding component boundary during implementation.
