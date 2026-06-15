# Mockup Modal Two-Pane Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-column mockup export modal with a two-pane layout (preview pinned beside its controls) so nothing scrolls on a laptop, and consolidate the duplicated modal body into one shared component.

**Architecture:** Extract the modal body (currently duplicated in `AdvancedToolsBar.tsx` and `ActionsSidebar.tsx`) into one presentational `MockupModalBody` component that receives all state + setters via a typed props object. State stays in the hosts. Extraction happens **first with layout unchanged** (verify parity), then the two-pane responsive layout is applied once inside the shared component. Breakpoint: two panes ≥880px, stacked preview-on-top below.

**Tech Stack:** React 19 / Next.js 16, TypeScript, Tailwind CSS, Pointer Events (iPad/Pencil), vitest + tsc as the gate.

**Spec:** `docs/superpowers/specs/2026-06-15-mockup-modal-two-pane-design.md`

---

## Important context for the implementer

- This branch (`feat/mockup-social-exports`) carries a just-shipped live-preview + crop + perf stack. **Do not regress it.** The crop slider, drag-to-move, size-grid snapshot, and full-res download must keep working.
- There are **no unit tests** for this UI; layout is verified by `tsc`, `vitest run` (must stay green at baseline 80/80), and manual UAT. The "test" steps below are the gate commands + explicit manual checks, not new vitest specs (writing a jsdom layout test for canvas/Pointer-Events here would be low-value and brittle — YAGNI).
- The two hosts differ today: **AdvancedToolsBar** has a Scale control and a single combined controls bar (shadow/highlight interleaved, short labels like "Accent"); **ActionsSidebar** has no Scale, a separate pink color row, and longer labels ("Accent Color"). The consolidated body standardizes on the AdvancedToolsBar-style unified bar with a conditional Scale field. ActionsSidebar's controls intentionally change to match — that is expected, not a regression.
- Gate commands (run from repo root):
  - `npx tsc --noEmit` → expect 0 errors
  - `npx vitest run` → expect all green (baseline 80/80)

---

## File Structure

- **Create:** `src/components/mockups/MockupModalBody.tsx` — shared presentational modal body. One responsibility: lay out + render the controls bar, Logo Overlay, badge, download grid, and preview+crop stage, responsively. No business logic.
- **Modify:** `src/components/layout/AdvancedToolsBar.tsx` — replace inline body (lines 620–913) with `<MockupModalBody {...} />`; pass scale props.
- **Modify:** `src/components/sidebar/ActionsSidebar.tsx` — replace inline body (lines 503–759) with `<MockupModalBody {...} />`; omit scale props.

---

## Task 1: Define the shared props interface + scaffold MockupModalBody

**Files:**
- Create: `src/components/mockups/MockupModalBody.tsx`

- [ ] **Step 1: Create the file with the props interface and imports**

Read `src/components/layout/AdvancedToolsBar.tsx` lines 1–60 and 606–914 first to copy exact import sources and prop value shapes. Then create:

