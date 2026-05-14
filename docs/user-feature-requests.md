# User Feature Requests

Running list of features and improvements requested by PatternPAL Pro users. When Mandy asks "what did users request?" or "what should I work on?", check here.

---

## Open Requests

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
