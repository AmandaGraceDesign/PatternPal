---
task: iPad/mobile mockup perf — gallery + social-export + tweak modal + drag
status: 2 commits shipped on `merge-test`. Drag display-size stability needs user verification on iPad next session.
created: 2026-05-24 (evening)
current_branch: merge-test
---

## What shipped tonight (2 commits)

### `4c57fe9` perf(mockups): medium-res preview layers for gallery + social-export

Gallery cold-load was crashing iPad Safari (~125 full-res PNG layers × ~54 MB RGBA each) and slow on desktop. Social-export preview render took ~20s after every mockup pick for the same reason.

Pre-generated 800px JPEG-q-equivalent PNG variants of every v2 layer into [public/mockups/v2/medium/](../public/mockups/v2/medium/). 152 files, ~32 MB total (vs. 892 MB full set). Regenerate with [scripts/gen-medium-layers.sh](../scripts/gen-medium-layers.sh) when adding/replacing v2 assets.

- New `preview` prop on [MockupRendererV2.tsx](../src/components/mockups/MockupRendererV2.tsx) — swaps `/mockups/v2/foo.png` → `/mockups/v2/medium/foo.png`. Gallery callsite [MockupGalleryModal.tsx:216](../src/components/mockups/MockupGalleryModal.tsx#L216) passes `preview`. Tweak view does NOT (keeps full fidelity).
- Same `{ preview, maxRenderDimension }` options added to [renderMockupV2Offscreen.ts](../src/lib/utils/renderMockupV2Offscreen.ts). Social-export live preview at [RepeatExportModal.tsx:344-347](../src/components/export/RepeatExportModal.tsx#L344-L347) passes `{ preview: true, maxRenderDimension: 600 }`. The **final exported file** path at line 232 (`applyMockupOverlay`) is unchanged — full-res for export quality.
- LRU cap in MockupRendererV2 bumped 40 → 100 (medium files are ~200 KB so 100 entries ≈ 20 MB).
- Social-export picker buttons: added `touch-action: manipulation` (kills iOS 300ms tap delay) and `pointer-events-none` on the inner `<img>` so taps hit the `<button>` not the img. Mandy confirmed touch now responsive.

### `7d92072` perf(mockups): fit tweak modal to viewport + responsive drag-to-position

**Modal sizing** — Canvas was overflowing iPad landscape (~680px content area vs. 900px canvas at 600px × 2:3 aspect). New `fitContainer` prop on MockupRendererV2 sets canvas CSS:
```ts
width: '100%'
aspectRatio: `${template.canvasSize.width} / ${template.canvasSize.height}`
maxHeight: '60vh'
height: 'auto'
```
This decouples display size from intrinsic pixel size — pipeline can render at any resolution, display box stays the same. Wrapper at [ActionsSidebar.tsx:549](../src/components/sidebar/ActionsSidebar.tsx#L549) and [AdvancedToolsBar.tsx:646](../src/components/layout/AdvancedToolsBar.tsx#L646) kept `w-[600px] max-w-full` (so modal doesn't collapse before canvas mounts) plus added `flex justify-center` (centers canvas when 60vh clamps width below 600).

**Drag perf** — Drag-to-position on iPad was 3-5s per pointermove (full 3000×4500 pipeline every frame). MockupRendererV2's render effect now derives `effPreview` and `effMaxDim` from the existing `isDragging` state: while dragging it forces `preview=true` (medium sources) AND `maxRenderDimension=400`, ~50× cheaper per frame. `isDragging` added to effect deps so pointerup re-fires the effect at full quality. **Export pipeline untouched** — uses `renderMockupV2Offscreen` directly.

## UNRESOLVED — verify on iPad next session

**Mandy went to bed before confirming the final drag-perf + aspect-ratio fix works end-to-end.**

She reported earlier in this session that an EARLIER version (commit not made — superseded) shrank the canvas during drag and never restored size. The fix (`7d92072`) was to add `aspectRatio` CSS so display size is independent of intrinsic pixel size. Should now stay stable across drag → release.

**What to verify when she's back:**
1. iPad: open a mockup in the tweak modal. Drag the pattern. Display box should NOT change size. During drag it may look slightly blurry (~400px render); on release it should sharpen.
2. If display still shrinks/jumps, **Option A from the in-session discussion is the fallback**: keep canvas intrinsic dimensions stable (always full template size), pipeline renders to a small offscreen canvas, then `drawImage` it onto the full-size display canvas with smoothing. The aspect-ratio CSS can stay; just also force the canvas's intrinsic dimensions to the template's full canvasSize regardless of `effMaxDim`. ~10 LOC change in the render effect's `canvas.width = ...; canvas.height = ...; ctx.drawImage(resultCanvas, 0, 0)` block.

## Carried over (still relevant)

- **UNRESOLVED from yesterday's handoff: mockup-modal "13.64" scale label.** Untouched today. See [docs/handoff-2026-05-24-mockup-perf-and-scale-mystery.md](handoff-2026-05-24-mockup-perf-and-scale-mystery.md) — needs Mandy to provide a screenshot of the exact label and where it appears.
- **iPad backlog from earlier handoffs:** re-shoot `wrapping-paper-roll-highlight.png` (tighter regions); tune `nursery-wallpaper` colorOverlayLabel; confirm wrapping-paper-roll zones; commit pre-existing untracked v2 PNGs (desk-mat, gift-bag, mens-dress-shirt, mens-tie, phone-case, womens-blouse); rename Entry Wallpaper colorOverlayLabel.

## Files touched tonight

- `public/mockups/v2/medium/` (new, 152 files, 32 MB)
- `scripts/gen-medium-layers.sh` (new)
- `src/components/mockups/MockupRendererV2.tsx` — preview + fitContainer props, LRU cap, drag perf
- `src/components/mockups/MockupGalleryModal.tsx` — passes `preview`
- `src/lib/utils/renderMockupV2Offscreen.ts` — new options arg
- `src/components/export/RepeatExportModal.tsx` — preview options on live preview, touch fixes on picker
- `src/components/sidebar/ActionsSidebar.tsx` — modal wrapper sizing + fitContainer
- `src/components/layout/AdvancedToolsBar.tsx` — modal wrapper sizing + fitContainer

## Dev server note

Dev server had been running since Friday 10AM during this session. After the first round of social-export changes Mandy was seeing stale 20s renders on iPad because the bundle hadn't hot-reloaded. **If iPad behavior ever doesn't match recent commits, restart `npm run dev` and force-reload the iPad tab.**

## iPad testing setup (LAN)

`http://10.0.0.144:3000` — verify IP with `ipconfig getifaddr en0` if it drifted.
