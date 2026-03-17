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
- Header shows `← Back` button (returns to destination picker) and `✕` close button.
- Title: **Social Media Export**

### Format
- Toggle at the top: **JPG** (default) | **PNG**
- No DPI picker — social media platforms care about pixel dimensions only, not DPI metadata. Output is rendered at exact platform pixel dimensions.

### Size Selection

A **Select All** checkbox appears above the size list.

Five size presets, each as a checkbox row:

| Label | Pixel Size | Aspect |
|---|---|---|
| Instagram / Facebook Post | 1080×1080 | 1:1 |
| Instagram / Facebook Portrait | 1080×1350 | 4:5 |
| Story / Reel / TikTok | 1080×1920 | 9:16 |
| Pinterest Pin | 1000×1500 | 2:3 |
| Facebook Cover | 1640×624 | ~21:8 |

### Per-Size Scale Control (key feature)

When a size is **checked**, its row expands to show:
- A **live preview canvas** in the correct aspect ratio for that size (e.g. square for 1:1, tall narrow for 9:16)
- **− / +** buttons to adjust tile scale (same step logic as Cricut path: jumps to the next repeat count that meaningfully changes the layout)
- Current tile size in inches (e.g. `3.20" × 3.20"`)
- Repeat count (e.g. `6 × 6 repeats`)
- Output pixel dimensions
- File name preview (e.g. `mypattern-instagram-post.jpg`)

Each checked size has its **own independent scale state**. Scale changes on one size do not affect others.

When a size is **unchecked**, its expanded section collapses back to the compact row.

### Export Behavior

- **1 size checked** → direct file download (no zip)
- **2+ sizes checked** → zip file containing one image per size
- Export button label reflects count: `Export 1 Image` / `Export 2 Images` / etc.

### File Naming

Pattern: `{originalFilename}-{sizeSlug}.{ext}`

Size slugs:
- `instagram-post`
- `instagram-portrait`
- `story`
- `pinterest-pin`
- `facebook-cover`

Example: `florals-instagram-post.jpg`, `florals-story.jpg`

### Zip File Naming

`{originalFilename}-social-media.zip`

---

## Technical Notes

### New Components
- `RepeatExportModal` gains a `mode` state: `'picker' | 'cricut' | 'social'`
- Social media path is a new view within the same modal component (not a separate file)
- Each size preset has its own `exportScale` in a `Record<SizeSlug, number>` state map

### Export Engine
- Reuse existing `generateRepeatFillExport` for each size, passing that size's pixel dimensions and scale
- For zip: use `JSZip` (already a dependency via EasyScale export) to bundle multiple images
- No DPI metadata injection for social exports (pixel dimensions only)

### Canvas Preview
- Preview canvas per size, sized proportionally to fit within ~90px max dimension
- Same tile-drawing logic as current Cricut preview canvas
- Only renders when the size is checked (no wasted computation)

### Scale Step Logic
- Same `scaleForRepeatsX` formula as Cricut path
- `MIN_SCALE = 0.02`, `MAX_SCALE = 1.0` (same bounds)
- Scale initialized to `1.0` when a size is first checked

---

## Out of Scope

- Custom pixel dimensions (not needed — platform sizes are fixed)
- Animated GIF export
- Watermarking
- Any changes to the Cricut/Silhouette path
