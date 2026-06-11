# Mockup social-size crop anchor + per-size previews — Design

**Date:** 2026-06-11
**Branch:** `feat/mockup-social-exports` (builds on the unified "Download mockup" menu)
**Seed:** [SEED-mockup-crop-anchor.md](../SEED-mockup-crop-anchor.md)

## Problem

The unified social-size cover-crop is auto-centered. For some mockups that frames the
product wrong — the canonical case is a **dress on a hanger** cropped to a square: the
centered crop keeps the full hanger at the top and clips the dress hem at the bottom.
Mandy wants to keep the dress and drop the hanger (anchor the crop lower).

Users need to (1) **see the crop framing per size** before downloading, and (2) **choose
Top / Center / Bottom** per size.

## Decisions (resolved during brainstorm)

| Fork | Decision |
|------|----------|
| Anchor axis | **Vertical only** (Top/Center/Bottom). Works on Square + Portrait (the only sizes cropped vertically). Pinterest is the same 2:3 as the source so it is never cropped; Story crops horizontally — both get no toggle. |
| Anchor scope | **Per-size.** Square can be Bottom while Portrait stays Center. |
| UI layout | **Per-size rows** (checkbox · thumbnail · name/dims · T/C/B toggle), replacing the pill wrap. |
| Anchor reset | **Reset to Center on template change and on modal close** — mirrors today's `socialSizes` lifecycle. No persistence. |
| Preview render | **One canvas snapshot, CSS-cropped per row** (`background-size:cover` + `background-position`). Identical math to the export crop; instant on toggle. |
| Parity | **Extract a shared `MockupDownloadMenu` component** rendered by both entry points, instead of mirroring the richer logic twice. |

## Which sizes get an anchor (grounding)

Source render is always 2:3 portrait (3000×4500), `srcAspect ≈ 0.667`. In
`computeCoverCropRect`, the branch taken decides the cropped axis:

| Size | Target aspect | Branch | Cropped axis | Anchor |
|------|---------------|--------|--------------|--------|
| Full size | n/a (not cropped) | — | — | none |
| Square 1:1 | 1.000 | taller-source (else) | top/bottom | **vertical T/C/B** |
| Portrait 4:5 | 0.800 | taller-source (else) | top/bottom | **vertical T/C/B** |
| Pinterest 2:3 | 0.667 | equal → full source | none (no crop) | T/C/B shown but a no-op; treat as none |
| Story 9:16 | 0.5625 | wider-source (if) | left/right | none (vertical n/a) |

> Note: Pinterest is the same aspect as the source, so it is never cropped — its anchor
> would do nothing. **Only Square and Portrait actually expose a working anchor.** Story
> and Full size show no toggle. Pinterest shows no toggle either (no crop). This keeps the
> UI honest: a T/C/B control only appears where it changes the output.

## Architecture

### 1. Geometry — `src/lib/utils/mockupSocialExport.ts`

```ts
export type VAnchor = 'top' | 'center' | 'bottom';

export function computeCoverCropRect(
  srcW, srcH, targetW, targetH,
  anchor: VAnchor = 'center',
): CoverCropRect
```

Only the **taller-source branch** uses `anchor` (the branch that sets `sy`):

```ts
const sHeight = Math.round(srcW / targetAspect);
const sy =
  anchor === 'top'    ? 0
  : anchor === 'bottom' ? srcH - sHeight
  : Math.round((srcH - sHeight) / 2); // center (today's behavior)
return { sx: 0, sy, sWidth: srcW, sHeight };
```

The wider-source branch (Story) is unchanged — `anchor` is accepted but ignored there.
Default `center` ⇒ existing behavior is byte-identical for untouched exports.

### 2. Threading the anchor through the export chain

- `MockupSocialOpts` gains `anchors?: Partial<Record<SizeSlug, VAnchor>>`.
- `coverCropToBlob(source, targetW, targetH, anchor: VAnchor = 'center')` forwards it.
- `exportMockupSocialBlob` resolves `const a = opts.anchors?.[preset.slug] ?? 'center'`
  and passes it down.
- `downloadMockupSocialSizes` passes `opts` through as today; Full size
  (`exportFullSizeMockupBlob`) ignores anchors entirely.

### 3. Preview thumbnails — CSS crop from one snapshot

- On the modal's existing `MockupRendererV2 onRenderComplete`, snapshot the live mockup
  canvas (`[data-mockup-modal] canvas`) to a data-URL **once per render**; store in state
  (e.g. `mockupSnapshotUrl`). Clear it while `isCapturingFullRes` re-renders.
