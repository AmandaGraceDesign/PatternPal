# Phase 1: V2 Templates Complete - Research

**Researched:** 2026-03-22
**Domain:** Canvas-based mockup rendering, V2 pipeline template authoring, TypeScript type extension
**Confidence:** HIGH

## Summary

This phase is almost entirely internal — no new dependencies, no framework changes, no API calls. All work happens inside the existing V2 pipeline (`MockupPipeline.ts`) and template registry (`templateRegistry.ts`). The codebase is well-structured and the extension points are clear.

The two tasks are (1) adding per-zone `physicalWidth` to `MockupZone` so the kids dress bodice and skirt tile at different physical scales, and (2) authoring six new V2 `MockupV2Template` objects (one per V1 mockup) with `productBase: { type: 'image' }` and appropriate `patternArea`/`maskPath` values derived from existing V1 data plus two-pass visual verification.

The gallery already renders both V1 and V2 cards side-by-side. Migrated templates go into `templateRegistry.ts` — the gallery will pick them up automatically. No gallery changes are needed in this phase.

**Primary recommendation:** Extend `MockupZone` with an optional `physicalWidth` field, thread it through `processZone`, then author the six migration templates using V1 mask files and dimensions already on disk.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Kids Dress Tile Scaling**
- Physically accurate per-zone tile scaling: bodice uses ~13.5" physical width, skirt uses ~18" physical width
- Tiles will appear at different physical sizes per zone — this is intentional and matches real garment behavior
- Skirt zone gets fabric-drape displacement for realism; bodice stays flat (displacement=0) since photo already shows it fitted
- Zone `MockupZone` type will need a `physicalSize` field to support per-zone widths

**Migration Visual Fidelity**
- Two-pass migration: first match V1 output exactly, then enhance with V2 lighting overlay
- Lighting overlay added to all migrated photo-based mockups after verifying V1 match
- Blend tuning and other V2 features not in scope for enhancement pass — just lighting

