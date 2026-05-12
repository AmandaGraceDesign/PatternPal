---
task: Mockup v2 — silk-scarf + picnic-blanket tuning, schema extension
status: paused
last_updated: 2026-05-12
branch: mockup-upgrade
head: d1c016d
---

## Current state

Iterated on silk-scarf and picnic-blanket. Extended the engine to support
per-zone pattern offsets (phase-shifting one zone's tiling so adjacent zones
don't line up). Everything committed as `d1c016d`. Visual QA on the other
new mockups (tea-towels, throw-blanket, curtain) is still pending.

## Completed this session (since 2026-05-11 handoff)

### Schema
- Added `patternOffset?: { x: number; y: number }` to `MockupZone`
  in [types.ts](../src/lib/mockups/mockupEngineV2/templates/types.ts).
  Pixel shift applied to the tiled pattern within a zone before perspective warp.
  Currently honoured only in the rotated tile branch (`patternAngle !== 0`).

### Pipeline ([MockupPipeline.ts](../src/lib/mockups/mockupEngineV2/MockupPipeline.ts))
- Rotated tile branch now grows the oversized canvas by `2 × max(|offsetX|, |offsetY|)`
  so the shifted+rotated draw still covers the patternArea, then translates the
  oversized draw by `(offsetX, offsetY)` in canvas space.

### Silk-scarf template ([templateRegistry.ts](../src/lib/mockups/mockupEngineV2/templates/templateRegistry.ts))
Photo shows a scarf folded into quarters, so the visible face is one
18×18" quadrant of the print (not the full 36×36"). Tuned:
- `main` zone: `physicalWidth: 36 → 18`, `patternAngle: -22`
- `corner` zone: `physicalWidth: 16.21 → 8.11`, `patternAngle: -22`,
  `blend.opacity: 1.0 → 0.67`, `patternOffset: { x: 137, y: 89 }`
  (non-round to avoid landing on tile boundaries for any user pattern dimensions)
- `shadowOpacity: 0.68`, `highlightOpacity: 0.41`
- `physicalSize` kept at `{ 36, 36 }` so `sizeLabel` still reflects the
  real product size — only the per-zone `physicalWidth` reflects what's visible.

### Picnic-blanket template
Same "visible region ≠ nominal product size" issue: photo shows ~30" of width.
- Converted from single-zone (top-level fields) to multi-zone (one zone)
  so we can use zone-level `physicalWidth: 30` for tile scaling while keeping
  `physicalSize: { 60, 72 }` for the product label.
- Moved `productBase.maskPath` → `zones[0].maskPath`
  (`/mockups/v2/picnic-blanket-main-mask.png`).
- Added `patternAngle: -5`.

### Verification
- Confirmed stack order in [MockupPipeline.ts:504-520](../src/lib/mockups/mockupEngineV2/MockupPipeline.ts#L504-L520):
  shadow (multiply, `template.shadowOpacity`) and highlight (soft-light,
  `template.highlightOpacity`) both composite ABOVE the masked pattern,
  in that order. Highlight presence still suppresses the auto-lighting pass
  to prevent double-lighting.
- `npx tsc --noEmit` clean after every change.

## Remaining work

1. **Visual QA on the other new mockups** — none of these have been
   confirmed in-browser this session:
   - `tea-towel-1`, `tea-towel-2` (multi-zone, never visually validated)
   - `blanket` (throw-blanket, photo-based replacement of procedural)
   - `curtain` (photo-based replacement of procedural)
2. **Likely scale calibration needed** — same root cause as picnic-blanket
   (`physicalSize.width` is the nominal product size, not the visible region):
   - `blanket`: physicalSize 50×60" — check visible width in photo
   - `curtain`: same check
   - `tea-towel-1`/`tea-towel-2`: per-zone physicalWidth was already set
     this session before pause; confirm the tile scale looks right
3. **Picnic-blanket -5° angle** is the latest setting the user landed on
   after trying +5° first. Confirm it still looks right after a refresh.
4. **Merging to main** — see "Merge readiness" below.

## Decisions made

- For products where the visible region in the photo doesn't match the full
  product (silk-scarf folded, picnic-blanket cropped), use per-zone
  `physicalWidth` (in `zones[]`) for tile scaling and leave `physicalSize`
  at the real product dimensions for the `sizeLabel`. The single-zone path
  uses `template.physicalSize.width` directly, so converting to multi-zone
  is the standard fix.
- `patternOffset` deliberately scoped to the rotated tile branch only —
  the non-rotated branch uses `PatternTiler.renderPreScaled` which doesn't
  have offset support, and the use case (silk-scarf corner) was already
  going through the rotated branch via `patternAngle: -22`. Can be
  extended later if a non-rotated template needs it.
- Used non-round offset numbers (137, 89) for silk-scarf corner so the
  shift is unlikely to coincide with any user-supplied pattern repeat
  dimensions.

## Blockers

None. Engine work is complete; remaining is calibration + visual QA.

## Merge readiness (mockup-upgrade → main)

Branch is **49 ahead, 32 behind** `origin/main`. Will not merge cleanly.

**Files touched on both sides (need conflict resolution):**
- [src/components/sidebar/ActionsSidebar.tsx](../src/components/sidebar/ActionsSidebar.tsx)
- [src/components/layout/AdvancedToolsBar.tsx](../src/components/layout/AdvancedToolsBar.tsx)

**Touched on main but not here (should integrate cleanly):**
- [app/page.tsx](../app/page.tsx)
- [src/components/layout/PatternControlsTopBar.tsx](../src/components/layout/PatternControlsTopBar.tsx)

**Pre-merge checklist:**
1. Finish visual QA on tea-towel-1, tea-towel-2, blanket, curtain
2. Fix scale calibration on any that need it (likely blanket + curtain)
3. `git merge origin/main` — resolve conflicts in the two overlapping files
4. Re-verify all mockups render correctly after merge
5. Open PR

## Files modified this session

All committed as `d1c016d`:
- `src/lib/mockups/mockupEngineV2/templates/types.ts` (patternOffset)
- `src/lib/mockups/mockupEngineV2/templates/templateRegistry.ts` (silk-scarf, picnic-blanket)
- `src/lib/mockups/mockupEngineV2/MockupPipeline.ts` (offset in rotated branch)

(Also part of the same commit but from earlier sessions: source changes for
all new templates, PNG assets, scripts/scan-mask-bounds.mjs, and the
2026-05-11 handoff.)

## Working-tree state at pause

Only unrelated untracked items remain — none of these are part of the
mockup work and were deliberately left untracked:
`.claude/`, `.superpowers/`, `.continue-here.md` (stale, dated April 12),
`openspec/`, `tasks/`, `docs/google-ads-*.md`,
`docs/patternpal-pro-genius-update.md`.

## Next action when resuming

Start by loading the mockup gallery in the dev server and visually checking
each of the 4 untested templates against the user's pattern. For each one
that looks wrong-scale, follow the picnic-blanket pattern: convert to
multi-zone with a single zone (if currently single-zone), set
`zones[0].physicalWidth` to the visible width in inches, leave
`template.physicalSize` alone.