- Each row thumbnail is a `<div>` with:
  - `aspectRatio: targetW / targetH` (so the box IS the target frame),
  - `backgroundImage: url(snapshot)`, `backgroundSize: 'cover'`,
  - `backgroundPosition` from the anchor: `'50% 0%'` (top) · `'50% 50%'` (center) ·
    `'50% 100%'` (bottom). Story/Pinterest/Full use `'50% 50%'`.
- `background-size:cover` + a percentage `background-position` is the exact CSS equivalent
  of the cover-crop math, so the preview cannot drift from the exported file. Toggling
  T/C/B is pure CSS — no recompute, no re-render.
- Watermark/badge are **not** drawn in thumbnails (framing only). The large modal preview
  already shows watermark/badge overlays.
- Before the first snapshot exists, rows show a neutral placeholder (e.g. a soft shimmer
  box at the right aspect ratio).

### 4. Shared UI component — `MockupDownloadMenu`

New presentational component (location: `src/components/mockups/MockupDownloadMenu.tsx`)
rendered by both `AdvancedToolsBar.tsx` and `ActionsSidebar.tsx`. Props (state stays
lifted in each parent so the existing reset/lifecycle effects keep working):

```ts
interface MockupDownloadMenuProps {
  sizes: SocialSizePreset[];              // mockupDownloadSizes()
  selected: Set<SizeSlug>;
  onToggleSize: (slug: SizeSlug) => void;
  anchors: Record<SizeSlug, VAnchor>;
  onSetAnchor: (slug: SizeSlug, a: VAnchor) => void;
  snapshotUrl: string | null;
  isLocked: (slug: SizeSlug) => boolean;  // wraps isFreeMockup/isFreeSocialSize + isPro
  onLockedClick: () => void;              // opens UpgradeModal
  isBusy: boolean;                        // isCapturingFullRes
  onDownload: () => void;
}
```

Anchor toggle visibility rule inside the component: show T/C/B **only** for slugs whose
cover-crop actually crops vertically — i.e. Square and Portrait. Everything else renders
the thumbnail with no toggle. (Implemented as a small `cropsVertically(slug)` helper, or a
static set, colocated with the size presets so the rule has one home.)

Both entry points must render this identically — that is the entire point of extracting it.

### 5. State & lifecycle (in each parent)

- New state: `const [socialAnchors, setSocialAnchors] = useState<Record<SizeSlug, VAnchor>>(...)`,
  all defaulting to `'center'`.
- Reset to all-center in the **same** places `socialSizes` resets: the
  `selectedMockup`-change `useEffect` and the modal `onClose` handler.
- New state: `mockupSnapshotUrl: string | null`, captured in `onRenderComplete`, cleared on
  template change / close.
- `onDownload` passes `anchors: socialAnchors` into the `MockupSocialOpts` it builds for
  `downloadMockupSocialSizes`.

### 6. Touch / iPad (mandatory — ~half of users on iPad/Pencil)

- T/C/B is a segmented control of real `<button>`s with `touchAction: 'manipulation'`,
  large tap targets (≥36px), no hover-only affordances.
- No drag, no Pointer-Event capture needed (presets, not free-drag). Selection toggles and
  anchor buttons are plain taps.

## Testing

**Unit (vitest, jsdom — geometry is assertable):**
- `computeCoverCropRect(3000,4500,1000,1000,'top')` → `sy: 0`
- `…,'center')` → `sy: 750` (unchanged default)
- `…,'bottom')` → `sy: 1500`
- Default arg (omitted) equals `'center'` (regression guard for unchanged behavior).
- Story/wider-source case (`…,1000,2000,'bottom'`) ignores anchor — `sx` still centered,
  `sy: 0`.

**Manual (canvas pixels are not assertable in jsdom):**
- Run the app desktop + iPad. Pick the dress mockup, Square size, set Bottom → confirm the
  hem is kept and the hanger dropped, and the downloaded PNG matches the thumbnail.

## Guardrails (carried from the unified-menu work)

- Imports in `mockupSocialExport.ts` stay **relative** (vitest has no `@/` alias).
- Do **not** touch `RepeatExportModal` or `SOCIAL_SIZE_PRESETS`.
- Default anchor = `center` ⇒ unchanged output for anyone who doesn't pick Top/Bottom.
- Per-task gates: `npx tsc --noEmit` clean · `npx vitest run` green · `npx eslint <file>`
  no new warnings.

## Out of scope (YAGNI)

- Horizontal anchor / free-drag repositioning (declined).
- Anchor on Story, Pinterest, or Full size (no working vertical crop there).
- Persisting anchors across templates or sessions.
- Baking watermark/badge into preview thumbnails.