```tsx
'use client';

import React from 'react';
import MockupRendererV2 from '@/components/mockups/MockupRendererV2';
import MockupCropStage from '@/components/mockups/MockupCropStage';
import MockupDownloadMenu from '@/components/mockups/MockupDownloadMenu';
import WatermarkPanel from '@/components/watermark/WatermarkPanel';
import PatternpalBadgeToggle from '@/components/badge/PatternpalBadgeToggle';
import type { SocialSizePreset } from '@/lib/export/socialSizes';
import type { MockupTemplateV2 } from '@/lib/mockups/types'; // adjust to the actual type export used by getV2Template
import type { WatermarkConfig } from '@/components/watermark/WatermarkPanel'; // adjust to actual exported type

export interface MockupModalBodyProps {
  // template + source
  v2Template: MockupTemplateV2 | null | undefined;
  selectedMockup: string;
  image: HTMLImageElement | null;

  // scale (AdvancedToolsBar only — omit to hide the Scale field)
  scale?: {
    effectiveTileWidth: number;
    tileWidth: number;
    mockupScaleOverride: number | null;
    setMockupScaleOverride: (n: number | null) => void;
  };

  // color overlay
  showColor: boolean;
  overlayLabel: string;
  canToggleOverlay: boolean;
  colorOverlayEnabled: boolean;
  setColorOverlayEnabled: (b: boolean) => void;
  mockupColorOverride: string | null;
  setMockupColorOverride: (c: string | null) => void;
  scheduleColorUpdate: (c: string) => void;
  effectiveAutoColor: string;

  // shadow / highlight (index 0 = primary, 1+ = additional layers)
  hasShadow: boolean;
  hasHighlight: boolean;
  shadowLabels: string[];
  highlightLabels: string[];
  shadowEnableds: boolean[];
  shadowOpacityPercents: number[];
  highlightEnableds: boolean[];
  highlightOpacityPercents: number[];
  setShadowEnableds: React.Dispatch<React.SetStateAction<boolean[]>>;
  setShadowOpacityPercents: React.Dispatch<React.SetStateAction<number[]>>;
  setHighlightEnableds: React.Dispatch<React.SetStateAction<boolean[]>>;
  setHighlightOpacityPercents: React.Dispatch<React.SetStateAction<number[]>>;

  // watermark + badge
  isPro: boolean;
  watermark: WatermarkConfig;
  setWatermark: (w: WatermarkConfig) => void;
  badgeEnabled: boolean;
  setBadgeEnabled: (b: boolean) => void;

  // download menu
  socialSizes: Record<string, boolean>;
  onToggleSize: (slug: string) => void;
  socialOffsets: Record<string, number>;
  setSocialOffsets: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  activeSlug: string;
  setActiveSlug: (slug: string) => void;
  snapshotUrl: string | null;
  isLocked: (preset: SocialSizePreset) => boolean;
  onLockedClick: (preset: SocialSizePreset) => void;
  isBusy: boolean;
  onDownload: () => void;

  // renderer
  renderTileWidth: number;
  renderTileHeight: number;
  dpi: number;
  repeatType: string; // match the host's repeatType type
  isCapturingFullRes: boolean;
  activePreset: SocialSizePreset;
  badgeVisible: boolean;
  onRenderComplete: () => void;
}

export default function MockupModalBody(props: MockupModalBodyProps) {
  return null; // replaced in Task 2
}
```

