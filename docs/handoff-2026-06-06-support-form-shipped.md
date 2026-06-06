# Handoff — 2026-06-06 — In-app support form shipped

## What shipped this session

### ✅ "Report a problem" form (committed `9e11e8b`)
Replaced the Help button's `mailto:` with a real in-app modal that **emails the
report directly** — no mail app, no copy/paste. The old `mailto:` relied on users
sending from their own mail client and most never did, which is why "no one
answers the questions." This was originally scoped as Option A (mailto, no
backend); the user (correctly) pushed for a true form, so we added a small
backend instead.

**Delivery mechanism:** Gmail SMTP via Nodemailer (user's choice over Resend /
form relays). Sends from and to `education@amandagracedesign.com` (a real
mailbox). `Reply-To` is set to the reporter so replies go to the right person.

**Implementation:**
- `app/api/support/route.ts` — `runtime = 'nodejs'`. Parses `FormData`, sends via
  `smtp.gmail.com:465` (Nodemailer). Recipient = `SUPPORT_TO` || `GMAIL_USER`.
  Optional screenshot: validated as `image/*`, capped at **4MB** (Vercel body
  limit). Strips whitespace from the app password. Friendly errors, never leaks.
- `src/components/support/SupportModal.tsx` — prefilled email (from Clerk if
  signed in), auto-detected **Device** + **Browser** dropdowns (iPad caught via
  `maxTouchPoints > 1`, editable), **required** "What's happening?" textarea
  (the gate), optional screenshot with the reworded artwork-safety reassurance,
  "Sent! 💛" success state, inline errors, Escape/overlay close. Touch/iPad
  parity. Silently attaches screen size + signed-in state + full userAgent.
- `src/components/layout/TopBar.tsx` — Help button opens the modal (was `mailto:`).
- `package.json` — added `nodemailer` + `@types/nodemailer`.

**Env vars (REQUIRED for sending):**
- `GMAIL_USER` = `education@amandagracedesign.com`
- `GMAIL_APP_PASSWORD` = 16-char Google App Password (needs 2FA on the account)
- `SUPPORT_TO` (optional) — defaults to `GMAIL_USER`
Set in `.env.local` (git-ignored ✓) **and** in Vercel (user already added + redeployed).

**Verification:** `npx tsc --noEmit` clean. User tested locally end-to-end —
**test email received**, Reply-To confirmed. Vercel redeployed with env vars.
**Pushed to `main`** (commits `9e11e8b`, `2b69be0`, `9c7d27f`).

### ✅ Top-bar cleanup (committed `9c7d27f`)
Consolidated the two redundant email entry points (Help + Feedback) into a
single **Support** button that opens the form. Removed the Feedback `mailto:`.
Right-side top bar is now: **Tour · Support · Upgrade**. Modal heading stays
"Report a problem" (user's call).

## Open / decisions pending
- No automated test for `/api/support` (would need to mock Nodemailer). Manual
  verification only so far.

## Still on the backlog (from the 2026-06-05 handoff)
- **No error boundary** (`app/error.tsx` / `app/global-error.tsx`). Add one that
  auto-reloads on `ChunkLoadError` — leading cause of the iPad "Application error"
  white-screen. Cheap, high-value. **Recommended next.**
- **No error reporting / source maps** — free Sentry + hidden source maps
  (~20 min). User interested, deferred.
- CMYK warning: still no real end-to-end test with an actual CMYK JPEG from
  Illustrator (~30s manual check).

## Suggested next session
Build the **error boundary** (the original iPad white-screen safety net), then
optionally Sentry.
