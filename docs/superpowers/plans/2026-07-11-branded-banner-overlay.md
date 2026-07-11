# Branded Banner Overlay — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Banner" mode to the existing logo overlay — a full-width band carrying the user's logo plus an optional title + subtitle — with shared 9-point placement that also upgrades the current "Simple logo" mode, on social + mockup exports only.

**Architecture:** Extend the one shared watermark system (`WatermarkConfig` → `drawWatermark()` → `applyWatermarkToBlob()`). All branded surfaces call `drawWatermark`, so a banner branch there reaches social export, mockup social export, and the mockup crop preview at once, with preview and export guaranteed in sync. Pure geometry helpers are unit-tested; the canvas draw and UI are source-asserted + manually UAT'd (repo convention — no pixel tests).

**Tech Stack:** Next.js (App Router, `--webpack`), React 18 client components, TypeScript, HTML Canvas 2D, Vitest + jsdom.

## Global Constraints

- **Backward compatibility is mandatory.** `DEFAULT_WATERMARK` must default to `mode: 'logo'`, `anchorH: 'center'`, `anchorV: 'bottom'`, and in that configuration `drawWatermark` must produce **pixel-identical** output to today. Existing behavior cannot regress.
- **Pro-only.** The panel is already gated behind `isPro` at its call sites — do not change that gating. No new free-tier surface.
- **Surfaces: social + mockup exports only.** Do NOT add watermark/badge calls to EasyScale (`EasyscaleExportModal.tsx`) or Cricut/repeat-fill (`generateRepeatFillExport`) — those print-deliverable exports stay clean.
- **Config is per-session `useState`, not persisted** — no migration code needed.
- **iPad/Pencil parity** applies to any new interactive control (the placement picker is tap-only buttons — no drag — so this is satisfied by using normal buttons).
- Test command: `npx vitest run <file>`. Full suite: `npm test`. Lint: `npm run lint`. Build: `npm run build`.

---

### Task 1: Data model — extend WatermarkConfig + defaults

**Files:**
- Modify: `src/lib/watermark/watermark.ts` (interface 3-19; `DEFAULT_WATERMARK` 38-50)
- Test: `src/__tests__/watermarkBanner.test.ts` (create)

**Interfaces:**
- Produces: `WatermarkConfig` gains `mode: 'logo' | 'banner'`, `anchorH: 'left' | 'center' | 'right'`, `anchorV: 'top' | 'middle' | 'bottom'`, `bannerTitle: string`, `bannerSubtitle: string`, `bandColor: string`, `bandOpacity: number`.
- Produces: `WatermarkAnchorH = 'left' | 'center' | 'right'`, `WatermarkAnchorV = 'top' | 'middle' | 'bottom'` (exported type aliases).

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/watermarkBanner.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { DEFAULT_WATERMARK } from '../lib/watermark/watermark';

