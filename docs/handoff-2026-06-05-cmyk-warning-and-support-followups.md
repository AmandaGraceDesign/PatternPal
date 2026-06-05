# Handoff — 2026-06-05 — CMYK upload warning + open follow-ups

## What shipped this session

### ✅ CMYK upload warning (committed)
**Problem:** A customer's pattern colors shifted dramatically after upload. Root
cause: PatternPal has **no color code at all** — it hands files to the browser,
and the **browser's JPEG decoder converts CMYK→RGB on decode, discarding the
embedded ICC profile**. Screens are RGB-only, so true CMYK can't be displayed.
This is correct behavior for a screen-based pattern tester; the fix is to warn
users and tell them to re-export as RGB.

**Implementation:**
- `src/lib/utils/imageUtils.ts`
  - `isCmykJpegBuffer(buffer)` — pure SOF-marker scan; component count 4 = CMYK/YCCK.
  - `detectCmykJpeg(file)` — async wrapper (FileReader); resolves `false` on any
    error so it can never block an upload.
  - `CMYK_WARNING_MESSAGE` — friendly copy telling users to re-export as RGB.
- `app/page.tsx` — wired a non-blocking `alert(CMYK_WARNING_MESSAGE)` into all
  **3** upload paths (paste event, file upload, clipboard-read button), after
  the size check and before `setIsLoading(true)`.
- `src/__tests__/cmykDetection.test.ts` — 6 tests (CMYK / RGB / grayscale /
  APP0-prefixed / non-JPEG / truncated). All green.

**Verification:** `npx tsc --noEmit` clean; `npx vitest run` = 48/48 pass.
**Not yet done:** real end-to-end test by uploading an actual CMYK JPEG from
Illustrator into the running app (~30s manual check).

**Customer reply (CMYK color shift)** — ready to send:
> So glad you're loving it! That color shift is because the file was exported as
> CMYK (a print color mode) — browsers can only show RGB, so they convert it and
> the colors drift. Fix: in Illustrator, File → Document Color Mode → RGB Color,
> then re-export your JPEG. Colors will then match what you see in Illustrator.
> CMYK is only needed when printing physically. 💛

## Investigated, no action needed

### ✅ Vercel Agent "Middleware 5xx spike" (503 on /_middleware) — CLOSED
- Single user/IP `188.69.200.98` (Lithuania, Chrome/Windows), 56% of *their*
  requests, 17:44–17:53 UTC Jun 5, self-healed in 9 min, zero other-user impact.
- Middleware is just `clerkMiddleware()` (`proxy.ts`). Clerk status page: clean.
  No Vercel firewall alert, no recurrence.
- **Verdict:** transient per-IP rate-limit blip (Clerk or Vercel), not a code
  defect. Re-trigger to act = same 503 pattern across *multiple* users.

## ⏸️ Open / not started

### Support form (Option A) — DESIGNED & APPROVED, not built
Replace the Help button's `mailto:` ([TopBar.tsx:42-56](../src/components/layout/TopBar.tsx#L42-L56))
with an in-app "Report a problem" modal because **no one answers the questions**
in the current pre-filled email.
- New component `src/components/support/SupportModal.tsx` (~150 LOC).
- Fields: **Device** + **Browser** dropdowns auto-detected from `navigator.userAgent`
  (use `maxTouchPoints > 1` to catch iPads, which masquerade as Mac) — editable;
  **What's happening?** textarea = **required** (the gate).
- Send = build structured body (answers + userAgent + screen size + signed-in
  state) → `mailto:education@amandagracedesign.com`, pre-filled. Keep the
  artwork-safety reassurance, reworded to "after you tap Send, attach the file."
- **No backend** (Option A chosen — user didn't want a new service; Kit is the
  wrong tool: it adds reporters as subscribers, can't attach files, overwrites
  custom fields). Touch/iPad parity mandatory.
- Out of scope: the separate "Feedback" link stays as-is.

### Backlog (from turn 1 — original iPad white-screen ticket)
- **No error boundary** anywhere (no `app/error.tsx` / `app/global-error.tsx`).
  Add one that (a) shows friendly recovery, (b) auto-reloads on `ChunkLoadError`
  (stale-chunk-after-deploy is the leading cause of the iPad "Application error"),
  (c) reports the real error.
- **No error reporting / no source maps** → blind to client errors. Recommended:
  free Sentry + hidden source maps (~20 min wizard). User interested, deferred.
- Optional: `docs/incidents/` log to spot 503 recurrence.

## Suggested next session
Fresh session → build the **support form (Option A)**. Then consider the error
boundary (cheap, high-value safety net for the original iPad issue).
