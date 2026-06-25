# HANDOFF — EasyScale iPad download crash fix

**Date:** 2026-06-25 · **Branch:** `main` (committed, **not pushed** — Mandy tests first)

## The bug
Support email: iPad, EasyScale export, 3600×3600 @300ppi PNG → 300 DPI, 12" only, PNG, Download → **"Application error: a client-side exception has occurred"** instead of a ZIP. Second report of this (first was Judi, 2026-06-17, on 18"/24").

## Root cause (two distinct causes)
1. **>4096px canvas ceiling** on iPad WebKit — hits 18"/24" @ 300 DPI (5400/7200px). Original June-17 diagnosis.
2. **Memory pressure even at sub-4096 sizes** (THIS report). Pipeline peak = decoded bitmap + full-size canvas + PNG blob + `injectPngDpi` full-size array copy + **JSZip re-DEFLATE of an already-compressed PNG** + zip blob + shared File → exceeds iPad per-tab budget → tab killed.

Confirmed both export modals (`EasyscaleExportModal.handleExport` try/catch, `ScaleExportModal`) **catch** thrown export errors and show inline/alert — so a thrown error is NEVER the white screen; that's Next's default boundary on a render-phase throw or an OOM tab-kill. No Sentry → no captured stack.

## What shipped (all in this commit)
- `src/lib/utils/imageUtils.ts` — new `assertExportCanvasWithinLimits(w,h)` (iOS 4096/16.7M via `isIOS()`; desktop 16384) throws friendly catchable Error; consts `IOS_CANVAS_MAX_SIDE`/`IOS_CANVAS_MAX_AREA`.
- `src/lib/utils/imageScaler.ts` `scaleImage` — guard before alloc, null-check `getContext`, null-safe `canvasToBlob`, release canvas (`w=h=0`) in `finally`.
- `src/lib/utils/exportScaled.ts` — same guards on includeOriginal canvas; **JSZip `STORE` for png/jpg, `DEFLATE` only for tif** (the fix for the sub-4096 case).
- `src/lib/utils/downloadCanvas.ts` — exported existing null-safe `canvasToBlob`.
- `src/__tests__/exportCanvasLimits.test.ts` — 6 cases (iPad vs desktop).

## Verified
`tsc --noEmit` clean · **99/99 tests pass** · ESLint 0 errors (6 pre-existing warnings, untouched code).

## NOT verified / open
- **Not tested on a real iPad / prod.** This is a strong mitigation, not a confirmed cure. Deploy to preview/prod, have reporter retry.
- If still crashing: ask whether **JPG** or **8"** works → isolates memory vs PNG path.
- **Vercel "Edge Requests spike" alert** (15:15 UTC, 87→1.6k/5min, `pattern-pal`): unrelated to this code (was undeployed). Check Observability top paths/referrers for that window — rule out an iPad reload-loop vs organic/bot burst.

## Not touched (intentionally)
`easyscaleUtils.detectOriginalDPI` `toBlob(blob!)` (already inside try/catch → harmless); `dpiMetadata` TIFF-fallback `toBlob(blob!)`.