describe('WATERMARK: default config preserves legacy behavior', () => {
  it('defaults to simple-logo mode anchored center+bottom', () => {
    expect(DEFAULT_WATERMARK.mode).toBe('logo');
    expect(DEFAULT_WATERMARK.anchorH).toBe('center');
    expect(DEFAULT_WATERMARK.anchorV).toBe('bottom');
  });
  it('defaults banner fields to empty / sensible band', () => {
    expect(DEFAULT_WATERMARK.bannerTitle).toBe('');
    expect(DEFAULT_WATERMARK.bannerSubtitle).toBe('');
    expect(DEFAULT_WATERMARK.bandColor).toBe('#ffffff');
    expect(DEFAULT_WATERMARK.bandOpacity).toBeGreaterThan(0);
    expect(DEFAULT_WATERMARK.bandOpacity).toBeLessThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/watermarkBanner.test.ts`
Expected: FAIL — `mode` etc. are `undefined`.

- [ ] **Step 3: Extend the type**

In `watermark.ts`, add the aliases after line 1 and extend the interface (replace lines 3-19):

```ts
export type WatermarkFont = 'sans' | 'serif' | 'script';
export type WatermarkAnchorH = 'left' | 'center' | 'right';
export type WatermarkAnchorV = 'top' | 'middle' | 'bottom';

export interface WatermarkConfig {
  enabled: boolean;
  text: string;
  font: WatermarkFont;
  color: string;
  opacity: number;   // 0–1
  fontSize: number;   // px relative to 1080px-wide canvas
  bgEnabled: boolean;
  bgColor: string;
  /** Data URL of an uploaded transparent PNG logo. */
  logoDataUrl?: string;
  /** Logo opacity 0..1. Independent from text opacity. */
  logoOpacity: number;
  /** Logo width as a fraction of canvas width (e.g. 0.25 = 25%). */
  logoSizePercent: number;

  // ---- banner overlay (added 2026-07) ----
  /** Which overlay to render. 'logo' = free-floating logo (legacy);
   *  'banner' = full-width band with logo + title/subtitle. */
  mode: 'logo' | 'banner';
  /** Shared placement. In logo mode: the logo's anchor point. In banner mode:
   *  anchorV picks the band edge; anchorH places the logo within the band. */
  anchorH: WatermarkAnchorH;
  anchorV: WatermarkAnchorV;
  /** Banner text (both optional; blank = logo-only band). */
  bannerTitle: string;
  bannerSubtitle: string;
  /** Band fill color + opacity (0..1). */
  bandColor: string;
  bandOpacity: number;
}
```

- [ ] **Step 4: Extend the defaults**

Replace `DEFAULT_WATERMARK` (lines 38-50):

```ts
export const DEFAULT_WATERMARK: WatermarkConfig = {
  enabled: true,
  text: '',
  font: 'sans',
  color: '#ffffff',
  opacity: 0.5,
  fontSize: 32,
  bgEnabled: false,
  bgColor: '#000000',
  logoDataUrl: undefined,
  logoOpacity: 1,
  logoSizePercent: 0.2,
  mode: 'logo',
  anchorH: 'center',
  anchorV: 'bottom',
  bannerTitle: '',
  bannerSubtitle: '',
  bandColor: '#ffffff',
  bandOpacity: 0.8,
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/__tests__/watermarkBanner.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/watermark/watermark.ts src/__tests__/watermarkBanner.test.ts
git commit -m "feat(watermark): add banner mode + placement fields to WatermarkConfig"
```

---

### Task 2: Logo anchor helper + logo-mode placement

**Files:**
- Modify: `src/lib/watermark/watermark.ts` (add helper before `drawWatermark`; logo branch 124-133)
- Test: `src/__tests__/watermarkBanner.test.ts` (extend)

**Interfaces:**
- Consumes: `WatermarkAnchorH`, `WatermarkAnchorV` (Task 1).
- Produces: `computeLogoRect(canvasW: number, canvasH: number, logoW: number, logoH: number, anchorH: WatermarkAnchorH, anchorV: WatermarkAnchorV, margin: number): { x: number; y: number }` — top-left px for the logo. Rounds to integers.

- [ ] **Step 1: Write the failing test**

Append to `src/__tests__/watermarkBanner.test.ts`:

```ts
import { computeLogoRect } from '../lib/watermark/watermark';

describe('computeLogoRect — 9-point logo placement', () => {
  const W = 1000, H = 800, lw = 200, lh = 100, m = 32;
  it('center+bottom matches the legacy formula', () => {
    expect(computeLogoRect(W, H, lw, lh, 'center', 'bottom', m))
      .toEqual({ x: Math.round((W - lw) / 2), y: H - lh - m });
  });
  it('places left+top at the margin', () => {
    expect(computeLogoRect(W, H, lw, lh, 'left', 'top', m)).toEqual({ x: m, y: m });
  });
  it('places right+middle correctly', () => {
    expect(computeLogoRect(W, H, lw, lh, 'right', 'middle', m))
      .toEqual({ x: W - lw - m, y: Math.round((H - lh) / 2) });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/watermarkBanner.test.ts`
Expected: FAIL — `computeLogoRect is not a function`.

- [ ] **Step 3: Add the helper**

In `watermark.ts`, add just above `drawWatermark` (before line 74):

```ts
/** Top-left pixel position for a logo of (logoW × logoH) at a 9-point anchor,
 *  inset by `margin` on the outer edges. Pure — unit tested. */
export function computeLogoRect(
  canvasW: number,
  canvasH: number,
  logoW: number,
  logoH: number,
  anchorH: WatermarkAnchorH,
  anchorV: WatermarkAnchorV,
  margin: number,
): { x: number; y: number } {
  let x: number;
  if (anchorH === 'left') x = margin;
  else if (anchorH === 'right') x = canvasW - logoW - margin;
  else x = (canvasW - logoW) / 2;
  let y: number;
  if (anchorV === 'top') y = margin;
  else if (anchorV === 'middle') y = (canvasH - logoH) / 2;
  else y = canvasH - logoH - margin;
  return { x: Math.round(x), y: Math.round(y) };
}
```

- [ ] **Step 4: Use it in the logo branch (preserving legacy exactly)**

In `drawWatermark`, replace the logo branch (lines 124-133) with:

```ts
  // Logo — anchored by anchorH/anchorV. The default center+bottom preserves
  // the legacy "stack above caption text" behavior; other anchors use the
  // 9-point helper.
  if (hasLogo) {
    const drawW = Math.max(1, Math.round(canvasW * wm.logoSizePercent));
    const aspect = logoImage.width / logoImage.height;
    const drawH = Math.max(1, Math.round(drawW / aspect));
    let drawX: number;
    let drawY: number;
    if (wm.anchorH === 'center' && wm.anchorV === 'bottom') {
      drawX = Math.round((canvasW - drawW) / 2);
      drawY = Math.round(cursorY - drawH);
    } else {
      const r = computeLogoRect(canvasW, canvasH, drawW, drawH, wm.anchorH, wm.anchorV, bottomMargin);
      drawX = r.x;
      drawY = r.y;
    }
    ctx.globalAlpha = wm.logoOpacity;
    ctx.drawImage(logoImage, drawX, drawY, drawW, drawH);
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/watermarkBanner.test.ts`
Expected: PASS (all).

- [ ] **Step 6: Commit**

```bash
git add src/lib/watermark/watermark.ts src/__tests__/watermarkBanner.test.ts
git commit -m "feat(watermark): 9-point placement for simple-logo mode"
```

---

### Task 3: Banner geometry helpers

**Files:**
- Modify: `src/lib/watermark/watermark.ts` (add helpers)
- Test: `src/__tests__/watermarkBanner.test.ts` (extend)

**Interfaces:**
- Consumes: `WatermarkAnchorH`, `WatermarkAnchorV` (Task 1).
- Produces: `computeBannerBandHeight(logoH: number, titleSize: number, subtitleSize: number, hasTitle: boolean, hasSubtitle: boolean, padding: number, lineGap: number): number`.
- Produces: `computeBannerBandRect(canvasW: number, canvasH: number, anchorV: WatermarkAnchorV, bandHeight: number): { x: number; y: number; width: number; height: number }` — full-width band (`x: 0, width: canvasW`).
- Produces: `computeBannerContentLayout(band: { x: number; y: number; width: number; height: number }, anchorH: WatermarkAnchorH, logoW: number, logoH: number, showText: boolean, padding: number, gap: number): { logo: { x: number; y: number }; text: { x: number; align: 'left' | 'right'; centerY: number } | null }` — `text` is `null` when `anchorH === 'center'` (logo-only band) or `showText` is false.

- [ ] **Step 1: Write the failing test**

Append to `src/__tests__/watermarkBanner.test.ts`:

```ts
import {
  computeBannerBandHeight,
  computeBannerBandRect,
  computeBannerContentLayout,
} from '../lib/watermark/watermark';

describe('computeBannerBandHeight', () => {
  it('sizes to the taller of logo vs text, plus padding', () => {
    // logo 120 tall vs text 30+20+4=54 → 120 + 2*16 = 152
    expect(computeBannerBandHeight(120, 30, 20, true, true, 16, 4)).toBe(152);
    // text taller than logo: logo 40 vs 30+20+4=54 → 54 + 32 = 86
    expect(computeBannerBandHeight(40, 30, 20, true, true, 16, 4)).toBe(86);
  });
});

describe('computeBannerBandRect — full-width band at anchorV', () => {
  const W = 1000, H = 800, bh = 150;
  it('top', () => expect(computeBannerBandRect(W, H, 'top', bh)).toEqual({ x: 0, y: 0, width: W, height: bh }));
  it('bottom', () => expect(computeBannerBandRect(W, H, 'bottom', bh)).toEqual({ x: 0, y: H - bh, width: W, height: bh }));
  it('middle', () => expect(computeBannerBandRect(W, H, 'middle', bh)).toEqual({ x: 0, y: Math.round((H - bh) / 2), width: W, height: bh }));
});

describe('computeBannerContentLayout', () => {
  const band = { x: 0, y: 650, width: 1000, height: 150 };
  it('center = logo centered, no text', () => {
    const r = computeBannerContentLayout(band, 'center', 200, 100, true, 16, 16);
    expect(r.text).toBeNull();
    expect(r.logo.x).toBe(Math.round(band.x + (band.width - 200) / 2));
  });
  it('left = logo at left, text to its right, left-aligned', () => {
    const r = computeBannerContentLayout(band, 'left', 200, 100, true, 16, 16);
    expect(r.logo.x).toBe(16);
    expect(r.text).not.toBeNull();
    expect(r.text!.align).toBe('left');
    expect(r.text!.x).toBe(16 + 200 + 16);
  });
  it('right = logo at right, text to its left, right-aligned', () => {
    const r = computeBannerContentLayout(band, 'right', 200, 100, true, 16, 16);
    expect(r.logo.x).toBe(1000 - 16 - 200);
    expect(r.text!.align).toBe('right');
    expect(r.text!.x).toBe((1000 - 16 - 200) - 16);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/watermarkBanner.test.ts`
Expected: FAIL — the three functions are not defined.

- [ ] **Step 3: Add the helpers**

In `watermark.ts`, add below `computeLogoRect`:

```ts
/** Band height = taller of (logo, stacked text) + vertical padding. */
export function computeBannerBandHeight(
  logoH: number,
  titleSize: number,
  subtitleSize: number,
  hasTitle: boolean,
  hasSubtitle: boolean,
  padding: number,
  lineGap: number,
): number {
  const textH =
    (hasTitle ? titleSize : 0) +
    (hasSubtitle ? subtitleSize : 0) +
    (hasTitle && hasSubtitle ? lineGap : 0);
  return Math.round(Math.max(logoH, textH) + padding * 2);
}

/** Full-width band rect positioned at the chosen vertical edge. */
export function computeBannerBandRect(
  canvasW: number,
  canvasH: number,
  anchorV: WatermarkAnchorV,
  bandHeight: number,
): { x: number; y: number; width: number; height: number } {
  let y: number;
  if (anchorV === 'top') y = 0;
  else if (anchorV === 'middle') y = Math.round((canvasH - bandHeight) / 2);
  else y = canvasH - bandHeight;
  return { x: 0, y, width: canvasW, height: bandHeight };
}

/** Position the logo (vertically centered in the band) and the text block.
 *  center anchor → logo centered, no text. left/right → logo on that side,
 *  text on the opposite side, aligned toward the logo. */
export function computeBannerContentLayout(
  band: { x: number; y: number; width: number; height: number },
  anchorH: WatermarkAnchorH,
  logoW: number,
  logoH: number,
  showText: boolean,
  padding: number,
  gap: number,
): { logo: { x: number; y: number }; text: { x: number; align: 'left' | 'right'; centerY: number } | null } {
  const logoY = Math.round(band.y + (band.height - logoH) / 2);
  const centerY = Math.round(band.y + band.height / 2);
  if (anchorH === 'center' || !showText) {
    const logoX = Math.round(band.x + (band.width - logoW) / 2);
    return { logo: { x: logoX, y: logoY }, text: null };
  }
  if (anchorH === 'left') {
    const logoX = band.x + padding;
    return {
      logo: { x: logoX, y: logoY },
      text: { x: logoX + logoW + gap, align: 'left', centerY },
    };
  }
  // right
  const logoX = band.x + band.width - padding - logoW;
  return {
    logo: { x: logoX, y: logoY },
    text: { x: logoX - gap, align: 'right', centerY },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/watermarkBanner.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add src/lib/watermark/watermark.ts src/__tests__/watermarkBanner.test.ts
git commit -m "feat(watermark): banner geometry helpers (band rect, height, content layout)"
```

---

### Task 4: Render the banner in `drawWatermark`

**Files:**
- Modify: `src/lib/watermark/watermark.ts` (add `drawBannerWatermark`; early branch in `drawWatermark`)
- Test: `src/__tests__/watermarkBanner.test.ts` (source-assert)

**Interfaces:**
- Consumes: `computeBannerBandHeight`, `computeBannerBandRect`, `computeBannerContentLayout` (Task 3), `WATERMARK_FONTS`.
- Produces: `drawBannerWatermark(ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number, wm: WatermarkConfig, scaleFactor: number, logoImage: HTMLImageElement | null): void`; `drawWatermark` early-returns into it when `wm.mode === 'banner'`.

- [ ] **Step 1: Write the failing (source-assert) test**

jsdom has no real 2D canvas raster, so assert the threading at source level (matching this repo's `MockupPipeline.test.ts` convention). Append to `src/__tests__/watermarkBanner.test.ts`:

```ts
import fs from 'fs';
import path from 'path';

describe('drawWatermark banner branch (source-level)', () => {
  const src = fs.readFileSync(
    path.resolve(__dirname, '../lib/watermark/watermark.ts'),
    'utf-8',
  );
  it('drawWatermark dispatches to the banner renderer on banner mode', () => {
    expect(src).toMatch(/wm\.mode === 'banner'/);
    expect(src).toMatch(/drawBannerWatermark\(/);
  });
  it('the banner renderer fills the band and draws the logo + title/subtitle', () => {
    expect(src).toMatch(/export function drawBannerWatermark/);
    expect(src).toMatch(/wm\.bandColor/);
    expect(src).toMatch(/wm\.bandOpacity/);
    expect(src).toMatch(/wm\.bannerTitle/);
    expect(src).toMatch(/wm\.bannerSubtitle/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/watermarkBanner.test.ts`
Expected: FAIL — the banner renderer and dispatch don't exist yet.

- [ ] **Step 3: Add the early branch in `drawWatermark`**

In `drawWatermark`, right after the `if (!wm.enabled) return;` line (line 85), add:

```ts
  if (!wm.enabled) return;
  if (wm.mode === 'banner') {
    drawBannerWatermark(ctx, canvasW, canvasH, wm, scaleFactor, logoImage);
    return;
  }
```

- [ ] **Step 4: Add the banner renderer**

Add `drawBannerWatermark` below `drawWatermark` (after its closing brace, ~line 136):

```ts
/** Render the banner overlay: a full-width band at the chosen edge, with the
 *  logo on its anchorH side and an optional bold title + lighter subtitle. */
export function drawBannerWatermark(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  wm: WatermarkConfig,
  scaleFactor: number,
  logoImage: HTMLImageElement | null,
): void {
  const hasTitle = wm.bannerTitle.trim().length > 0;
  const hasSubtitle = wm.bannerSubtitle.trim().length > 0;
  const hasLogo = !!logoImage;
  // Centre anchor is a logo-only band (no text).
  const showText = wm.anchorH !== 'center' && (hasTitle || hasSubtitle);
  if (!hasLogo && !showText) return;

  const fontDef = WATERMARK_FONTS.find(f => f.value === wm.font) ?? WATERMARK_FONTS[0];
  const titleSize = Math.round(wm.fontSize * scaleFactor);
  const subtitleSize = Math.round(wm.fontSize * 0.7 * scaleFactor);
  const padding = Math.round(16 * scaleFactor);
  const gap = Math.round(16 * scaleFactor);
  const lineGap = Math.round(4 * scaleFactor);

  let logoW = 0;
  let logoH = 0;
  if (hasLogo && logoImage) {
    logoW = Math.max(1, Math.round(canvasW * wm.logoSizePercent));
    const aspect = logoImage.width / logoImage.height;
    logoH = Math.max(1, Math.round(logoW / aspect));
  }

  const bandHeight = computeBannerBandHeight(
    logoH, titleSize, subtitleSize,
    showText && hasTitle, showText && hasSubtitle,
    padding, lineGap,
  );
  const band = computeBannerBandRect(canvasW, canvasH, wm.anchorV, bandHeight);

  ctx.save();

  // Band fill (semi-transparent so the pattern shows through).
  ctx.globalAlpha = wm.bandOpacity;
  ctx.fillStyle = wm.bandColor;
  ctx.fillRect(band.x, band.y, band.width, band.height);
  ctx.globalAlpha = 1;

  const layout = computeBannerContentLayout(band, wm.anchorH, logoW, logoH, showText, padding, gap);

  if (hasLogo && logoImage) {
    ctx.globalAlpha = wm.logoOpacity;
    ctx.drawImage(logoImage, layout.logo.x, layout.logo.y, logoW, logoH);
    ctx.globalAlpha = 1;
  }

  if (showText && layout.text) {
    ctx.fillStyle = wm.color;
    ctx.textAlign = layout.text.align;
    ctx.textBaseline = 'middle';
    const cy = layout.text.centerY;
    if (hasTitle && hasSubtitle) {
      ctx.font = `600 ${titleSize}px ${fontDef.css}`;
      ctx.fillText(wm.bannerTitle, layout.text.x, cy - Math.round(subtitleSize / 2 + lineGap / 2));
      ctx.font = `400 ${subtitleSize}px ${fontDef.css}`;
      ctx.fillText(wm.bannerSubtitle, layout.text.x, cy + Math.round(titleSize / 2 + lineGap / 2));
    } else if (hasTitle) {
      ctx.font = `600 ${titleSize}px ${fontDef.css}`;
      ctx.fillText(wm.bannerTitle, layout.text.x, cy);
    } else {
      ctx.font = `400 ${subtitleSize}px ${fontDef.css}`;
      ctx.fillText(wm.bannerSubtitle, layout.text.x, cy);
    }
  }

  ctx.restore();
}
```

- [ ] **Step 5: Run test + typecheck**

Run: `npx vitest run src/__tests__/watermarkBanner.test.ts && npm run build`
Expected: tests PASS; build succeeds (banner draw type-checks).

- [ ] **Step 6: Commit**

```bash
git add src/lib/watermark/watermark.ts src/__tests__/watermarkBanner.test.ts
git commit -m "feat(watermark): render banner (band + logo + title/subtitle) in drawWatermark"
```

---

### Task 5: WatermarkPanel — mode toggle, banner controls, placement picker

**Files:**
- Modify: `src/components/watermark/WatermarkPanel.tsx` (whole expanded body 34-107)

**Interfaces:**
- Consumes: `WatermarkConfig` banner fields (Task 1), `WATERMARK_FONTS`.

**Design notes:** Add a small reusable 3×3 placement grid (nine buttons) that sets `anchorH`/`anchorV` together. In banner mode it doubles as "band edge + logo side"; label it accordingly. Keep the existing logo upload/size/opacity controls shared across both modes.

- [ ] **Step 1: Add the mode toggle + shared placement + banner fields**

Replace the expanded body (lines 34-107, the `{expanded && (...)}` block) with:

```tsx
      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t-2 border-[#e0c26e] pt-3">
          {/* Mode toggle */}
          <div className="flex gap-1 p-0.5 bg-[#f1efeb] rounded-md">
            {(['logo', 'banner'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setWatermark(w => ({ ...w, mode: m }))}
                className={`flex-1 px-2 py-1 text-[11px] font-medium rounded ${
                  watermark.mode === m ? 'bg-white text-[#294051] shadow-sm' : 'text-[#6b7280]'
                }`}
              >
                {m === 'logo' ? 'Simple logo' : 'Banner'}
              </button>
            ))}
          </div>

          {/* Logo upload (shared) */}
          <div>
            <span className="text-[10px] text-[#6b7280] uppercase tracking-wide">Logo (PNG or JPG)</span>
            <div className="mt-1 flex items-center gap-2">
              {watermark.logoDataUrl ? (
                <>
                  <div
                    className="w-12 h-12 rounded border border-[#e5e7eb] flex items-center justify-center bg-[#f9fafb]"
                    style={{
                      backgroundImage: `repeating-conic-gradient(#e5e7eb 0% 25%, #f9fafb 0% 50%)`,
                      backgroundSize: '8px 8px',
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={watermark.logoDataUrl} alt="Logo preview" className="max-w-full max-h-full object-contain" />
                  </div>
                  <button
                    onClick={() => setWatermark(w => ({ ...w, logoDataUrl: undefined }))}
                    className="text-[10px] text-[#705046] hover:text-[#294051] underline"
                  >
                    Remove
                  </button>
                </>
              ) : (
                <label className="flex-1 px-3 py-2.5 text-xs font-semibold text-center border-2 border-dashed border-[#705046] rounded-md text-[#705046] bg-[#faf3e0] hover:bg-[#f5e8c8] cursor-pointer transition-colors">
                  Upload logo
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        const result = reader.result;
                        if (typeof result === 'string') {
                          setWatermark(w => ({ ...w, logoDataUrl: result }));
                        }
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
              )}
            </div>
            {watermark.logoDataUrl && (
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 items-center mt-2">
                <span className="text-[10px] text-[#6b7280] uppercase tracking-wide">Logo size</span>
                <div className="flex items-center gap-2">
                  <input
                    type="range" min={5} max={60} step={1}
                    value={Math.round(watermark.logoSizePercent * 100)}
                    onChange={e => setWatermark(w => ({ ...w, logoSizePercent: Number(e.target.value) / 100 }))}
                    className="flex-1 accent-[#e0c26e]"
                  />
                  <span className="text-[10px] text-[#9ca3af] w-10 text-right">{Math.round(watermark.logoSizePercent * 100)}%</span>
                </div>
                <span className="text-[10px] text-[#6b7280] uppercase tracking-wide">Logo opacity</span>
                <div className="flex items-center gap-2">
                  <input
                    type="range" min={10} max={100} step={5}
                    value={Math.round(watermark.logoOpacity * 100)}
                    onChange={e => setWatermark(w => ({ ...w, logoOpacity: Number(e.target.value) / 100 }))}
                    className="flex-1 accent-[#e0c26e]"
                  />
                  <span className="text-[10px] text-[#9ca3af] w-10 text-right">{Math.round(watermark.logoOpacity * 100)}%</span>
                </div>
              </div>
            )}
          </div>

          {/* Shared placement picker (3×3) */}
          <div>
            <span className="text-[10px] text-[#6b7280] uppercase tracking-wide">
              {watermark.mode === 'banner' ? 'Band + logo position' : 'Logo position'}
            </span>
            <div className="mt-1 grid grid-cols-3 gap-1 w-[84px]">
              {(['top', 'middle', 'bottom'] as const).map(v =>
                (['left', 'center', 'right'] as const).map(h => {
                  const active = watermark.anchorV === v && watermark.anchorH === h;
                  return (
                    <button
                      key={`${v}-${h}`}
                      type="button"
                      aria-label={`${v} ${h}`}
                      onClick={() => setWatermark(w => ({ ...w, anchorH: h, anchorV: v }))}
                      className={`w-6 h-6 rounded border ${active ? 'bg-[#e0c26e] border-[#e0c26e]' : 'bg-white border-[#e5e7eb] hover:bg-[#f5f5f5]'}`}
                    >
                      <span className={`block w-1.5 h-1.5 mx-auto rounded-full ${active ? 'bg-[#294051]' : 'bg-[#d1d5db]'}`} />
                    </button>
                  );
                })
              )}
            </div>
            {watermark.mode === 'banner' && (
              <p className="text-[10px] text-[#9ca3af] mt-1">Row = band edge (top/middle/bottom); column = logo side (centre = logo only).</p>
            )}
          </div>

          {/* Banner-only controls */}
          {watermark.mode === 'banner' && (
            <div className="space-y-2">
              <div>
                <span className="text-[10px] text-[#6b7280] uppercase tracking-wide">Title</span>
                <input
                  type="text"
                  value={watermark.bannerTitle}
                  onChange={e => setWatermark(w => ({ ...w, bannerTitle: e.target.value }))}
                  placeholder="e.g. Fruity Floral Patchwork"
                  className="mt-1 w-full px-2 py-1.5 text-xs border border-[#e5e7eb] rounded-md"
                />
              </div>
              <div>
                <span className="text-[10px] text-[#6b7280] uppercase tracking-wide">Subtitle</span>
                <input
                  type="text"
                  value={watermark.bannerSubtitle}
                  onChange={e => setWatermark(w => ({ ...w, bannerSubtitle: e.target.value }))}
                  placeholder="e.g. Part of the FLF Collection"
                  className="mt-1 w-full px-2 py-1.5 text-xs border border-[#e5e7eb] rounded-md"
                />
              </div>
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 items-center">
                <span className="text-[10px] text-[#6b7280] uppercase tracking-wide">Band color</span>
                <input
                  type="color"
                  value={watermark.bandColor}
                  onChange={e => setWatermark(w => ({ ...w, bandColor: e.target.value }))}
                  className="w-8 h-6 rounded border border-[#e5e7eb] cursor-pointer"
                />
                <span className="text-[10px] text-[#6b7280] uppercase tracking-wide">Band opacity</span>
                <div className="flex items-center gap-2">
                  <input
                    type="range" min={10} max={100} step={5}
                    value={Math.round(watermark.bandOpacity * 100)}
                    onChange={e => setWatermark(w => ({ ...w, bandOpacity: Number(e.target.value) / 100 }))}
                    className="flex-1 accent-[#e0c26e]"
                  />
                  <span className="text-[10px] text-[#9ca3af] w-10 text-right">{Math.round(watermark.bandOpacity * 100)}%</span>
                </div>
                <span className="text-[10px] text-[#6b7280] uppercase tracking-wide">Text color</span>
                <input
                  type="color"
                  value={watermark.color}
                  onChange={e => setWatermark(w => ({ ...w, color: e.target.value }))}
                  className="w-8 h-6 rounded border border-[#e5e7eb] cursor-pointer"
                />
                <span className="text-[10px] text-[#6b7280] uppercase tracking-wide">Font</span>
                <select
                  value={watermark.font}
                  onChange={e => setWatermark(w => ({ ...w, font: e.target.value as WatermarkConfig['font'] }))}
                  className="px-2 py-1 text-xs border border-[#e5e7eb] rounded-md bg-white"
                >
                  {WATERMARK_FONTS.map(f => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      )}
```

- [ ] **Step 2: Update the imports + `hasContent`**

At the top of `WatermarkPanel.tsx`, extend the import (line 4) and the `hasContent` check (line 13):

```tsx
import { WatermarkConfig, WATERMARK_FONTS } from '@/lib/watermark/watermark';
```

```tsx
  const hasContent = !!watermark.logoDataUrl || watermark.bannerTitle.trim().length > 0 || watermark.bannerSubtitle.trim().length > 0;
```

- [ ] **Step 3: Verify build + lint**

Run: `npm run lint && npm run build`
Expected: no new errors in `WatermarkPanel.tsx`.

- [ ] **Step 4: Manual UAT**

`npm run dev`, open a pattern → Pattern Fill Export → **Social** → open the Logo Overlay panel (Pro).
Verify: mode toggle switches Simple logo / Banner; placement grid highlights the active cell; banner mode shows title/subtitle/band color/opacity/text color/font; typing a title updates the config.

- [ ] **Step 5: Commit**

```bash
git add src/components/watermark/WatermarkPanel.tsx
git commit -m "feat(watermark): banner mode UI — toggle, placement grid, title/subtitle, band controls"
```

---

### Task 6: Live preview overlay — reflect banner + anchors

**Files:**
- Modify: `src/components/watermark/WatermarkPreviewOverlay.tsx` (whole component)

**Interfaces:**
- Consumes: `WatermarkConfig` banner fields (Task 1).

**Design notes:** This HTML overlay is a *hint* (the authoritative pixels come from `drawWatermark` at export). It needs to communicate placement + banner content, not be pixel-perfect. Map `anchorV` → vertical flex alignment, `anchorH` → the logo/text side.

- [ ] **Step 1: Replace the component**

Replace `WatermarkPreviewOverlay.tsx` (lines 14-36) with:

```tsx
export default function WatermarkPreviewOverlay({ watermark }: Props) {
  if (!watermark.enabled) return null;

  const vAlign =
    watermark.anchorV === 'top' ? 'justify-start'
    : watermark.anchorV === 'middle' ? 'justify-center'
    : 'justify-end';

  if (watermark.mode === 'banner') {
    const hasTitle = watermark.bannerTitle.trim().length > 0;
    const hasSubtitle = watermark.bannerSubtitle.trim().length > 0;
    const showText = watermark.anchorH !== 'center' && (hasTitle || hasSubtitle);
    if (!watermark.logoDataUrl && !showText) return null;
    const rowJustify =
      watermark.anchorH === 'left' ? 'justify-start'
      : watermark.anchorH === 'right' ? 'justify-end'
      : 'justify-center';
    const rowReverse = watermark.anchorH === 'right' ? 'flex-row-reverse' : 'flex-row';
    return (
      <div className={`pointer-events-none absolute inset-0 flex flex-col ${vAlign} z-10`}>
        <div
          className="w-full flex items-center gap-[2cqw]"
          style={{ backgroundColor: watermark.bandColor, opacity: watermark.bandOpacity, padding: '2cqw' }}
        >
          <div className={`w-full flex items-center gap-[2cqw] ${rowJustify} ${rowReverse}`} style={{ opacity: 1 }}>
            {watermark.logoDataUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={watermark.logoDataUrl}
                alt=""
                style={{ width: `${watermark.logoSizePercent * 100}%`, opacity: watermark.logoOpacity, objectFit: 'contain', maxHeight: '12cqw' }}
              />
            )}
            {showText && (
              <div className="flex flex-col" style={{ color: watermark.color, textAlign: watermark.anchorH === 'right' ? 'right' : 'left' }}>
                {hasTitle && <span style={{ fontWeight: 600, fontSize: '3.5cqw', lineHeight: 1.1 }}>{watermark.bannerTitle}</span>}
                {hasSubtitle && <span style={{ fontWeight: 400, fontSize: '2.5cqw', lineHeight: 1.1 }}>{watermark.bannerSubtitle}</span>}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Simple logo mode
  if (!watermark.logoDataUrl) return null;
  const hAlign =
    watermark.anchorH === 'left' ? 'items-start'
    : watermark.anchorH === 'right' ? 'items-end'
    : 'items-center';
  return (
    <div
      className={`pointer-events-none absolute inset-0 flex flex-col ${vAlign} ${hAlign} z-10`}
      style={{ padding: '3cqw' }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={watermark.logoDataUrl}
        alt=""
        style={{ width: `${watermark.logoSizePercent * 100}%`, opacity: watermark.logoOpacity, objectFit: 'contain', maxHeight: '40%' }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify build + lint**

Run: `npm run lint && npm run build`
Expected: clean.

- [ ] **Step 3: Manual UAT (both surfaces)**

`npm run dev`:
1. Social export → Banner mode → the preview shows the band at the chosen edge with logo side + title/subtitle; toggling anchors moves it; the exported file matches.
2. Mockup modal (tweak) → Logo Overlay panel → the crop-stage preview reflects banner mode too.
3. Simple logo mode → logo honors the 9-point placement in both previews and exports; default center+bottom looks exactly as before.

- [ ] **Step 4: Commit**

```bash
git add src/components/watermark/WatermarkPreviewOverlay.tsx
git commit -m "feat(watermark): preview overlay reflects banner mode + 9-point placement"
```

---

### Task 7: Final verification + tracker

**Files:** `docs/user-feature-requests.md` (move request #5 to Shipped)

- [ ] **Step 1: Full suite + lint + build**

Run: `npm test && npm run lint && npm run build`
Expected: all tests pass (including the new `watermarkBanner.test.ts`), no new lint errors in touched files, build succeeds.

- [ ] **Step 2: Backward-compat regression check**

`npm run dev`. With a logo uploaded and the panel left at defaults (Simple logo, center+bottom): export a social image and confirm the logo sits bottom-center exactly as before this branch. Confirm mockup exports likewise unchanged at defaults.

- [ ] **Step 3: Surface-scope check**

Confirm EasyScale and Cricut exports still carry **no** watermark/badge (open each, export, verify clean) — no banner leaked into the print-deliverable paths.

- [ ] **Step 4: Cross-surface banner UAT (desktop + iPad)**

For social AND mockup exports: banner at top/middle/bottom; logo left/right/center (center = logo-only band); blank title/subtitle → logo-only band; band color + opacity + text color + font all reflected in the exported file; Pro gating (non-Pro can't reach the panel).

- [ ] **Step 5: Update the tracker**

Move request #5 in `docs/user-feature-requests.md` from Open Requests to Shipped with the commit range. Then:

```bash
git add docs/user-feature-requests.md
git commit -m "docs: mark branded banner overlay (request #5) shipped"
```

---

## Self-review notes

- **Spec coverage:** mode toggle → Task 5; banner layout (logo one side, text beside) → Tasks 3-4; title+subtitle optional → Tasks 3-4; shared 9-point anchor for both modes → Tasks 2 (logo), 3-4 (banner), 5 (UI); brand-control styling (band color/opacity, text color, font) → Task 5; band height auto-size → Task 3 (`computeBannerBandHeight`); surfaces social+mockup via shared `drawWatermark` → Tasks 4/6; preview parity → Task 6; Pro-only + Cricut/EasyScale untouched → Global Constraints + Task 7 step 3; backward-compat → Global Constraints + Task 7 step 2. Out-of-scope items (size sliders, presets, persistence) correctly absent.
- **Type consistency:** `computeLogoRect`, `computeBannerBandHeight`, `computeBannerBandRect`, `computeBannerContentLayout`, `drawBannerWatermark` signatures are identical wherever referenced. `WatermarkConfig` fields (`mode`, `anchorH`, `anchorV`, `bannerTitle`, `bannerSubtitle`, `bandColor`, `bandOpacity`) used identically across Tasks 1/4/5/6. Anchor enums (`WatermarkAnchorH`/`WatermarkAnchorV`) consistent.
- **No placeholders:** every code step shows the real code. Canvas raster (which jsdom can't assert) is covered by source-assert tests (Task 4) + explicit manual UAT (repo convention).
