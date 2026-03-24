# Phase 2: Gallery Redesign - Research

**Researched:** 2026-03-24
**Domain:** React UI / Tailwind CSS modal redesign (presentation layer only)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Horizontal tab bar across the top of the modal, below the header
- "All" tab included as first option
- No count badges on tabs — keep labels clean
- 8 tabs total: All, Apparel, Home Goods, Fabric, Wallpaper, Gifting, Stationery, Accessories
- Tabs scroll horizontally on mobile if they overflow
- Keep amber accent color on active states (`#d97706` active, `#fbbf24` default)
- Keep dark header `#3a3d44` as app visual language
- "20+ mockups coming May 2026" teaser text at the bottom — keep it

### Claude's Discretion
- Tab visual style (underline vs pill/chip — pick whichever looks best with the dark `#3a3d44` header)
- Card design and info density (thumbnail size, hover states, label placement)
- Modal size and layout (column count, spacing, max-width)
- Mobile adaptations (column count, touch target sizing, scroll behavior)
- Empty state if a category has 0 matching templates

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GALL-01 | Mockups organized by category tabs (apparel, home decor, stationery, etc.) | Tab state already scaffolded in current component; `getV2TemplatesByCategory()` and `getAllV2Categories()` exist in registry |
| GALL-02 | Thumbnail cards show user's actual pattern applied to mockup (live preview) | `MockupRendererV2` already accepts all required props and renders live to canvas; just needs correct card layout |
| GALL-03 | Cards display sizeLabel and physical dimensions clearly | Every template has `sizeLabel` (MOCK-03 complete); label just needs readable styling on the card |
| GALL-04 | Gallery works on iPad and phone — 44px touch targets, responsive layout, no horizontal scroll | Requires Tailwind responsive grid, min touch target on cards, and `overflow-x-auto` tab strip with `scrollbar-hide` |
</phase_requirements>

---

## Summary

Phase 2 is a **pure presentation layer rewrite** of `MockupGalleryModal.tsx`. The mockup engine, template registry, and rendering pipeline are already complete from Phase 1 — nothing below the gallery component needs to change. The current file already has the right architectural skeleton (category state, `getAllV2Templates()`, `MockupRendererV2` per card, `sizeLabel` display) but lacks polish: the tab strip visual style is raw amber pills that clash with the dark header, cards have no hover state, the size label is tiny gray text, and the grid does not adapt to small screens.

The core engineering challenge is **performance**: 18 cards each running a full canvas render pipeline simultaneously is heavy. The current implementation starts all renders at mount. A staggered or intersection-observer-gated approach prevents frame drops on mobile. The secondary challenge is **mobile UX**: the tab strip must overflow-scroll without showing scrollbars, touch targets on cards must reach 44px minimum height (Apple HIG / WCAG), and the grid must collapse to 2 columns on narrow screens.

The pro-gate (`UpgradeModal`) is currently commented out for testing and must be re-enabled in this phase. The callback wiring (`onSelectMockup`, `image`, `tileWidth`, `tileHeight`, `dpi`, `repeatType`) is already correct in both `ActionsSidebar` and `AdvancedToolsBar` callers.

**Primary recommendation:** Rewrite `MockupGalleryModal.tsx` in place. Do not create a new file — callers import by path. Keep the same props interface. Add staggered render initiation (e.g., 50ms between cards or IntersectionObserver) to prevent simultaneous canvas floods.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2 | Component model, state | Already in project |
| Tailwind CSS | v4 | Utility-first styling, responsive breakpoints | Already in project, all existing UI uses it |
| TypeScript | 5 | Type safety | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `clsx` / `tailwind-merge` | ^2 / ^3 | Conditional class composition | Both already in project deps; use for active tab class toggling |

### No New Dependencies Required
This phase requires zero new npm packages. Everything needed is already installed.

---

## Architecture Patterns

### Component Structure
The rewrite is a single-file replacement of `MockupGalleryModal.tsx`. No new files need to be created.

```
src/components/mockups/
├── MockupGalleryModal.tsx   ← REWRITE THIS (presentation layer only)
└── MockupRendererV2.tsx     ← DO NOT TOUCH
```

### Pattern 1: Tab Navigation with Overflow Scroll
**What:** A horizontal `div` with `overflow-x-auto` wrapping tab buttons. On desktop all tabs are visible; on mobile the row scrolls left/right.
**When to use:** Always — locked decision.
**Key classes:**
```tsx
// Outer container — scrolls on overflow, hides scrollbar visually
<div className="flex gap-1.5 px-4 py-2 bg-[#3a3d44] overflow-x-auto scrollbar-hide">

// Tab button — 44px min height for GALL-04 touch target compliance
<button
  className={`px-3 py-1 min-h-[44px] rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors
    ${isActive
      ? 'bg-[#d97706] text-white shadow-[0_2px_8px_rgba(217,119,6,0.45)]'
      : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
    }`}
>
```

