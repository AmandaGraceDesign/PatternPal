# Architecture

**Analysis Date:** 2026-03-22

## Pattern Overview

**Overall:** Next.js App Router SPA with client-side canvas rendering and a thin API layer

**Key Characteristics:**
- Primary application logic lives in a single `'use client'` page component (`app/page.tsx`) that owns all pattern state
- Canvas-based rendering via the HTML Canvas API — no React for drawing, only for layout shells
- Server-side API routes handle auth-gated billing operations (Stripe) and Pro status verification via Clerk
- Feature gating is dual: client-side for instant UX (`checkClientProStatus`) and server-side for security (`requireProUser`/`checkProStatus`)
- Two co-existing router patterns: `app/` (App Router, primary) and `pages/` (legacy Pages Router remnant — only `pages/api/stripe/` exists there, now superseded by `app/api/stripe/`)

## Layers

**Page/UI Shell Layer:**
- Purpose: Owns all pattern state, handles file I/O, and wires child components together via props
- Location: `app/page.tsx`
- Contains: State hooks (image, DPI, zoom, pan, repeat type), input handlers (upload, paste, drag-drop), layout shell
- Depends on: `src/components/layout/*`, `src/components/canvas/*`, `src/lib/utils/imageUtils`
- Used by: Browser (entry point)

**Layout Components Layer:**
- Purpose: App chrome — top bar with auth, controls bar with pattern settings
- Location: `src/components/layout/`
  - `TopBar.tsx` — branding, auth (Clerk), upgrade/billing entry points, affiliate slide-out
  - `PatternControlsTopBar.tsx` — repeat type selector, DPI/tile controls, zoom, upload/paste/clear buttons, export access
- Depends on: Clerk client hooks, `src/components/export/UpgradeModal`, `src/components/billing/`
- Used by: `app/page.tsx`

**Canvas Rendering Layer:**
- Purpose: Renders the tiled pattern preview to an HTML canvas element with pan/zoom/outline support
- Location: `src/components/canvas/PatternPreviewCanvas.tsx`
- Contains: Canvas ref management, DPR scaling, double-buffer offscreen canvas, pointer pan, pinch-to-zoom, ruler
- Depends on: `src/lib/tiling/PatternTiler`
- Used by: `app/page.tsx`

**Tiling Engine Layer:**
- Purpose: Pure canvas drawing logic for tiling a source image in full-drop, half-drop, or half-brick repeat patterns
- Location: `src/lib/tiling/PatternTiler.ts`
- Contains: `PatternTiler` class, `RepeatType` union type, three render strategies
- Depends on: Native Canvas 2D API only
- Used by: `src/components/canvas/PatternPreviewCanvas.tsx`, `src/lib/mockups/mockupEngineV2/MockupPipeline.ts`

**Actions Sidebar Layer:**
- Purpose: Pro-gated feature entry point — analysis, mockups, export, seam inspector
- Location: `src/components/sidebar/ActionsSidebar.tsx`
- Contains: Pro status check, analysis trigger, mockup gallery opener, export modal launcher
- Depends on: `src/lib/analysis/patternAnalyzer`, `src/lib/mockups/mockupTemplates`, `src/lib/mockups/mockupEngineV2`, `src/lib/seam-inspector/openSeamInspector`
- Used by: `app/page.tsx` (via `PatternControlsTopBar` or direct wiring)

**Mockup Engine V2 Layer:**
- Purpose: Multi-stage pipeline that composites a tiled pattern onto product photography with perspective warp, displacement maps, and blend modes
- Location: `src/lib/mockups/mockupEngineV2/`
  - `MockupPipeline.ts` — orchestrates stages: tile → perspective warp → displacement → mask clip → composite
  - `stages/perspectiveWarp.ts` — strip-subdivision trapezoid warp
  - `stages/displacementMap.ts` — fabric wrinkle simulation
  - `stages/blendComposite.ts` — multiply/overlay blend onto product base image
  - `templates/templateRegistry.ts` — all V2 template definitions (multi-zone support)
- Depends on: `PatternTiler`, Canvas 2D API, product base images + zone masks in `public/mockups/v2/`
- Used by: `src/components/mockups/MockupRendererV2.tsx`

