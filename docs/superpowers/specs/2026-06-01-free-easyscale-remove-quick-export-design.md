---
title: Free Easyscale + remove Quick Export + drop 3 PRO badges
date: 2026-06-01
status: approved (design) — ready for implementation plan
branch: main
supersedes_followups:
  - "2026-05-31 handoff #1 (FREE+PRO hybrid badge) — resolved by simply removing the badge"
  - "2026-05-31 handoff #2 (gate Easyscale like Social/Mockups, remove Quick Export)"
---

## Goal

Give the free tier (anonymous + signed-in free) a real taste of **Easyscale Export**,
remove the now-redundant **Quick Export** tool, and remove the misleading **PRO**
badge from the three tool cards that are now partially free (Easyscale, Social
Media, Mockups) so free users know they can click in.

This mirrors the free-tier pattern already shipped for Mockups and Social Export
(2026-05-31): the gate is *what's offered* inside the tool, not a usage counter.

## Key discovery (why this is small)

`EasyscaleExportModal` **already fully supports free users** — the hard part is done:
- Free users see only `FREE_USER_SIZES = [8, 12]` (8" & 12") — `EasyscaleExportModal.tsx:19, 301`
- DPI locked to 150 for free (300 DPI radio disabled + 🔒) — `:436-450`
- Format locked to JPG for free (PNG/TIFF disabled + 🔒) — `:475-519`
- Custom size, "include original" — all Pro-gated with inline upsell hints

The **only** thing blocking free users today is the card-level gate in
`AdvancedToolsBar.tsx:295` (`handleProToolClick` → upgrade wall). So follow-up #2
reduces to gating decisions at the card/picker level plus removing Quick Export.

## Decisions (locked with Mandy)

1. **Cricut branch:** Show the Easyscale picker to free users; the POD/Spoonflower
   option opens the free-capable modal, the **Cricut/Silhouette** option is
   Pro-locked (🔒 → upgrade modal). Best discoverability — free users learn Cricut
   exists as a Pro perk. Cricut export itself stays Pro-only (300 DPI, no free gate).
2. **Free sizes:** Removing Quick Export shifts free export sizes from {6", 10"}
   (Quick Export) to {8", 12"} (Easyscale). Accepted — a net upgrade for free.
3. **Badges:** Remove the PRO chip from Easyscale, Social Media, and Mockups cards.
   Pattern Analysis and Seam Analyzer keep their PRO badge (still fully Pro-locked).
4. **Consolidation (Part D):** Move Easyscale's free limits into `freeTier.ts` to
   match the established single-source-of-truth pattern.

## Scope

### Part A — Open Easyscale to free users
- `AdvancedToolsBar.tsx` — Easyscale card (`~:290-298`): change `onClick` from
  `handleProToolClick(() => setIsEasyscalePickerOpen(true))` to
  `setIsEasyscalePickerOpen(true)`. Free users now reach the picker.
- Easyscale picker (`~:388-436`): the **Cricut/Silhouette** button becomes
  Pro-gated. For non-Pro (`!proAllowed`): render a 🔒 affordance and `onClick`
  closes the picker + opens the upgrade modal (`setIsEasyscalePickerOpen(false);
  setIsUpgradeModalOpen(true)`) instead of `setRepeatModalMode('cricut')`. For Pro,
  unchanged. The POD/Spoonflower button is unchanged for everyone.
- No changes inside `EasyscaleExportModal` behavior — it already degrades correctly
  by `isPro` (which is fed `proAllowed`).

### Part B — Remove Quick Export
- `AdvancedToolsBar.tsx`: delete the Quick Export `ToolCard` (`~:277-287`), the
  `<QuickExportModal>` render (`~:353-361`), the `QuickExportModal` import, and the
  `isQuickExportOpen` state + setter.
- Delete the orphaned file `src/components/export/QuickExportModal.tsx`.
- Confirmed: `QuickExportModal` is imported only by `AdvancedToolsBar.tsx` (and
  itself) — safe to delete with no other call sites.

### Part C — Drop the 3 PRO badges
- `AdvancedToolsBar.tsx` `ToolCard`: add `hideBadge?: boolean` prop. Update the
  badge guard from `const showBadge = !isPro;` to
  `const showBadge = !isPro && !hideBadge;`.
- Pass `hideBadge` on the Easyscale, Social Media, and Mockups cards. Card styling
  (amber border/icon, hover) is unchanged — only the "PRO" chip is removed.

### Part D — Source-of-truth consolidation
- `src/lib/mockups/freeTier.ts`: add
  - `export const FREE_EASYSCALE_SIZES = [8, 12] as const;`
  - `export const FREE_EASYSCALE_DPI = 150 as const;`
  - `export const FREE_EASYSCALE_FORMAT = 'jpg' as const;`
- `EasyscaleExportModal.tsx`: replace the local `FREE_USER_SIZES = [8, 12]` with the
  imported `FREE_EASYSCALE_SIZES`; use `FREE_EASYSCALE_DPI` / `FREE_EASYSCALE_FORMAT`
  for the non-Pro defaults (`useState` initializers at `:43-44`). No behavioral
  change — same values, centralized.

## Out of scope (YAGNI)
- No new "FREE + PRO" hybrid badge (handoff #1's original idea) — Mandy chose plain
  badge removal instead.
- No free tier for Cricut/Silhouette export — stays Pro-only.
- No changes to Social/Mockups free behavior (already shipped).
- No usage counters — consistent with the existing free-tier philosophy.

## Testing / verification
- `freeTier.ts` unit tests (`src/__tests__/freeTier.test.ts`): extend existing
  tests to cover the new Easyscale constants (values: [8,12], 150, 'jpg').
- Build clean (`npm run build`) + existing test suite passes.
- Manual (browser), as a signed-out/free user:
  1. Easyscale card has **no PRO badge**; clicking opens the picker.
  2. Picker POD/Spoonflower → modal limited to 8"/12", JPG, 150 DPI (others 🔒).
  3. Picker Cricut/Silhouette → 🔒, opens upgrade modal (no export).
  4. Social Media and Mockups cards have **no PRO badge**.
  5. Quick Export card is gone; no console errors; no dead import.
- Manual as Pro: picker Cricut works as before; all sizes/DPI/formats unlocked;
  no badges anywhere (unchanged).

## Files touched
- `src/components/layout/AdvancedToolsBar.tsx` (Parts A, B, C)
- `src/components/export/QuickExportModal.tsx` (deleted — Part B)
- `src/components/export/EasyscaleExportModal.tsx` (Part D)
- `src/lib/mockups/freeTier.ts` (Part D)
- `src/__tests__/freeTier.test.ts` (Part D)
