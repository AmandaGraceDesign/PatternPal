---
task: Free-tier mockups + social export — shipped; two follow-up ideas open
status: Implementation COMPLETE on `main` (unpushed at handoff time). Build clean, 39 tests pass. Mandy confirmed "working great" in browser.
date: 2026-05-31
branch: main
---

## What shipped this session

Free tier (anon + signed-in free) now gets a taste of Mockups + Social Export (previously 100% Pro-gated). Spec + plan:
- Spec: `docs/superpowers/specs/2026-05-30-free-tier-mockups-social-design.md`
- Plan: `docs/superpowers/plans/2026-05-30-free-tier-mockups-social.md`

Commits on `main` (after `65156ec` docs):
- `b96d974` freeTier.ts source of truth (`FREE_MOCKUP_IDS` = onesie, throw-pillow, wallpaper, wrapping-paper; `FREE_SOCIAL_SIZE_SLUG` = instagram-post) + tests
- `a287623` gallery opens for all; non-free templates show 🔒 PRO overlay → upgrade
- `fa1640f` free users download the 4 free mockups; logo WatermarkPanel now Pro-only (mockup view)
- `7d5ac9b` social export open to free: IG square only + only the 4 free mockups; other sizes 🔒
- `8b94757` review fixes: (1) social export was still hitting `/api/pro/verify` and throwing for free users — now skips verify for the free IG-square selection; (2) `RepeatExportModal` now gets `isPro={proAllowed}` (was raw `isPro`) to match other modals.

Key files: `src/lib/mockups/freeTier.ts`, `src/components/mockups/MockupGalleryModal.tsx`, `src/components/layout/AdvancedToolsBar.tsx`, `src/components/export/RepeatExportModal.tsx`.

Rules locked: badge "Tested in PatternPAL" PERMANENT on all free tiers (only Pro removes); logo watermark Pro-only everywhere; no usage counters (gate is *what's offered*); anon perk lives within the 3-free-test window then `openSignIn` → signed-in free.

## Open follow-ups (Mandy raised, NOT yet built — need brainstorming/design first)

### 1. "FREE + PRO" hybrid badge on Social + Mockups tool cards
Problem: the cards show a "PRO" badge, so free users don't realize parts are usable to them. Mandy wants them to know they CAN click in.
- Tool cards live in `src/components/layout/AdvancedToolsBar.tsx` — `ToolCard` component (`isFree`/`isPro` props, badge at the `isFree ? 'FREE' : 'PRO'` logic around line ~102).
- Likely want a dual/hybrid badge (e.g. "FREE + PRO" or "Try Free") on Social + Mockups cards specifically, since those are now partially free.
- Design question: badge wording + which cards. Brainstorm before building.

### 2. Remove Quick Export; gate Easyscale like Social/Mockups
Mandy's idea: drop the separate Quick Export tool, and instead let Easyscale Export be openable by free users but locked to just the two sizes they currently get (Quick Export = 8" and 12", JPG, 150 DPI), with the rest locked → upgrade. Mirrors the Social/Mockups pattern.
- Quick Export: `src/components/export/QuickExportModal.tsx`; card shown only to non-pro at `AdvancedToolsBar.tsx:276`.
- Easyscale: `src/components/export/EasyscaleExportModal.tsx`; picker at `AdvancedToolsBar.tsx:386`.
- Would extend `freeTier.ts` with free Easyscale size/format limits. Brainstorm scope (which exact sizes/format/DPI are "free") before building.

## First steps next session
1. `read handoff` (this file). Verify Mandy pushed `main` (was unpushed at handoff).
2. Brainstorm follow-up #1 (badge) and #2 (Easyscale) — both are design decisions, not mechanical.
3. Note: a dev server may be running on :3000 (pid was 88139).
