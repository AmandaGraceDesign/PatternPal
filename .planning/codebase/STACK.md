# Technology Stack

**Analysis Date:** 2026-03-22

## Languages

**Primary:**
- TypeScript 5.x - All application code in `src/`, `app/`, config files

**Secondary:**
- CSS - Global styles in `app/globals.css`

## Runtime

**Environment:**
- Node.js v22.16.0 (detected from active runtime; no `.nvmrc` pinned)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present (lockfileVersion 3)

## Frameworks

**Core:**
- Next.js ^16.0.7 - App Router, API routes, SSR/SSG. Webpack bundler enforced via `--webpack` flag in `dev` and `build` scripts (Turbopack explicitly disabled)
- React ^19.2.1 - UI rendering
- React DOM ^19.2.1 - DOM bindings

**Styling:**
- Tailwind CSS ^4 - Utility-first CSS, configured via `postcss.config.mjs` with `@tailwindcss/postcss` plugin
- clsx ^2.1.1 - Conditional classname composition
- tailwind-merge ^3.4.0 - Merge Tailwind classes without conflicts

**State Management:**
- Zustand ^5.0.9 - Client-side state; package is present but store files not yet found in `src/` (may be in components or app root)

**Fonts:**
- Geist ^1.5.1 - Vercel Geist font family; `GeistSans` and `GeistMono` applied in `app/layout.tsx`

**Build/Dev:**
- TypeScript compiler - `tsconfig.json` targets ES2017, strict mode on
- ESLint ^9 - `eslint.config.mjs` uses `eslint-config-next` core-web-vitals + TypeScript rules
- PostCSS - `postcss.config.mjs` drives Tailwind v4 transformation

## Key Dependencies

**Critical:**
- `@clerk/nextjs` ^6.37.2 - Authentication and user management; wraps entire app via `ClerkProvider` in `app/layout.tsx`
- `stripe` ^20.2.0 - Server-side Stripe SDK; used in all billing API routes
- `@stripe/react-stripe-js` ^5.4.1 - React Stripe.js components for client-side payment UI
- `@stripe/stripe-js` ^8.6.3 - Stripe.js browser SDK

**Infrastructure:**
- `@vercel/analytics` ^1.6.1 - Vercel Analytics SDK (installed but not currently imported in observed layout/pages)
- `jszip` ^3.10.1 - Client-side ZIP archive generation for pattern export (`src/lib/utils/exportScaled.ts`)

## Configuration

**Environment:**
- `.env.local` file present (contents not read)
- Required env vars (referenced in source):
  - `STRIPE_SECRET_KEY` - Stripe server-side API key
  - `STRIPE_WEBHOOK_SECRET` - Stripe webhook signature verification
  - `STRIPE_PRICE_MONTHLY` - Stripe price ID for monthly plan
  - `STRIPE_PRICE_YEARLY` - Stripe price ID for yearly plan
  - `NEXT_PUBLIC_APP_URL` - Public-facing production URL; used for CSRF origin validation and return URLs
  - `APP_URL` - Legacy alias for `NEXT_PUBLIC_APP_URL` (referenced in `app/api/stripe/portal/route.ts`)
  - Clerk env vars expected by `@clerk/nextjs` (standard `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`)

**Build:**
- `next.config.ts` - Next.js config; sets strict CSP headers for all non-static routes
- `tsconfig.json` - `@/*` path alias resolves to `./src/*`
- `postcss.config.mjs` - PostCSS with `@tailwindcss/postcss`
- `eslint.config.mjs` - ESLint flat config

## TypeScript Config

- **Target:** ES2017
- **Module resolution:** bundler
- **Strict:** true
- **Path alias:** `@/*` → `./src/*`
- `mockup-system-package/` excluded from compilation

## Platform Requirements

**Development:**
- Node.js (v22 detected)
- npm
- Stripe CLI recommended for webhook testing (see `WEBHOOK_SETUP.md`)

**Production:**
- Vercel (strongly implied by `@vercel/analytics`, Vercel-hosted Clerk domain `clerk.amandagracedesign.com` in CSP, `NEXT_PUBLIC_APP_URL` pointing to `pattern-tester.amandagracedesign.com`)
- Production domain: `https://pattern-tester.amandagracedesign.com`

---

*Stack analysis: 2026-03-22*
