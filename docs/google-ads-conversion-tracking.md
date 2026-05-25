# Google Ads Conversion Tracking — Implementation Handoff

**Date:** 2026-03-27
**Status:** Code complete, awaiting Google Ads account IDs

---

## What Was Built

Google Ads conversion tracking for 3 events: free account signup, Pro trial (monthly), and Pro trial (annual). Conversions fire client-side at the exact moment the user completes each action — no thank-you pages needed.

---

## Files Changed / Created

| File | Change |
|------|--------|
| `src/lib/gtag.ts` | **NEW** — Conversion helper with 3 event types and value mapping |
| `src/types/gtag.d.ts` | **NEW** — TypeScript declarations for `window.gtag` and `window.dataLayer` |
| `app/_components/SignupConversion.tsx` | **NEW** — Fires `freeSignup` conversion when a new Clerk account is detected (<60s old) |
| `app/_components/CheckoutConversion.tsx` | **NEW** — Fires `proTrialMonthly` or `proTrialAnnual` when Stripe redirects back with `?checkout=success&plan=monthly\|yearly` |
| `app/layout.tsx` | **EDITED** — Added `gtag('js', new Date())` and `gtag('config', 'AW-XXXXXXXXXX')` to consent-defaults script |
| `app/page.tsx` | **EDITED** — Mounted `<SignupConversion />` and `<CheckoutConversion />` components |
| `app/api/checkout/route.ts` | **EDITED** — Added `&plan=${plan}` to Stripe `success_url` so redirect carries the billing interval |
| `next.config.ts` | **EDITED** — Added `googleadservices.com` and `googleads.g.doubleclick.net` to CSP `script-src`, `img-src`, and `connect-src` |

---

## Placeholders to Replace

There are **4 placeholders** across 2 files. All use the format `AW-XXXXXXXXXX` or `AW-XXXXXXXXXX/XXXXXXXXXXXX`.

### 1. Google Ads Account ID (1 location)

**File:** `app/layout.tsx` line 68
```js
gtag("config", "AW-XXXXXXXXXX");
```
Replace `AW-XXXXXXXXXX` with your Google Ads conversion ID (e.g., `AW-123456789`).

### 2. Conversion Labels (3 locations)

**File:** `src/lib/gtag.ts` lines 1, 4-6
```ts
export const GA_ADS_ID = 'AW-XXXXXXXXXX'          // same account ID as above

export const CONVERSION_IDS = {
  freeSignup:      'AW-XXXXXXXXXX/XXXXXXXXXXXX',   // Free Signup conversion label
  proTrialMonthly: 'AW-XXXXXXXXXX/XXXXXXXXXXXX',   // Pro Monthly conversion label
  proTrialAnnual:  'AW-XXXXXXXXXX/XXXXXXXXXXXX',   // Pro Annual conversion label
}
```

---

## How to Get the IDs from Google Ads

1. Go to **Google Ads > Goals > Conversions > Summary**
2. Click **+ New conversion action** > **Website**
3. Create 3 conversion actions:

| Conversion Action | Category | Value | Count |
|---|---|---|---|
| Free Signup | Sign-up | $0.00 | One |
| Pro Trial Monthly | Purchase | $7.99 | One |
| Pro Trial Annual | Purchase | $79.92 | One |

4. For each action, click **Use Google Tag** > **Install the tag yourself**
5. Copy the conversion ID (`AW-XXXXXXXXXX`) and label (`XXXXXXXXXXXX`) from the snippet shown
6. The full `send_to` value is `AW-{ID}/{LABEL}` — paste that into `CONVERSION_IDS` in `src/lib/gtag.ts`

---

## How Each Conversion Fires

### Free Signup ($0)
- **Trigger:** Clerk's `useUser()` hook detects `isSignedIn` with `user.createdAt` < 60 seconds ago
- **Component:** `app/_components/SignupConversion.tsx`
- **Dedup:** `sessionStorage` key `pp_signup_conversion_fired` + React ref prevents double-fires
- **Flow:** User clicks Sign Up → Clerk modal → account created → component detects new account → `fireConversion('freeSignup')`

### Pro Trial Monthly ($7.99)
- **Trigger:** URL contains `?checkout=success&plan=monthly` after Stripe redirect
- **Component:** `app/_components/CheckoutConversion.tsx`
- **Flow:** User picks Monthly → Stripe Checkout → success redirect → component reads `plan=monthly` → `fireConversion('proTrialMonthly')`

### Pro Trial Annual ($79.92)
- **Trigger:** URL contains `?checkout=success&plan=yearly` after Stripe redirect
- **Component:** `app/_components/CheckoutConversion.tsx`
- **Flow:** User picks Annual → Stripe Checkout → success redirect → component reads `plan=yearly` → `fireConversion('proTrialAnnual')`

---

## GTM Interaction

The app already has GTM (`GTM-5PM5T8RC`) installed. The `gtag('config', 'AW-...')` call in `layout.tsx` works independently of GTM — conversion pings go directly to Google Ads.

**Important:** Do NOT also add a Google Ads conversion tag in GTM for the same events, or conversions will be double-counted. Choose one path:
- **Option A (current):** Direct gtag.js — conversions fire via `window.gtag()` calls in the code (this is what's implemented)
- **Option B:** GTM-managed — remove the `gtag('config', 'AW-...')` from layout.tsx and the `fireConversion()` calls, then set up conversion tags in GTM triggered by dataLayer events

---

## Cookiebot / Consent

The existing Cookiebot setup sets all consent signals to `denied` by default. Google Ads respects consent mode — conversion pings will be modeled (not dropped) when consent is denied, and fully tracked when granted. No changes needed here.

---

## Testing

1. Replace placeholders with real IDs
2. Deploy to preview or production
3. Install [Google Tag Assistant](https://tagassistant.google.com/) browser extension
4. Test free signup: create a new account → verify `freeSignup` conversion fires in Tag Assistant
5. Test monthly purchase: go through checkout with monthly plan → verify `proTrialMonthly` fires on redirect
6. Test annual purchase: same with yearly plan → verify `proTrialAnnual` fires
7. Check Google Ads > Conversions dashboard for recorded events (may take a few hours to appear)
