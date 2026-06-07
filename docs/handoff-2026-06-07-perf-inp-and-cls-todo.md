# Handoff — 2026-06-07 — Web Vitals: INP fixed, CLS still to do

## Context
Vercel Speed Insights on **Desktop / Production** showed RES **62 (Needs
Improvement)**. Five of six metrics green (FCP 1.2s, LCP 1.39s, FID 14ms,
TTFB 0.59s). Two bad metrics, both on the **home page `/`** (RES 52, ~2.9K
visits; `/seam-inspector`=100, `/settings`=83):
- **INP = 992ms** 🔴 (good <200ms)
- **CLS = 0.23** 🟠 (good <0.1)

## ✅ Shipped: INP fix (committed `04b14a1`, pushed)
**Cause:** every zoom/scale/pan change ran a full **synchronous** `tiler.render()`
inside the canvas effect. The zoom slider
([PatternControlsTopBar.tsx:336](../src/components/layout/PatternControlsTopBar.tsx#L336))
fires `onZoomChange` on every pixel of drag → dozens of back-to-back re-tiles
blocking the main thread before paint.

**Fix:** wrapped the real-image render path in
[PatternPreviewCanvas.tsx:277](../src/components/canvas/PatternPreviewCanvas.tsx#L277)
in a single `requestAnimationFrame` (cancel-and-reschedule via existing `rafId` +
`cancelled` cleanup). Bursts now collapse to one render per frame; the handler
returns immediately. Output identical (still double-buffered offscreen blit).

**Verified:** `tsc` clean; user confirmed zoom "feels better." Real INP number
will drop in Speed Insights over days (field data, not instant).

## ⏸️ NOT done: CLS 0.23 — START BY MEASURING
Do **not** blindly trust the earlier exploration here. The Explore agent's top
theory (ProTrialBanner / AffiliateSlideOut) is **probably wrong** — both are
`position: fixed` + `translate-y`, and fixed/transform-animated elements don't
cause layout shift by definition.

**Step 1 (do this first):** get per-element attribution. Either read Vercel
Speed Insights' CLS-by-element breakdown, or temporarily add the `web-vitals`
attribution build to log which DOM node shifts. Don't change code until the
shifting element is identified.

**Leading hypothesis to check:** the main canvas area collapses then expands on
mount — the render effect bails while `canvasSize.width === 0`
([PatternPreviewCanvas.tsx:195](../src/components/canvas/PatternPreviewCanvas.tsx#L195)),
so the container may have no reserved height until JS measures it → big shift.
If confirmed, reserve the canvas/container dimensions so it doesn't reflow.

**Cheap safe wins regardless** (low confidence they're the 0.23, but real
violations): give explicit width/height to the `<img>`s in
[WatermarkPreviewOverlay.tsx](../src/components/watermark/WatermarkPreviewOverlay.tsx)
and [BadgePreviewOverlay.tsx](../src/components/badge/BadgePreviewOverlay.tsx).

## Other still-open (from prior handoffs)
- Error boundary (`app/error.tsx`) that auto-reloads on `ChunkLoadError` — iPad
  white-screen safety net. **Recommended next feature.**
- Sentry + hidden source maps (deferred).
- CMYK warning: still no real end-to-end test with an Illustrator CMYK JPEG.

## Suggested next session
Fresh session (this one ran low on context). Either: (a) measure + fix CLS, or
(b) build the error boundary.