Note: Tailwind v4 does not include `scrollbar-hide` by default. Use inline CSS `scrollbarWidth: 'none'` + `::-webkit-scrollbar { display: none }` OR add it via a global CSS rule. Check project globals before deciding.

### Pattern 2: Responsive Gallery Grid
**What:** CSS Grid that goes 2 columns on mobile, 3 on sm+.
**Key classes:**
```tsx
<div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4">
```
The existing implementation already does this. Keep it.

### Pattern 3: Gallery Card with Readable Labels
**What:** Card wraps `MockupRendererV2` canvas + two text lines below. Name in base font, sizeLabel in amber to make it visually distinct and readable.
```tsx
<div
  className="group cursor-pointer rounded-xl overflow-hidden transition-transform hover:scale-[1.02] active:scale-[0.98]"
  onClick={() => onSelectMockup(template.id)}
>
  <MockupRendererV2 ... />
  <div className="px-2 py-1.5 bg-white">
    <p className="text-xs font-semibold text-[#294051] truncate">{template.name}</p>
    <p className="text-[10px] text-[#d97706] font-medium truncate">
      {template.sizeLabel}
    </p>
  </div>
</div>
```
Using amber (`#d97706`) for the sizeLabel makes it pop against white without requiring a separate "PRO" badge color.

### Pattern 4: Staggered Render Initiation (Performance)
**What:** Prevent all 18 canvas renders from starting simultaneously on modal open.
**Why it matters:** `runPipeline()` is CPU-intensive (tiling + displacement + compositing). 18 simultaneous calls on a mobile CPU causes visible jank.
**Approach:** Wrap card render in a state that gates whether `MockupRendererV2` receives a real `patternImage` or `null`. Stagger by index * delay, OR use `IntersectionObserver` in `MockupRendererV2` to defer off-screen renders.

The simplest approach that requires no changes to `MockupRendererV2`: pass `patternImage={null}` initially for each card, then use a `useEffect` with staggered `setTimeout` to flip each card's image prop to the real image.

```tsx
// In MockupGalleryModal
const [visibleCount, setVisibleCount] = useState(0);

useEffect(() => {
  if (!isOpen) { setVisibleCount(0); return; }
  // Reveal cards in batches of 3, every 80ms
  const timers = templates.map((_, i) =>
    setTimeout(() => setVisibleCount(c => Math.max(c, i + 1)), Math.floor(i / 3) * 80)
  );
  return () => timers.forEach(clearTimeout);
}, [isOpen, templates]);

// In render:
patternImage={index < visibleCount ? image : null}
```

### Pattern 5: Empty State (Future-Proof)
**What:** If a filtered category returns 0 templates, show a simple message rather than an empty grid.
```tsx
{filtered.length === 0 && (
  <p className="col-span-full text-center text-sm text-gray-400 py-8">
    No mockups in this category yet.
  </p>
)}
```

### Pattern 6: Pro Gate Re-enabling
The `UpgradeModal` block is commented out. It must be re-enabled:
```tsx
if (!isPro) {
  return <UpgradeModal isOpen onClose={onClose} />;
}
```
This renders BEFORE the gallery grid, so non-pro users never see the modal content.

### Anti-Patterns to Avoid
- **Immediate full render on open:** Starting all 18 `MockupRendererV2` renders simultaneously stalls the main thread. Always stagger.
- **Removing `onClick={(e) => e.stopPropagation()}` from inner div:** The backdrop click handler on the outer div will fire and close the modal.
- **Changing the props interface:** Both `ActionsSidebar` and `AdvancedToolsBar` pass `zoom` and `scaleFactor` props that are not currently used inside the modal — they are legacy passthrough. Leave the interface intact to avoid caller changes.
- **Using `scrollbar-hide` from Tailwind v3 docs:** Tailwind v4 handles this differently. Use explicit CSS or verify the project's tailwind setup first.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Conditional class strings | Manual string concatenation | `clsx` (already imported in project) | Edge cases with undefined/falsy values |
| Category filtering | Custom filter logic | `t.category === activeCategory` (already works) | Registry structure already supports it |
| Live pattern thumbnails | Custom canvas drawing | `MockupRendererV2` | It already handles async loading, cancellation, and the full pipeline |
| Responsive breakpoints | JS resize listeners | Tailwind `sm:` prefix | CSS-native, no JS overhead |

