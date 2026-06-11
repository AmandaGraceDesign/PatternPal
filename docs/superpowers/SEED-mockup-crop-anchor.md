# SEED — Mockup social-size crop anchor + per-size previews

**For the next session.** Start with `superpowers:brainstorming`, then spec → plan → build. Branch: continue on `feat/mockup-social-exports` (or branch off it after it merges). This builds directly on the just-shipped unified "Download mockup" menu.

## The request (Mandy, 2026-06-11)

The unified social sizes cover-crop is **auto-centered**, which frames some mockups wrong. Concrete example: a **dress on a hanger** mockup, cropped to a 1:1 square, keeps the full hanger at top and clips the dress hem at the bottom. Mandy would rather **keep the dress and drop the hanger** — i.e. anchor the crop lower. Other templates have similar focal mismatches.

She wants:
1. **A preview thumbnail per size** — see the actual crop framing before downloading.
2. **Crop anchor Top / Center / Bottom per size** — choose what's kept vs cut.

**Decisions already made (in the session that wrote this seed):**
- ✅ **Anchor presets (Top/Center/Bottom)**, NOT free-drag repositioning. Lighter UI, solves the case. (Free-drag was offered and declined.)
- ✅ Build in a **fresh brainstorm session** (this seed), after the unified menu is verified + merged.

## Why this is a small, clean change (grounded in the code)

The crop window is computed by one helper in [src/lib/utils/mockupSocialExport.ts](../../src/lib/utils/mockupSocialExport.ts) (~lines 30–38). It returns `{ sx, sy, sWidth, sHeight }` and **auto-centers**:

- Target taller/narrower than source → `sx = (srcW - sWidth)/2`, `sy = 0`
- Target wider than source → `sx = 0`, `sy = (srcH - sHeight)/2`  ← **this is the one the dress case hits** (square/portrait cropping a 2:3 render)

A **vertical anchor** just replaces that centered `sy`:
- `top` → `sy = 0`
- `center` → `sy = (srcH - sHeight)/2` (today's behavior — the default)
- `bottom` → `sy = srcH - sHeight`

Thread an `anchor` param through: crop-rect helper → `coverCropToBlob` → `exportMockupSocialBlob` → `downloadMockupSocialSizes`. Default `center` so nothing changes unless the user picks Top/Bottom. **Add unit tests** for the three anchor offsets (the geometry IS assertable in jsdom — unlike canvas pixel output).

The **preview thumbnail** = draw the same computed crop rect into a small canvas (or compute an `object-position`-style CSS transform on the mockup image) inside each selected size row in the unified list. Both entry points render that list: [AdvancedToolsBar.tsx](../../src/components/layout/AdvancedToolsBar.tsx) and [ActionsSidebar.tsx](../../src/components/sidebar/ActionsSidebar.tsx) — keep them in parity (same lesson as the unified-menu work: two mirror files).

Full size is NOT cropped, so it has no anchor — only the 4 social sizes do.

## Brainstorm forks to resolve first (don't pre-decide in the plan)

1. **Vertical-only anchor, or also horizontal?** The dress case is vertical. Horizontal anchor matters for wide targets (Story is tall; FB Cover is excluded). Probably **vertical-only** to start — confirm.
2. **Per-size anchor vs one anchor for all social sizes?** Per-size is more precise (square vs story crop differently) but more UI/state. One-anchor is simpler. Likely **per-size**, defaulting all to center.
3. **Where does anchor state live + does it persist?** Per-mockup-template? Reset on template change (like `socialSizes` does today)? Remember last choice?
4. **Preview rendering:** real canvas thumbnail (accurate, heavier) vs CSS `object-position` crop of the existing mockup image (cheap, approximate). Pick based on fidelity needs.
5. **Touch/iPad:** the Top/Center/Bottom toggle must be tap-friendly (`touchAction`, no hover-only) — ~half of users are iPad. Mandatory.

## Guardrails (carry over from the unified-menu work)

- **Two entry points stay identical** (AdvancedToolsBar + ActionsSidebar) — apply UI changes to both.
- **Imports in `mockupSocialExport.ts` are relative paths** (no `@/` — vitest has no alias).
- **Don't touch** the separate Social Export modal (`RepeatExportModal`) or `SOCIAL_SIZE_PRESETS`.
- **Default anchor = center** so existing behavior is unchanged for anyone who doesn't touch it.
- Gates per task: `npx tsc --noEmit` clean · `npx vitest run` green · `npx eslint <file>` no NEW warnings. Canvas pixels aren't assertable in jsdom — verify framing by running the app (desktop + iPad), but DO unit-test the anchor geometry offsets.

## Current state when this seed was written

Unified "Download mockup" menu is **code-complete on `feat/mockup-social-exports`** (6 commits `ca97c2a`..`2c945f2`), tsc clean, 58/58 vitest, **not pushed/merged, not yet manually verified** by Mandy. This crop-anchor feature is the logical next step on top of it.
