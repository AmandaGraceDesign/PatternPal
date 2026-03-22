# External Integrations

**Analysis Date:** 2026-03-22

## APIs & External Services

**Authentication:**
- Clerk - Full user auth, session management, and user metadata storage
  - SDK/Client: `@clerk/nextjs` ^6.37.2
  - Auth: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` (standard Clerk env vars)
  - Custom domain: `clerk.amandagracedesign.com` (configured in `next.config.ts` CSP)
  - Pro status stored in `user.publicMetadata.pro` (boolean)
  - Stripe customer/subscription IDs stored in `user.privateMetadata.stripeCustomerId` / `stripeSubscriptionId`

**Payments:**
- Stripe - Subscription billing for Pro tier
  - SDK/Client: `stripe` ^20.2.0 (server), `@stripe/react-stripe-js` + `@stripe/stripe-js` (client)
  - Auth: `STRIPE_SECRET_KEY`
  - API version: `2025-12-15.clover`
  - Plans: monthly (`STRIPE_PRICE_MONTHLY`) and yearly (`STRIPE_PRICE_YEARLY`)
  - Default trial: 3 days (payment method required upfront)
  - Promo code `affiliate20` grants 120-day free trial (hardcoded in `app/api/checkout/route.ts`)

**Affiliate Tracking:**
- Rewardful - Affiliate referral tracking
  - Script: `https://r.wdfl.co/rw.js` loaded in `app/layout.tsx`
  - Account ID: `97736d` (hardcoded in layout script tag)
  - Client-side types declared in `src/types/rewardful.d.ts`
  - Referral token passed as `client_reference_id` in Stripe checkout sessions

**Analytics:**
- Vercel Analytics - Page view and event tracking
  - SDK: `@vercel/analytics` ^1.6.1 (installed; import not observed in current layout — may be pending activation)

## Data Storage

**Databases:**
- None detected. No Supabase, Prisma, or database client found in `src/lib/supabase/` (directory exists but is empty) or elsewhere in the codebase.

**User Data Storage:**
- All user state (Pro status, Stripe IDs) stored exclusively in Clerk user metadata:
  - `publicMetadata.pro` — boolean Pro flag readable client-side
  - `privateMetadata.stripeCustomerId` — Stripe customer ID (server-only)
  - `privateMetadata.stripeSubscriptionId` — active subscription ID (server-only)
  - `privateMetadata.stripePriceId` — active price ID (server-only)
  - `privateMetadata.stripeStatus` — Stripe subscription status (server-only)

**File Storage:**
- Local filesystem only — pattern images are uploaded and processed in-browser (Canvas API); ZIP exports are generated client-side via `jszip`

**Caching:**
- None detected

## Authentication & Identity

**Auth Provider:**
- Clerk (`@clerk/nextjs`)
  - Implementation: `ClerkProvider` wraps app in `app/layout.tsx`
  - Server auth: `auth()` and `clerkClient()` from `@clerk/nextjs/server` used in all API routes
  - Auth helper: `src/lib/auth.ts` wraps Clerk with app-specific `User`/`Session` types and Pro-check utilities
  - Pro gating: `src/lib/utils/checkProStatus.ts` and `src/lib/auth.ts:requireProUser()` enforce Pro access
  - No middleware file detected — route protection handled per-route in API handlers

## Monitoring & Observability

**Error Tracking:**
- None detected (no Sentry, Datadog, or similar SDK found)

**Logs:**
- `console.error` and `console.log` used directly in API route handlers
- Development-only logging guarded by `process.env.NODE_ENV === 'development'` checks in several routes (GDPR-aware: no userId logged in production in `app/api/create-portal-link/route.ts`)

## CI/CD & Deployment

**Hosting:**
- Vercel (inferred from `@vercel/analytics`, CSP allowing Vercel domains, production domain `pattern-tester.amandagracedesign.com`)

**CI Pipeline:**
- Not detected (no `.github/workflows/`, no `vercel.json` found at project root)

## Webhooks & Callbacks

**Incoming (from Stripe):**
- `POST /api/stripe/webhook` (`app/api/stripe/webhook/route.ts`) — handles subscription lifecycle:
  - `customer.subscription.created` → sets `publicMetadata.pro = true`
  - `customer.subscription.updated` → grants or revokes Pro based on subscription status
  - `customer.subscription.deleted` → sets `publicMetadata.pro = false`
  - `customer.subscription.trial_will_end` → logs email (notification email not yet implemented)
  - `invoice.payment_failed` → sets `publicMetadata.pro = false`
  - Webhook signature verified with `STRIPE_WEBHOOK_SECRET`

**Outgoing:**
- None detected

## API Routes Summary

All API routes live in `app/api/`:

| Route | Method | Purpose |
|---|---|---|
| `/api/checkout` | POST | Create Stripe Checkout session (redirects to hosted page) |
| `/api/stripe/create-subscription` | POST | Create subscription with payment intent (embedded flow) |
| `/api/stripe/portal` | POST | Create Stripe Billing Portal session |
| `/api/create-portal-link` | POST | Duplicate portal link endpoint (legacy, returns to `/settings`) |
| `/api/stripe/webhook` | POST | Stripe webhook handler |
| `/api/pro/verify` | POST | Server-side Pro status check (called from client export flow) |

## Environment Configuration

**Required env vars:**
- `STRIPE_SECRET_KEY` — Stripe secret API key
- `STRIPE_WEBHOOK_SECRET` — Stripe webhook signing secret
- `STRIPE_PRICE_MONTHLY` — Stripe Price ID for monthly plan
- `STRIPE_PRICE_YEARLY` — Stripe Price ID for yearly plan
- `NEXT_PUBLIC_APP_URL` — Public app URL (used for CSRF origin validation and Stripe return URLs)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — Clerk publishable key
- `CLERK_SECRET_KEY` — Clerk server-side secret key

**Optional env vars:**
- `APP_URL` — Legacy alias for `NEXT_PUBLIC_APP_URL`

**Secrets location:**
- `.env.local` (present at project root, not committed)

---

*Integration audit: 2026-03-22*
