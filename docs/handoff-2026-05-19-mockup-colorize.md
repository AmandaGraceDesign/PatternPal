---
task: Mockup v2 color-overlay tuning — HSL Colorize attempt reverted
status: complete (reverted to color × multiply)
last_updated: 2026-05-19
current_branch: merge-test
---

## TL;DR

Tried Photoshop-style HSL Colorize for the accent color overlay, plus user-facing H/S/L sliders with gradient tracks. Results were too fiddly across templates — pastels still felt punchy even with a saturation roll-off and live sliders. Reverted to the original fill × multiply pipeline.

## Commits on `merge-test` this session

1. `d9eea11` — apron + boys-pjs templates added; throw-blanket colorOverlay wired with neutral `#a9a09a` default. **KEPT.**
2. `b62e6ce` — HSL Colorize pipeline + auto-default swatch fallback in sidebars. **PARTIALLY KEPT** (see below).
3. `ced1725` — **REVERT** of the color overlay block in [MockupPipeline.ts](../src/lib/mockups/mockupEngineV2/MockupPipeline.ts) back to fill × multiply with shading + 30% soft-light highlight pass. Original logic from pre-`b62e6ce` state (`c3f2538`).

## What is still in from `b62e6ce`

- `extractDominantColor` is now `export`ed from [MockupPipeline.ts](../src/lib/mockups/mockupEngineV2/MockupPipeline.ts) and the picker swatch in both [ActionsSidebar.tsx](../src/components/sidebar/ActionsSidebar.tsx) and [AdvancedToolsBar.tsx](../src/components/layout/AdvancedToolsBar.tsx) shows the effective auto-color as the picker default (instead of black).

## What is gone

- `hexToRgb`, `rgbToHsl`, `hslToRgb` helpers
- `hueShift` / `satAdjust` / `lightAdjust` pipeline inputs and renderer props
- HSL slider UI (number inputs, then range sliders, then gradient-track sliders — all gone)
- `.hsl-slider` CSS class in [app/globals.css](../app/globals.css)

## Current color overlay pipeline (color × multiply, restored)

1. Convert overlay mask to alpha (B/W or alpha-based, auto-detected)
2. Extract contrast-boosted luminance from `productCanvas` as a shading layer, clipped to mask
3. Build `colorLayer`: solid `accentColor` fill × multiply with shading, clipped to mask
4. Composite `colorLayer` onto final canvas with `multiply` blend
5. Soft-light pass at 30% opacity from the original photo to restore subtle highlights in the recolored region

## Open items / next session

- **Desk-mat and phone-case** templates still procedural placeholders. Photo assets not yet in [public/mockups/v2/](../public/mockups/v2/). When user drops them in (convention: `<name>.png`/`-shadow.png`/`-highlight.png`/`-main-mask.png` + optional `-color-mask.png`), wire them via `node scripts/scan-mask-bounds.mjs` and add to [templateRegistry.ts](../src/lib/mockups/mockupEngineV2/templates/templateRegistry.ts).
- **Throw blanket fringe** still looks "weird" per user — likely a color-mask PNG quality issue, not algorithmic. Don't touch code until user supplies a new mask.
- **Memoize `extractDominantColor`** — currently runs on every render. Not urgent.

## Status

- Tests: 28/28 passing
- Typecheck: clean
- Dev server: still up at http://localhost:3000 (PID 10756 at last check)
- Not pushed

## Don't forget

- Still on `merge-test` (per [handoff-2026-05-14-evening-pause.md](handoff-2026-05-14-evening-pause.md)) — do NOT fast-forward main yet.
- `mockup-upgrade` safety branch untouched.

## Lesson

User feedback at the time of the HSL attempt: "i just wasted a lot of time." The simple multiply approach was already working — only switch overlay algorithms when there is a concrete, reproducible failure case the new approach demonstrably fixes. Tuning magic numbers across N templates is open-ended; predictable multiply behavior is finite. If revisiting in the future, ship behind a per-template flag, not a global pipeline swap.
