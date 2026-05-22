---
task: Migrate social-media export tool to the v2 mockup pipeline (all v2 templates available)
status: SHIPPED (tsc clean, dev server compiles). NOT browser-tested by Claude.
created: 2026-05-22
current_branch: merge-test
---

## What changed

The social-media export modal previously rendered mockups via the legacy
`renderMockupOffscreen` pipeline, exposing only 6 templates from
`SOCIAL_MOCKUP_IDS` (onesie, fabric-swatch, wallpaper, throw-pillow,
wrapping-paper, journal).

It now renders via the v2 pipeline (`runPipeline` + `mockupV2Templates`),
exposing all image-based v2 templates — onesie, fabric-swatch, throw-pillow,
wallpaper, journal, wrapping-paper (gift box), curtain, tea-towel-1,
tea-towel-2, blanket, picnic-blanket, duvet-1, mug-1, mug-2, gift-bag,
silk-scarf, mens-tie, phone-case, desk-mat, mens-dress-shirt, womens-blouse,
girl-dress-1, girl-dress-2, apron, boys-pjs, swim-trunks-1, swimsuit-kids-2.

Procedural-base templates (nursery-wall, wrapping-paper-v2, wallpaper-roll)
are filtered out — they don't have a product image and aren't useful for
social export thumbnails.

## Files

NEW
- [src/lib/utils/renderMockupV2Offscreen.ts](../src/lib/utils/renderMockupV2Offscreen.ts) —
  async wrapper around `runPipeline`. Loads all template assets (product
  base, masks, color overlay, shadow/highlight + additionals, zone masks)
  in parallel via a module-local image cache, then calls `runPipeline`.
  Defaults all runtime toggles to "enabled" — the social export doesn't
  expose per-layer controls.

EDITED
- [src/components/export/RepeatExportModal.tsx](../src/components/export/RepeatExportModal.tsx) —
  - Replaced `mockupTemplates` + `SOCIAL_MOCKUP_IDS` + `renderMockupOffscreen`
    imports with v2 equivalents (`mockupV2Templates`, `getAllV2Templates`,
    `renderMockupV2Offscreen`).
  - Computed `SOCIAL_V2_MOCKUP_IDS` at module load: all v2 templates with
    `productBase.type === 'image'`.
  - Threaded `currentDPI` through `SocialPreviewSlide` props +
    `applyMockupOverlay` function signature (v2 pipeline takes a dpi arg).
  - `MockupOverlayConfig.templateId` type changed from `MockupType` to
    `string` (v2 IDs are string-keyed).
  - Picker UI made scrollable: `max-h-[180px] overflow-y-auto` since the
    template count jumped from 6 to 27.
  - Picker thumbnail src now reads `mockupV2Templates[id].productBase.imagePath`.
  - Preview `useEffect` deps array now includes `dpi`.

## Verification

- `npx tsc --noEmit` exits 0 (clean).
- Dev server (`next dev --webpack`) compiles cleanly — serving 200s.
- The legacy `mockupTemplates`, `SOCIAL_MOCKUP_IDS`, and `renderMockupOffscreen`
  symbols are gone from `RepeatExportModal.tsx` (grep verified).
- **NOT browser-tested by Claude.** User should verify: open social export →
  picker shows ~27 thumbnails in a scrollable strip → select a v2 template
  (e.g., mens-tie, gift-bag, desk-mat) → preview canvas renders correctly →
  export → exported file has the v2 mockup baked in.

## Gotchas

- The v2 pipeline expects a `dpi` arg; the legacy one didn't. The current
  user-selected DPI (`currentDPI` from RepeatExportModal props) is threaded
  through to both the preview and export call sites.
- For image-based v2 templates with `displacement.intensity = 0` (which is
  every v2 template currently in the registry), `dpi` is essentially a
  no-op — the pipeline uses it for procedural displacement. So even if dpi
  were wrong, output would still be correct.
- The original 6 templates (onesie, fabric-swatch, wallpaper, throw-pillow,
  wrapping-paper, journal) exist in BOTH registries. The v2 versions may
  render slightly differently (different blend logic, lighting). The mockup
  view already uses v2 for those, so this unifies behavior across the app.
- `applyMockupOverlay` signature gained a 10th positional arg (`dpi`). Any
  future caller must pass it.
- The legacy `mockupTemplates.ts` and `renderMockupOffscreen.ts` files are
  still in the repo — unused by social export but may still be referenced
  elsewhere. Not deleted.

## Not done

- Browser test the picker UI (scroll behavior, all 27 templates render
  thumbnails, selection updates preview).
- Browser test a v2 mockup export end-to-end (e.g., select mens-tie →
  export → confirm the exported PNG has the tie correctly baked in).
- iPad verification (touch-scroll the picker, tap a thumbnail, export).
- Consider deleting the legacy `mockupTemplates.ts` +
  `renderMockupOffscreen.ts` if nothing else references them.

## Commit

Pending — about to commit on `merge-test`.