**sizeLabel Content**
- Format: "Product + dimensions" with inches and centimeters — e.g., `16×16" (40×40cm) Throw Pillow`
- Kids dress label updated from "Size 5 Kids (13.5×20.5")" to match new format: `13.5×20.5" (34×52cm) Kids T-Shirt Dress`
- All templates (migrated V1s, kids dress, existing V2 procedural) get sizeLabels in this format

**Template Naming**
- Migrated V1 templates keep original IDs in V2 registry: 'onesie', 'fabric-swatch', 'wallpaper', 'throw-pillow', 'wrapping-paper', 'journal'
- Both photo-based and procedural versions coexist — wrapping paper gets both variants
- Duplicate products use descriptive display name suffixes (e.g., "Wrapping Paper (Flat Sheet)" vs "Wrapping Paper (Folded)")
- V1 category assignments map to V2 categories: onesie→apparel, fabric-swatch→fabric, wallpaper→wallpaper, throw-pillow→home-goods, wrapping-paper→gifting, journal→stationery

### Claude's Discretion
- Skirt displacement intensity and wrinkle frequency values
- Seam treatment between bodice and skirt zones (overlap blend vs feathered edge)
- Whether each V1 template uses mask-based or coordinate-based pattern areas (evaluate per template)
- Descriptive suffix wording for duplicate product display names

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MOCK-01 | All 6 V1 mockups (onesie, fabric swatch, wallpaper, throw pillow, wrapping paper, journal) render through V2 engine as single-zone templates | V1 `mockupTemplates.ts` has all physical dimensions and mask paths; `MockupV2Template` type supports `productBase: { type: 'image' }` today |
| MOCK-02 | Kids tshirt-dress renders with per-zone physical widths (bodice ~13.5", skirt hem ~18") for accurate tile scaling | `processZone` already takes `physicalWidth` as a parameter; `MockupZone` needs one new optional field `physicalWidth`; pipeline passes `template.physicalSize.width` today — must pass zone-level override when set |
| MOCK-03 | Every template has a human-readable sizeLabel displaying physical dimensions | `sizeLabel` field already exists on `MockupV2Template` (optional); gallery already renders it; just needs values on all templates |
</phase_requirements>

---

## Standard Stack

### Core (no new dependencies needed)

| File | Purpose | Phase 1 role |
|------|---------|--------------|
| `src/lib/mockups/mockupEngineV2/templates/types.ts` | Type definitions for all V2 templates and zones | Add `physicalWidth?: number` to `MockupZone` |
| `src/lib/mockups/mockupEngineV2/MockupPipeline.ts` | `processZone()` + `runPipeline()` | Thread zone-level `physicalWidth` override into `processZone` |
| `src/lib/mockups/mockupEngineV2/templates/templateRegistry.ts` | Central record of all V2 templates | Add 6 migration templates + update kids dress sizeLabel |
| `src/lib/mockups/mockupTemplates.ts` | V1 template data source | Read-only reference for mask paths and physical dimensions |
| `public/mockups/` | Existing mask images for all 6 V1 templates | Reuse directly — already on disk |

### No new packages required

All work is TypeScript type extension + data authoring inside existing files.

---

## Architecture Patterns

### How the pipeline resolves physical width per zone

Today in `MockupPipeline.ts` line 184, `processZone` always receives `template.physicalSize.width` — the template-level value:

```typescript
// Current (single physical width for all zones)
const zoneResult = processZone(
  patternImage,
  zone,
  width, height,
  template.physicalSize.width,   // ← always the template-level value
  dpi,
  repeatType,
  maskImg,
);
```

After the change, the call site reads the zone's override if present, falling back to the template value:

```typescript
// After change
const zonePhysicalWidth = zone.physicalWidth ?? template.physicalSize.width;
const zoneResult = processZone(
  patternImage,
  zone,
  width, height,
  zonePhysicalWidth,             // ← zone-specific or template fallback
  dpi,
  repeatType,
  maskImg,
);
```

The `processZone` signature itself does not change — only the call site changes.

### Type extension for MockupZone

Add one optional field to `MockupZone`:

```typescript
export interface MockupZone {
  id: string;
  maskPath: string;
  patternArea: { x: number; y: number; width: number; height: number };
  perspective: { topSqueeze: number; bottomSqueeze: number };
  displacement: {
    intensity: number;
    wrinkleFreq: number;
    type: DisplacementType;
  };
  blend: { mode: BlendMode; opacity: number };
  /** Override physical width (inches) for tile scaling in this zone.
   *  Falls back to template.physicalSize.width when absent. */
  physicalWidth?: number;
}
```

### Single-zone V2 template pattern (photo-based)

Every migrated V1 mockup follows this structure. No `zones[]` array — uses top-level fields:

```typescript
'onesie': {
  id: 'onesie',
  name: 'Baby Onesie',
  description: 'See your pattern on baby clothing',
  category: 'apparel',
  canvasSize: { width: 1024, height: 1024 },
  // patternArea from V1 mockupTemplates.ts (pixel bounds)
  patternArea: { x: 0, y: 0, width: 1024, height: 1024 },
  perspective: { topSqueeze: 0, bottomSqueeze: 0 },
  // Photo-based: no procedural displacement
  displacement: { intensity: 0, wrinkleFreq: 0, type: 'flat-surface' },
  blend: { mode: 'multiply', opacity: 0.9 },
  lighting: { enabled: true, intensity: 0.25 },
  physicalSize: { width: 10.5, height: 18, unit: 'in' },
  sizeLabel: '10.5×18" (26.7×45.7cm) Baby Onesie',
  productBase: {
    type: 'image',
    imagePath: '/mockups/onesie.png',
    maskPath: '/mockups/onesie_mask_new.png',
  },
},
```

Key invariants for photo-based templates:
- `perspective: { topSqueeze: 0, bottomSqueeze: 0 }` — photo has natural perspective already
- `displacement: { intensity: 0, wrinkleFreq: 0, type: 'flat-surface' }` — no procedural displacement
- `lighting: { enabled: true, intensity: 0.25 }` — lighting overlay after V1 match confirmed
- `productBase.type: 'image'` — uses the photo, not a procedural gradient

### Kids dress zone update

The two zones need `physicalWidth` values and skirt displacement:

```typescript
zones: [
  {
    id: 'bodice',
    maskPath: '/mockups/v2/tshirt-dress_bodice.png',
    patternArea: { x: 453, y: 421, width: 960, height: 896 },
    perspective: { topSqueeze: 0, bottomSqueeze: 0 },
    displacement: { intensity: 0, wrinkleFreq: 0, type: 'flat-surface' },
    blend: { mode: 'multiply', opacity: 0.85 },
    physicalWidth: 13.5,   // ← new field
  },
  {
    id: 'skirt',
    maskPath: '/mockups/v2/tshirt-dress_skirt.png',
    patternArea: { x: 430, y: 1307, width: 1007, height: 804 },
    perspective: { topSqueeze: 0, bottomSqueeze: 0 },
    displacement: { intensity: 12, wrinkleFreq: 6, type: 'fabric-drape' }, // ← to be tuned
    blend: { mode: 'multiply', opacity: 0.85 },
    physicalWidth: 18,     // ← new field (wider than bodice)
  },
],
```

### Two-pass migration sequence

**Pass 1 — V1 match:** Set `lighting: { enabled: false, intensity: 0 }` initially. Render and confirm tile scale and multiply blend visually matches V1 output. Only after visual match confirmed:

**Pass 2 — V2 enhance:** Set `lighting: { enabled: true, intensity: 0.25 }`. Verify lighting layer looks correct on each photo.

### sizeLabel format

Formula: `{W}×{H}" ({Wcm}×{Hcm}cm) {Product Name}`

