# Batch / multi-file upload — design spec

> **Status:** ALL FOUR SECTIONS APPROVED by Mandy 2026-08-27. Ready for spec review, then an implementation plan.
> **Recovered 2026-08-27** from session `0a2ea945` after two context deaths. Do not let this live only in a transcript again.
> **No code has been written.** This is a design document.

## The ask (Mandy, 2026-08-26)

> "the BIGGEST ask that i have had by far. and the one i am more worried about due to rendering, cluttered UI"

Load more than one file at a time. Two concrete uses she named:

1. A folder with six JPEGs → upload the whole collection → bulk EasyScale export at scales of 2, 4, 6, 8.
2. Coordinating patterns from one collection used together in a single mockup.

Her two stated fears: **cluttered UI**, and **memory** — "a locally hosted app that doesn't upload anything for storage."

## The memory finding that reframes the whole feature

The app runs on one decoded image (`app/page.tsx:25-26`), threaded to every downstream surface as props.

| Thing | RAM |
|---|---|
| Six 3000×3000 patterns as `File`/`Blob` handles | ~0 / ~18 MB compressed |
| Six 3000×3000 patterns **decoded at once** | ~216 MB 💥 |
| One decoded at a time | ~36 MB (today's footprint) |
| **One EasyScale canvas, 24″ @ 300 DPI** | **~207 MB** |

**The single export canvas already shipped is bigger than all six source patterns combined.** For
*decoding*, batch does not raise the memory ceiling as long as patterns are processed strictly one at a
time and released between. Six patterns is six times the *wait*, not six times the *risk*.

⚠️ **This holds for decoding only.** Section 2 found that *delivery* does raise the ceiling: the combined
zip is assembled in memory and grows with the batch. That is what the pre-flight output-size cap exists to
bound. Read the two together — the intake peak (~54 MB) and the delivery peak are different numbers.

Two things genuinely break the one-at-a-time rule: the combined zip above, and coordinating mockups
(D below), which needs multiple images live at once. That is why D goes last.

## This is four features, not one

| | Sub-project | Depends on | Risk |
|---|---|---|---|
| **A** | Multi-file intake + queue (one active at a time) | — | Low |
| **B** | Bulk EasyScale export | A | Low — sequential by nature |
| **C** | Bulk social + bulk mockup export | A | Medium — more surfaces |
| **D** | Coordinating patterns in one mockup | A, and breaks the memory rule | High — needs its own spec |

**Scope for v1: A + B only.** C and D each get their own spec later.

## Locked decisions

- **Pro feature.** No new tier, no billing work. **Explicitly: batch needs its own gate.** The existing
  `verifyProAccessIfNeeded` gates on *export options* (300 DPI, non-JPG format, non-free sizes, extra
  sizes, include-original) — a free user can legitimately export 8" JPG at 150 DPI today. Multi-file
  intake is therefore gated separately, at the point of selecting more than one file, independent of the
  option-based check. The single hoisted pre-flight check in Section 2 covers both gates in one call.
- **Architecture: option 2 — batch lives at app level, exposed only in EasyScale for v1.**
  `app/page.tsx` gains one array beside its existing state:
  ```
  patterns: PatternEntry[]   // { file/blob, name, detectedDPI, thumbnail }
  image / originalFilename   // unchanged — still "the active one"
  ```
  Every existing code path keeps working untouched; a single upload is a queue of one. EasyScale reads
  the queue, nothing else knows it exists yet. (Option 1, batch confined inside the EasyScale modal, is a
  dead end — C and D would each need their own copy. Option 3, replacing `image` with an active-index
  threaded through all thirteen surfaces, was already turned down.)
- **DPI: auto-detect per file.** *(Reason corrected 2026-08-27 — decision unchanged, severity downgraded.)*
  The original claim was that one app-state DPI stamped across a batch would silently double physical
  export sizes. **That is wrong for scaled exports.** In `scaleImage`, `scaleFactor` divides target pixels
  by the source's own pixel count, so the source DPI cancels: output is always `size x targetDPI` on the
  longest side, and `imageScaler.ts:96-100` embeds `targetDPI`. Source DPI genuinely matters in exactly
  two places: the **original tile** (`includeOriginal` stamps `originalDPI` on it, so a batch-level DPI
  misstates each tile's physical size) and the **size readout the UI shows the user**. Detect per file,
  show it on each row, batch DPI as fallback only for files with no metadata.
- **Repeat type is safe to set once.** Verified: `scaleImage()` never receives `repeatType`
  (`imageScaler.ts:42-49`); it only decides whether the optional convert-to-full-drop step runs
  (`exportScaled.ts:55-60`). One batch-level setting, no silent corruption.
- **iPad supported.** The ceiling is the single largest export canvas, not the batch. Judi's crash-fix
  guards apply per pattern.
- **Partial failure: the batch survives it.** Pattern 4 blows the canvas cap → skip it, finish the rest,
  deliver what worked, name what didn't.
- **Progress UI: one line.** "Exporting 3 of 6 — leaf-03.jpg." Not six spinners.

## Section 1 of 4 — Intake ✅ APPROVED

**The stale-handle problem.** The existing upload handler reads bytes immediately, inside the event
handler, with this warning attached (`PatternControlsTopBar.tsx:107-115`):

> Network-mounted files (Google Drive, iCloud, Dropbox) use virtual file handles that go stale if we wait
> even one async tick.

Holding six `File` handles and decoding each when its turn comes walks straight into that. Her exact use
case is "a folder with six JPEGs" — for many designers that folder is in Google Drive or iCloud. Patterns
1 and 2 would export fine and pattern 4 would fail with an unreadable-file error, intermittently, only for
cloud-folder users. A nightmare support ticket.

**The fix keeps the memory story intact.** At intake, read *all* selected files to `Blob` in the same
event handler — bytes captured, handles no longer needed. A Blob holds compressed bytes, not a decoded
bitmap. Decoding stays lazy and one-at-a-time.

| Held in the queue | Six files |
|---|---|
| Blobs (compressed JPEG bytes) | ~18 MB |
| Thumbnails | ~0.2 MB |
| Decoded image — one, at export time | ~36 MB |
| **Peak** | **~54 MB**, against a 207 MB export canvas |

**What changes at intake:**

- `multiple` on the existing file input. One file behaves exactly as today.
- Each file, in order: read bytes → validate with the existing `validateImageDimensions` (15,000px cap) →
  detect its own DPI → generate a ~120px thumbnail → **release the full decode immediately**.
- A file that fails validation is marked rejected in the list with its reason and **does not block the
  others**. Six files, one is 20,000px → five in the queue, one row saying why.
- First accepted pattern becomes the active one: `image` and `originalFilename` are set exactly as today,
  so canvas, seam tools, mockups and every other surface behave identically.

**What changes in `app/page.tsx`:** one array added beside existing state. `image` and `originalFilename`
keep their current meaning. Nothing else in the tree learns a new prop in v1.

**Two named constraints, both invisible, both easy for a later change to quietly undo — each gets a test:**

1. **Read bytes now.** All selected files are read to Blob synchronously in the input's event handler.
2. **Release the full decode immediately** after generating each thumbnail. Never hold N decoded images.
   (If the batch list rendered six `<img src={objectURL}>` previews, the browser would decode all six at
   full resolution to paint them — the 216 MB crash, before anyone clicks Export.)

## Section 2 of 4 — Export pipeline ✅ APPROVED

**Two code findings changed the plan.**

**1. Per-file DPI is new wiring, not reuse.** `detectOriginalDPI()` (`imageScaler.ts:12-16`) is a stub
returning a hardcoded `150` with a TODO. The real detector is `extractDpiFromFile()`
(`imageUtils.ts:85`), which reads **file bytes**. Section 1 already reads every file to a Blob at intake,
so the bytes are available exactly when needed — the sections interlock, no extra read.

**2. The zip is the memory ceiling, not the canvas.** `generateScaledExport` builds one `JSZip`, adds
every produced blob, then `generateAsync({type:'blob'})` assembles the whole archive in memory before
`downloadBlob`. One pattern x 5 sizes is comfortable today; six patterns is 30 files, holding inputs and
assembled output at once. **Correction to Section 1's framing:** batch does not raise the ceiling for
*decoding*, but it does for *delivery*.

**Delivery — Mandy chose (a):**

- **(a) One combined zip, a folder per pattern.** ← CHOSEN. One action instead of six. Costs the full
  archive in memory at the end, mitigated by the pre-flight cap below.
- (b) One zip per pattern, delivered as each finishes. Peak memory stays at today's, but means six
  deliveries — six trips through the `IOSSaveSheet` queue on iPad, throttled/blocked repeat downloads on
  desktop. Rejected: it protects memory by making the feature six times as annoying.

**Pre-flight size cap.** Before the loop starts, compute output bytes from the known pixel dimensions.
Over a device-dependent ceiling, refuse with an actionable sentence — *"6 patterns x 5 sizes at 300 DPI is
about 900 MB. Export 3 at a time, or drop to 150 DPI."* Turns a silent iPad OOM into something the user
can act on.

**The rest of the pipeline:**

- **Hoist the Pro check.** `verifyProAccessIfNeeded` fires `/api/pro/verify` per call — six patterns is
  six round trips and a failure that surfaces only after pattern 3 is already processed. Check once,
  before the loop.
- **Sequential loop, explicit release.** Decode one Blob -> write its sizes into the zip -> null the
  decoded image and zero its canvases -> next. Never two decoded patterns alive.
- **One existing transient that batch multiplies by six.** With convert-to-full-drop on,
  `exportScaled.ts:63-70` round-trips the doubled tile through `canvas.toDataURL('image/png')` — a base64
  string ~1.37x the PNG held in JS memory, then decoded into a *second* Image. Largest transient in the
  path, already shipped, run once per pattern. Swap for `toBlob` + object URL, released immediately.
- **Naming inside the zip.** Folder per pattern from the sanitized base filename, with a collision suffix
  — a folder of six files can contain `leaf.jpg` and `leaf.png`, which `sanitizeFilename` collapses.

## Section 3 of 4 — Failure handling ✅ APPROVED

**Most failures are knowable before any work starts.** Output dimensions are `size x targetDPI` on the
longest side and do not depend on the source file, so a canvas-cap failure is a property of *the
settings*, not of *pattern 4*. If 24" @ 300 DPI blows the iPad ceiling for one pattern it blows it for all
six. Today that surfaces as an exception partway through `scaleImage`, after the user has already waited.

Failures therefore split in two:

**Pre-flight — everything configuration-shaped, reported at once, before a single pixel is drawn.**
Run `assertExportCanvasWithinLimits` against every (size x targetDPI x aspect ratio x full-drop)
combination, plus the Section 2 output-size estimate, plus the single hoisted Pro check. One dialog:
*"24 inch won't export on this iPad — uncheck it or switch to 150 DPI."* Nothing wasted. In a batch this
is the difference between failing in 200ms and failing after three minutes.

**Mid-batch — only the genuinely unpredictable.** A Blob that won't decode, `getContext('2d')` returning
null under memory pressure, `canvasToBlob` failing, TIFF creation on a huge tile. Memory and corruption
failures, not settings failures.

**Policy for those: the batch survives.** Skip the pattern, continue, deliver what worked.

**Decisions:**

- **Keep partial patterns.** Pattern 4 produces 2/4/6 then fails at 8 -> the three that worked stay in the
  zip and the report says `leaf-04: 3 of 4 sizes`. Because size failures are pre-flighted, a mid-loop one
  means transient memory pressure; discarding three good files to punish one is worse than a named
  incomplete row.
- **The report goes in two places.** An on-screen summary when the batch ends, *and* a `_read-me.txt`
  inside the zip listing what is included and what failed with the reason. On iPad the zip lands in Files
  and is opened hours later, long after the on-screen summary is gone.
- **Zero successes means no download.** Show the error rather than hand over an empty zip with a readme.
- **Cancel finishes the pattern in flight, then delivers what is done**, with the remainder marked
  cancelled in the report. Someone cancelling at pattern 5 of 6 wants out of the wait, not out of the
  work. (Rejected alternative: cancel discards everything — cleaner to reason about, throws away four
  completed patterns.)

## Section 4 of 4 — Test plan ✅ APPROVED

**The driving constraint: jsdom has no canvas.** No `canvas` package is installed, so `getContext('2d')`
returns null under test. The existing 21-file suite works precisely because it tests pure computation and
guards, never pixels (`vitest.config.ts` -> `environment: 'jsdom'`; see
`src/__tests__/exportCanvasLimits.test.ts`, which flips `navigator.userAgent` to exercise the iPad and
desktop branches of one guard).

**The two rules Section 1 named as most likely to be quietly broken are exactly what jsdom cannot
observe.** So both are designed out rather than commented:

- **Read-bytes-now becomes a type.** Intake splits so the queue builder accepts *already-read bytes*,
  never a `File`. No handle survives to go stale, because the function that could misuse one cannot
  receive one. A later refactor cannot reintroduce the bug without changing a signature.
- **Release-the-decode becomes an ownership rule.** The thumbnail generator owns the decode lifecycle and
  returns only the thumbnail plus dimensions — it never hands a decoded `HTMLImageElement` back to its
  caller. "Never hold N decoded images" becomes something the API will not let you express.

**Unit tests — all pure, all in the existing style, in `src/__tests__/`:**

1. **Pre-flight validation** — given sizes, targetDPI, aspect ratios, full-drop on/off and a device UA,
   which combinations are rejected and with what message. Highest value, since Section 3 leans on
   pre-flight catching most failures. Direct analog to the existing canvas-limits test.
2. **Output-size estimation** — the Section 2 batch-cap arithmetic, including the refusal boundary.
3. **Zip naming and collisions** — `leaf.jpg` and `leaf.png` from one folder must land in distinct
   directories after `sanitizeFilename` collapses them.
4. **Queue state** — six files, one failing `validateImageDimensions`: five queued, one rejected row with
   its reason, first accepted becomes active. Written as a pure reducer so it is testable at all.
5. **Result shaping** — a run with successes, one skipped pattern and a cancel produces the right
   on-screen summary and `_read-me.txt`, including the zero-success case that must not produce a download.
6. **Pro check fires once** — mock `fetch`, assert one call for a six-pattern batch, not six.

**Manual pass — what cannot be automated here:**

- [ ] Zip opens and contains the expected per-pattern folders and filenames.
- [ ] DPI metadata is correct in an exported file (scaled output carries targetDPI; the original tile
      carries that file's own detected DPI).
- [ ] Six-pattern batch on iPad, patterns sourced from a **Google Drive folder** — the exact scenario the
      stale-handle rule exists for, and roughly half the user base.
- [ ] iPad delivery goes through the `IOSSaveSheet` and saves to Files.
- [ ] A batch refused by the pre-flight cap shows the actionable message, not a crash.
- [ ] Cancel mid-batch delivers the completed patterns and names the rest.

## Out of scope for v1

C (bulk social + bulk mockup export) and D (coordinating patterns in one mockup) are named in the four-way
split above and each need their own spec. Nothing in v1 should be built in a way that blocks them — that
is the entire reason architecture option 2 was chosen over option 1.

## Open items carried into implementation

- The device-dependent ceiling for the pre-flight output-size cap needs a real number. Derive it from the
  existing iPad canvas ceiling constants in `imageUtils.ts` rather than inventing one.
- `detectOriginalDPI()` (`imageScaler.ts:12-16`) is a stub returning a hardcoded 150. v1 wires
  `extractDpiFromFile()` for batch intake. Whether the stub is also replaced on the single-pattern path is
  an implementation decision, not a design one — but it should not be left returning a constant with a
  TODO once a real detector is wired in beside it.
