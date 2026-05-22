---
task: Legacy v1 cleanup, add tote-bag v2, remove throw-blanket, lock preview width
status: PARTIAL — one commit shipped, three changes uncommitted and unverified in browser
created: 2026-05-22
current_branch: merge-test
---

## What shipped (committed)

**595d439 — `chore(mockups): remove legacy v1 mockup pipeline`**

Deleted the unreachable v1 fallback pipeline:
- `src/lib/mockups/mockupTemplates.ts` (v1 template registry)
- `src/lib/utils/renderMockupOffscreen.ts` (unreferenced)
- `src/components/mockups/MockupRenderer.tsx` (v1 preview component)

Updated `ActionsSidebar.tsx` + `AdvancedToolsBar.tsx` to drop v1 imports and collapse the v1 fallback ternary. The fallback was unreachable because the gallery only enumerates v2 templates (`getAllV2Templates()`), and the two v1-only types (`pillow`, `tote-bag`) were never selectable. Net: −1409 / +6 lines.

## What's uncommitted

### 1. Added `tote-bag` v2 template

[templateRegistry.ts](../src/lib/mockups/mockupEngineV2/templates/templateRegistry.ts) — new entry after `desk-mat`. Two zones:
- `body` (mask1) — front panel, `physicalWidth: 15`
- `trim` (mask2) — edge band around the bag, `physicalWidth: 15`, `patternOffset: { x: 487, y: 281 }`

The patternOffset was bumped from initial 67×43 → 487×281 (per user feedback "needs shifted so it doesn't line up perfectly"). At ~24% / 16% of patternArea, it's clearly out of phase with common tile sizes. May still need tuning after browser verification.

Other settings:
- `colorOverlay` over the handles, labeled "Handle Color"
- `physicalSize: 15×14"`
- Shadow + highlight enabled

Assets at `public/mockups/v2/tote-bag-*.png` (6 files, untracked).

### 2. Removed `throw-blanket` template

User said "i just don't like that mockup". Removed:
- `'blanket'` entry from `templateRegistry.ts`
- 5 asset files: `throw-blanket{,-mask,-color-mask,-shadow,-highlight}.png`

`picnic-blanket` untouched.

### 3. Locked preview canvas width to 600px CSS

User reported: tea-towel rendered visibly smaller than mens-tie in the modal at the same viewport. Root cause is the canvas's intrinsic dimensions (`canvas.width = template.canvasSize.width`) interacting with `w-full` and timing of asset loads — different templates ended up at different display widths.

Fix: changed the preview wrapper in both consumer files from `w-full max-w-2xl` to `w-[600px] max-w-full`:
- [ActionsSidebar.tsx:541](../src/components/sidebar/ActionsSidebar.tsx#L541)
- [AdvancedToolsBar.tsx:631](../src/components/layout/AdvancedToolsBar.tsx#L631)

All templates now render at exactly 600px CSS wide. Height follows each canvas's intrinsic aspect ratio (so a 1024² onesie is 600×600, a 3000×4500 tie is 600×900). Down from previous up-to-672px but now consistent.

## Files

EDITED (uncommitted)
- [src/lib/mockups/mockupEngineV2/templates/templateRegistry.ts](../src/lib/mockups/mockupEngineV2/templates/templateRegistry.ts) — added tote-bag, removed blanket
- [src/components/sidebar/ActionsSidebar.tsx](../src/components/sidebar/ActionsSidebar.tsx) — preview wrapper width lock
- [src/components/layout/AdvancedToolsBar.tsx](../src/components/layout/AdvancedToolsBar.tsx) — preview wrapper width lock

DELETED (uncommitted)
- `public/mockups/v2/throw-blanket{,-mask,-color-mask,-shadow,-highlight}.png` (5 files)

NEW assets (untracked)
- `public/mockups/v2/tote-bag-{mask1,mask2,color-mask,shadow,highlight}.png` + `tote-bag.png`
- Plus a pile of pre-existing untracked v2 assets and other untracked files unrelated to this session

## Verification

- `npx tsc --noEmit` exit 0 after each change.
- Cleanup commit (595d439) — code-level only, no functional changes (v1 fallback was already unreachable).
- Tote-bag template — **not yet browser-verified**. User should load the tote-bag mockup in the gallery and confirm: (1) front panel + trim render distinctly, (2) trim pattern is visibly offset from body pattern, (3) handle color picker works.
- Preview width lock — **not yet browser-verified**. User should open tea-towel-2 and mens-tie back-to-back and confirm they render at identical widths.

## Diagnostic notes (context for next session)

- All v2 template canvas sizes listed in `templateRegistry.ts`. Smaller-than-3000×4500 templates (would benefit from re-shoot for export quality): `onesie` (1024²), `fabric-swatch` (1024²), `throw-pillow` (1024²), `nursery-wall` (1000×800), `wrapping-paper` (1024²), `wrapping-paper-v2` (900×800), `wallpaper` (1024²), `wallpaper-roll` (700×900), `journal` (1024²).
- Canvas pixel size affects export resolution only; CSS display width is now locked at 600px regardless.
- Desk-mat mask was updated by user mid-session. Tight bbox `(0, 862) → (2999, 4499)` still matches existing `patternArea` — no template change needed.

## Not done

- Commit the three uncommitted changes (tote-bag, blanket removal, width lock).
- Browser-verify tote-bag mockup (front + trim look distinct, color picker on handles works).
- Browser-verify preview width lock (tea-towel and mens-tie render at identical widths).
- Consider re-shoot of small-canvas templates at 3000×4500 for export quality wins.
- New untracked assets in `public/mockups/v2/`: `tea-towel3-*.png` files visible in git status — possibly a new template the user hasn't wired in yet. Worth checking.
- Outstanding backlog (carried over):
  - iPad verification for social export picker scroll + v2 mockup export
  - iPad save-to-Photos for Easyscale + Pattern Fill (see tasks/todo.md)
