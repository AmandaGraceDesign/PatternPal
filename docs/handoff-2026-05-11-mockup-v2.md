# Handoff — Mockup v2 expansion (2026-05-11)

Branch: `mockup-upgrade`

## What shipped this session

### Schema additions ([types.ts](../src/lib/mockups/mockupEngineV2/templates/types.ts))
- `shadowPath?`, `shadowOpacity?` (default 1.0) on `MockupV2Template` — overlay PNG composited with **multiply** at the top of the stack
- `highlightPath?`, `highlightOpacity?` (default 1.0) on `MockupV2Template` — overlay PNG composited with **soft-light** at the top of the stack
- `patternAngle?: number` on `MockupZone` — degrees, clockwise, applied after tiling before perspective warp
- Displacement maps are being phased out (still in schema, used only by legacy `womens-skirt`)

### Pipeline changes ([MockupPipeline.ts](../src/lib/mockups/mockupEngineV2/MockupPipeline.ts))
- Shadow stage: multiply blend, runs last in `runPipeline`
- Highlight stage: soft-light blend, runs last; when present, **suppresses the auto-derived `lighting` soft-light pass** (prevents double-lighting)
- Rotation: when `zone.patternAngle !== 0`, tiles to an oversized canvas (√2×), rotates around center, draws into patternArea-sized canvas. Only applies to independent tiling (not `sharedPatternArea` path)

### Renderer changes ([MockupRendererV2.tsx](../src/components/mockups/MockupRendererV2.tsx))
- Preloads `shadowImage` and `highlightImage` if template paths set

### Color picker generalized
- [ActionsSidebar.tsx](../src/components/sidebar/ActionsSidebar.tsx) and [AdvancedToolsBar.tsx](../src/components/layout/AdvancedToolsBar.tsx) now show the color picker for **any** V2 template with a `colorOverlay`, not just onesie/wrapping-paper
- Contextual labels: "Wall Color:", "Border Color:", "Bow Color:", "Onesie Trim Color:", fallback "Accent Color:"

### New / replaced templates in [templateRegistry.ts](../src/lib/mockups/mockupEngineV2/templates/templateRegistry.ts)
| ID | State | Zones | Shadow | Highlight | ColorOverlay |
|---|---|---|---|---|---|
| `tea-towel-1` | NEW | main, bottom | ✓ | ✓ | — |
| `tea-towel-2` | NEW | main, bottom, right | ✓ | — | — |
| `blanket` | photo (was procedural) | single | ✓ | ✓ | — |
| `picnic-blanket` | NEW | single | ✓ | — | ✓ (border) |
| `curtain` | photo (was procedural) | single | — | — | ✓ (wall) |
| `silk-scarf` | photo (was procedural) | main, corner | ✓ | ✓ | — |
| `tablecloth` | **REMOVED** | — | — | — | — |

### Tooling
- New script [scan-mask-bounds.mjs](../scripts/scan-mask-bounds.mjs) — uses `sharp` (existing transitive dep) to scan all `*-mask.png` in `public/mockups/v2/` and print white-pixel bounding boxes. Re-run when adding new mockups.

### Asset renames
- `curtain-mask.png` → `curtains-mask.png`
- `curtain_wall_mask.png` → `curtains-wall-color-mask.png`
- `tea-towel1*` → `tea-towel-1*` (kebab-case w/ hyphen before number)
- `tea-towel2*` → `tea-towel-2*`

## Conventions (also in memory: [mockup_v2_conventions.md](/Users/amandacorcoran/.claude/projects/-Users-amandacorcoran-Documents-patternpal-pro/memory/mockup_v2_conventions.md))

**Naming** (kebab-case, lowercase):
- Base: `{product}.png`
- Pattern mask: `{product}-mask.png` or `{product}-{region}-mask.png`
- Color overlay mask: `{product}-color-mask.png` or `{product}-{region}-color-mask.png`
- Shadow: `{product}-shadow.png` (RGBA, optional)
- Highlight: `{product}-highlight.png` (RGBA, optional)
- Numbered variants: `tea-towel-1`, `tea-towel-2` (hyphen before number)

**Dimensions:** 2:3 aspect, **3000 × 4500 px @ 300dpi** (10×15"). All files within a set must match dimensions exactly.

**Blend modes** (fixed in renderer, not in filename):
- Shadow → `multiply`
- Highlight → `soft-light`
- Opacity variable, default 1.0

**Per-zone `physicalWidth`** must reflect each region's actual physical width, NOT the whole product. Critical for consistent tile scale across zones. Derive: `zonePixelWidth / canvasPxPerInch` where `canvasPxPerInch = totalProductPixelWidth / productPhysicalWidth`.

## Open items

1. **Silk scarf pattern angle** — user said pattern should be at an angle, will provide. Both zones currently `patternAngle: 0`. To set: edit `silk-scarf` template in [templateRegistry.ts](../src/lib/mockups/mockupEngineV2/templates/templateRegistry.ts) — change `patternAngle: 0` to the angle in degrees (positive = clockwise) for `main` and/or `corner` zones.

2. **Tea-towel-1 was 3019 × 4500** (not exact 2:3). User accepted as "close enough." Same with throw-blanket (2400 × 3577) and silk-scarf (3019 × 4500). Future mockups should be exactly 3000 × 4500.

3. **Tablecloth PNG files orphaned** in `public/mockups/v2/` — not deleted by request. Files: `tablecloth*.png` (7 files).

4. **Visual verification incomplete.** Dev server runs, type-check passes, assets serve. User needs to load mockup gallery and confirm each renders correctly. Things to watch:
   - Pattern scale consistent across zones (tea-towel-2 right stripe was the worst case — fixed by setting per-zone physicalWidth)
   - Shadow darkens correctly, highlight gently lifts
   - Color picker appears for curtain (wall) and picnic-blanket (border)

## Workflow for adding the next mockup

1. Drop PNG files into `public/mockups/v2/` following naming convention
2. Run `node scripts/scan-mask-bounds.mjs` to get patternArea bounds
3. Compute `canvasPxPerInch` from the product's full width
4. Add entry to [templateRegistry.ts](../src/lib/mockups/mockupEngineV2/templates/templateRegistry.ts) with:
   - canvasSize from PNG dimensions
   - patternArea from scan
   - physicalSize (research common size for product)
   - zones if multi-region, each with its own `physicalWidth` and optional `patternAngle`
   - shadowPath, highlightPath, colorOverlay as applicable
5. Run `npx tsc --noEmit` to verify
6. Refresh browser to test

## Files touched this session
- `src/lib/mockups/mockupEngineV2/templates/types.ts`
- `src/lib/mockups/mockupEngineV2/templates/templateRegistry.ts`
- `src/lib/mockups/mockupEngineV2/MockupPipeline.ts`
- `src/components/mockups/MockupRendererV2.tsx`
- `src/components/sidebar/ActionsSidebar.tsx`
- `src/components/layout/AdvancedToolsBar.tsx`
- `scripts/scan-mask-bounds.mjs` (new)
- `public/mockups/v2/` (renames + new picnic-blanket and silk-scarf assets from user)

Nothing committed — all changes are working-tree on `mockup-upgrade` branch.