---

## Common Pitfalls

### Pitfall 1: Modal Height Calculation with Dynamic Tab Bar
**What goes wrong:** The scrollable content area uses `calc(85vh - 96px)`. If the tab bar height changes (e.g., wraps to two lines on some viewports before overflow-scroll kicks in), the content overflows.
**Why it happens:** Hardcoded pixel offset doesn't account for dynamic header height.
**How to avoid:** Use CSS flexbox for the modal layout — make the content area `flex-1 overflow-y-auto` rather than using `calc()`. The flex container naturally fills remaining height.
**Warning signs:** Content clipped at the bottom on narrow screens.

### Pitfall 2: Touch Target Size on Gallery Cards
**What goes wrong:** Small cards (2-column grid on mobile ~160px wide) with a canvas thumbnail have no explicit minimum height — the tap area is just the rendered canvas height, which can be very small for portrait-oriented mockups.
**How to avoid:** The card wrapper `div` does not need a min-height because clicking anywhere on the card (including the label area below) triggers `onSelectMockup`. Ensure `onClick` is on the outer wrapper, not just the canvas.
**Warning signs:** GALL-04 fails if users report needing to tap very precisely.

### Pitfall 3: Category Key Mismatch
**What goes wrong:** The tab key `'home-goods'` must match exactly the `category` value in the template registry (`MockupV2Category` type). If the display label mapping uses a different key, filtering silently returns 0 results.
**How to avoid:** Drive the displayed category list from the same string values in the type definition — do NOT use different display keys. The `categoryLabels` map already handles the display string separately.
**Warning signs:** "Home Goods" tab shows 0 mockups.

### Pitfall 4: Canvas Aspect Ratio in Grid
**What goes wrong:** Different templates have different canvas aspect ratios (1:1 square for onesie, 5:9 portrait for phone case, 2:1 landscape for desk mat). A uniform grid creates jarring height variations between cards.
**How to avoid:** `MockupRendererV2` renders a `<canvas>` with `className="w-full"` and no fixed height — the canvas height is set by the rendered `resultCanvas.width/height`. This means cards naturally vary in height. Use CSS Grid (no `items-stretch`) so each card takes its natural height. Alternatively, add a fixed-aspect wrapper:
```tsx
<div className="aspect-square overflow-hidden rounded-t-lg bg-gray-100">
  <MockupRendererV2 ... />
</div>
```
But this crops landscape templates. The current approach (variable height) is more honest. Accept variable card heights or use `aspect-square` with `object-contain` semantics.

### Pitfall 5: Stale Pattern Image on Re-open
**What goes wrong:** If a user opens the gallery, changes their pattern, and re-opens, the stagger timer `useEffect` may not re-fire if dependencies aren't tuned correctly.
**How to avoid:** Include `image` in the `useEffect` dependency array alongside `isOpen`. When `image` changes, reset `visibleCount` to 0 and re-stagger.

---

## Code Examples

### Category Tab Strip (Pill Style on Dark Header)
```tsx
// Pill style with amber active — works best against #3a3d44
const tabClasses = (cat: string) =>
  cat === activeCategory
    ? 'bg-[#d97706] text-white shadow-[0_2px_8px_rgba(217,119,6,0.4)]'
    : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white';

<div
  className="flex gap-1.5 px-4 py-2 bg-[#3a3d44] border-b border-white/10"
  style={{ overflowX: 'auto', scrollbarWidth: 'none' }}
>
  {categories.map(cat => (
    <button
      key={cat}
      onClick={() => setActiveCategory(cat)}
      className={`px-3 py-1 min-h-[44px] rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors ${tabClasses(cat)}`}
    >
      {categoryLabels[cat]}
    </button>
  ))}
</div>
```

### Flex-Based Modal Layout (No Calc)
```tsx
<div className="relative w-[calc(100vw-32px)] max-w-2xl max-h-[85vh] bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col">
  {/* Header — fixed height */}
  <div className="flex-none flex items-center justify-between px-4 py-3 bg-[#3a3d44]">...</div>
  {/* Tabs — fixed height */}
  <div className="flex-none ...">...</div>
  {/* Scrollable content — fills remainder */}
  <div className="flex-1 overflow-y-auto p-4">...</div>
</div>
```

