# Free Easyscale + Remove Quick Export + Drop 3 PRO Badges — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open Easyscale Export to free users (POD only; Cricut stays Pro), remove the now-redundant Quick Export tool, and drop the misleading "PRO" badge from the three partially-free tool cards (Easyscale, Social, Mockups).

**Architecture:** The free Easyscale POD modal already exists and degrades by `isPro`. The work is therefore (1) centralize Easyscale's free limits in `freeTier.ts`, (2) open the Easyscale card + Pro-lock the Cricut branch of its picker, (3) delete Quick Export, (4) add a `hideBadge` prop to `ToolCard` and apply it. No new export logic.

**Tech Stack:** Next.js (App Router) + React + TypeScript, Tailwind, Vitest. Test command: `npm run test`. Build: `npm run build`.

**Spec:** `docs/superpowers/specs/2026-06-01-free-easyscale-remove-quick-export-design.md`

---

## File Structure

- `src/lib/mockups/freeTier.ts` — **modify.** Add three Easyscale free-limit constants. Single source of truth for "what's free."
- `src/__tests__/freeTier.test.ts` — **modify.** Add coverage for the new constants.
- `src/components/export/EasyscaleExportModal.tsx` — **modify.** Replace local `FREE_USER_SIZES` and the hardcoded non-Pro defaults with the `freeTier.ts` constants. No behavior change.
- `src/components/layout/AdvancedToolsBar.tsx` — **modify.** Open Easyscale card, Pro-lock Cricut in picker, remove Quick Export card/modal/state/import, add `hideBadge` to `ToolCard` + apply to 3 cards.
- `src/components/export/QuickExportModal.tsx` — **delete.** Sole importer is `AdvancedToolsBar.tsx`.

---

## Task 1: Centralize Easyscale free limits in freeTier.ts (Part D)

**Files:**
- Modify: `src/lib/mockups/freeTier.ts`
- Test: `src/__tests__/freeTier.test.ts`

- [ ] **Step 1: Write the failing test**

Add this `describe` block to the end of `src/__tests__/freeTier.test.ts`, and add the three new names to the existing import at the top of the file:

```typescript
// --- update the import at the top of the file to: ---
import {
  FREE_MOCKUP_IDS,
  FREE_SOCIAL_SIZE_SLUG,
  FREE_EASYSCALE_SIZES,
  FREE_EASYSCALE_DPI,
  FREE_EASYSCALE_FORMAT,
  isFreeMockup,
  isFreeSocialSize,
} from '../lib/mockups/freeTier';

// --- append this describe block at the end of the file: ---
describe('free-tier Easyscale limits', () => {
  it('limits free users to 8" and 12"', () => {
    expect([...FREE_EASYSCALE_SIZES]).toEqual([8, 12]);
  });
  it('limits free users to 150 DPI', () => {
    expect(FREE_EASYSCALE_DPI).toBe(150);
  });
  it('limits free users to JPG', () => {
    expect(FREE_EASYSCALE_FORMAT).toBe('jpg');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/__tests__/freeTier.test.ts`
Expected: FAIL — `FREE_EASYSCALE_SIZES` (and the other two) are `undefined` / not exported.

- [ ] **Step 3: Add the constants**

In `src/lib/mockups/freeTier.ts`, after the `FREE_SOCIAL_SIZE_SLUG` line (currently line 17), insert:

