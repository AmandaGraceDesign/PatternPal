# PatternPal Pro - Engineering Handoff

**Last updated:** March 7, 2026

---

## What is PatternPal Pro?

A browser-based tool for textile/surface pattern designers. Users upload a pattern tile image and can:

- Preview it tiling as a seamless repeat (full-drop, half-drop, half-brick)
- Inspect seams at high zoom
- Analyze contrast, composition, and color harmony
- Preview patterns on product mockups (onesie, pillow, wallpaper, etc.)
- Export print-ready files at multiple physical sizes with correct DPI metadata

Built by Amanda Grace Design. Production URL: `https://pattern-tester.amandagracedesign.com`

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16, App Router, TypeScript, React 19 |
| Styling | Tailwind CSS v4 |
| Auth | Clerk (`@clerk/nextjs` v6) |
| Payments | Stripe (subscriptions, webhooks) |
| Affiliates | Rewardful |
| Analytics | Vercel Analytics |
| Hosting | Vercel |
| Build | Webpack (explicitly forced with `--webpack`, not Turbopack) |

---

## Project Structure

```
app/
  page.tsx                          # Main app - all top-level state lives here
  layout.tsx                        # ClerkProvider, fonts, Rewardful scripts
  api/
    checkout/route.ts               # Stripe checkout session creation
    create-portal-link/route.ts     # Stripe billing portal
    pro/verify/route.ts             # Server-side Pro status check
    stripe/webhook/route.ts         # Stripe webhook (grant/revoke Pro)

src/
  components/
    layout/
      TopBar.tsx                    # Header: branding, auth, upgrade button, tour
      PatternControlsTopBar.tsx     # Upload/Paste, repeat type, scale preview, zoom
      AdvancedToolsBar.tsx          # Tool cards: Export, Analysis, Seam, Mockups
    canvas/
      PatternPreviewCanvas.tsx      # Main tiled pattern preview
    export/
      EasyscaleExportModal.tsx      # Pro: multi-size zip export
      RepeatExportModal.tsx         # Pro: tiled fill image for Silhouette/Cricut
      QuickExportModal.tsx          # Free: limited export
      UpgradeModal.tsx              # Upgrade CTA with Stripe checkout
    analysis/
      PatternAnalysisModal.tsx      # Pro: contrast, composition, color harmony
      SeamInspector.tsx             # Pro: interactive seam inspection
    mockups/
      MockupGalleryModal.tsx        # Pro: mockup template picker
      MockupModal.tsx               # Pro: full-size mockup view
      MockupRenderer.tsx            # Canvas-based mockup renderer
    onboarding/
      WelcomeModal.tsx              # 10-step spotlight tour

  lib/
    auth.ts                         # Server-side Clerk helpers
    tiling/
      PatternTiler.ts               # Core tiling engine (full-drop, half-drop, half-brick)
    analysis/
      patternAnalyzer.ts            # Contrast, composition, color harmony algorithms
    mockups/
      mockupTemplates.ts            # Mockup definitions
    utils/
      convertToFullDrop.ts          # HD/HB tile -> full-drop canvas conversion
      dpiMetadata.ts                # Inject PNG pHYs / JPEG JFIF DPI metadata
      exportScaled.ts               # generateScaledExport() - zip pipeline
      repeatFillExport.ts           # Pattern fill tiling export for Silhouette/Cricut
      imageScaler.ts                # scaleImage(), calculateOriginalSize()
      imageUtils.ts                 # extractDpiFromFile(), validateSvgSafety()
      sanitizeFilename.ts           # Filename sanitizer

public/
  mockups/                          # Mockup template images (PNG)
```

---

## Key Features

### Pattern Preview Canvas
- User uploads/pastes a tile, it tiles across canvas in selected repeat mode
- Supports full-drop, half-drop, half-brick
- Pinch-to-zoom, ctrl+scroll zoom, scale preview (physical size in inches)
- Files read into memory immediately via `FileReader.readAsArrayBuffer()` to support cloud file handles (Google Drive, iCloud) that go stale after one async tick

