---
task: Mockup v2 — curtain rebuild, in-modal scale control, render perf, angle tweaks
status: paused — uncommitted
last_updated: 2026-05-12 (evening session)
branch: mockup-upgrade
head: c3f2538 (uncommitted changes on top)
---

## Current state

Working tree has uncommitted changes across:
- `src/components/layout/AdvancedToolsBar.tsx` — new in-modal scale control + consolidated single-row UI + 150 ms debounce
- `src/components/mockups/MockupRendererV2.tsx` — module-level image cache + parallel asset loads
- `src/lib/mockups/mockupEngineV2/templates/templateRegistry.ts` — curtain rebuild + 3 angle tweaks
- `public/mockups/v2/curtains.png`, `curtains-mask.png`, `curtains-wall-color-mask.png` (replaced)
- `public/mockups/v2/curtains-shadow.png`, `curtains-highlight.png` (NEW)

Typecheck (`npx tsc --noEmit`) is clean at pause. Nothing committed yet — Mandy hasn't asked.

## Completed this session

### 1. Curtain template rebuilt
Mandy replaced all 5 curtain image assets mid-session. New canvas is 3600×4500
(was 3612×4515). Updated [templateRegistry.ts:213-241](../src/lib/mockups/mockupEngineV2/templates/templateRegistry.ts#L213-L241):
- `canvasSize`: 3600×4500
- `patternArea`: `{ x: 500, y: 358, width: 2645, height: 3883 }` (from rescanned mask)
- Added `shadowPath: '/mockups/v2/curtains-shadow.png'` and `highlightPath: '/mockups/v2/curtains-highlight.png'`
- Converted to multi-zone (one zone) with `physicalWidth: 84` (= 2 × 42")
  to fix the "only 1.5 repeats per panel" issue — the patternArea bbox spans
  both panels, so we map 84" of pattern across it and the gap masks out.

### 2. In-modal pattern scale control
New feature: every open mockup now has a "Scale" number input that seeds from
the main canvas `tileWidth` but lets the user preview a different scale without
leaving the modal.
- Local state: `mockupScaleOverride: number | null` (null = use main canvas)
- Aspect ratio locked: `effectiveTileHeight = override × (tileHeight / tileWidth)`
- "reset" link appears when override ≠ canvas value
- Override clears on modal close — reopening starts from main canvas
- Subtitle updates live: `Based on X.X × Y.Y inch repeat`
- Gallery thumbnails are untouched (still main canvas scale)

### 3. Consolidated control bar
Merged 3 stacked colored bands (Scale / Color / Shadow+Highlight) into one
`flex-wrap` row at the top of every mockup. Single warm-gray background,
hairline dividers between groups, hidden on narrow widths. Tightened labels
("Accent Color:" → "Accent:", "Scale (inch repeat):" → "Scale:") so the row
fits comfortably on one line in the modal.

### 4. Render performance
Mandy reported that scale increments were laggy. Diagnosed three issues in
[MockupRendererV2.tsx](../src/components/mockups/MockupRendererV2.tsx) and fixed all three:

- **Module-level image cache** (`imageCache: Map<string, Promise<HTMLImageElement | null>>`):
  every re-render previously reloaded all template PNGs (5–25 MB each).
  Cached now — second+ renders skip the decode entirely. This is the big win.
- **Parallel asset loads**: 6 sequential `await loadImage` calls became one
  `Promise.all`. First-render-of-a-template is ~6× faster on the load step.
- **150 ms debounce** on the rendered tile width/height (via inline
  `useDebouncedValue` hook in AdvancedToolsBar). The input stays bound to
  the un-debounced value so typing/clicking feels instant; only the pipeline
  consumer is debounced. Arrow spam now coalesces into one final render.

### 5. Angle tweaks (Mandy iterated in real time)
- `swim-trunks-1` main zone → `patternAngle: 10`
- `swimsuit-kids-2` → converted single-zone → multi-zone, `patternAngle: 14`,
  `physicalWidth: 12`. Required moving `maskPath` from `productBase` into
  `zones[0].maskPath`.
- `silk-scarf` both zones (main + corner) → `patternAngle: 21` (down from -22)

### 6. Conversation also produced
Diagnosed "Will online be faster?" question — yes, 2–3× from minified React,
but the canvas/decode work is the same. Cache+parallel+debounce mattered more
than dev-vs-prod.

## Decisions made

- **In-modal scale is preview-only**, never persists back to main canvas.
  Mandy explicitly chose this in the AskUserQuestion — safer for experimentation.
- **Aspect ratio locked** on the scale input — single number, height derives
  from the original `tileHeight / tileWidth` ratio. Matches how users think
  about "scale" in plain language.
- **Image cache stores Promises, not resolved Images** — dedupes concurrent
  loads (if two renderers ask for the same image simultaneously, they share
  one in-flight request). Cache is module-level so it survives unmounts;
  cleared on page reload, which is fine because production assets only change
  on redeploy.
- **Curtain `physicalWidth: 84`** based on the math `2 panels × 42" each`.
  If gathers/folds make the visible per-panel width feel closer to 35",
  dropping to 70 is the next dial. Don't go below ~70 without re-checking.

## Remaining work

### Visual QA still pending from the pre-evening handoff
None of these were touched this session — angle/scale work today was on
different templates:
- `tea-towel-1`, `tea-towel-2` — multi-zone, never visually validated
- `blanket` (throw-blanket) — likely needs the picnic-blanket fix
  (convert single-zone → multi-zone with corrected `physicalWidth`)

### Templates touched today — confirm in-browser after pause
- `curtain` — verify rebuilt assets render correctly with `physicalWidth: 84`,
  shadow/highlight overlays look right, color overlay (wall) still works.
- `swim-trunks-1` — confirm 10° angle is the keeper.
- `swimsuit-kids-2` — confirm 14° angle on the converted-to-multi-zone template.
- `silk-scarf` — confirm 21° angle on both zones.

### New UI features — sanity check
- Scale input: try typing, arrow-clicking, hitting reset, opening different
  mockups (should reseed from main canvas each time).
- Single-row controls: check on a template with all three (color + shadow +
  highlight, e.g. swim-trunks-1) and on one with just scale (e.g. throw pillow).
  Confirm wrap behavior at narrow viewport.
- Render perf: open a heavy mockup (duvet-1 with its 15 MB assets), bump
  scale 5 times in a row — should feel smooth after the first render.

### Merge readiness (mockup-upgrade → main)
Now even further from main. Conflict surface area in
[AdvancedToolsBar.tsx](../src/components/layout/AdvancedToolsBar.tsx) is
bigger because we added:
- New state (`mockupScaleOverride`, `useDebouncedValue` hook)
- Restructured the modal content (single row instead of 3 bands)
- New props passed to renderers (`renderTileWidth`/`renderTileHeight`)

Pre-merge sequence:
1. Commit the current changes (see "Commit suggestions" below)
2. Finish visual QA on tea-towel-1/2 + blanket
3. `git merge origin/main` — expect conflicts in `ActionsSidebar.tsx` and
   `AdvancedToolsBar.tsx`
4. Re-verify all mockups after merge
5. Open PR

## Commit suggestions (when Mandy is ready)

Three logical commits to keep history readable:

**Commit A — curtain rebuild**
```
feat(mockups-v2): rebuild curtain with new photo + shadow + highlight

Replaces curtain assets and updates template to match new canvas (3600x4500)
and rescanned mask bounds. Converts to multi-zone with physicalWidth: 84
(= 2 panels × 42") so each panel now shows the right number of pattern
repeats (the previous single-zone setup spread 42" of pattern across both
panels, yielding ~1.5 repeats per panel).
```
Files: `public/mockups/v2/curtains*.png`, `templateRegistry.ts` (curtain block only)

**Commit B — angle tweaks**
```
tune(mockups-v2): swim-trunks 10°, swimsuit-kids-2 14°, silk-scarf 21°

Also converts swimsuit-kids-2 from single-zone to multi-zone so it can
honor patternAngle (single-zone path doesn't use it).
```
Files: `templateRegistry.ts` (swim-trunks, swimsuit, silk-scarf blocks)

**Commit C — in-modal scale + perf + UI consolidation**
```
feat(mockups): in-modal scale override, render perf, single-row controls

- New scale input in mockup modal previews different inch-repeat values
  without leaving the modal (aspect-locked, resets on close, debounced
  150ms before the pipeline runs).
- MockupRendererV2 now caches loaded images at module scope and loads
  all template assets in parallel — second+ renders skip the 5-25 MB
  PNG decode entirely.
- Consolidated Scale / Color / Shadow+Highlight rows into one flex-wrap
  row to reduce vertical chrome and keep mockup visible without scroll.
```
Files: `AdvancedToolsBar.tsx`, `MockupRendererV2.tsx`

(Or just one big commit — Mandy's call.)

## Working-tree state at pause

Modified (intended for commit):
- `public/mockups/v2/curtains.png`, `curtains-mask.png`, `curtains-wall-color-mask.png`
- `public/mockups/v2/curtains-highlight.png`, `curtains-shadow.png` (new)
- `src/components/layout/AdvancedToolsBar.tsx`
- `src/components/mockups/MockupRendererV2.tsx`
- `src/lib/mockups/mockupEngineV2/templates/templateRegistry.ts`

Unrelated untracked (deliberately left out, same as previous handoff):
- `.claude/`, `.superpowers/`, `.continue-here.md` (stale, dated April 12),
  `openspec/`, `tasks/`, `docs/google-ads-*.md`, `docs/patternpal-pro-genius-update.md`

## Next action when resuming

1. Decide whether to commit now or after more QA.
2. Open the dev server, refresh, and visually walk through each touched
   template (curtain, swim-trunks-1, swimsuit-kids-2, silk-scarf) plus the
   still-untested ones (tea-towel-1, tea-towel-2, blanket).
3. Test the new scale input on a few templates — confirm it feels instant
   and resets correctly between mockups.