```typescript
/** Free users can export Easyscale POD files only at these longest-side sizes (inches). */
export const FREE_EASYSCALE_SIZES = [8, 12] as const;
/** Free Easyscale exports are capped at 150 DPI (300 DPI is Pro). */
export const FREE_EASYSCALE_DPI = 150 as const;
/** Free Easyscale exports are JPG only (PNG/TIFF are Pro). */
export const FREE_EASYSCALE_FORMAT = 'jpg' as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/__tests__/freeTier.test.ts`
Expected: PASS — all free-tier tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/mockups/freeTier.ts src/__tests__/freeTier.test.ts
git commit -m "feat(free-tier): add Easyscale free-limit constants to freeTier source of truth"
```

---

## Task 2: Wire EasyscaleExportModal to the constants (Part D)

**Files:**
- Modify: `src/components/export/EasyscaleExportModal.tsx`

No behavioral change — same values [8,12]/150/'jpg', now sourced from `freeTier.ts`.

- [ ] **Step 1: Add the import**

In `src/components/export/EasyscaleExportModal.tsx`, after the existing import block (the `getConvertToFullDropBlockReason` import on line 6), add:

```typescript
import { FREE_EASYSCALE_SIZES, FREE_EASYSCALE_DPI, FREE_EASYSCALE_FORMAT } from '@/lib/mockups/freeTier';
```

- [ ] **Step 2: Remove the local free-sizes constant**

Delete this line (currently line 19):

```typescript
const FREE_USER_SIZES = [8, 12]; // Free users limited to 8" and 12"
```

(Leave `const PRESET_SIZES = [2, 4, 6, 8, 10, 12, 18, 24];` on line 18 untouched.)

- [ ] **Step 3: Use the constants for non-Pro defaults**

Replace the two state initializers (currently lines 43-44):

```typescript
  const [selectedDPI, setSelectedDPI] = useState<150 | 300>(isPro ? 300 : 150);
  const [format, setFormat] = useState<'png' | 'jpg' | 'tif'>(isPro ? 'png' : 'jpg');
```

with:

```typescript
  const [selectedDPI, setSelectedDPI] = useState<150 | 300>(isPro ? 300 : FREE_EASYSCALE_DPI);
  const [format, setFormat] = useState<'png' | 'jpg' | 'tif'>(isPro ? 'png' : FREE_EASYSCALE_FORMAT);