### EasyScale Export (Pro)
- Batch export at multiple sizes (2-24" + custom) as PNG/JPG/TIFF
- DPI options: 150 or 300
- Correct DPI metadata injected (PNG pHYs before IDAT, JPEG JFIF APP0)
- "Convert to Full Drop" option for HD/HB tiles (for POD sites that only accept full-drop)
- When converting, user's selected size refers to the original tile dimensions; the doubled side scales to 2x automatically
- Server-side Pro verification before export generation

### Pattern Fill Export (Pro)
- Bakes multiple repeats of a tile into a single large fill image for Silhouette Design Store and Cricut Design Space
- Preset target sizes (8x8", 12x12", 16x16", 12x24") plus custom W×H
- DPI: 150 or 300, format: PNG or JPG
- HD/HB tiles auto-converted to full-drop before tiling
- Output always uses whole-number repeats so the image itself is a valid full-drop tile
- Caps at 10,000px per side and ~67M total pixels (browser canvas safety)
- DPI metadata injected same as EasyScale exports

### Quick Export (Free)
- 2 sizes (8" and 12"), JPG only, 150 DPI only

### Pattern Analysis (Pro)
- **Contrast:** Global luminance contrast (high/moderate/soft/very low)
- **Composition:** Visual weight distribution (all-over, focal-point, directional, etc.)
- **Color Harmony:** K-means clustering, detects scheme type (monochromatic, analogous, complementary, etc.)
- All analysis is algorithmic canvas pixel analysis, NOT AI

### Seam Inspector (Pro)
- Three views: 4-Corner Intersection, Top/Bottom seam, Left/Right seam
- Zoom: 50-400%, pan by dragging, keyboard arrow navigation
- Handles iOS 16M pixel canvas limit

### Mockups (Pro)
- Canvas compositing with multiply blend mode
- Templates: Onesie, Fabric Swatch, Wallpaper, Throw Pillow, Gift Box, Journal
- Some templates have adjustable accent colors (trim, bow)

---

## Pro Gating Architecture

Two-layer approach:
1. **Client-side:** `checkClientProStatus(user.publicMetadata)` reads `publicMetadata.pro` from Clerk - used for UI display
2. **Server-side:** `/api/pro/verify` calls Clerk API directly before generating any Pro content

Pro status stored in Clerk `publicMetadata.pro: true/false`. Stripe IDs stored in `privateMetadata`.

Free trial: `localStorage` key `pp_free_tests_used`, max 3 anonymous tests before sign-up prompt (intentionally client-side only).

---

## DPI Pipeline

1. **Import:** `extractDpiFromFile()` reads PNG pHYs or JPEG APP0 chunks to detect DPI
2. **Smart default:** Web-DPI images (72/96) silently upgraded to 150 DPI
3. **Export:** `injectPngDpi()` inserts pHYs chunk before first IDAT (PNG spec requirement), `injectJpegDpi()` writes JFIF APP0 header, `createTiffWithDpi()` creates TIFF with DPI tags
4. **Validated against:** Spoonflower upload (strict PNG validator), Photoshop, Mac Preview

---

## Convert to Full Drop

Converts half-drop or half-brick tiles to full-drop for POD sites.

**Half-drop -> full-drop:**
- Canvas: 2W x H
- Draw at (0,0), (W, -H/2), (W, +H/2)

**Half-brick -> full-drop:**
- Canvas: W x 2H
- Draw at (0,0), (-W/2, H), (+W/2, H)

**Scaling behavior:** User's selected size applies to the original tile's longest side. The doubled dimension naturally becomes 2x. Example: 16"x20" half-drop tile at 12" export = 19.2" x 12" full-drop tile.

---

## Environment Variables

```bash
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
STRIPE_SECRET_KEY=ssk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_MONTHLY=price_...
STRIPE_PRICE_YEARLY=price_...

# App
NEXT_PUBLIC_APP_URL=https://pattern-tester.amandagracedesign.com

# Rewardful
NEXT_PUBLIC_REWARDFUL_API_KEY=97736d
```

---

## Deployment

- **Platform:** Vercel (auto-detects Next.js)
- **Domain:** `pattern-tester.amandagracedesign.com`
- **Build:** `npm run build` (uses `--webpack` flag)
- **Security headers:** CSP, X-Frame-Options, X-Content-Type-Options configured in `next.config.ts`
- **Stripe webhook:** Must point to `/api/stripe/webhook` with events: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`

---

## Recent Commit History

```
a240a79 feat: add Convert to Full Drop option in EasyScale export
42fb5bc fix: insert PNG pHYs chunk before IDAT per spec (fixes Spoonflower upload)
62aa13c style: make Upload button larger and Paste button gold
eab596d fix: mobile paste, Seam Inspector crash, and intermittent blank canvas
2ee3e51 fix: correct JFIF byte offsets so 300 DPI JPEGs import at true DPI
a002f37 fix: QuickExport preserves aspect ratio, scales correctly, injects DPI metadata
82ee790 fix: show sign-up modal for unauthenticated upgrade deep-links
cc72cc9 feat: add deep-link CTAs for landing page pricing buttons
f5be1f6 fix: harden API routes — remove error leakage, add Pro authorization
b3b42df feat: redesign UpgradeModal with feature comparison table
92598bb docs: add Kajabi landing page for PatternPal Pro
0ea2217 feat: add 10-step welcome modal with spotlight tour
669affa feat: add Affiliate20 promo code with 4-month free trial
57750ca feat: add affiliate program link and slide-out banner for Pro users
```

---

## Known Open Items

From `SECURITY_FIXES.md`:
- EXIF stripping not yet implemented (uploaded images may retain GPS/metadata)
- Free trial tracking is localStorage-only (bypassable, considered acceptable)

From git status:
- Three mockup images deleted but not committed: `fabric_swatch.png`, `onesie.png`, `wallpaper.png`