| Template | physicalSize (in) | sizeLabel |
|----------|------------------|-----------|
| onesie | 10.5 × 18 | `10.5×18" (26.7×45.7cm) Baby Onesie` |
| fabric-swatch | 12 × 12 | `12×12" (30.5×30.5cm) Fabric Swatch` |
| wallpaper | 86 × 60 | `86×60" (218.4×152.4cm) Wallpaper` |
| throw-pillow | 18 × 18 | `18×18" (45.7×45.7cm) Throw Pillow` |
| wrapping-paper (photo) | 8 × 8 | `8×8" (20.3×20.3cm) Wrapping Paper (Gift Box)` |
| journal | 5.5 × 8.5 | `5.5×8.5" (14×21.6cm) A5 Journal` |
| tshirt-dress | 13.5 × 20.5 | `13.5×20.5" (34×52cm) Kids T-Shirt Dress` |

Centimeter conversion: inches × 2.54, rounded to 1 decimal place.

---

## V1 Asset Inventory (reuse directly)

All mask images are already in `public/mockups/`. No new images to create.

| V1 ID | Photo file | Mask file | Canvas size | patternArea (V1) | Physical (in) |
|-------|-----------|-----------|-------------|-----------------|---------------|
| onesie | `/mockups/onesie.png` | `/mockups/onesie_mask_new.png` | 1024×1024 | 0,0,1024,1024 | 10.5×18 |
| fabric-swatch | `/mockups/fabric_swatch.png` | `/mockups/fabric_swatch_mask.png` | 1024×1024 | 0,0,1024,1024 | 12×12 |
| wallpaper | `/mockups/wallpaper.png` | `/mockups/wallpaper_mask.png` | 1024×1024 | 0,0,1024,1024 | 86×60 |
| throw-pillow | `/mockups/throw_pillow.png` | `/mockups/throw_pillow_mask.png` | 1024×1024 | 0,0,1024,1024 | 18×18 |
| wrapping-paper | `/mockups/wrapping_paper.png` | `/mockups/wrapping_paper_mask.png` | 1024×1024 | 0,0,1024,1024 | 8×8 |
| journal | `/mockups/journal.png` | `/mockups/journal_mask.png` | 1024×1024 | 0,0,1024,1024 | 5.5×8.5 |

