# Free-Tier Mockups + Social Export — Design Spec

**Date:** 2026-05-30
**Status:** Approved design, pending implementation plan
**Author:** Mandy (Amanda Grace Design) + Claude

---

## Goal

Give free users (both anonymous and signed-in free) a real taste of the Mockups
and Social Export tools — currently 100% Pro-gated — without giving away the
whole catalog. Free users get a **curated set of 4 mockups** plus **one Instagram
square social export**, while seeing the full (locked) catalog as upgrade bait.

Logo-watermark overlay stays Pro-only on every tier. The "Tested in PatternPAL"
badge stays permanently baked into all free output (removable only on Pro).

---

## Tier Matrix

| Capability | Anonymous (within 3 free tests) | Signed-in free | Pro |
|---|---|---|---|
| Logo watermark overlay | ❌ never | ❌ never | ✅ available |
| "Tested in PatternPAL" badge | 🔒 permanent | 🔒 permanent | removable |
| Mockup catalog | full catalog **visible**, 4 unlocked, rest locked | same | all unlocked |
| Mockup downloads | the 4 free templates, freely re-downloadable | same | all, unlimited |
| Social export | Instagram square only, freely re-downloadable | Instagram square only, freely re-downloadable | all sizes, unlimited |

**No social-usage counter.** The free social export is gated purely by *what's
offered* — only the Instagram-square size and only the 4 free mockups — not by a
usage quota. A free user can generate/re-download it as many times as they like.
This mirrors the mockup model (the gate is the curated set, not a download count).

**Anon lifecycle:** the perk is usable while the anonymous user still has free
tests remaining. Once they hit the 3-test wall (`pp_free_tests_used >= 3`) they
get the existing sign-in prompt (`openSignIn`) and convert to the signed-in free
tier, where the same perk continues.

---

## The Curated Free Set (4 templates)

| Display intent | Template name | Template ID |
|---|---|---|
| Baby onesie | Baby Onesie | `onesie` |
| Pillow | Throw Pillow | `throw-pillow` |
| Bench / entry wallpaper | Entry Wallpaper | `wallpaper` |
| Gift wrap box | Wrapping Paper (Gift Box) | `wrapping-paper` |

Define once as a shared constant, e.g.:

```ts
// src/lib/mockups/freeTier.ts
export const FREE_MOCKUP_IDS = ['onesie', 'throw-pillow', 'wallpaper', 'wrapping-paper'] as const;
export const FREE_SOCIAL_SIZE_SLUG = 'instagram-post'; // 1080×1080
```

Both the gallery (per-card lock) and the social export (which mockups + which
size are offered) read from this single source of truth.

---

## Component-Level Changes

### 1. `src/components/mockups/MockupGalleryModal.tsx`
- **Remove** the blanket `if (!isPro) return <UpgradeModal>` wall (lines ~126–129).
  The gallery opens for everyone.
- Per-card gating: a card whose `template.id` is in `FREE_MOCKUP_IDS` is openable
  for all tiers. Every other card renders with a **lock badge + dimmed overlay**;
  clicking a locked card opens the `UpgradeModal` (or routes to upgrade) instead
  of `onSelectMockup`.
- Free tiers still see all thumbnails render (the enticement), just can't open
  the locked ones.

### 2. `src/components/mockups/MockupModal.tsx`
- Only reachable for free users via a free template (gallery enforces this), so
  the full-size view + Download work unchanged for the 4 free templates.
- Badge: free users already get the badge locked on via
  `shouldStampBadge({ isPaidPro: false, badgeEnabled: true })` → no change needed
  beyond confirming the badge toggle / logo-watermark panel is not shown to free
  users (logo watermark is Pro-only — verify the WatermarkPanel is Pro-gated here
  and in the social modal).

### 3. `src/components/export/RepeatExportModal.tsx` (social mode)
- Allow free users into social mode (today it's behind `handleProToolClick`).
- For free tiers:
  - **Size:** only `instagram-post` (1080×1080) is selectable; other
    `SOCIAL_SIZE_PRESETS` rows render locked → upgrade prompt.
  - **Mockup overlay options:** restricted to `FREE_MOCKUP_IDS`.
  - **Badge:** locked on; **logo-watermark panel hidden** (Pro-only).
  - **No usage quota** — freely re-downloadable. The free gate is the size
    restriction (Instagram square only) + the 4-mockup restriction. The locked
    size rows act as the upgrade nudge.

### 4. `src/components/layout/AdvancedToolsBar.tsx`
- **Social Media Export card:** no longer hard Pro-gated — opens the social modal
  for everyone (the modal enforces free limits). Keep the PRO badge styling logic,
  but free users get the limited flow rather than the UpgradeModal.
- **Mockups card:** already opens the gallery for everyone; gallery now does
  per-card gating instead of the modal-level wall.

### 5. Metering — none beyond the existing free-test gate
- **No new counters.** Mockups and the social export are both gated by *what's
  offered* (curated 4 templates; Instagram-square size only), not by usage counts.
- The only existing meter is the anonymous 3-free-test gate (`pp_free_tests_used`
  in localStorage, handled in `app/page.tsx`). When anon hits the wall, the
  existing `openSignIn` flow converts them to signed-in free and the perk
  continues.
- The single source of truth (`FREE_MOCKUP_IDS`, `FREE_SOCIAL_SIZE_SLUG`) lives
  in `src/lib/mockups/freeTier.ts` (new) and is read by the gallery and the
  social modal.

---

## What Stays the Same

- Pro experience is unchanged: full catalog, unlimited, removable badge, logo
  watermark available.
- DPI pipeline, badge rendering (`applyBadgeToBlob`), and social export rendering
  pipeline are untouched — we only change *who* can reach them and *what options*
  they see.
- Server-side `/api/pro/verify` remains the gate for genuine Pro features. The
  free perk is intentionally client-metered and bypass-tolerant (same stance as
  the existing free trial; the permanent badge limits the downside).

---

## Out of Scope

- Server-side metering / abuse prevention for the free perk.
- Changes to the badge artwork or placement.
- Adding new mockup templates.
- The unrelated open follow-ups (iPad login timeout, `/api/pro/verify`
  root-cause).

---

## Open Risks / Notes

- **Wallpaper identity:** "bench wallpaper" mapped to `wallpaper` ("Entry
  Wallpaper"), not `nursery-wallpaper`. Confirmed acceptable; revisit if the
  wrong scene.
- **Logo-watermark visibility:** must verify the `WatermarkPanel` is not exposed
  to free users in either the mockup or social flows (it should already be
  Pro-gated; confirm during implementation).
- **Mobile/iPad parity:** all new lock overlays and the limited social flow must
  work with touch + Pencil (Pointer Events, `touch-action: none`), per project
  standard.
