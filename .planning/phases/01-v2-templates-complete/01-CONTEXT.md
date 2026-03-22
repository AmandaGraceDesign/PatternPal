# Phase 1: V2 Templates Complete - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Every mockup template renders through the V2 pipeline with physically accurate tile scaling. This includes finishing the kids tshirt-dress per-zone sizing, migrating all 6 V1 mockups as single-zone V2 templates, and adding sizeLabels to every template. No new mockup templates — focus on migrating and perfecting existing ones.

</domain>

<decisions>
## Implementation Decisions

### Kids Dress Tile Scaling
- Physically accurate per-zone tile scaling: bodice uses ~13.5" physical width, skirt uses ~18" physical width
- Tiles will appear at different physical sizes per zone — this is intentional and matches real garment behavior
- Skirt zone gets fabric-drape displacement for realism; bodice stays flat (displacement=0) since photo already shows it fitted
- Zone `MockupZone` type will need a `physicalSize` field to support per-zone widths

### Migration Visual Fidelity
- Two-pass migration: first match V1 output exactly, then enhance with V2 lighting overlay
- Lighting overlay added to all migrated photo-based mockups after verifying V1 match
- Blend tuning and other V2 features not in scope for enhancement pass — just lighting

### sizeLabel Content
- Format: "Product + dimensions" with inches and centimeters — e.g., `16×16" (40×40cm) Throw Pillow`
- Kids dress label updated from "Size 5 Kids (13.5×20.5")" to match new format: `13.5×20.5" (34×52cm) Kids T-Shirt Dress`
- All templates (migrated V1s, kids dress, existing V2 procedural) get sizeLabels in this format

### Template Naming
- Migrated V1 templates keep original IDs in V2 registry: 'onesie', 'fabric-swatch', 'wallpaper', 'throw-pillow', 'wrapping-paper', 'journal'
- Both photo-based and procedural versions coexist — wrapping paper gets both variants
- Duplicate products use descriptive display name suffixes (e.g., "Wrapping Paper (Flat Sheet)" vs "Wrapping Paper (Folded)")
- V1 category assignments map to V2 categories: onesie→apparel, fabric-swatch→fabric, wallpaper→wallpaper, throw-pillow→home-goods, wrapping-paper→gifting, journal→stationery

### Claude's Discretion
- Skirt displacement intensity and wrinkle frequency values
- Seam treatment between bodice and skirt zones (overlap blend vs feathered edge)
- Whether each V1 template uses mask-based or coordinate-based pattern areas (evaluate per template)
- Descriptive suffix wording for duplicate product display names

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `MockupV2Template` type ([templates/types.ts](src/lib/mockups/mockupEngineV2/templates/types.ts)): already supports `productBase: { type: 'image' }` for photo-based mockups
- `MockupZone` interface: has per-zone mask, patternArea, perspective, displacement, blend — needs `physicalSize` added
- `templateRegistry.ts`: central registry with category helpers (`getV2TemplatesByCategory`, `getAllV2Categories`)
- `MockupPipeline.ts`: V2 rendering pipeline with stage architecture
- V1 `mockupTemplates.ts`: has all 6 templates with physical dimensions, mask paths, and pattern areas already defined

### Established Patterns
- Photo-based mockups use `perspective=0, displacement=0` (photo has natural perspective) — already decided
- Mask pixel bounds scanned with tools, not guessed — 10px overlap at seam boundaries
- Single-zone templates use top-level fields; multi-zone uses `zones[]` array
- Categories are typed as `MockupV2Category` union type

### Integration Points
- `templateRegistry.ts` is the single source of truth for all V2 templates
- `MockupV2Category` type needs no changes — all V1 categories map to existing V2 categories
- Gallery already reads from `getAllV2Templates()` and `getV2TemplatesByCategory()`
- Social export (Phase 3) will consume whatever templates exist in the V2 registry

</code_context>

<specifics>
## Specific Ideas

- User wants multiple versions of products (e.g., multiple wrapping paper mockups) — photo + procedural variants add variety for designers
- Displacement on the kids dress skirt should feel like real A-line fabric drape
- sizeLabel format should help designers know exact print dimensions at a glance, including metric conversion

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-v2-templates-complete*
*Context gathered: 2026-03-22*