### Staggered Render Gate
```tsx
const [revealedCount, setRevealedCount] = useState(0);

useEffect(() => {
  if (!isOpen || !image) { setRevealedCount(0); return; }
  const timers = filtered.map((_, i) =>
    window.setTimeout(() => setRevealedCount(c => Math.max(c, i + 1)), Math.floor(i / 3) * 80)
  );
  return () => timers.forEach(window.clearTimeout);
}, [isOpen, image, activeCategory]);
// Reset count on category change so switching tabs re-staggers
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| V1/V2 split tab | Single unified category tab set | Phase 2 (this phase) | All templates browsable by product type, not engine version |
| `calc(85vh - Npx)` scroll area | `flex-1 overflow-y-auto` | Phase 2 (this phase) | Robust to dynamic header sizes |
| All renders fire simultaneously | Staggered render initiation | Phase 2 (this phase) | Prevents mobile jank |

**Deprecated/outdated:**
- V2/V1 split tab navigation: replaced by category-based tabs
- Pro gate commented out: must be re-enabled in this phase

---

## Open Questions

1. **`scrollbar-hide` availability in Tailwind v4**
   - What we know: `scrollbar-hide` was a popular Tailwind v3 plugin (`tailwind-scrollbar-hide`). Tailwind v4 has a different plugin system.
   - What's unclear: Whether the project has any scrollbar utilities configured.
   - Recommendation: Use inline `style={{ scrollbarWidth: 'none' }}` + `WebkitScrollbar` rule in globals. This is standards-based and requires no plugin.

2. **`aspect-square` wrapper vs variable card heights**
   - What we know: Templates vary from 1:1 (onesie, pillow) to 2:1 landscape (desk mat) to 1:2 portrait (phone case, curtain).
   - What's unclear: User preference — forced square crops vs honest aspect ratios.
   - Recommendation: Default to `aspect-square overflow-hidden` wrapper for visual consistency in the grid; the canvas `w-full` inside will letterbox naturally since canvas preserves its own pixel ratio. This is discretion territory (CONTEXT.md).

---

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json` — section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1 |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npm test` (runs `vitest run`) |
| Full suite command | `npm test` |

**Note:** Vitest is configured with `environment: 'jsdom'` and includes only `src/__tests__/**/*.test.ts`. The gallery rewrite is a React component with canvas rendering — standard unit tests cannot drive a real browser canvas. Phase 2 test coverage is limited to pure logic assertions (category filtering, template data shape). Visual/render correctness is manual-only.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GALL-01 | Category filter returns correct templates per tab | unit | `npm test -- --reporter=verbose` | ❌ Wave 0 |
| GALL-02 | `MockupRendererV2` receives correct props (live pattern) | manual-only | N/A — canvas rendering requires browser | N/A |
| GALL-03 | Every template has non-empty `sizeLabel` | unit (already covered) | `npm test` — `templateRegistry.test.ts` MOCK-03 | ✅ |
| GALL-04 | Touch targets 44px+, responsive layout | manual-only | N/A — requires device/browser | N/A |

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green + manual browser check on iPhone viewport before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/galleryModal.test.ts` — covers GALL-01: category filtering logic (pure function, no DOM needed)
  - Test: given a category key, `getAllV2Templates().filter(t => t.category === key)` returns expected template IDs
  - Test: "All" tab (`activeCategory === 'all'`) returns all 18 templates
  - Test: switching category resets `revealedCount` (if extracted to pure function)

*(GALL-02 and GALL-04 are manual-only due to canvas/browser rendering requirements — no framework gaps to fill)*

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection: `src/components/mockups/MockupGalleryModal.tsx` — current implementation and props interface
- Direct code inspection: `src/lib/mockups/mockupEngineV2/templates/templateRegistry.ts` — all 18 templates, category values
- Direct code inspection: `src/lib/mockups/mockupEngineV2/templates/types.ts` — `MockupV2Category` type definition
- Direct code inspection: `src/components/mockups/MockupRendererV2.tsx` — render props and cancellation pattern
- Direct code inspection: `src/components/sidebar/ActionsSidebar.tsx` — caller props passed to gallery
- Direct code inspection: `vitest.config.ts` — test environment and include pattern

### Secondary (MEDIUM confidence)
- `.planning/phases/02-gallery-redesign/02-CONTEXT.md` — locked decisions and visual language requirements
- `.planning/REQUIREMENTS.md` — GALL-01 through GALL-04 requirement definitions

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from package.json and existing component code
- Architecture: HIGH — based on reading actual current component; patterns are concrete changes from known baseline
- Pitfalls: HIGH — derived from reading the actual code and identifying real gaps (calc height, render flooding, key mismatch)
- Test coverage: HIGH — vitest config and existing test files read directly

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable domain — React + Tailwind + canvas; no fast-moving dependencies)
