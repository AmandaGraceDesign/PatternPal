---
task: Logo Overlay (watermark) on mockup downloads + accordion UX
status: SHIPPED — committed on merge-test
created: 2026-05-22
prior_handoff: handoff-2026-05-21-watermark-on-mockups.md
current_branch: merge-test
---

## What shipped

The social-export watermark (text + transparent PNG logo) now also
applies to v2 mockup downloads from both entry points (ActionsSidebar
sidebar, AdvancedToolsBar). Both surfaces share the same UI component
and the same bake logic. The panel was renamed to **"Logo Overlay"**
and made a click-to-expand accordion so it doesn't dominate the mockup
modal's vertical space.

## Files

NEW
- [src/lib/watermark/watermark.ts](../src/lib/watermark/watermark.ts) —
  extracted types + pure helpers (`drawWatermark`, `applyWatermarkToBlob`,
  `cachedLoadLogo`, `loadWatermarkFonts`, `WATERMARK_FONTS`,
  `DEFAULT_WATERMARK`). `DEFAULT_WATERMARK.enabled` is now `true` because
  the accordion replaced the standalone enable checkbox — the actual gate
  on rendering/baking is "user has set text or logoDataUrl."
- [src/components/watermark/WatermarkPanel.tsx](../src/components/watermark/WatermarkPanel.tsx) —
  shared accordion component. Default collapsed. Header is a button with
  "Logo Overlay" + chevron + a gold dot indicator when content is set.
  On first expand, calls `loadWatermarkFonts()` to inject the Google
  Font stylesheet.
- [src/components/watermark/WatermarkPreviewOverlay.tsx](../src/components/watermark/WatermarkPreviewOverlay.tsx) —
  HTML overlay that floats over the mockup preview wrapper (absolute,
  bottom-center). Uses `cqw` container queries to scale text size by
  preview width (analog to canvas `fontSize / 1080` scaling). Pure visual
  hint — the download path bakes the real watermark onto the canvas.

EDITED
- [src/components/export/RepeatExportModal.tsx](../src/components/export/RepeatExportModal.tsx) —
  removed ~200 lines of inlined watermark types/helpers/UI. Now imports
  `WatermarkPanel` and the helpers from `@/lib/watermark/watermark`. Social
  export behavior unchanged.
- [src/components/sidebar/ActionsSidebar.tsx](../src/components/sidebar/ActionsSidebar.tsx) —
  added `watermark` state, `<WatermarkPanel>` between control row and preview,
  `<WatermarkPreviewOverlay>` inside the preview wrapper, and watermark-aware
  download path (`applyWatermarkToBlob` + `downloadBlobAsImage`).
- [src/components/layout/AdvancedToolsBar.tsx](../src/components/layout/AdvancedToolsBar.tsx) —
  same wiring as ActionsSidebar.
- [src/lib/utils/downloadCanvas.ts](../src/lib/utils/downloadCanvas.ts) —
  added `downloadBlobAsImage()` sibling so iOS Share Sheet behavior is
  preserved when the download payload has been post-processed (watermark
  stamped) into a Blob.

## Behavior

- Mockup preview shows a live HTML overlay (logo + text) at bottom-center.
  This is an approximation — uses the preview wrapper as the reference
  width. The download uses `applyWatermarkToBlob` on the actual canvas
  (3000×4500 typically), scaled by `canvasW / 1080`. They look close but
  may differ a few pixels.
- Download gate: `wm.enabled && (text || logo)`. Since `enabled` now
  defaults true and the panel never unsets it, this is effectively
  `text || logo`.
- Accordion starts collapsed. Header click toggles. Font load fires on
  first expand so font assets aren't fetched until needed.

## Verification

- `npx tsc --noEmit` exits 0
- Dev server (`npm run dev`, `next dev --webpack`) compiles clean
- NOT browser-tested by Claude. User verified the panel appears in both
  surfaces and that the live overlay shows the logo. Downloads not
  explicitly verified post-accordion change — but the bake path is unchanged
  from the social-export version that was already shipping.

## Gotchas

- The mockup canvas is grabbed via `document.querySelector('[data-mockup-modal] .mockup-canvas')`
  (ActionsSidebar) and `'[data-mockup-modal] .mockup-canvas, [data-mockup-modal] canvas'`
  (AdvancedToolsBar). If a future refactor renames that selector, the watermark
  bake will silently fall back to the un-stamped path.
- `applyWatermarkToBlob` scales by `w / 1080`. So a `logoSizePercent` of 0.2
  means 20% of the canvas width — same scaling logic as social export.
- The preview overlay positions at the bottom of the `w-full max-w-2xl`
  wrapper. If the mockup canvas leaves whitespace at the bottom of that
  wrapper (some templates do), the overlay sits in that whitespace, slightly
  below the visible mockup. The bake is unaffected.
- Mobile/iPad: file upload uses `accept="image/png"` and `FileReader` —
  same iOS-tested path as social export, so should work. Not retested here.

## Not done

- Browser-test the mockup download end-to-end with an actual logo PNG.
- Verify on iPad: accordion tap, file upload, share sheet on download.
- Consider snapshotting the preview overlay positioning against the canvas
  bake so they're pixel-aligned (would need a ResizeObserver on the canvas).

## Commit

See `feat(mockups-v2): add Logo Overlay (watermark) accordion + apply to mockup downloads`
on `merge-test`.
