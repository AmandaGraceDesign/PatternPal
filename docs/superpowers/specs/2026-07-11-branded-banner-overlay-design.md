# Design Spec: Branded Banner Overlay (logo + collection title)

**Date:** 2026-07-11
**Source:** User feature request #5 (Colour Rebel Studio) — see `docs/user-feature-requests.md`. She wants a branded **banner** overlaid on pattern/mockup marketing images: a semi-transparent horizontal band carrying her **logo + a collection-name title/subtitle** (e.g. "Fruity Floral Patchwork" / "Part of the FLF Collection"), with **placement options** so she can then add pin/post text in Canva.

---

## Overview

Extend the existing watermark ("Logo Overlay") system with a new **banner mode**: a full-width band, positioned top / middle / bottom, carrying the user's logo (left / right / centre) plus an optional bold **title** and lighter **subtitle**. The current free-floating bottom-center logo becomes "Simple logo" mode and **also gains 9-point placement**. The overlay is preview/export-only branding — it never alters the saved pattern or the print-deliverable exports (EasyScale / Cricut).

**Why extend, not rebuild:** All three branded surfaces already funnel through one system — `WatermarkConfig` → `drawWatermark()` → `applyWatermarkToBlob()`. Adding a banner branch there means every surface (social export, mockup social export, mockup crop preview) gets it automatically, canvas preview and baked export can't drift (both call `drawWatermark`), and there is one place to test. A separate banner module would duplicate compositing and risk preview/export divergence. Rejected.

**Current state (mapped 2026-07-11):**
- Core: `src/lib/watermark/watermark.ts` — `WatermarkConfig` (fields ~3-19), `DEFAULT_WATERMARK` (~38-50), `drawWatermark()` (position math ~124-133, `cursorY` from bottom ~98), `applyWatermarkToBlob()`, `cachedLoadLogo()`, `WATERMARK_FONTS`.
- UI: `src/components/watermark/WatermarkPanel.tsx` — today surfaces only logo upload/remove, size slider (5–60%), opacity slider (10–100%). The `text`/`font`/`color`/`bgColor` fields exist in the type but are not surfaced.
- Live hint: `src/components/watermark/WatermarkPreviewOverlay.tsx` — hard-coded `inset-x-0 bottom-0 items-center` (bottom-center HTML approximation).
- Applied in: social export (`RepeatExportModal.tsx` `SocialPreviewSlide` — canvas draw ~377, bake ~853), mockup social/download (`src/lib/utils/mockupSocialExport.ts` ~93/128), mockup crop preview (`MockupCropStage.tsx`:165, panel hosted in `MockupModalBody.tsx`:398).
- **Not** applied in EasyScale or Cricut/repeat-fill — those print-deliverable exports are already clean and stay untouched.

---

## Design decisions (from brainstorm 2026-07-11)

1. **Mode toggle**, not replacement or stacking. The Logo Overlay panel has two modes: **Simple logo** (current behavior) and **Banner** (new). User picks one.
2. **Banner layout:** logo on one side, title + subtitle stacked beside it (matches her examples). Centre logo = logo-only band, no text.
3. **Text:** bold **title** + lighter **subtitle**, both optional. Blank = logo-only band, or leave room to add text in Canva.
4. **Placement is a shared 9-point anchor** (`anchorH` × `anchorV`) driving both modes:
   - Simple logo: logo placed at the anchor point.
   - Banner: `anchorV` selects the band edge (top/middle/bottom); `anchorH` places the logo within the band (left/right/center).