Note: V1 wrapping paper also has `wrapping_paper_shadow.png`, `wrapping_paper_highlight.png`, and `wrapping_paper_bow_mask.png` on disk. These are not used in V2 migration — the lighting overlay replaces them.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Physical-to-pixel scaling | Custom unit conversion math | The existing `scaleFactor = patternArea.width / (physicalWidth * dpi)` in `processZone` line 54 — already correct, just needs zone-level `physicalWidth` input |
| Mask-based clipping | Custom polygon clip or CSS mask | Existing `processZone` Stage 4 luminance-to-alpha mask clip — works for all V1 masks |
| Lighting overlay | New compositing logic | `lighting.enabled` + `soft-light` compositing already in `runPipeline` — just set `intensity` |
| Gallery card sizeLabel display | New UI component | Gallery already renders `template.sizeLabel` at line 181 of `MockupGalleryModal.tsx` |
| Category filtering | New filter logic | Gallery already reads `t.category` and filters — just needs correct category on each new template |

---

## Common Pitfalls

### Pitfall 1: physicalWidth field naming mismatch
**What goes wrong:** CONTEXT.md says "physicalSize field" but the existing `MockupV2Template` already has `physicalSize: { width, height, unit }` at template level. The zone-level field needs a distinct name.
**How to avoid:** Name the new zone field `physicalWidth: number` (a scalar, not an object) to avoid confusion with the template-level `physicalSize` object. Document clearly that it overrides only the width dimension for tile scaling.

### Pitfall 2: Zone mask coordinates vs pattern area coordinates
**What goes wrong:** The mask image is full-canvas sized (1024×1024 or 1856×2304). In `processZone` Stage 4, the code extracts `patternArea`-sized crop from the mask at `(patternArea.x, patternArea.y)`. If `patternArea` spans the full canvas (x:0, y:0, w:1024, h:1024 for V1 templates), the mask is used at full size — correct. If a future template has an offset `patternArea`, the crop must still align.
**How to avoid:** For all 6 V1 migrations, `patternArea` is `{x:0, y:0, width:1024, height:1024}` so the mask extraction is trivially correct. Just verify the mask is 1024×1024 (they all are).

### Pitfall 3: Wrapping paper duplicate ID collision
**What goes wrong:** V1 uses ID `'wrapping-paper'`. V2 registry already has `'wrapping-paper-v2'` (procedural). Adding the photo version as `'wrapping-paper'` means two templates coexist: `'wrapping-paper'` (new, photo) and `'wrapping-paper-v2'` (existing, procedural). Gallery shows both — correct per decisions. But `'wrapping-paper-v2'` display name needs the `(Folded)` suffix too.
**How to avoid:** When adding the photo migration, also update `'wrapping-paper-v2'`'s `name` field to `'Wrapping Paper (Flat Sheet)'` or similar to disambiguate in the gallery.

### Pitfall 4: Existing V2 procedural templates missing sizeLabels
**What goes wrong:** MOCK-03 requires ALL templates to have sizeLabels. The existing procedural templates in `templateRegistry.ts` (womens-skirt, tablecloth, curtain, blanket, nursery-wall, etc.) have no `sizeLabel`.
**How to avoid:** Add `sizeLabel` to all existing V2 templates in the same task as adding it to migrated ones. Use the same format formula.

