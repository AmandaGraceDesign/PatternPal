# "Tested in PatternPAL" Badge — Design

**Date:** 2026-05-30
**Status:** Approved (design); pending implementation plan

## Purpose

PatternPAL is invisible. 191 paying users ship work daily, but every export is
anonymous, so no signal reaches other surface designers that the tool exists.
The badge turns each Pro user's social posts and mockup downloads into a passive,
ongoing PatternPAL impression — a "this person tested their pattern properly"
flex, not a punitive watermark. One toggle, deployed once, compounds every time
a Pro user exports.

The badge lives **where the work is seen** (social posts, mockups), never **where
the work is shipped** (production files for printers/POD/clients).

## Scope

**In scope — badge IS stamped on:**
- Social Media Export (`RepeatExportModal` `'social'` mode)
- Mockup downloads (`AdvancedToolsBar` and `ActionsSidebar` `onDownload` handlers)

**Out of scope — badge is NEVER stamped on:**
- Easyscale / Cricut export (`RepeatExportModal` `'cricut'` mode)
- Pattern Fill export (`RepeatExportModal` `'picker'` mode)

These are production files; a badge there reads as unprofessional. They are
separate code paths and remain untouched.

## What it is

A **fixed PatternPAL brand mark** stamped onto the final exported image. It is
distinct from the existing user-watermark system (`src/lib/watermark/watermark.ts`),
which stamps the *user's own* logo/text. The two coexist: user watermark is
bottom-center; the PatternPAL badge is bottom-left.

Assets (already in `public/`):
- `tested-in-patternpal-navy.png` — dark mark, used on **light** backgrounds
- `tested-in-patternpal-gold.png` — light/warm mark, used on **dark** backgrounds

## Placement & appearance

- **Fixed bottom-left corner.** Not draggable.
- Inset ≈ 4% of canvas width from the left and bottom edges. Bottom margin aligns
  with the watermark band so the badge and any user logo share the same baseline.
- **Width ≈ 20% of canvas width** (single tunable constant `BADGE_WIDTH_PERCENT`).
  Height derives from the PNG aspect ratio.
- **Auto-color by contrast:** sample the average luminance of the badge's target
  rectangle on the *composed* image (after pattern + any mockup overlay + user
  watermark). Luminance > 0.5 → navy mark; else → gold mark. Fully automatic, no
  user override.

## Gating (who sees it, who can remove it)

Both Social Export and Mockups are already Pro-gated tools; free users hit the
upgrade modal and cannot export through these paths. The distinction that matters
is paid-Pro vs. trial access:

- `isPro === true` (paid, via `checkClientProStatus(user.publicMetadata)`):
  toggle visible, **default ON**, user can turn it OFF.
- `proAccess === 'allowed'` but not paid (**trial**): badge **forced ON**; the
  toggle renders locked/disabled with an "upgrade to remove" hint.

Decision rule for whether the toggle is user-controllable:
`const badgeLocked = !isPro;` (locked-on for trial). Effective stamp decision:
`const stampBadge = badgeLocked ? true : badgeEnabled;`

> Note: use `isPro` (paid) for lock logic, NOT `proAllowed` (which is true for
> trial users too).

## New code

### `src/lib/badge/patternpalBadge.ts`

Mirrors the structure of `src/lib/watermark/watermark.ts`:

- Asset path constants for the navy/gold PNGs.
- A module-level image cache (`Map<string, Promise<HTMLImageElement | null>>`),
  same pattern as `cachedLoadLogo`, so each PNG decodes once.
- `BADGE_WIDTH_PERCENT` and corner-inset constants.
- `pickBadgeVariant(luminance: number): 'navy' | 'gold'` — threshold at 0.5.
- `sampleRegionLuminance(ctx, x, y, w, h): number` — average luminance of the
  badge's target rectangle (downsample for speed; reuse the watermark lib's
  approach to canvas sampling where practical).
- `drawPatternpalBadge(ctx, canvasW, canvasH, badgeImg, scaleFactor)` — draws the
  badge bottom-left at the computed size/inset.
- `applyBadgeToBlob(blob, w, h, format, { enabled }): Promise<Blob>` — if not
  enabled, returns the blob unchanged; else composes onto a canvas, samples
  contrast in the badge rectangle, loads the matching PNG via the cache, draws it,
  and returns a new blob. Signature parallels `applyWatermarkToBlob`.

### Toggle UI

A standalone **"Tested in PatternPAL badge"** toggle row (its own row, not folded
into the watermark panel) added to each of the three export surfaces. State is a
local `badgeEnabled` boolean (default `true`) in each component, exactly mirroring
how the `watermark` config is already held locally in each component (no global
store — keeps the change minimal and consistent with existing patterns).

When `!isPro` (trial), the row renders checked + disabled with an upgrade hint.

## Integration points (where the stamp is applied)

The badge is applied to the **final composed blob, after the user watermark**, so
it sits on top:

1. **Social** — `src/components/export/RepeatExportModal.tsx`, the `'social'`
   per-blob export loop (~L808, immediately after `applyWatermarkToBlob`).
2. **Mockup (toolbar)** — `src/components/layout/AdvancedToolsBar.tsx`
   `onDownload` (~L547), after the watermark compose, before `injectPngDpi`.
3. **Mockup (sidebar)** — `src/components/sidebar/ActionsSidebar.tsx`
   `onDownload` (~L391), after the watermark compose, before download.

Each call site computes `stampBadge` from `isPro` + local `badgeEnabled` and calls
`applyBadgeToBlob(blob, w, h, format, { enabled: stampBadge })`.

## Data flow

```
pattern image
  → [social] tile/scale  OR  [mockup] full-res render → downscale (÷2, 150 DPI)
  → optional mockup overlay (social only)
  → optional USER watermark (applyWatermarkToBlob)
  → optional PATTERNPAL badge (applyBadgeToBlob)   ← NEW, top layer
  → [mockup] injectPngDpi(150)
  → downloadBlob / zip
```

## Error handling

- If a badge PNG fails to load, `applyBadgeToBlob` returns the input blob
  unchanged (no badge) rather than failing the export — same defensive posture as
  `applyWatermarkToBlob` returning the original blob on context failure.
- Contrast sampling guards against zero-size rectangles and missing 2D context.

## Testing

- **Unit (`src/lib/badge/patternpalBadge.ts`):**
  - `pickBadgeVariant` returns `'navy'` for light luminance, `'gold'` for dark,
    boundary at 0.5.
  - `applyBadgeToBlob({ enabled: false })` returns the input blob untouched.
  - `applyBadgeToBlob({ enabled: true })` returns a blob of the expected
    dimensions with the badge present (assert non-empty / dimensions; canvas
    pixel-spot-check bottom-left region differs from input).
- **Gating logic:** `stampBadge` is `true` when trial (`!isPro`) regardless of
  `badgeEnabled`; honors `badgeEnabled` when `isPro`.
- **Manual / iPad parity:** verify the toggle row works via touch (Pointer
  Events, `touch-action: none` where relevant), and that badge placement looks
  correct on both a light and a dark pattern across social sizes and a mockup.
- **Negative:** confirm Easyscale (`'cricut'`) and Pattern Fill (`'picker'`)
  exports produce NO badge.

## Housekeeping

`public/tested-in-patternpal.zip` is the source asset package and should not be
served or committed — add to `.gitignore` or remove. Only the two PNGs ship.

## Open / tunable

- `BADGE_WIDTH_PERCENT` (~20%) and corner inset are single constants, easy to
  tweak after seeing real exports.
