---
task: Extend the social-export watermark (text + transparent PNG logo) to v2 mockup downloads
status: HANDOFF — not started. Prior watermark work is shipped and committed.
created: 2026-05-21
prior_handoff: handoff-2026-05-20-perf-scale-opacity.md
current_branch: merge-test (HEAD = `abff335`)
---

## Background

The Pattern Fill / Social export modal already has a watermark UX:
text + uploaded transparent PNG logo, stacked at bottom-center, each with
its own opacity. The user wants the same logo+text watermark capability
when downloading any v2 mockup from the mockup preview.

Prior session shipped (commits already pushed to merge-test):
- `5080bf0 feat(mockups-v2)` — womens-blouse + mens-dress-shirt templates,
  rAF-throttle on the color picker, `colorOverlayDefaultEnabled` flag.
- `abff335 feat(social-export)` — watermark logo upload, rename of
  swim-trunks-1 display name to "Boys' Swim Trunks".

Branch `merge-test` is NOT pushed.

## The task

Add the same watermark UX (text + logo) to the mockup view, and stamp it
onto the downloaded mockup PNG. UI should match the social export
watermark panel — same fields, same defaults — so users get a consistent
experience.

## Plan

### Step 1 — Extract watermark module

Pull the watermark logic out of
[src/components/export/RepeatExportModal.tsx](../src/components/export/RepeatExportModal.tsx)
into a new file:

`src/lib/watermark/watermark.ts`

Move (~150 LOC):
- `type WatermarkFont`
- `interface WatermarkConfig`
- `const WATERMARK_FONTS`
- `loadWatermarkFonts()`  (must remain — Google Font CSS injector)
- `const DEFAULT_WATERMARK`
- `loadImageFromUrl()`
- `watermarkLogoCache` + `cachedLoadLogo()`
- `drawWatermark()`
- `applyWatermarkToBlob()`

In RepeatExportModal.tsx, replace the local definitions with imports
from `@/lib/watermark/watermark`.

**Why:** otherwise three different files end up with the same 150 lines.
The extraction is mechanical — types and pure helpers, no React.

Verify by running `npx tsc --noEmit` and clicking through the social
export to confirm nothing regressed.

### Step 2 — Build a shared `<WatermarkPanel>` component

Create
`src/components/watermark/WatermarkPanel.tsx`.

It owns the same UI block currently inlined in RepeatExportModal.tsx
(starts around the line that renders the "Add Watermark" checkbox plus
the logo uploader, text input, font/color/opacity/size sliders, bg
toggle, and live preview strip — roughly lines 1440–1580).

Props:
```tsx
interface Props {
  watermark: WatermarkConfig;
  setWatermark: Dispatch<SetStateAction<WatermarkConfig>>;
}
```

Then both RepeatExportModal.tsx and the mockup view import and render
`<WatermarkPanel watermark={...} setWatermark={...} />`.

**Why:** matches the user's "same logic" instruction. Single source of
truth for the UI.

### Step 3 — Wire into mockup view

Two consumers — desktop sidebar and the advanced bar:

- [src/components/sidebar/ActionsSidebar.tsx](../src/components/sidebar/ActionsSidebar.tsx)
- [src/components/layout/AdvancedToolsBar.tsx](../src/components/layout/AdvancedToolsBar.tsx)

In each, add:
```tsx
const [watermark, setWatermark] = useState<WatermarkConfig>({ ...DEFAULT_WATERMARK });
```
Render `<WatermarkPanel watermark={watermark} setWatermark={setWatermark} />`
inside the mockup preview block (a collapsible panel under the
shadow/highlight controls is the natural home — see how the existing
shadow/highlight row sits next to the mockup canvas).

### Step 4 — Stamp on download

ActionsSidebar mockup download is at
[ActionsSidebar.tsx:363-377](../src/components/sidebar/ActionsSidebar.tsx#L363-L377).
AdvancedToolsBar download is at
[AdvancedToolsBar.tsx:427-440](../src/components/layout/AdvancedToolsBar.tsx#L427-L440).

Both already do `document.querySelector` to grab the mockup canvas, then
`downloadCanvasAsImage(mockupCanvas, filename)`. Change to:

```ts
let blob: Blob = await canvasToBlob(mockupCanvas); // or use the existing toBlob path
if (watermark.enabled && (watermark.text.trim() || watermark.logoDataUrl)) {
  blob = await applyWatermarkToBlob(
    blob,
    mockupCanvas.width,
    mockupCanvas.height,
    watermark,
    'png',
  );
}
// download `blob` with `filename`
```

`downloadCanvasAsImage` may need a sibling that accepts a Blob — or
inline the toBlob + anchor-click. Check
[src/lib/utils/downloadCanvas.ts](../src/lib/utils/downloadCanvas.ts).

### Step 5 — Verify

- `npx tsc --noEmit` clean.
- Social export watermark still works (regression check).
- Mockup view shows watermark panel; uploading a PNG renders it in the
  preview; downloading bakes it in.
- Text alone, logo alone, both together — all download correctly.
- iPad — file upload on iOS Safari needs `accept="image/png"` (already
  set) plus testing that the FileReader path resolves. Mobile/iPad
  parity is mandatory per the user's memory.

## Gotchas

- The mockup canvas is queried via `document.querySelector('canvas[...]')`
  — fragile. Confirm the existing selector still hits the right canvas
  after the WatermarkPanel is rendered above it.
- The mockup canvas is at the rendered pipeline size (3000×4500 typically).
  `applyWatermarkToBlob` scales the watermark via `w / 1080`, which is
  the same scaling used for social export — so a logoSizePercent of 0.2
  means 20% of the mockup width. That's reasonable. If users complain
  the logo is huge, tune the default or expose a `referenceWidth` arg.
- `cachedLoadLogo` lives at module scope — works across both consumers
  for free.
- Don't break the existing watermark in social export. Imports change;
  behavior must not.

## Files to touch

- NEW `src/lib/watermark/watermark.ts`
- NEW `src/components/watermark/WatermarkPanel.tsx`
- EDIT `src/components/export/RepeatExportModal.tsx` (replace local defs
  with imports, replace inline UI with `<WatermarkPanel/>`)
- EDIT `src/components/sidebar/ActionsSidebar.tsx`
- EDIT `src/components/layout/AdvancedToolsBar.tsx`
- POSSIBLY EDIT `src/lib/utils/downloadCanvas.ts` (Blob-accepting variant)

## Commit message template

```
feat(mockups-v2): add watermark (text + logo) to mockup downloads

- Extract watermark types/helpers from RepeatExportModal into shared
  src/lib/watermark/watermark.ts (no behavior change in social export).
- New <WatermarkPanel> component reused by social export + mockup view.
- ActionsSidebar + AdvancedToolsBar render the panel inside the mockup
  preview; download path stamps the configured watermark onto the
  mockup canvas via applyWatermarkToBlob before saving.
```
