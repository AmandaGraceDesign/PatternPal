---
task: Investigate iPad login timeout — user logged out every 5-10 min during normal use
status: Not started. User report received 2026-05-26; needs fresh-session investigation.
date: 2026-05-26
branch: main
priority: HIGH — user is actively losing work / time
---

## User report (verbatim)

> "I use it on my iPad and I have noticed I log in, notice I need to fix something, go work on it, export, go back into pattern pal and I am logged out. I literally have logged in every 5-10 minutes for the last couple of hours. Can the timeout be increased?"

User is on iPad. App is `pattern-tester.amandagracedesign.com` (production). Auth is Clerk.

## What we know

- Auth provider: **Clerk** (`@clerk/nextjs`)
- Clerk subdomain: `clerk.amandagracedesign.com` (per CSP in [app/layout.tsx](app/layout.tsx))
- Middleware: [proxy.ts](proxy.ts) — single line: `export default clerkMiddleware();` (no custom session config)
- Clerk provider wraps the app in [app/layout.tsx:29](app/layout.tsx#L29) with only `localization` customization — no session-lifetime overrides
- No `sessionTokenTemplate` or similar session config anywhere in repo (grepped: only matches in `app/api/checkout/route.ts` which is Stripe, not Clerk session config)

## Hypotheses, ranked by likelihood

### 1. Clerk Session TTL is set too short in the Clerk dashboard
Most likely cause. Clerk's defaults are:
- Session token TTL: 60 seconds (this is the JWT, refreshes automatically — NOT the logout timer)
- Inactivity timeout: configurable, often defaults to 7 days
- Maximum session lifetime: configurable

If "Inactivity timeout" is set low (e.g., 5-10 min — which matches her report exactly), iPad backgrounding the tab while she fixes the pattern in another app causes Clerk to expire the session.

**Where to check:** Clerk dashboard → Sessions → "Inactivity timeout" and "Maximum session lifetime."

**Fix:** Raise inactivity timeout to 7 days (Clerk's default for new apps). Pure dashboard change, no code.

### 2. iOS Safari ITP is purging Clerk's cookies
iOS Safari's Intelligent Tracking Prevention (ITP) aggressively purges cookies from domains it classifies as third-party or "tracker-like." Clerk lives at `clerk.amandagracedesign.com` — a subdomain of the app. **If Clerk is configured as a "satellite" domain rather than a true first-party setup**, ITP may treat its session cookies as third-party and purge them after ~1 day of inactivity or sooner.

**Where to check:**
- Clerk dashboard → Domains → confirm `clerk.amandagracedesign.com` is registered as the primary or as a "first-party" domain, not a "satellite."
- Also check that the production DNS for `clerk.amandagracedesign.com` is a CNAME pointing to Clerk's edge, not a redirect.

**Fix:** If misconfigured, set up first-party domain in Clerk dashboard. May require DNS verification.

### 3. iPad PWA / standalone mode cookie isolation
If she has added Pattern Pal to her iPad home screen as a PWA-like icon, iOS isolates the cookie jar between Safari and the standalone webview. Logging in via Safari ≠ logged in in the home-screen app.

**Where to check:** Ask her if she added Pattern Pal to her home screen. If yes, that's the cause — recommend she opens via Safari, or we add a manifest that handles standalone correctly.

### 4. JWT cookie expires aggressively because of `Set-Cookie` lifetime / Secure / SameSite mismatch
Less likely but possible. Clerk sets cookies with `SameSite=Lax`, `Secure`, `HttpOnly`. If the production proxy or Vercel edge is rewriting these, they'd be dropped.

**Where to check:** Network tab in Safari Web Inspector (or remote-debug iPad) — inspect the `__session` cookie's Max-Age and SameSite values on a fresh login.

## Recommended investigation order

1. **First**: Open Clerk dashboard, check Sessions tab for inactivity / max lifetime values. If they're low, raise them. Many issues evaporate here.
2. **Second**: Confirm `clerk.amandagracedesign.com` setup is first-party in Clerk dashboard.
3. **Third**: Ask user whether she's using Safari or a home-screen PWA. Different fix per case.
4. **Fourth (if all above pass)**: Connect a Mac to her iPad via USB, open Safari Web Inspector → Storage → Cookies, watch what happens when the session "expires."

## Files relevant to any code-side fix

- [proxy.ts](proxy.ts) — Clerk middleware. Empty config — would add `{ ... }` options here if needed.
- [app/layout.tsx](app/layout.tsx) — ClerkProvider. Could add session-related props here.
- Clerk environment variables — `CLERK_*` vars in Vercel project settings; do NOT log or change without verifying.

## What to do FIRST in a fresh session

1. Read this doc.
2. Ask user: "Are you opening Pattern Pal via Safari, or as a home-screen / standalone app?"
3. While she answers, log into Clerk dashboard (her account: contact@amandagracedesign.com) → Sessions tab → screenshot current inactivity timeout + max session lifetime values. Those settings alone will likely diagnose this.
4. Based on findings: either a Clerk dashboard change (no code), a `proxy.ts` config tweak, or a Clerk domain-setup fix.

## Out of scope for this task

The second user issue (seam line on her 1500×1500 ×4 = 3000×3000 pattern) is NOT being investigated. User explicitly deferred it.