> NOTE: The exact imported type names (`MockupTemplateV2`, `WatermarkConfig`, `repeatType`'s type) must be copied from the real exports the hosts already use. Open both host files and match them exactly; adjust the import lines above to whatever the hosts import. Do not invent type names.

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors (unused-prop warnings are fine; the body returns null for now).

- [ ] **Step 3: Commit**

```bash
git add src/components/mockups/MockupModalBody.tsx
git commit -m "feat: scaffold shared MockupModalBody props interface"
```

---

## Task 2: Move AdvancedToolsBar's body into MockupModalBody (layout UNCHANGED)

This is a verbatim relocation. The output must be visually identical to today's AdvancedToolsBar modal — same single-column stack. Do NOT apply the two-pane layout yet.

**Files:**
- Modify: `src/components/mockups/MockupModalBody.tsx`
- Modify: `src/components/layout/AdvancedToolsBar.tsx:606-914`

- [ ] **Step 1: Move the body JSX**

Copy the JSX currently inside `AdvancedToolsBar.tsx` lines **620–913** (the `<div className="flex flex-col gap-3"> … </div>` block, including the IIFE controls bar, WatermarkPanel, PatternpalBadgeToggle, MockupDownloadMenu, and the preview wrapper with MockupRendererV2 + MockupCropStage) into `MockupModalBody`'s return.

Replace every host variable reference with the corresponding `props.` field per the interface from Task 1:
- `effectiveTileWidth` → `props.scale?.effectiveTileWidth` (and wrap the whole Scale `<label>` in `{props.scale && ( … )}`)
- `tileWidth` → `props.scale?.tileWidth`
- `mockupScaleOverride` / `setMockupScaleOverride` → `props.scale?.mockupScaleOverride` / `props.scale?.setMockupScaleOverride`
- `showColor`, `overlayLabel`, `canToggleOverlay`, `effectiveAuto` (→ `props.effectiveAutoColor`), `colorOverlayEnabled`, `setColorOverlayEnabled`, `mockupColorOverride`, `setMockupColorOverride`, `scheduleColorUpdate` → matching props
- `v2Template` → `props.v2Template`; `image` → `props.image`; `selectedMockup` → `props.selectedMockup`
- shadow/highlight arrays + the local `setShadowAt`/`setShadowOpAt`/`setHighlightAt`/`setHighlightOpAt` helpers: keep the helpers as local functions inside the component but have them call `props.setShadowEnableds` etc.
- `shadowLabels`/`highlightLabels` → `props.shadowLabels`/`props.highlightLabels`
- `isPro` → `props.isPro`; `watermark`/`setWatermark` → props; `badgeEnabled`/`setBadgeEnabled` → props
- Download menu props → `props.socialSizes`, `props.onToggleSize`, `props.socialOffsets`, `props.activeSlug`, `props.setActiveSlug`, `props.snapshotUrl`, `props.isLocked`, `props.onLockedClick`, `props.isBusy`, `props.onDownload`
- Renderer props → `props.renderTileWidth`, `props.renderTileHeight`, `props.dpi`, `props.repeatType`, `props.isCapturingFullRes`, shadow/highlight arrays, `props.colorOverlayEnabled`
- The `onRenderComplete` inline closure (which references `downloadAfterRenderRef` and `snapshotThrottleRef`) → replace with `props.onRenderComplete` (the host keeps those refs and passes a closure).
- CropStage → `props.activePreset`, `props.socialOffsets[props.activeSlug] ?? 0.5`, `onChangeOffset` calls `props.setSocialOffsets`, `props.isCapturingFullRes`, `props.watermark`, `props.badgeVisible`.

- [ ] **Step 2: Wire AdvancedToolsBar to render the component**

In `AdvancedToolsBar.tsx`, replace lines 620–913 (the entire body div) with:

```tsx
<MockupModalBody
  v2Template={v2Template}
  selectedMockup={selectedMockup!}
  image={image}
  scale={{
    effectiveTileWidth,
    tileWidth,
    mockupScaleOverride,
    setMockupScaleOverride,
  }}
  showColor={selectedMockup === 'onesie' || selectedMockup === 'wrapping-paper' || !!v2Template?.colorOverlay}
  overlayLabel={/* keep the existing overlayLabel derivation expression here */}
  canToggleOverlay={!!v2Template?.colorOverlay}
  colorOverlayEnabled={colorOverlayEnabled}
  setColorOverlayEnabled={setColorOverlayEnabled}
  mockupColorOverride={mockupColorOverride}
  setMockupColorOverride={setMockupColorOverride}
  scheduleColorUpdate={scheduleColorUpdate}
  effectiveAutoColor={(v2Template?.colorOverlay?.defaultColor && v2Template.colorOverlay.defaultColor !== 'auto') ? v2Template.colorOverlay.defaultColor : (image ? extractDominantColor(image) : '#ffffff')}
  hasShadow={!!v2Template?.shadowPath}
  hasHighlight={!!v2Template?.highlightPath}
  shadowLabels={[v2Template?.shadowLabel ?? 'Shadow', ...(v2Template?.additionalShadowLabels ?? [])]}
  highlightLabels={[v2Template?.highlightLabel ?? 'Highlight', ...(v2Template?.additionalHighlightLabels ?? [])]}
  shadowEnableds={shadowEnableds}
  shadowOpacityPercents={shadowOpacityPercents}
  highlightEnableds={highlightEnableds}
  highlightOpacityPercents={highlightOpacityPercents}
  setShadowEnableds={setShadowEnableds}
  setShadowOpacityPercents={setShadowOpacityPercents}
  setHighlightEnableds={setHighlightEnableds}
  setHighlightOpacityPercents={setHighlightOpacityPercents}
  isPro={isPro}
  watermark={watermark}
  setWatermark={setWatermark}
  badgeEnabled={badgeEnabled}
  setBadgeEnabled={setBadgeEnabled}
  socialSizes={socialSizes}
  onToggleSize={handleToggleSocialSize}
  socialOffsets={socialOffsets}
  setSocialOffsets={setSocialOffsets}
  activeSlug={activeSlug}
  setActiveSlug={setActiveSlug}
  snapshotUrl={mockupSnapshotUrl}
  isLocked={(preset) => preset.slug === FULL_SIZE_SLUG ? (!isPro && !isFreeMockup(selectedMockup)) : (!isPro && !isFreeSocialSize(preset.slug))}
  onLockedClick={handleDownloadMenuLockedClick}
  isBusy={isCapturingFullRes}
  onDownload={onDownloadExport}
  renderTileWidth={renderTileWidth}
  renderTileHeight={renderTileHeight}
  dpi={dpi}
  repeatType={repeatType}
  isCapturingFullRes={isCapturingFullRes}
  activePreset={activePreset}
  badgeVisible={shouldStampBadge({ isPaidPro: isPro, badgeEnabled })}
  onRenderComplete={() => {
    if (downloadAfterRenderRef.current) {
      const cb = downloadAfterRenderRef.current;
      downloadAfterRenderRef.current = null;
      cb();
    }
    if (!isCapturingFullRes) snapshotThrottleRef.current?.call();
  }}
/>
```

Add `import MockupModalBody from '@/components/mockups/MockupModalBody';` near the other mockup imports. Remove now-unused locals only if tsc flags them.

- [ ] **Step 3: Gate**

Run: `npx tsc --noEmit` → 0 errors.
Run: `npx vitest run` → all green (80/80).

- [ ] **Step 4: Manual parity check**

Start dev server (`npm run dev`; note it auto-picks a free port). Open a mockup from the AdvancedToolsBar entry point. Verify the modal looks and behaves **identically to before**: scale field, color/shadow/highlight, logo overlay, badge, size grid, drag-to-move, crop slider, download. No visual change yet.

- [ ] **Step 5: Commit**

```bash
git add src/components/mockups/MockupModalBody.tsx src/components/layout/AdvancedToolsBar.tsx
git commit -m "refactor: extract MockupModalBody from AdvancedToolsBar (layout unchanged)"
```

---

## Task 3: Point ActionsSidebar at MockupModalBody

**Files:**
- Modify: `src/components/sidebar/ActionsSidebar.tsx:485-760`

- [ ] **Step 1: Read ActionsSidebar's modal region**

Read `src/components/sidebar/ActionsSidebar.tsx` lines 485–760 to confirm its state variable names match (most do: `colorOverlayEnabled`, `shadowEnableds`, `socialSizes`, `socialOffsets`, `activeSlug`, `mockupColorOverride`, `watermark`, `badgeEnabled`, etc.) and to find its equivalents for: the download-menu props, `isLocked`/locked-click handler, `onDownload`, `renderTileWidth/Height`, `dpi`, `repeatType`, `activePreset`, `isCapturingFullRes`, snapshot ref, and render-complete closure. Confirm there is **no** scale state.

- [ ] **Step 2: Replace the body (lines 503–759) with `<MockupModalBody … />`**

Use the same prop wiring as Task 2 Step 2, with these differences:
- **Omit the `scale` prop entirely** (no Scale field renders).
- Use ActionsSidebar's longer overlay label derivation if you want to preserve it — but per the spec, standardize: pass the same `overlayLabel` style as AdvancedToolsBar (short form). The shared body renders one unified controls bar regardless.
- Map ActionsSidebar's own handler/variable names (e.g. its toggle-size handler, its locked-click handler, its `onDownloadExport` equivalent) to the matching props.

Add the `MockupModalBody` import.

- [ ] **Step 3: Gate**

Run: `npx tsc --noEmit` → 0 errors.
Run: `npx vitest run` → all green.

- [ ] **Step 4: Manual parity check**

Open a mockup from the ActionsSidebar entry point. It now renders the unified controls bar (expected change: color/shadow/highlight look like AdvancedToolsBar's bar; no Scale field). Verify drag, crop, size grid, download all work.

- [ ] **Step 5: Commit**

```bash
git add src/components/sidebar/ActionsSidebar.tsx
git commit -m "refactor: ActionsSidebar uses shared MockupModalBody"
```

---

## Task 4: Apply the two-pane responsive layout inside MockupModalBody

Now change the layout once, in the shared component. Both hosts inherit it.

**Files:**
- Modify: `src/components/mockups/MockupModalBody.tsx`

- [ ] **Step 1: Restructure the outer wrapper into two panes**

Replace the single `<div className="flex flex-col gap-3">` wrapper with a responsive two-pane container. Pattern (Tailwind):

```tsx
// Outer: stacked < 880px, two-pane ≥ 880px. The 880px breakpoint isn't a
// default Tailwind one, so use an arbitrary variant via a min-width container.
<div className="flex flex-col min-[880px]:flex-row min-[880px]:items-stretch gap-3 min-[880px]:gap-4">

  {/* PREVIEW PANE — order-first; pinned. Narrow: pinned top via sticky + capped height. Wide: left pane, sticky. */}
  <div className="min-[880px]:flex-[0_0_52%] min-[880px]:order-first
                  sticky top-0 z-10 bg-white
                  min-[880px]:self-start">
    <div className="bg-white w-full flex justify-center">
      {/* existing preview wrapper (the w-[600px] max-w-full → v2Template sizing block + MockupRendererV2 + MockupCropStage) goes here UNCHANGED.
          For the narrow breakpoint, cap height: add `max-h-[40vh] min-[880px]:max-h-none` to the canvas sizing wrapper so the pinned preview doesn't eat the screen. */}
    </div>
  </div>

  {/* CONTROLS PANE — controls bar, logo, badge, download grid, button */}
  <div className="flex flex-col gap-3 min-[880px]:flex-1 min-[880px]:overflow-y-auto min-[880px]:max-h-[80vh]">
    {/* controls IIFE bar, WatermarkPanel, PatternpalBadgeToggle, MockupDownloadMenu — moved here UNCHANGED */}
  </div>

</div>
```

Move the existing controls (bar + WatermarkPanel + badge + MockupDownloadMenu) into the CONTROLS PANE, and the existing preview block into the PREVIEW PANE. Do not change the inner markup of either — only their wrapping containers.

Notes:
- `MockupModal` (the shell) caps at `max-w-[90vw] max-h-[90vh]`. Widen the body so two panes have room: the shell's content wrapper is `max-w-4xl`. In `src/components/mockups/MockupModal.tsx:91`, change `max-w-4xl` to `max-w-6xl` so the wide layout isn't cramped. Verify the narrow layout still centers (it will; `max-w-6xl` + `w-full` collapses on small screens).
- The preview wrapper already uses `containerType: inline-size` and `min(100%, 60vh-based width)`. Keep that. The `max-h-[40vh]` cap only needs to apply below 880px — gate it with `max-[879px]:max-h-[40vh]` on the inner sizing div if the 60vh cap is too tall when pinned. Test on a real iPad-portrait viewport before finalizing the exact vh value.

- [ ] **Step 2: Gate**

Run: `npx tsc --noEmit` → 0 errors.
Run: `npx vitest run` → all green.

- [ ] **Step 3: Manual UAT across breakpoints**

With dev server running, test BOTH hosts (AdvancedToolsBar + ActionsSidebar) at:
- **Laptop (≥1280px):** two panes, preview left, controls right, **no page scroll** inside modal.
- **iPad landscape (~1024–1194px):** two panes (≥880px), no scroll.
- **iPad portrait (~768–834px):** stacked, preview pinned on top, controls scroll beneath, drag-to-move works with Pencil/touch (`touch-action: none` preserved — confirm dragging the pattern doesn't scroll the page).
- **Phone (~390px):** stacked, usable.
Verify in all: crop slider, size-grid thumbnails update, full-res download produces correct file.

- [ ] **Step 4: Commit**

```bash
git add src/components/mockups/MockupModalBody.tsx src/components/mockups/MockupModal.tsx
git commit -m "feat: two-pane mockup modal layout (preview pinned beside controls)"
```

---

## Task 5: Final verification + handoff doc

- [ ] **Step 1: Full gate**

Run: `npx tsc --noEmit` → 0; `npx vitest run` → 80/80.

- [ ] **Step 2: Update the perf/handoff doc**

Append a short note to `docs/superpowers/HANDOFF-mockup-modal-perf.md` (or create `docs/superpowers/HANDOFF-mockup-two-pane.md`) recording: two-pane layout shipped, MockupModalBody now shared (duplication resolved), manual UAT results per breakpoint, still-not-merged status.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/
git commit -m "docs: record mockup two-pane layout + body consolidation"
```

---

## Self-Review (completed by plan author)

- **Spec coverage:** two-pane desktop (Task 4) ✓; pinned-top narrow (Task 4 Step 1 height cap) ✓; 880px breakpoint ✓; consolidate-first into `MockupModalBody` (Tasks 1–3) ✓; conditional Scale (Task 2/3) ✓; standardize controls (Task 3) ✓; extract-with-parity-then-layout sequencing (Tasks 2→4) ✓; out-of-scope crop bug untouched ✓; iPad parity + `touch-action` preserved (Task 4 Step 3) ✓; gate = tsc+vitest (every task) ✓.
- **Placeholder scan:** the two intentional "copy the real type name / derivation from the host" notes are explicit instructions to match existing code, not TODOs — the engineer has exact line ranges to copy from. No vague error-handling/validation placeholders.
- **Type consistency:** prop names in the Task 2 wiring match the `MockupModalBodyProps` interface in Task 1 (`onToggleSize`, `snapshotUrl`, `isBusy`, `onDownload`, `effectiveAutoColor`, `badgeVisible`, `onRenderComplete`).