### Pitfall 5: tshirt-dress `physicalSize.width` still drives single-zone fallback
**What goes wrong:** After adding zone-level `physicalWidth`, the top-level `template.physicalSize.width` (13.5) is still used by the single-zone code path and for the sizeLabel. This is correct — the template's nominal physical size stays 13.5×20.5. Only `processZone` call sites change.
**How to avoid:** Do not change `template.physicalSize` — only add `physicalWidth` to the zones and update the multi-zone call site in `runPipeline`.

### Pitfall 6: Canvas size mismatch for image-based templates
**What goes wrong:** All V1 mockups use 1024×1024 images. The V2 template's `canvasSize` must match the actual image dimensions, otherwise the `productCtx.drawImage(input.productBaseImage, 0, 0, width, height)` will stretch or shrink the photo.
**How to avoid:** Set `canvasSize: { width: 1024, height: 1024 }` for all 6 V1 migrations. The tshirt-dress uses 1856×2304 — this is already correct in the registry.

---

## Code Examples

### Tile scale calculation (from MockupPipeline.ts line 54)
```typescript
// Source: src/lib/mockups/mockupEngineV2/MockupPipeline.ts
const scaleFactor = patternArea.width / (physicalWidth * dpi);
const scaledW = Math.round(srcW * scaleFactor) || 1;
const scaledH = Math.round(srcH * scaleFactor) || 1;
```

With `patternArea.width = 960` (bodice), `physicalWidth = 13.5`, `dpi = 150`:
- `scaleFactor = 960 / (13.5 × 150) = 960 / 2025 = 0.474`

With `patternArea.width = 1007` (skirt), `physicalWidth = 18`, `dpi = 150`:
- `scaleFactor = 1007 / (18 × 150) = 1007 / 2700 = 0.373`

The skirt tiles are smaller (0.373 vs 0.474 relative scale) because the skirt is physically wider — tiles appear larger in physical space, meaning fewer fit per row.

### Gallery card sizeLabel rendering (from MockupGalleryModal.tsx line 180)
```typescript
// Source: src/components/mockups/MockupGalleryModal.tsx
<span className="block text-[10px] text-gray-400">
  {template.sizeLabel || `${template.physicalSize.width}×${template.physicalSize.height}"`}
</span>
```

The fallback `template.physicalSize.width×height"` fires when `sizeLabel` is absent. After this phase all templates will have `sizeLabel` set, so the fallback is dead code.

### Mask luminance-to-alpha clip (from MockupPipeline.ts lines 114-123)
```typescript
// Source: src/lib/mockups/mockupEngineV2/MockupPipeline.ts
for (let i = 0; i < md.length; i += 4) {
  const luminance = md[i] * 0.299 + md[i + 1] * 0.587 + md[i + 2] * 0.114;
  md[i] = 255; md[i + 1] = 255; md[i + 2] = 255;
  md[i + 3] = Math.round(luminance); // white=opaque, black=transparent
}
```

All V1 masks are white-on-black PNGs — this algorithm is correct for them.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None installed — no vitest/jest config found in project root |
| Config file | None — Wave 0 must create |
| Quick run command | `npx vitest run --reporter=verbose` (after Wave 0 setup) |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MOCK-01 | All 6 V1 IDs present in `getAllV2Templates()` result | unit | `npx vitest run src/__tests__/templateRegistry.test.ts` | ❌ Wave 0 |
| MOCK-01 | Each migrated template has `productBase.type === 'image'` | unit | same file | ❌ Wave 0 |
| MOCK-02 | tshirt-dress bodice zone has `physicalWidth: 13.5` | unit | `npx vitest run src/__tests__/templateRegistry.test.ts` | ❌ Wave 0 |
| MOCK-02 | tshirt-dress skirt zone has `physicalWidth: 18` | unit | same file | ❌ Wave 0 |
| MOCK-02 | `processZone` called with zone `physicalWidth` when set (pipeline logic) | unit | `npx vitest run src/__tests__/MockupPipeline.test.ts` | ❌ Wave 0 |
| MOCK-03 | All V2 templates have non-empty `sizeLabel` string | unit | `npx vitest run src/__tests__/templateRegistry.test.ts` | ❌ Wave 0 |
| MOCK-03 | sizeLabel format matches `WxH" (Wcm×Hcm) Name` pattern | unit | same file | ❌ Wave 0 |

