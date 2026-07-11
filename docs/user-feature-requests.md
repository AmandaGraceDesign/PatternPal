# User Feature Requests

Running list of features and improvements requested by PatternPAL Pro users. When Mandy asks "what did users request?" or "what should I work on?", check here.

---

## Open Requests

### 4. [BUG] EasyScale white-screen crash on iPad ("client-side exception")
**Reported:** 2026-06-17
**User:** Judi (jaymariedesignstudio@gmail.com) — iPad, Safari 26.5, 834×1210 (11" iPad portrait), signed in
**Summary:** Using **EasyScale** on `pattern-tester.amandagracedesign.com` shows "Application error: a client-side exception has occurred" — "quite frequently recently." A full white-screen crash, not an in-app error.
**Root cause (diagnosed):** iPad Safari/WebKit has a hard canvas ceiling (~4,096px/side, ~16.7M px area on 11" iPads). EasyScale allocates canvases sized `inches × DPI` (24"@300 DPI = 7,200px) and — since commit `9f5c637` (May 1, "lift upload cap to 15,000px") — allows source tiles up to 15,000px. Oversized canvases make `getContext('2d')` return null (code uses a `!` non-null assertion → throws) or OOM-kill the tab. The May-1 commit only guarded the full-drop path; the EasyScale scaling + includeOriginal canvases were left unprotected → the "recently" regression. **Device issue, not Safari-app-specific:** all iPad browsers use WebKit so they'd all crash; desktop browsers (more RAM, higher limits) would not. Input-dependent: large source tile and/or large size at 300 DPI triggers it.
**Related existing code:** [src/lib/utils/imageScaler.ts](src/lib/utils/imageScaler.ts) (lines ~69–90), [src/lib/utils/exportScaled.ts](src/lib/utils/exportScaled.ts) (~79–97, 111), [src/lib/utils/easyscaleUtils.ts](src/lib/utils/easyscaleUtils.ts) (~42–44). Modal try/catch at [src/components/export/EasyscaleExportModal.tsx](src/components/export/EasyscaleExportModal.tsx) (~194) already catches throws → would show a friendly inline error once the canvas no longer OOMs.
**Suggested approach:** Apply an iOS-only canvas ceiling (MAX_SIDE 4096 / MAX_AREA 16.7M, via existing `isIOS()` in [src/lib/utils/downloadCanvas.ts](src/lib/utils/downloadCanvas.ts)); null-check every `getContext('2d')` and reject on null `toBlob` with a friendly message ("This size is too large to export on this iPad — try a smaller size or 150 DPI."). Desktop untouched. Build in a fresh session with a test + iPad UAT over the tunnel before shipping. Stopgap for users: smaller size / 150 DPI, or export on a computer.

---

### 3. Crop anchor (Top/Center/Bottom) + per-size previews for mockup social sizes
**Requested:** 2026-06-11
**User:** Mandy
**Summary:** The unified "Download mockup" social sizes use an auto-**centered** cover-crop, so on a 1:1 square the focal subject can be clipped wrong — e.g. a dress mockup keeps the full hanger but cuts off the dress hem. User wants (a) a **preview thumbnail per size** showing the actual crop framing, and (b) the ability to **anchor the crop Top / Center / Bottom** per size so she can keep the hem and drop the hanger. Other templates have similar framing mismatches.
**Context:** Comes right after the unified Mockup Download Menu shipped (branch `feat/mockup-social-exports`). User picked **anchor presets** over free-drag (lighter UI, solves the case) and chose to build it in a **fresh brainstorm session**.
**Related existing code:** Cover-crop geometry auto-centers in [src/lib/utils/mockupSocialExport.ts](src/lib/utils/mockupSocialExport.ts) — the crop-rect helper (~lines 30–38) computes `sy = (srcH - sHeight)/2` (vertical center) / `sx = (srcW - sWidth)/2` (horizontal center). Anchor = swap the centered offset for Top (`0`), Center (centered), Bottom (`srcH - sHeight`), threaded through `coverCropToBlob` → `exportMockupSocialBlob` → `downloadMockupSocialSizes`. Preview = render the same crop rect into a small canvas in the unified list rows ([AdvancedToolsBar.tsx](src/components/layout/AdvancedToolsBar.tsx) + [ActionsSidebar.tsx](src/components/sidebar/ActionsSidebar.tsx)).
**Seed/handoff:** [docs/superpowers/SEED-mockup-crop-anchor.md](docs/superpowers/SEED-mockup-crop-anchor.md)
**Suggested approach:** Add a per-size `anchor: 'top' | 'center' | 'bottom'` (default `center` = today's behavior) to the crop math; surface a tiny Top/Center/Bottom toggle + live preview thumbnail on each selected size row. Brainstorm the UX (vertical anchor only vs also horizontal; per-size vs per-template default) before planning.

---

### 1. Custom filename on export (Easyscale + Pattern Fill)
**Requested:** 2026-04-18
**User:** (unspecified)
**Summary:** Ability to name the file when exporting from **Easyscale Export** and **Pattern Fill / Repeat Export** (these paths currently auto-generate the filename with no user input).
**Context:** Mockup exports already prompt for a filename. This request is specifically about the other export flows that don't.
**Related existing code:** Easyscale uses [src/lib/utils/exportScaled.ts](src/lib/utils/exportScaled.ts) (auto-names with timestamp). Repeat/tile exports use [src/lib/utils/repeatFillExport.ts](src/lib/utils/repeatFillExport.ts) and [src/components/export/RepeatExportModal.tsx](src/components/export/RepeatExportModal.tsx) (auto-names with pattern slug). Neither prompts the user.
**Suggested approach:** Add a filename input to the Easyscale and Repeat export modals (proper React input, not `window.prompt`) so users can name the file at export time.

---

### 2. Scale control for mockup pattern
**Requested:** 2026-04-18
**User:** (same user as #1)
**Summary:** In the mockup generator, let the user control how large/small the pattern appears on the mockup object.
**Context:** A pattern scale that looks right on wrapping paper is too small for wallpaper or a throw pillow. Currently the scale is fixed per template. User wants a scale slider inside the mockup modal so the same pattern can be previewed at different scales on the same mockup.
**Suggested approach:** Add a scale slider (e.g., 25%–300%) in the mockup modal that multiplies the pattern's repeat size when drawn onto the mockup canvas. Persist per-mockup so switching templates remembers the last scale or resets sensibly.

---

## How to use this doc

- Add new requests at the top of **Open Requests** with date + user + summary + any relevant code pointers.
- When a request ships, move it to **Shipped** below with the commit or PR link.
- If a request is declined or deferred indefinitely, move it to **Declined / Parked** with a one-line reason.

---

## Shipped

### Mockup pattern rotation (per-area drag-to-rotate + "rotate all")
**Shipped:** 2026-07-11 (branch `feat/mockup-rotation-cricut-transparency`)
**User:** User feature request (rotation on mockups)
**Summary:** Users can now rotate the pattern within a mockup on a **per-product-area** basis using a **drag-to-rotate handle** on the live preview, with an optional **"Rotate all areas together"** toggle to spin every area by the same delta. Rotation affects only the mockup preview/export — it never mutates the saved pattern. `sharedPatternArea` templates are excluded in v1 (no handle). iPad/Pencil-safe (Pointer Events + `touch-action: none`, rAF-coalesced).
**Implementation:** Runtime per-zone angle override mirrors the existing pattern-offset plumbing: engine input `patternAngleOverrides` → `processZone(overrideAngle)` → `MockupRendererV2` state + rotate-handle gesture → `MockupModalBody` toggle.
**Commits:** `a571ea0` (engine), `c085aec` (renderer state + handle), `0cda70c` (rotate-all toggle).

### Transparent Cricut / Pattern-Fill PNG export
**Shipped:** 2026-07-11 (branch `feat/mockup-rotation-cricut-transparency`)
**User:** User feature request (transparent PNG for Cricut export)
**Summary:** Pro users can export the Cricut / Pattern-Fill ("Digital Paper") output as a **transparent PNG**, preserving the alpha of transparent-source patterns instead of baking them onto white. A **"Transparent background"** toggle in the Cricut panel is enabled only for PNG (JPG has no alpha; greyed with a "PNG only" hint), and the live preview shows a checkerboard behind the pattern when transparent is on.
**Implementation:** Gated the previously-unconditional white `fillRect` behind a PNG-only `shouldPaintBackground(format, transparentBackground)` helper + `RepeatFillExportConfig.transparentBackground` flag, mirrored in the preview.
**Commits:** `d597b76` (export gate + helper), `98e87a0` (modal toggle + checkerboard).

### iPad download fix for mockups
**Shipped:** 2026-04-19
**Users:** Charisse + 1 additional user
**Summary:** Mockup downloads failed silently on iPad (especially Chrome on iOS) — users saw the filename prompt but the file never saved anywhere.
**Root cause:** The old code used `canvas.toDataURL()` + `<a download>` + `link.click()`. Chrome on iOS silently drops that pattern with data URLs.
**Fix:** New shared helper [src/lib/utils/downloadCanvas.ts](src/lib/utils/downloadCanvas.ts) that uses `canvas.toBlob()` + `navigator.share({ files })` on iOS (native share sheet with Save Image / Save to Files) and Blob + Object URL anchor click on desktop/Android. Wired into both mockup download call sites.
**Commits:** `b2f2436` (initial fix) and `49a8e2b` (prefer share sheet over Chrome's bottom bar).

---

## Declined / Parked

_(nothing yet)_
