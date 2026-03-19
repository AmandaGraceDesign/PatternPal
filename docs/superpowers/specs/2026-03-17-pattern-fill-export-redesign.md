# Pattern Fill Export Redesign — Spec
**Date:** 2026-03-17
**Branch:** `pattern-fill-export`

---

## Goal

Expand the existing Pattern Fill Export (currently Cricut/Silhouette-only) to also serve social media creators. A destination picker lets the user choose their context upfront, keeping each path focused and uncluttered.

---

## Entry Point

When the user clicks **Pattern Fill Export** in AdvancedToolsBar, the modal opens to a **Destination Picker screen** with two choices:

- **🖨 Cricut / Silhouette** — Digital paper · print files · Etsy/Creative Fabrica
- **📱 Social Media** — Instagram · Pinterest · TikTok · Facebook

Clicking a destination navigates to that destination's screen. The existing Cricut/Silhouette flow is unchanged.

---

## Cricut / Silhouette Path

No changes to existing behavior. Works exactly as it does today.

---

## Social Media Path

### Navigation
- Header shows `← Back` button (returns to destination picker; does **not** reset per-size scale state) and `✕` close button.
- Title: **Social Media Export**
- Escape key is disabled while export is in progress.

### Format
- Toggle at the top: **JPG** (default) | **PNG**
- Format state is **per-mode** — switching back to Cricut does not inherit the social JPG default.
- No DPI picker — social media platforms care about pixel dimensions only. No DPI metadata is injected into social exports.

### Size Selection

A **Select All** checkbox with standard indeterminate state:
- All checked → checked
- None checked → unchecked
- Some checked → indeterminate
- Clicking Select All when unchecked or indeterminate → checks all. When checked → unchecks all.

Five size presets, each as a checkbox row:

| Label | Pixel Size | Aspect | File Slug |
|---|---|---|---|
| Instagram / Facebook Post | 1080×1080 | 1:1 | `instagram-post` |
| Instagram / Facebook Portrait | 1080×1350 | 4:5 | `instagram-portrait` |
| Story / Reel / TikTok | 1080×1920 | 9:16 | `story` |
| Pinterest Pin | 1000×1500 | 2:3 | `pinterest-pin` |
| Facebook Cover | 1640×624 | ~21:8 | `facebook-cover` |

### Per-Size Scale Control (key feature)

When a size is **checked**, its row expands to show:
- A **live preview canvas** sized to a max dimension of **90px** on the longest side, maintaining exact aspect ratio (so a 9:16 story preview is 50×90px, a 1:1 post preview is 90×90px)
- **− / +** buttons to adjust tile scale (same step logic as Cricut: jumps to next `repeatsX` count that meaningfully changes the layout)
- Current tile size in inches (reflects current scale)
- Repeat count (e.g. `6 × 10 repeats`)
- Output pixel dimensions (always exact platform size)
- File name preview (e.g. `mypattern-instagram-post.jpg`)

Each checked size has its **own independent scale state**, stored in `scalesRef: Record<SizeSlug, number>`. Scale is initialized to `1.0` when a size is **first checked**. Scale state **persists** if the user unchecks and re-checks a size within the same modal session, or navigates Back and returns. Scale state resets **only** when the modal closes.

When a size is **unchecked**, its preview canvas is unmounted (no retained canvas contexts).

### Scale → Pixel Math (DPI Bridge)

Social media export works in pixel space but reuses tile dimensions in inches. The bridge:

- Use a **fixed internal DPI of 96** for all social media exports.
- `tilePixelW = tileWidthInches * exportScale * 96`
- `tilePixelH = tileHeightInches * exportScale * 96`
- `repeatsX = Math.round(targetPxW / tilePixelW)`
- `repeatsY = Math.round(targetPxH / tilePixelH)`
- The export canvas is drawn at exactly `targetPxW × targetPxH` pixels (no rounding drift).

This guarantees exact platform pixel dimensions regardless of the user's tile DPI.

### New Export Function: `generateSocialFillBlob`

Social exports **do not** reuse `generateRepeatFillExport` (which auto-triggers a download and accepts only `150 | 300` DPI). Instead, a new function is added to `repeatFillExport.ts`:

```ts
generateSocialFillBlob(params: {
  image: HTMLImageElement;
  repeatType: 'full-drop' | 'half-drop' | 'half-brick';
  targetPxW: number;
  targetPxH: number;
  format: 'png' | 'jpg';
  tileWidthInches: number;
  tileHeightInches: number;
  exportScale: number;
}): Promise<Blob>
```

- Renders the pattern fill onto an offscreen canvas at exactly `targetPxW × targetPxH`
- Returns a `Blob` (does **not** trigger download directly)
- No DPI metadata injected
- Uses the 96 DPI bridge internally for tile sizing
- Calls `mapRepeatType(repeatType)` before passing to `convertToFullDrop` (same as existing `generateRepeatFillExport`)

### Export Behavior

1. **Pro gate:** Single `/api/pro/verify` call before any rendering begins. If it fails, show error and abort.
2. For each checked size, call `generateSocialFillBlob` in sequence.
3. If **1 size checked** → create object URL from blob → trigger download directly.
4. If **2+ sizes checked** → pass all blobs to `JSZip`, trigger zip download.
5. Export button is **disabled** when no sizes are checked or when `image` is null.
6. Button label: `Export 1 Image` / `Export 2 Images` / `Export All 5 Images` etc.

### Error Handling

- If one size's `generateSocialFillBlob` throws, **skip that size** and continue with the rest.
- After export completes, if any sizes were skipped, show an inline warning: `"Could not export: [size labels]. Others downloaded successfully."`
- If **all** sizes fail, show the error message and do not trigger any download.

### Image Null Guard

If `image` is null when the social view is shown, render the same "No pattern loaded" message as the Cricut path. Checkboxes are not shown.

### File Naming

- Pattern: `{sanitizedFilename}-{sizeSlug}.{ext}`
- `originalFilename` null fallback: use `'pattern'` (same as Cricut path)
- Zip name: `{sanitizedFilename}-social-media.zip`

---

## Technical Notes

### State Changes in `RepeatExportModal`

- Add `mode: 'picker' | 'cricut' | 'social'` state (initial: `'picker'`)
- Add `socialFormat: 'png' | 'jpg'` state (initial: `'jpg'`, separate from Cricut's `format`)
- Add `checkedSizes: Set<SizeSlug>` state (initial: empty)
- Add `scalesRef: React.MutableRefObject<Record<SizeSlug, number>>` (persists within session; ref avoids re-renders during zip generation)
- `mode` resets to `'picker'` on modal close; `scalesRef` resets to `{}` on modal close
- Select All indeterminate state must be set via a DOM ref (`checkboxRef.current.indeterminate = true`) — JSX attribute does not work for this
- No canvas size guard needed in `generateSocialFillBlob` — all five presets are well within browser canvas limits (~2M px max vs 67M px limit)

### Social view renders within the same modal container
No new modal component file needed.

### Preview Canvas per Size
- Max longest dimension: 90px; exact aspect ratio maintained
- Canvas only mounted when size is checked (unmounted on uncheck via conditional render)
- Same tile-drawing logic as Cricut preview (convertToFullDrop + drawImage in loops)

---

## Out of Scope

- Custom pixel dimensions for social media
- Animated GIF export
- Watermarking
- Any changes to the Cricut/Silhouette path