Note: `MockupPipeline.ts` and `runPipeline` use `HTMLCanvasElement` and `HTMLImageElement` which are browser APIs. Pipeline unit tests require jsdom environment config. Template registry tests are pure data — no DOM needed.

### Sampling Rate
- **Per task commit:** `npx vitest run src/__tests__/templateRegistry.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/templateRegistry.test.ts` — covers MOCK-01, MOCK-02 (zone fields), MOCK-03
- [ ] `src/__tests__/MockupPipeline.test.ts` — covers MOCK-02 (pipeline physicalWidth threading); requires jsdom
- [ ] `vitest.config.ts` — root config with jsdom environment for pipeline tests
- [ ] `package.json` test script — add `"test": "vitest run"`
- [ ] Install: `npm install --save-dev vitest @vitest/browser jsdom`

---

## Open Questions

1. **Wrapping paper photo patternArea — full canvas or masked?**
   - What we know: V1 `patternArea` is `{x:0, y:0, width:1024, height:1024}` and a `wrapping_paper_mask.png` exists. The mask appears to cover the visible gift box surface (not full canvas).
   - What's unclear: Whether the mask is a tight crop of the box faces or looser. Needs pixel inspection at authoring time.
   - Recommendation: Claude's discretion — evaluate mask bounds when authoring the template. If mask tightly bounds the box, use mask + full-canvas patternArea. If mask is loose, scan white-pixel bounds to set a tighter patternArea.

2. **Wallpaper patternArea — wall region vs full canvas?**
   - What we know: V1 uses full canvas `{x:0, y:0, width:1024, height:1024}` and `wallpaper_mask.png` isolates the wall.
   - What's unclear: Whether the mask is useful for V2 (pattern should tile the full wall, not just a cropped region).
   - Recommendation: Use `maskPath` for clean edges, keep patternArea at full canvas. The mask prevents pattern bleed onto non-wall areas.

3. **Displacement intensity for skirt zone**
   - What we know: `fabric-drape` displacement at intensity=12, freq=6 is used on `womens-skirt` and looks reasonable. Kids dress skirt is an A-line with fewer folds.
   - What's unclear: Exact intensity value for kids dress A-line silhouette.
   - Recommendation: Start at `intensity: 8, wrinkleFreq: 5` (lower than womens-skirt) and tune visually during implementation. This is Claude's discretion.

---

## Sources

### Primary (HIGH confidence)
- Direct code read — `src/lib/mockups/mockupEngineV2/MockupPipeline.ts` — full pipeline logic, processZone signature, physicalWidth usage
- Direct code read — `src/lib/mockups/mockupEngineV2/templates/types.ts` — MockupZone and MockupV2Template interfaces
- Direct code read — `src/lib/mockups/mockupEngineV2/templates/templateRegistry.ts` — all existing V2 templates
- Direct code read — `src/lib/mockups/mockupTemplates.ts` — V1 template data (masks, patternAreas, physical dimensions)
- Direct file list — `public/mockups/` — confirmed all V1 mask files exist on disk
- Direct code read — `src/components/mockups/MockupGalleryModal.tsx` — confirmed sizeLabel display path

### Secondary (MEDIUM confidence)
- `package.json` — confirmed no test framework installed (no vitest/jest in devDependencies)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all files read directly from source
- Architecture: HIGH — processZone signature and zone iteration code read directly
- Pitfalls: HIGH — derived from direct reading of pipeline code, not guesswork
- Test gaps: HIGH — confirmed by absence of test files and no vitest in package.json

**Research date:** 2026-03-22
**Valid until:** Stable — pure internal refactor, no external dependencies
