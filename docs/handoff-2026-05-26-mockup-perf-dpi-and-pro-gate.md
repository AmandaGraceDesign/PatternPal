---
task: Mockup individual-modal perf + DPI metadata + Pro re-verify gate
status: All four fixes shipped to production. Two follow-up bugs noted below.
date: 2026-05-26
branch: main
priority: Done. Verify on live site after Vercel deploy completes.
---

## Shipped today (in order)

| Commit | Fix | What it does |
|---|---|---|
| `30d7740` | `perf(mockup-modal): use medium-res sources for tweak display` | Individual mockup editor now opens in <1s instead of up to 60s. Was loading full-res 3000×4500 source PNGs (5-25 MB each) even though output capped at 1500px. Added `preview={!isCapturingFullRes}` so display reuses the 800px medium-res sibling PNGs the gallery already decoded. Full-res reloads only on Download. |
| `2089254` | `fix(mockup-download): embed DPI metadata` | Mockup PNG now opens in Photoshop as 10×15" at 300 DPI instead of 41.667×62.5" at 72 DPI. Refactored the download callback so both watermarked and non-watermarked paths run through `injectPngDpi(blob, dpi)` using the user's current export DPI. |
| `f3ade1a` | `feat(mockup-modal): show generating spinner during full-res download render` | After typing the filename, Download button now shows a disabled spinner + "Generating high-res…" while the full-res re-render runs (10-60s the first time, since full-res PNGs aren't in the medium-res image cache). Restores to "Download" after the file downloads. |
| `daa2d2f` | `fix(mockup-download): trust client-side Pro check on Download click` | Real Pro users were being shown the Upgrade modal when clicking Download because `/api/pro/verify` was returning 401/403 even though their client-side Clerk metadata says Pro. Skip the server re-verify when `proAllowed` is already true client-side. |

## How the four fixes interact

1. User clicks a gallery thumbnail → modal opens fast (`30d7740`).
2. User tweaks scale/shadow/color → still fast (medium-res sources in cache).
3. User clicks **Download** → no upgrade modal popup (`daa2d2f`), spinner appears immediately (`f3ade1a`).
4. Full-res re-render runs (10-60s the first time), then PNG downloads with correct DPI metadata (`2089254`).

## Files touched

- [src/components/layout/AdvancedToolsBar.tsx](src/components/layout/AdvancedToolsBar.tsx) — all four commits
- [src/components/mockups/MockupModal.tsx](src/components/mockups/MockupModal.tsx) — added `isDownloading` prop (`f3ade1a`)
- No other files changed. `injectPngDpi` from `src/lib/utils/dpiMetadata.ts` was already present, just wasn't wired into the mockup download path.

## Follow-ups (NOT shipped — fresh session worth)

### 1. Why does `/api/pro/verify` return 401/403 for a genuinely-Pro user?
The Download-click verify failure that prompted commit `daa2d2f` is a real underlying bug. We worked around it by trusting the client-side check, but didn't root-cause it. Likely candidates:
- Clerk publicMetadata says Pro but server-side `checkProStatus(userId)` returns false → suggests Stripe webhook didn't update Clerk metadata correctly, or `checkProStatus` is checking a different source than the client.
- `auth()` failing intermittently on the server — possibly related to the iPad/Clerk session story below.

Investigate: [app/api/pro/verify/route.ts](app/api/pro/verify/route.ts), the `checkProStatus` implementation in `src/lib/auth`, and recent Stripe webhook handlers.

### 2. iPad login timeout (carried over from earlier today)
See [docs/handoff-2026-05-26-ipad-login-clerk-ruled-out.md](docs/handoff-2026-05-26-ipad-login-clerk-ruled-out.md). User asked to test Chrome on iPad to see if the 5-10 min logout is Safari-specific. **Awaiting her result**, plus still need to know if she opens Pattern Pal via Safari URL or a home-screen icon.

### 3. UX question the user raised (not implemented, recommended skip)
She asked about adding 72/150/300 DPI options to mockup download. My recommendation: skip — DPI is invisible metadata, pixel dimensions don't change. If file size becomes a real complaint, add a PNG/JPG toggle instead (5-10× smaller files for web use).

## Side issue user is currently working on (not in our scope)

User is investigating the **white seam line** on her 1500×1500 ×4 = 3000×3000 pattern. She believes this is on her pattern-creation side, not in Pattern Pal. If she comes back and it IS a Pattern Pal bug, relevant code is the seamless-tile preview rendering and the export composition path — do not preemptively investigate.

## What to do FIRST in a fresh session

1. Read this doc.
2. Verify her Chrome-on-iPad test result for the login timeout (handoff-2026-05-26-ipad-login-clerk-ruled-out.md).
3. If she reports the verify bug from #1 above is still confusing/visible anywhere else, investigate `checkProStatus`.

## Repo state at end of session

- Branch: `main`, clean, all pushed to origin.
- Recent commits on top of `main`:
  - `daa2d2f` fix(mockup-download): trust client-side Pro check on Download click
  - `f3ade1a` feat(mockup-modal): show generating spinner during full-res download render
  - `2089254` fix(mockup-download): embed DPI metadata so Photoshop reads correct inches
  - `30d7740` perf(mockup-modal): use medium-res sources for tweak display
  - `bee2031` docs: handoffs for launch week + ipad login investigation