```

- [ ] **Step 4: Use the constant for the size grid**

Replace the size-grid map opener (currently line 301):

```typescript
                  {(isPro ? PRESET_SIZES : FREE_USER_SIZES).map((sizeInInches) => {
```

with (spread so the readonly tuple matches `PRESET_SIZES`' `number[]`):

```typescript
                  {(isPro ? PRESET_SIZES : [...FREE_EASYSCALE_SIZES]).map((sizeInInches) => {
```

- [ ] **Step 5: Verify no other `FREE_USER_SIZES` references remain**

Run: `grep -n "FREE_USER_SIZES" src/components/export/EasyscaleExportModal.tsx`
Expected: no output (zero matches).

- [ ] **Step 6: Type-check / build**

Run: `npm run build`
Expected: build succeeds, no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/export/EasyscaleExportModal.tsx
git commit -m "refactor(free-tier): source Easyscale free limits from freeTier.ts"
```

---

## Task 3: Open Easyscale card to free + Pro-lock Cricut in picker (Part A)

**Files:**
- Modify: `src/components/layout/AdvancedToolsBar.tsx`

- [ ] **Step 1: Open the Easyscale card**

Replace the Easyscale `ToolCard` (currently lines 290-298):

```tsx
          <ToolCard
            icon="📦"
            title="Easyscale Export"
            description="POD, Spoonflower, Cricut & Silhouette"
            isPro={proAllowed}
            onClick={() => handleProToolClick(() => setIsEasyscalePickerOpen(true))}
            disabled={!image}
            dataTour="easyscale-export"
          />
```

with (drops the Pro gate; `hideBadge` is added in Task 5):

```tsx
          <ToolCard
            icon="📦"
            title="Easyscale Export"
            description="POD, Spoonflower, Cricut & Silhouette"
            isPro={proAllowed}
            onClick={() => setIsEasyscalePickerOpen(true)}
            disabled={!image}
            dataTour="easyscale-export"
          />
```

- [ ] **Step 2: Pro-lock the Cricut button in the picker**

Replace the Cricut/Silhouette button in the picker (currently lines 422-431):

```tsx
                <button
                  onClick={() => {
                    setIsEasyscalePickerOpen(false);
                    setRepeatModalMode('cricut');
                  }}
                  className="w-full text-left px-4 py-4 border-2 border-[#e5e7eb] rounded-lg bg-white hover:bg-[#f9fafb] transition-colors"
                >
                  <div className="text-sm font-semibold text-[#294051]">🖨 Cricut / Silhouette</div>
                  <div className="text-xs text-[#9ca3af] mt-1">Digital paper · print files · Etsy / Creative Fabrica</div>
                </button>
```

with:

```tsx
                <button
                  onClick={() => {
                    setIsEasyscalePickerOpen(false);
                    if (proAllowed) {
                      setRepeatModalMode('cricut');
                    } else {
                      setIsUpgradeModalOpen(true);
                    }
                  }}
                  className="w-full text-left px-4 py-4 border-2 border-[#e5e7eb] rounded-lg bg-white hover:bg-[#f9fafb] transition-colors"
                >
                  <div className="text-sm font-semibold text-[#294051]">
                    🖨 Cricut / Silhouette {!proAllowed && '🔒'}
                  </div>
                  <div className="text-xs text-[#9ca3af] mt-1">Digital paper · print files · Etsy / Creative Fabrica</div>
                </button>
```

- [ ] **Step 3: Build to verify**

Run: `npm run build`
Expected: build succeeds. (`handleProToolClick` is still used by Pattern Analysis & Seam Analyzer cards, so no unused-var error.)

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/AdvancedToolsBar.tsx
git commit -m "feat(free-tier): open Easyscale POD to free users, keep Cricut Pro-locked"
```

---

## Task 4: Remove Quick Export (Part B)

**Files:**
- Modify: `src/components/layout/AdvancedToolsBar.tsx`
- Delete: `src/components/export/QuickExportModal.tsx`

- [ ] **Step 1: Remove the import**

In `src/components/layout/AdvancedToolsBar.tsx`, delete the import (currently line 4):

```tsx
import QuickExportModal from '@/components/export/QuickExportModal';
```

- [ ] **Step 2: Remove the state**

Delete the state declaration (currently line 129):

```tsx
  const [isQuickExportOpen, setIsQuickExportOpen] = useState(false);
```

- [ ] **Step 3: Remove the Quick Export card**

Delete the entire Quick Export card block (currently lines 276-287), including its surrounding comment and `{!proAllowed && (...)}` wrapper:

```tsx
          {/* Card 1: Quick Export (FREE) - Only show for non-Pro users */}
          {!proAllowed && (
            <ToolCard
              icon="📦"
              title="Quick Export"
              description="2 sizes • JPG only"
              isFree
              isPro={proAllowed}
              onClick={() => setIsQuickExportOpen(true)}
              disabled={!image}
            />
          )}
```

- [ ] **Step 4: Remove the QuickExportModal render**

Delete the modal render block (currently lines 353-361):

```tsx
      <QuickExportModal
        isOpen={isQuickExportOpen}
        onClose={() => setIsQuickExportOpen(false)}
        image={image}
        currentDPI={dpi}
        repeatType={repeatType}
        originalFilename={originalFilename}
        onUpgrade={() => setIsUpgradeModalOpen(true)}
      />
```

- [ ] **Step 5: Delete the component file**

Run: `git rm src/components/export/QuickExportModal.tsx`

- [ ] **Step 6: Verify no dangling references**

Run: `grep -rn "QuickExportModal\|isQuickExportOpen" src`
Expected: no output (zero matches).

- [ ] **Step 7: Build to verify**

Run: `npm run build`
Expected: build succeeds, no missing-import or unused-var errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/layout/AdvancedToolsBar.tsx
git commit -m "feat(free-tier): remove Quick Export tool, superseded by free Easyscale"
```

---

## Task 5: Drop the PRO badge on Easyscale, Social, Mockups (Part C)

**Files:**
- Modify: `src/components/layout/AdvancedToolsBar.tsx`

- [ ] **Step 1: Add the `hideBadge` prop to the interface**

In the `ToolCardProps` interface, add `hideBadge` after the `isPro` line (currently line 59):

```tsx
  isPro?: boolean; // User's Pro status
  hideBadge?: boolean; // Suppress the PRO/FREE chip even for non-Pro users
```

- [ ] **Step 2: Accept the prop and update the badge guard**

Update the `ToolCard` function signature (currently line 65) to destructure `hideBadge`:

```tsx
function ToolCard({ icon, title, description, isFree = false, isPro = false, hideBadge = false, onClick, disabled = false, dataTour }: ToolCardProps) {
  const showBadge = !isPro && !hideBadge; // Hide if Pro user, or if explicitly suppressed
```

(This replaces the current `function ToolCard({ ... }: ToolCardProps) {` line and the `const showBadge = !isPro; // Hide badge if user is Pro` line on line 66.)

- [ ] **Step 3: Apply `hideBadge` to the Easyscale card**

In the Easyscale `ToolCard`, add `hideBadge` after the `isPro={proAllowed}` line:

```tsx
            isPro={proAllowed}
            hideBadge
            onClick={() => setIsEasyscalePickerOpen(true)}
```

- [ ] **Step 4: Apply `hideBadge` to the Social Media card**

In the Social Media `ToolCard`, add `hideBadge` after its `isPro={proAllowed}` line:

```tsx
            isPro={proAllowed}
            hideBadge
            onClick={() => setRepeatModalMode('social')}
```

- [ ] **Step 5: Apply `hideBadge` to the Mockups card**

In the Mockups `ToolCard`, add `hideBadge` after its `isPro={proAllowed}` line:

```tsx
            isPro={proAllowed}
            hideBadge
            onClick={() => setIsMockupsOpen(true)}
```

- [ ] **Step 6: Verify Pattern Analysis & Seam Analyzer still show PRO**

Run: `grep -n "hideBadge" src/components/layout/AdvancedToolsBar.tsx`
Expected: 6 matches — interface declaration, function-signature destructure, the `showBadge` guard, and the 3 cards (Easyscale, Social, Mockups). Confirm the 3 card matches are exactly those three; Pattern Analysis and Seam Analyzer must NOT have `hideBadge`.

- [ ] **Step 7: Build to verify**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/components/layout/AdvancedToolsBar.tsx
git commit -m "feat(free-tier): drop PRO badge on Easyscale, Social, Mockups cards"
```

---

## Task 6: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: all tests pass (the existing suite plus the 3 new Easyscale-limit tests).

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: build succeeds with no errors or new warnings.

- [ ] **Step 3: Manual browser check (free / signed-out user)**

Start dev server if not running (`npm run dev`), open the app as a signed-out user with a pattern loaded, and confirm:
- [ ] Easyscale card shows **no PRO badge**; clicking opens the picker.
- [ ] Picker → POD/Spoonflower → modal limited to 8" & 12", JPG, 150 DPI (300 DPI / PNG / TIFF show 🔒).
- [ ] Picker → Cricut/Silhouette shows 🔒 and opens the Upgrade modal (no export view).
- [ ] Social Media and Mockups cards show **no PRO badge**.
- [ ] Quick Export card is gone. No console errors.

- [ ] **Step 4: Manual browser check (Pro user)**

As a Pro user, confirm:
- [ ] Easyscale picker → Cricut/Silhouette opens the Cricut export (unchanged).
- [ ] POD modal: all sizes, 300 DPI, PNG/TIFF available.
- [ ] No badges on any card (unchanged Pro behavior).

- [ ] **Step 5: Final push**

```bash
git push origin main
```

---

## Notes for the implementer
- Line numbers above reflect the file state at plan-writing time. If earlier tasks shifted lines, match on the quoted code text rather than the number.
- `handleProToolClick` stays — Pattern Analysis and Seam Analyzer still use it. Do not remove it.
- `EasyscaleExportModal` receives `isPro={proAllowed}` from `AdvancedToolsBar` (line ~370), so anonymous users correctly get the free experience. No change needed there.
- The PatternPAL badge stays permanent on free output; logo watermark stays Pro-only — neither is touched by this plan.