**Mockup V1 Layer (Legacy):**
- Purpose: CSS-transform-based mockup rendering for original mockup set
- Location: `src/lib/mockups/mockupTemplates.ts`, `src/components/mockups/MockupRenderer.tsx`
- Contains: Template definitions for pillow, wallpaper, onesie, tote-bag, fabric-swatch, wrapping-paper, journal
- Depends on: CSS `transform` for perspective, not canvas pipeline
- Used by: `src/components/mockups/MockupGalleryModal.tsx`

**Analysis Layer:**
- Purpose: Client-side pixel analysis of the pattern tile for contrast, color harmony, and composition scoring
- Location: `src/lib/analysis/patternAnalyzer.ts`, `src/lib/analysis/seamAnalyzer.ts`, `src/lib/seam-inspector/`
- Contains: `analyzeContrast`, `analyzeComposition`, `ColorHarmonyAnalysis` interfaces; seam visualization utilities
- Depends on: Canvas 2D `getImageData` API
- Used by: `src/components/sidebar/ActionsSidebar.tsx`, `src/components/analysis/PatternAnalysisModal.tsx`

**Export Layer:**
- Purpose: Generates downloadable image files from the current pattern state
- Location: `src/components/export/` (QuickExportModal, RepeatExportModal, ScaleExportModal, EasyscaleExportModal), `src/lib/utils/exportScaled.ts`, `src/lib/utils/repeatFillExport.ts`
- Contains: Export format/size pickers, offscreen canvas rendering, file download
- Depends on: `PatternTiler`, browser `Blob`/`URL.createObjectURL`
- Used by: `src/components/sidebar/ActionsSidebar.tsx`, `src/components/layout/PatternControlsTopBar.tsx`

**Auth/Pro Utilities Layer:**
- Purpose: Thin wrappers around Clerk to surface current user identity and Pro flag
- Location: `src/lib/auth.ts` (server), `src/lib/utils/checkProStatus.ts` (client)
- Contains: `auth()`, `checkProStatus()`, `requireProUser()`, `checkClientProStatus()`
- Depends on: `@clerk/nextjs/server` (server), `@clerk/nextjs` (client)
- Used by: All API routes and gated UI components

**API Routes Layer:**
- Purpose: Billing operations — Stripe checkout, subscription management, webhook handling, Pro status verification
- Location: `app/api/`
  - `app/api/checkout/route.ts` — create Stripe Checkout session
  - `app/api/stripe/create-subscription/route.ts` — create subscription
  - `app/api/stripe/portal/route.ts` — Stripe Customer Portal link
  - `app/api/stripe/webhook/route.ts` — handle Stripe events, write `pro: true` to Clerk `publicMetadata`
  - `app/api/pro/verify/route.ts` — verify Pro status server-side
  - `app/api/create-portal-link/route.ts` — alias portal link creation
  - `app/api/debug/grant-pro/route.ts` — dev-only Pro grant
  - `app/api/debug/user-status/route.ts` — dev-only user inspection
- Depends on: `@clerk/nextjs/server`, `stripe` SDK
- Used by: Client-side fetch calls from billing/upgrade components

## Data Flow

**Pattern Load and Render:**

1. User uploads/pastes/drops an image file onto `app/page.tsx`
2. `handleFileUpload` reads the file as a Blob, validates SVG safety, extracts DPI from EXIF via `extractDpiFromFile`
3. `HTMLImageElement` is loaded from an object URL; physical dimensions calculated as `pixels / DPI`
4. State is set: `image`, `tileWidth`, `tileHeight`, `dpi`, `baseZoom`
5. `PatternPreviewCanvas` receives updated props, calls `PatternTiler.render()` inside a `useEffect`/RAF loop
6. Canvas is drawn: tiles placed in full-drop/half-drop/half-brick grid using integer-rounded coordinates

**Free Usage Gating:**

1. On each test action, `canRunFreeTest()` is called in `app/page.tsx`
2. Unauthenticated users are allowed 3 tests (count stored in `localStorage` under `pp_free_tests_used`)
3. On the 3rd test, `openSignIn()` is called; signed-in users are unrestricted on basic testing
4. Pro features (analysis, mockups, exports beyond basic) check `checkClientProStatus(user.publicMetadata)` client-side and `requireProUser()` server-side

**Stripe Subscription Flow:**

