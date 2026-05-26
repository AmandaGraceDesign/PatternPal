---
task: PatternPal launch — exports reorg, seam-inspector back fix, Vercel auto-deploy repaired
status: 3 commits pushed to origin/main; production build `pattern-flu4pf37s` triggered after GitHub App reconnect. All 96 commits (full v2 launch payload) are now deploying.
date: 2026-05-26
branch: main (in sync with origin)
---

## What shipped this session

Three commits pushed on top of yesterday's color-overlay fix:

1. `8f2bd57` refactor(exports): split Pattern Fill into Easyscale picker + Social Media card
2. `4468939` fix(seam-inspector): preserve pattern state when Back is clicked
3. `f3994c9` test: empty commit used to verify Vercel auto-deploy (no code changes — kept in history)

## Exports toolbar reorg

The "Pattern Fill Export" card is gone. Its two destinations were resurfaced:

- **Easyscale Export** card now opens a small picker (POD/Spoonflower vs Cricut/Silhouette). POD opens the existing `EasyscaleExportModal`; Cricut opens `RepeatExportModal` with new `initialMode='cricut'`.
- **Social Media Export** card is new — its own toolbar card, positioned immediately left of Mockups. Opens `RepeatExportModal` with `initialMode='social'`.

New Pro toolbar order: Easyscale → Pattern Analysis → Seam Analyzer → Social Media → Mockups.

`RepeatExportModal` got an optional `initialMode` prop that skips its internal picker and hides the back-to-picker button when entered directly (back button still appears on the social preview step to return to size select).

Files: [src/components/layout/AdvancedToolsBar.tsx](src/components/layout/AdvancedToolsBar.tsx), [src/components/export/RepeatExportModal.tsx](src/components/export/RepeatExportModal.tsx).

## Seam Inspector back button fix

`handleBack` on [app/seam-inspector/page.tsx:121](app/seam-inspector/page.tsx#L121) previously fell through to `window.history.back()` when `window.opener` was null. That navigation re-mounts the home page and wipes the in-memory pattern. Removed the destructive fallback — always calls `window.close()` now. Worst case if close fails silently: tab stays open, pattern preserved.

## Pre-push audit

Spawned two parallel agents — security + iPad/touch parity. Both reported clean for blocking issues:

- **Security:** zero secrets in diff, all API routes auth-gated, Stripe webhook signature-verified, filename sanitization consistent. One LOW (Stripe webhook matcher regex could anchor with `$` — post-launch cleanup).
- **iPad/touch:** new Easyscale picker buttons are py-4 (~56px), new Social Media card inherits 58px-tall ToolCard, mockup drag uses Pointer Events + setPointerCapture + `touch-action: none`, IOSSaveSheet calls `navigator.share` synchronously inside the gesture.
- **Pre-existing UX cracks (not new in these commits):** modal close X buttons are ~20-28px (below 44pt iOS); gallery tab scroll + backdrop click could conflict in theory. Not launch-blocking — backdrop tap and ESC still close.

## Vercel auto-deploy was broken

After pushing the 96 commits, `vercel list` showed no new production deploy. Last prod deploy was 25 days old.

False leads burned: I told her to check repo-level webhooks (wrong — Vercel uses a GitHub App, not legacy webhooks); checked "Ignored Build Step", "Production Branch", "Environments" — all correct (`main`, Automatic, etc.).

**Actual cause:** The Vercel GitHub App on the AmandaGraceDesign org needed reconnecting. Yesterday's `launch-preview` testing worked (those preview deploys fired) but production-branch deploys hadn't been exercised in 25d and the integration's main-branch path had drifted. After Mandy hit Configure → Save on the Vercel GitHub App page (set to "All repositories"), the empty commit `f3994c9` triggered `pattern-flu4pf37s` as a Production build within seconds.

If this recurs: GitHub → Personal Settings → Applications → Vercel → Configure → Save. That alone resets the connection.

## What's still TODO post-launch

Carry-forward from yesterday's handoff + new items:

- **iPad real-device verification of iOS share sheet** against production (`pattern-tester.amandagracedesign.com` or primary domain) — only thing that genuinely needed prod to test
- **Spot-check colorOverlay mockups other than boys-pjs/apron** against PSD references — flat-multiply is now their default too; none reported broken
- iPad Save-to-Photos for Easyscale + Pattern Fill exports (different code path from social/mockup)
- Mockup-modal "13.64" scale label mystery — needs Mandy screenshot
- nursery-wallpaper / wrapping-paper-roll `colorOverlayLabel` tuning
- Rename "Entry Wallpaper" `colorOverlayLabel`
- Close-X tap targets on modals (mockup, repeat-export, easyscale, gallery) → upgrade from ~20-28px to ≥44px
- Stripe webhook matcher regex: tighten to `api/stripe/webhook$` in `proxy.ts`
- Remove the empty test commit `f3994c9` from history? — Optional, just a one-line "test:" commit. Leave it.

## Untracked files at end of session

Not committed (Mandy's call later):
- `docs/handoff-2026-05-25-launch-day.md`
- `docs/handoff-2026-05-26-color-overlay-fix.md`
- `docs/handoff-2026-05-26-exports-reorg-and-launch.md` (this file)
- `scripts/link-env-to-preview.sh`

## To verify launch is live

```
vercel list --yes | head -3
# pattern-flu4pf37s should show Status=Ready, Environment=Production
```

Then open the production domain in a real iPad browser and walk through:
1. Upload a pattern
2. Easyscale Export → picker → POD path
3. Easyscale Export → picker → Cricut path
4. Social Media Export → pick a size → preview → save (the iOS share sheet test)
5. Mockups → pick any → tweak modal → drag to reposition → download
6. Seam Analyzer → opens new tab → Back closes cleanly without losing pattern
