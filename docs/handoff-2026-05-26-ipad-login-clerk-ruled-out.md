---
task: iPad login timeout — Clerk dashboard ruled out, awaiting Chrome-on-iPad test
status: In progress. User testing Chrome on iPad to determine if Safari-specific.
date: 2026-05-26
branch: main
priority: HIGH — user is actively losing sessions every 5-10 min on iPad
supersedes: handoff-2026-05-26-ipad-login-timeout.md
---

## TL;DR

Walked through the Clerk dashboard with the user. Confirmed all Clerk-side settings are healthy. The bug is **not** in Clerk's config. User is now testing **Chrome on iPad** to see if the logout cadence is Safari-specific. Waiting on that result before the next move.

## What we ruled OUT (verified in Clerk dashboard)

| Hypothesis | Status | Evidence |
|---|---|---|
| Clerk inactivity timeout set too low | ❌ Ruled out | Sessions tab: Max lifetime = 7 days, Inactivity timeout = OFF |
| Clerk satellite / third-party domain | ❌ Ruled out | Domains tab: `clerk.amandagracedesign.com` is a verified first-party CNAME (→ frontend-api.clerk.services); SSL issued |
| Allowed subdomains restriction blocking app | ❌ Ruled out | Allowed subdomains toggle is OFF (permissive — any subdomain of `amandagracedesign.com` is allowed). Session cookie scoped to root domain, accessible from `pattern-tester.amandagracedesign.com` |

## What's still in play

### Hypothesis A: iOS Safari memory eviction + Clerk JWT refresh failure
iPadOS aggressively evicts backgrounded Safari tabs. When the user switches to Procreate/Illustrator to fix a pattern, comes back 5–10 min later, Safari restores the tab from disk. Clerk's client SDK re-runs `getToken()`. JWT has expired (Clerk's JWT TTL is 60s and refreshes automatically), but if the refresh request fails (network blip on WiFi sleep), the SDK can mark the user as signed-out and redirect to login.

**This would only affect Safari, not Chrome on iPad.** ← That's why the Chrome test is the key tiebreaker.

### Hypothesis B: Home-screen / PWA standalone webview cookie isolation
**Never confirmed with the user.** Asked three times whether she opens Pattern Pal via Safari URL/bookmark or via a "Add to Home Screen" icon — she hasn't said. If she's using a home-screen icon, iOS standalone webview has an isolated cookie jar and far more aggressive memory eviction than Safari itself.

**The Chrome test will partially answer this.** If Chrome behaves identically badly, it's probably not standalone-webview-specific.

### Hypothesis C (less likely): Network/proxy stripping the `__session` cookie on revalidation
Possible if Vercel edge or the Clerk middleware rewrites cookies in some iPad-specific scenario. Would need Safari Web Inspector remote-debug to confirm.

## App code state (confirmed unchanged)

- [proxy.ts](proxy.ts) — `export default clerkMiddleware();` — no custom session config
- [app/layout.tsx:29](app/layout.tsx#L29) — `<ClerkProvider>` with only `localization` prop, no session lifetime overrides

Code-side is intentionally bare. If we need to fix this in code (vs. user-environment), the levers are inside `clerkMiddleware()` options and `<ClerkProvider>` props.

## What to do FIRST in a fresh session

1. **Read this doc** (you're here).
2. **Ask user: did Chrome on iPad have the same logout cadence?**
   - **Same cadence in Chrome too** → not Safari/ITP-specific. Likely Clerk client SDK behavior on iPadOS, or PWA mode (push for the Safari-vs-home-screen-icon answer again). Investigate Clerk SDK auto-signout-on-network-error path.
   - **Chrome doesn't log her out** → confirmed Safari ITP / memory-eviction issue. Either add `Set-Cookie` `Max-Age` overrides via Clerk's proxy configuration, or migrate to Clerk's recommended iOS-resilient session pattern (e.g., persistent refresh token in localStorage with `__session` cookie fallback).
3. **Get the Safari-vs-home-screen-icon answer.** Still outstanding. This single answer pivots the fix path.

## Side issue user is currently working on (NOT in our scope)

User pivoted to investigating the **white seam line** on her 1500×1500 ×4 = 3000×3000 pattern. She believes this is happening on her pattern-creation side (Procreate / Illustrator / wherever she's building the source pattern), **not** in Pattern Pal's export pipeline. She'll come back if that turns out to be wrong.

If she does come back about the seam line and it IS a Pattern Pal bug, relevant files would be the seamless-tile preview rendering and the export composition path — but do not preemptively investigate.

## Files changed this session

None. Investigation only.

## Files committed this session

- This handoff
- Prior session handoffs that were untracked:
  - `docs/handoff-2026-05-25-launch-day.md`
  - `docs/handoff-2026-05-26-color-overlay-fix.md`
  - `docs/handoff-2026-05-26-exports-reorg-and-launch.md`
  - `docs/handoff-2026-05-26-ipad-login-timeout.md` (superseded by this one but kept for history)
- `scripts/link-env-to-preview.sh` — env bulk-copy utility from earlier launch work
