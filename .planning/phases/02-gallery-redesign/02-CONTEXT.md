# Phase 2: Gallery Redesign - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Rebuild MockupGalleryModal with category-based navigation, live pattern previews on thumbnails, clear size/dimension display, and mobile-friendly UX. No new templates or mockup engine changes — purely presentation layer.

</domain>

<decisions>
## Implementation Decisions

### Category navigation
- Horizontal tab bar across the top of the modal, below the header
- "All" tab included as first option — users can browse everything or filter by category
- No count badges on tabs — keep labels clean (only 18 templates, counts add noise)
- 8 tabs total: All, Apparel, Home Goods, Fabric, Wallpaper, Gifting, Stationery, Accessories
- Tabs scroll horizontally on mobile if they overflow

### Claude's Discretion
- Tab visual style (underline vs pill/chip — pick whichever looks best with the dark `#3a3d44` header)
- Card design and info density (thumbnail size, hover states, label placement)
- Modal size and layout (column count, spacing, max-width)
- Mobile adaptations (column count, touch target sizing, scroll behavior)
- Empty state if a category has 0 matching templates (unlikely now but future-proof)

</decisions>

<specifics>
## Specific Ideas

- User was happy with the current yellow/amber accent color on active states — keep amber as the accent
- Current dark header (`#3a3d44`) should be preserved as part of the app's visual language
- "20+ mockups coming May 2026" teaser text at the bottom is intentional — keep it

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `MockupRendererV2` component: already renders live pattern previews in gallery cards
- `getAllV2Templates()` / `getV2TemplatesByCategory()`: registry functions for filtering
- `getAllV2Categories()`: returns unique category list from registry
- Template `sizeLabel` field: human-readable dimensions already on every template

### Established Patterns
- Modal pattern: fixed overlay with `bg-black/50`, centered card with `rounded-xl shadow-2xl`
- Dark header bar (`#3a3d44`) with white text — consistent across modals
- Amber accent (`#d97706` active, `#fbbf24` default) — app-wide highlight color
- Escape key closes modal — already implemented

### Integration Points
- `onSelectMockup(template.id)` callback — gallery cards trigger mockup selection
- Props from parent: `image`, `tileWidth`, `tileHeight`, `dpi`, `repeatType` for live rendering
- Pro gate via `UpgradeModal` — currently commented out for testing, needs re-enabling
- `ActionsSidebar` and `AdvancedToolsBar` both open the gallery modal

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-gallery-redesign*
*Context gathered: 2026-03-24*