5. **Styling = "brand controls"** tier: band color + opacity, text color, font (existing sans/serif/script). Band height auto-sizes to content. No height/size sliders in v1.
6. **Surfaces:** social exports + mockup exports only. Pro-only (same gating as today's logo overlay). Cricut/EasyScale untouched.

---

## Data model

Extend `WatermarkConfig` (`watermark.ts`). All fields additive; defaults reproduce today's behavior exactly (no regression for existing users).

```ts
export interface WatermarkConfig {
  // ---- existing (unchanged) ----
  enabled: boolean;
  text: string;            // still used by legacy caption path; not the banner title
  font: 'sans' | 'serif' | 'script';
  color: string;           // text color (reused by banner title/subtitle)
  opacity: number;         // legacy text opacity
  fontSize: number;
  bgEnabled: boolean;
  bgColor: string;
  logoDataUrl?: string;
  logoOpacity: number;
  logoSizePercent: number;

  // ---- new ----
  /** Which overlay to render. Default 'logo' = current free-floating logo. */
  mode: 'logo' | 'banner';
  /** Shared placement anchor. Default center+bottom = today's bottom-center logo. */
  anchorH: 'left' | 'center' | 'right';   // default 'center'
  anchorV: 'top' | 'middle' | 'bottom';   // default 'bottom'
  /** Banner text (both optional). */
  bannerTitle: string;                     // default ''
  bannerSubtitle: string;                  // default ''
  /** Band fill. */
  bandColor: string;                       // default '#ffffff'
  bandOpacity: number;                     // 0–1, default ~0.8
}
```

`DEFAULT_WATERMARK` sets `mode: 'logo'`, `anchorH: 'center'`, `anchorV: 'bottom'`, `bannerTitle: ''`, `bannerSubtitle: ''`, `bandColor: '#ffffff'`, `bandOpacity: 0.8` — so an existing saved config (or a fresh one) renders identically to today until the user switches to Banner.

**Interfaces / units:** anchors are enums (no magic strings elsewhere). `bandOpacity` is 0–1 to match `logoOpacity`/`opacity`. All position math is expressed as a fraction of canvas dimensions so it is render-scale-independent (same value works for the small preview canvas and the full-res export).

---

## Rendering — `drawWatermark()` banner branch

`drawWatermark(ctx, canvasW, canvasH, wm, scale, logoImg)` gains a top-level branch on `wm.mode`:

- **`mode === 'logo'` (default):** existing code path, refactored only to honor `anchorH`/`anchorV` instead of the hard-coded center/bottom. `anchorH: 'center', anchorV: 'bottom'` must produce pixel-identical output to today.
- **`mode === 'banner'`:**
  1. Compute band height from content: `max(logo height at logoSizePercent, title+subtitle stacked height)` + vertical padding. Pure helper `computeBannerBandRect(canvasW, canvasH, wm, scale, logoAspect, hasTitle, hasSubtitle) → { x, y, width, height }` (full-width band `x=0, width=canvasW`, `y` from `anchorV`).
  2. Fill the band: `ctx.fillStyle = bandColor` at `globalAlpha = bandOpacity`, `fillRect(bandRect)`.
  3. Lay out logo + text inside the band via pure helper `computeBannerContentLayout(bandRect, wm, scale, logoDims, textMetrics) → { logoRect, titlePos, subtitlePos }` keyed on `anchorH`:
     - `left`: logo left-aligned, text block to its right.
     - `right`: logo right-aligned, text block to its left.
     - `center`: logo centered, **no text** (logo-only band).
  4. Draw logo at `logoRect` (honoring `logoOpacity`), title in bold + subtitle lighter using `font` + `color`. Empty title/subtitle strings are skipped.

Because `applyWatermarkToBlob()` composites by calling `drawWatermark` onto the export canvas, and the social/mockup previews call the same function, **the banner appears in both preview and export with no additional wiring.**

---

## Preview parity

- **Social export** (`SocialPreviewSlide`): already canvas-draws via `drawWatermark` — banner renders accurately for free.
- **Mockup crop preview** (`MockupCropStage.tsx` via `WatermarkPreviewOverlay`): today an HTML overlay hard-coded bottom-center. Update `WatermarkPreviewOverlay` to render the band (position + logo side + title/subtitle) in banner mode, and honor `anchorH`/`anchorV` in logo mode, so the mockup preview matches what exports. (HTML approximation is acceptable — the authoritative pixels come from `drawWatermark` at export time; the overlay only needs to communicate placement/content.)

---

## UI — `WatermarkPanel.tsx`

Add a **mode toggle** at the top: `Simple logo` | `Banner`.

- **Simple logo mode:** existing controls (logo upload/remove, size, opacity) **plus** a 9-point placement control (`anchorH` × `anchorV`).
- **Banner mode:** reveals — title input, subtitle input, logo position (left/right/center → `anchorH`), band position (top/middle/bottom → `anchorV`), band color + band opacity, text color, font. Logo upload/size/opacity shared with logo mode.

Placement control: a compact 3×3 grid (or two 3-segment toggles for H and V) is sufficient; reuse existing panel styling. Pro-gated exactly as the panel is today (`isPro` guard in `RepeatExportModal` ~1428 and the mockup host).

---

## Scope, gating, surfaces

- **Pro-only** — unchanged from today's logo overlay (free tiers cannot overlay a logo/banner).
- **Surfaces:** social export (`RepeatExportModal` social mode) + mockup exports (`mockupSocialExport.ts`, mockup crop preview). Both already share `WatermarkConfig`.
- **Untouched:** EasyScale export, Cricut / repeat-fill (`generateRepeatFillExport`) — verified to carry zero branding; they stay clean.
- **Backward compatibility:** default `mode: 'logo'` + center/bottom anchor = pixel-identical to current output. No migration needed for in-memory configs (watermark config is per-session `useState`, not persisted).

---

## Testing

Following the repo convention (Vitest + jsdom, no pixel tests, no component-testing library — unit-test pure helpers, source-assert threading, manual UAT for canvas):

- **Unit (pure helpers):**
  - `computeBannerBandRect` — band `y`/height for each `anchorV`; height grows with title+subtitle vs logo-only.
  - `computeBannerContentLayout` — logo + text positions for `anchorH` left/right/center; center yields logo-only (no text positions).
  - Logo-mode anchor math — 9 anchor combinations place the logo in the expected corner/edge; `center`+`bottom` matches the legacy formula.
- **Source-assert:** `WatermarkConfig` has the new fields; `drawWatermark` branches on `mode`; `DEFAULT_WATERMARK` defaults preserve legacy behavior.
- **Manual UAT (desktop + iPad):** banner in social export preview + exported file; banner in mockup export; each band position; logo left/right/center; blank title/subtitle → logo-only band; Simple-logo placement at several anchors; confirm Cricut/EasyScale still carry nothing; Pro gating.

---

## Out of scope (v1)

- Band height / logo size / text size sliders (auto-size only; "Full control" tier deferred).
- Multiple/looping banners, per-size banner text, saved banner presets.
- Banner on EasyScale/Cricut (deliberately excluded).
- Persisting watermark/banner config across sessions.
- In-app "add your own text" beyond title/subtitle (she does that in Canva).

---

## Success criteria

- A Pro user can switch the Logo Overlay panel to **Banner**, type a title + subtitle, choose logo side + band position + band color/opacity + text color/font, and see it live in both the social and mockup previews.
- The exported social image and mockup image show the banner exactly as previewed.
- Blank title + subtitle produces a clean logo-only band.
- **Simple logo** mode still works and now honors placement; with default anchors it is pixel-identical to today.
- EasyScale and Cricut exports remain completely unbranded.