1. User opens `UpgradeModal` → selects monthly/yearly plan → enters optional promo code
2. Frontend POSTs to `app/api/checkout/route.ts` or `app/api/stripe/create-subscription/route.ts`
3. Server creates Stripe Checkout Session → returns `url` → browser redirects
4. On successful payment, Stripe POSTs to `app/api/stripe/webhook/route.ts`
5. Webhook handler retrieves Clerk user by email, updates `publicMetadata.pro = true` and `privateMetadata.stripeCustomerId`
6. Subsequent page loads reflect Pro status via Clerk session token

**Mockup V2 Rendering Pipeline:**

1. User selects a V2 mockup template from `MockupGalleryModal`
2. `MockupRendererV2` calls `runPipeline(input)` from `src/lib/mockups/mockupEngineV2/index.ts`
3. For each zone in the template: tile pattern → apply perspective warp → apply displacement map → clip to mask
4. All zone canvases are composited onto the product base image using the configured blend mode and opacity
5. Result canvas is displayed in `MockupModal` and available for download

**State Management:**
- No global state library; all core state lives as `useState` hooks in `app/page.tsx` and is passed down via props
- Pro status is derived from Clerk's `useUser()` hook (`user.publicMetadata.pro`)
- Free test count is stored in `localStorage`

## Key Abstractions

**PatternTiler:**
- Purpose: Encapsulates all three repeat tiling algorithms behind a single `render()` call
- Examples: `src/lib/tiling/PatternTiler.ts`
- Pattern: Class with injected canvas context; strategy dispatch via `RepeatType` enum

**MockupV2Template:**
- Purpose: Data-driven template definition describing canvas dimensions, zones, physical size, and pipeline parameters per mockup
- Examples: `src/lib/mockups/mockupEngineV2/templates/templateRegistry.ts`
- Pattern: Plain object registry keyed by template ID; supports single-zone and multi-zone layouts

**PipelineInput:**
- Purpose: Typed input contract for the V2 mockup rendering pipeline
- Examples: `src/lib/mockups/mockupEngineV2/MockupPipeline.ts`
- Pattern: Interface with pre-loaded image references to avoid async I/O during render

**Auth Session:**
- Purpose: Normalized user object with `id`, `email`, `isPro` derived from Clerk
- Examples: `src/lib/auth.ts`
- Pattern: Thin wrapper — never stores auth state, always calls Clerk APIs at request time

## Entry Points

**Main App:**
- Location: `app/page.tsx`
- Triggers: Browser navigation to `/`
- Responsibilities: All pattern state, file I/O, free-test gating, layout composition

**Legacy Pattern Tester:**
- Location: `app/pattern-tester/page.tsx`
- Triggers: Navigation to `/pattern-tester`
- Responsibilities: Server-fetches Pro status, renders `PatternCanvas` — appears to be an older/parallel route

**Root Layout:**
- Location: `app/layout.tsx`
- Triggers: All routes
- Responsibilities: `ClerkProvider` wrapper, Geist font variables, Rewardful affiliate script injection

**Stripe Webhook:**
- Location: `app/api/stripe/webhook/route.ts`
- Triggers: Stripe POST on subscription lifecycle events
- Responsibilities: Validate webhook signature, update Clerk user metadata with Pro status

## Error Handling

**Strategy:** Inline try/catch with console.error; no global error boundary or structured error reporting

**Patterns:**
- API routes return `NextResponse.json({ error: "..." }, { status: N })` on failure
- Client-side file I/O errors are caught and logged; loading state is cleared; no user-facing error UI beyond `alert()`
- SVG uploads run a safety validation (`validateSvgSafety`) before any processing; failures surface via `alert()`
- Webhook errors log and return 400 to trigger Stripe retry

## Cross-Cutting Concerns

**Logging:** `console.log`/`console.warn`/`console.error` only; development-only logs are guarded by `process.env.NODE_ENV === 'development'`

**Validation:** SVG safety check in `src/lib/utils/imageUtils.ts`; file size soft-limit at 15MB with `window.confirm`; server-side Clerk auth on all API routes

**Authentication:** Clerk throughout — `ClerkProvider` at root, `useUser`/`useClerk` client hooks, `auth()`/`clerkClient()` server utilities; Pro flag is stored as `publicMetadata.pro: true` on the Clerk user record

---

*Architecture analysis: 2026-03-22*
