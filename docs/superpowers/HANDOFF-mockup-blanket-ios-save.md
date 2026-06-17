# Handoff — Picnic blanket v2 swap + iPad download fixes

**Updated:** 2026-06-17 · **Branch:** `feat/mockup-social-exports` · **HEAD:** `fade045` · **NOT merged**

## Status

Three things done this session, all committed in `fade045`:

1. **Picnic blanket art swapped to v2** — DONE, automated checks pass.
2. **Download-size grid no longer clips labels on 12.9" iPad portrait** — DONE + confirmed by Mandy on iPad.
3. **Multi-size mockup downloads → "Save N images to Photos" on iOS** — CODE DONE, **NOT yet verifiable** because it needs HTTPS (see blocker).

Automated gates at commit time: `tsc --noEmit` = 0 errors · `vitest run` = 80/80.

## The one open blocker (do this first next session)

The iOS "Save to Photos or Files" sheet uses `navigator.share`, which **only exists in a secure context (HTTPS/localhost)**. Mandy has been testing over the LAN **HTTP** dev server (`http://192.168.1.162:3000`), where the API is absent — so Easyscale, Social, AND Mockups all fall back to a plain anchor-download (Downloads folder / Safari's "Do you want to download …zip" prompt). This is environmental, NOT a code bug. See memory [[web_share_requires_https]].

**To verify the Photos flow:** serve over HTTPS — `npm run tunnel` (ngrok; Claude is blocked by the safety classifier from starting it, so Mandy runs it) and open the printed `https://…ngrok…` URL on the iPad, OR a `vercel` preview. Then a mockup download should show "Save to Photos or Files" (single = 1 image, multiple = "Save N images"). Production (HTTPS) will work regardless.

## What shipped (commit `fade045`)

### Picnic blanket v2
- Overwrote canonical full-res `public/mockups/v2/picnic-blanket{,-main-mask,-shadow,-color-mask}.png` with the new squared-off blanket photo; regenerated the `medium/` set (533×800) and `thumbnails/picnic-blanket.jpg` (133×200). Deleted the redundant `picnic-blanket2-*` upload files.
- `templateRegistry.ts` `picnic-blanket`: `patternArea` height `3251 → 3335` (taller blanket, from new mask bbox `x662 y0 w2338 h3335`) on both the top-level and the `main` zone; `patternAngle: -5 → 0` (new blanket is axis-aligned, not tilted).
- **Still wants Mandy's visual confirm** (pattern fills to fringe, looks straight) — testable over HTTP.

### Download grid (confirmed working)
- `src/components/mockups/MockupDownloadMenu.tsx`: root is now `@container`; grid is `grid-cols-1 @[480px]:grid-cols-2`. Tracks the controls-rail width (not viewport) so the ~440px rail on a 12.9" iPad portrait gets a clean single column instead of clipped `F..`/`P..` labels.

### iOS multi-image save (needs HTTPS to verify)
- `src/lib/utils/iosSaveQueue.ts`: task now carries `files: IOSSaveFile[]`; added `pushIOSSaveTaskMulti(files)`; `pushIOSSaveTask` still takes a single blob.
- `src/components/ios/IOSSaveSheet.tsx`: renders/shares one OR many files; heading + button adapt ("Save N images…"); fallback anchor-downloads each.
- `src/lib/utils/downloadCanvas.ts`: exported `isIOS()`.
- `src/lib/utils/mockupSocialExport.ts`: in `downloadMockupSocialSizes`, the multi-file branch now, on iOS, calls `pushIOSSaveTaskMulti` with all selected PNGs instead of zipping; desktop still zips. Single-file path unchanged.
- **Social export (RepeatExportModal) left as-is** — still zips multiple; Mandy was OK with social. Could be unified later for consistency.

## Other live state
- Dev server running on port 3000 (`next dev --webpack -H 0.0.0.0`); LAN IP has been changing between `192.168.1.162` and `10.0.0.144` — re-check with `ipconfig getifaddr en0`.
- Branch not pushed/merged. Two-pane modal work from the prior handoff (`HANDOFF-mockup-two-pane.md`) is also still pending real-iPad UAT.
