# Codebase Concerns

**Analysis Date:** 2026-03-22

---

## Tech Debt

**Disabled Pro Gate in MockupGalleryModal:**
- Issue: The pro paywall for the mockup gallery is commented out with a TODO to re-enable it after testing. All users (free and pro) currently have unrestricted access to all mockups.
- Files: `src/components/mockups/MockupGalleryModal.tsx` lines 80-83
- Impact: Revenue/feature gating is silently broken. Free users get Pro-only mockups without paying.
- Fix approach: Uncomment the `if (!isPro)` guard and remove the TODO comment once testing is confirmed complete.

**Hardcoded Domain in Three Separate API Routes:**
- Issue: The production domain `https://pattern-tester.amandagracedesign.com` is hardcoded in three independent `ALLOWED_ORIGINS` arrays. If the domain changes, all three must be updated manually.
- Files: `app/api/checkout/route.ts` lines 71-72, `app/api/create-portal-link/route.ts` lines 40-41 and 58, `app/api/stripe/portal/route.ts` lines 38-39
- Impact: Domain migration requires touching multiple files; easy to miss one; inconsistency between routes (e.g., `portal/route.ts` has a legacy `APP_URL` env var, `checkout/route.ts` does not).
- Fix approach: Extract allowed origins into a shared utility (e.g., `src/lib/utils/allowedOrigins.ts`) and import from all routes.

**Duplicate Pro Status Utility Logic:**
- Issue: `src/lib/utils/checkProStatus.ts` documents two supported metadata formats (`publicMetadata.isPro` and `publicMetadata.plan === 'patternpal_pro'`) in its JSDoc comment, but only checks `publicMetadata.pro === true`. The legacy formats described in the comment are never actually checked.
- Files: `src/lib/utils/checkProStatus.ts`, `src/lib/auth.ts`
- Impact: Misleading documentation; any user whose metadata was set with the legacy format would not be recognized as Pro.
- Fix approach: Remove the stale JSDoc describing unsupported formats, or add support for them if they exist in production data.

**Duplicate Stripe Portal Routes:**
- Issue: Two separate routes both implement a Stripe billing portal: `app/api/stripe/portal/route.ts` and `app/api/create-portal-link/route.ts`. They have slightly different implementations (different `return_url` logic, different error handling).
- Files: `app/api/stripe/portal/route.ts`, `app/api/create-portal-link/route.ts`
- Impact: `ManageSubscriptionButton.tsx` calls `/api/create-portal-link`; `ActionsSidebar.tsx` and `UpgradeModal.tsx` call `/api/stripe/portal`. Divergent implementations create subtle behavioral differences.
- Fix approach: Consolidate to one route; delete the other; update all callers.

**Incomplete DPI Detection in imageScaler.ts:**
- Issue: `detectOriginalDPI()` always returns a hardcoded `150` instead of reading from image metadata. Two `TODO` comments mark this as Phase 1b work that was never completed.
- Files: `src/lib/utils/imageScaler.ts` lines 6-13
- Impact: Scale export DPI calculations use the wrong source DPI for any image that isn't 150 DPI, producing incorrect output sizes. `imageUtils.ts` already has a working `extractDpiFromFile` function that could replace this stub.
- Fix approach: Replace `detectOriginalDPI` stub with a call to `extractDpiFromFile` from `src/lib/utils/imageUtils.ts`.

**SeamAnalyzer Tiled Preview Uses Duplicated Original Instead of Actual Tile:**
- Issue: The seam comparison view in `seamAnalyzer.ts` is supposed to show the tiled version next to the original but instead just duplicates the original. A TODO comment marks this as incomplete.
- Files: `src/lib/analysis/seamAnalyzer.ts` lines 817-818
- Impact: The seam view shown to users is incorrect — it does not reflect how the pattern actually tiles.
- Fix approach: Implement the TODO: use `PatternTiler` to generate the real tiled version for the comparison canvas.

**Free Test Limit Enforced Only Client-Side via localStorage:**
- Issue: The free user test limit (`MAX_FREE_TESTS = 3`) is enforced solely via `localStorage` in `app/page.tsx`. Any user can bypass it by clearing their browser storage or using incognito mode.
- Files: `app/page.tsx` lines 14-75
- Impact: Unlimited free access to the core pattern testing feature for anyone who bypasses localStorage.
- Fix approach: Add server-side rate limiting tied to a session cookie or IP, or accept this as an intentional soft gate (document the decision).

**Deprecated Function Not Removed:**
- Issue: `createZoomedCornerView` in `seamAnalyzer.ts` is marked `@deprecated` but is still present with a full implementation.
- Files: `src/lib/analysis/seamAnalyzer.ts` line 962
- Impact: Dead code that may still be called; risk of using the deprecated path instead of `createSeamIntersectionView`.
- Fix approach: Confirm no callers exist and delete, or remove the `@deprecated` annotation if still in use.

**`src/components/PatternCanvas.tsx` vs `src/components/canvas/PatternCanvas.tsx` Ambiguity:**
- Issue: Two files with the same name `PatternCanvas.tsx` exist at different paths. `app/pattern-tester/page.tsx` imports from `@/components/PatternCanvas` (the root one), while the main app at `app/page.tsx` uses `PatternPreviewCanvas` from `canvas/`. The root `PatternCanvas.tsx` contains extensive debug `console.log` output.
- Files: `src/components/PatternCanvas.tsx`, `src/components/canvas/PatternCanvas.tsx`
- Impact: Confusing structure; the pattern-tester page is backed by a different (possibly older) component with debug logging still in place.
- Fix approach: Determine whether `src/components/PatternCanvas.tsx` is still the intended component for `app/pattern-tester/page.tsx` or if it should be migrated to use `PatternPreviewCanvas`. Remove if obsolete.

**`mockup-system-package/` is an Orphaned Package:**
- Issue: A top-level `mockup-system-package/` directory exists with its own `MockupRenderer.tsx`, `mockupTemplates.ts`, documentation files (`START_HERE.md`, `INTEGRATION_GUIDE.md`, etc.), and a `public/mockups/` folder. It imports from a path (`../lib/mockups/mockupTemplates`) that would not resolve from that location. No code in `src/` or `app/` imports from it.
- Files: `mockup-system-package/MockupRenderer.tsx`, `mockup-system-package/mockupTemplates.ts`
- Impact: Dead code in the repository root; potentially confusing to contributors; duplicate mockup templates that may diverge from `src/lib/mockups/mockupTemplates.ts`.
- Fix approach: Delete `mockup-system-package/` entirely, or move its useful parts into `src/`.

**Legacy `templateImage` Field in MockupTemplate Interface:**
- Issue: `MockupTemplate` has both `templateImage` and `image` fields that hold the same path. The `templateImage` field is explicitly labeled as "Legacy property" in both the interface definition and template data.
- Files: `src/lib/mockups/mockupTemplates.ts` lines 14-15, 43-44
- Impact: Interface bloat; risk of consumers reading the wrong field.
- Fix approach: Audit all consumers of `MockupTemplate`, migrate to `image`, remove `templateImage`.

---

## Known Bugs

**Webhook `invoice.customer` Cast Without Null Check:**
- Symptoms: If a Stripe invoice has no associated customer (possible for one-time payments or manual invoices), `invoice.customer as string` resolves to `null`/`""`, and `stripe.customers.retrieve("")` throws.
- Files: `app/api/stripe/webhook/route.ts` line 172
- Trigger: `invoice.payment_failed` event fired for an invoice with no customer.
- Workaround: None — the webhook returns a 500 error and Stripe will retry repeatedly.
- Fix approach: Add `if (!invoice.customer) return NextResponse.json({ received: true });` guard before the retrieve call.

**`checkout.session.completed` Event Not Handled in Webhook:**
- Symptoms: If a user completes a Stripe Checkout session successfully but the `customer.subscription.created` webhook is delayed or fails, the user never receives Pro status.
- Files: `app/api/stripe/webhook/route.ts`
- Trigger: Network issue or ordering of Stripe events; `checkout.session.completed` fires before `customer.subscription.created`.
- Workaround: None — user must wait for retry or contact support.
- Fix approach: Add a handler for `checkout.session.completed` that grants Pro access from the session's customer/subscription data, as a redundant grant path.

---

## Security Considerations

**`'unsafe-inline'` in Content-Security-Policy script-src:**
- Risk: The CSP allows inline scripts globally, which partially defeats XSS protections.
- Files: `next.config.ts` line 9
- Current mitigation: The overall CSP is well-structured with `object-src 'none'`, `frame-ancestors 'none'`, and a narrow `connect-src`. The `unsafe-inline` is likely required by Clerk.
- Recommendations: Investigate if Clerk supports nonce-based CSP (`'nonce-...'`) to remove `unsafe-inline` for scripts, or document the current state as intentional with a comment.

**SVG XSS Validation is Client-Side Only:**
- Risk: `validateSvgSafety` runs in the browser before uploading. A malicious client can bypass it entirely.
- Files: `src/lib/utils/imageUtils.ts` lines 200-243, `app/page.tsx` lines 88-96
- Current mitigation: SVGs are rendered to canvas via `drawImage`, which does not execute embedded scripts in modern browsers. The risk is lower than it appears.
- Recommendations: Document that the validation is UX-only (not a security boundary), since the canvas rendering already neutralizes most SVG XSS vectors. If SVGs are ever stored server-side or returned as HTML, add server-side validation.

**Pro Status Stored in Clerk `publicMetadata` (Client-Readable):**
- Risk: `publicMetadata.pro` is readable by any authenticated client via `useUser()`. A user could observe the exact field name and format.
- Files: `src/lib/auth.ts`, `app/api/stripe/webhook/route.ts`
- Current mitigation: The actual enforcement checks happen server-side in API routes (`checkProStatus`, `requireProUser`). The client-readable value is only used for UI gating.
- Recommendations: This is the standard Clerk pattern; no change needed unless business logic is also enforced client-side (which it currently is via the disabled mockup pro gate — see Tech Debt above).

---

## Performance Bottlenecks

**Extensive Debug `console.log` in Hot Canvas Rendering Paths:**
- Problem: `src/components/canvas/PatternCanvas.tsx` (the pattern-tester variant) and `src/lib/analysis/seamAnalyzer.ts` contain dense `console.log` and emoji debug output executed on every render cycle or analysis call.
- Files: `src/components/PatternCanvas.tsx` (full file), `src/lib/analysis/seamAnalyzer.ts` lines 70-152
- Cause: Debug instrumentation left in production code.
- Improvement path: Remove all `console.log` calls from render-path code; replace with structured conditional logging gated on a `DEBUG` flag.

**`getImageData` Called on Contexts Without `willReadFrequently: true`:**
- Problem: `getImageData` is called 40 times across 4 files on canvas contexts that were created without the `{ willReadFrequently: true }` hint. Browsers use this hint to skip GPU-accelerated rendering in favor of CPU-accessible memory, making repeated pixel reads significantly faster.
- Files: `src/components/mockups/MockupRenderer.tsx` (6 calls), `src/lib/analysis/seamAnalyzer.ts` (10 calls), `src/lib/analysis/patternAnalyzer.ts` (3 calls), `src/lib/utils/dpiMetadata.ts` (1 call)
- Cause: Canvas contexts created with bare `getContext('2d')` or `getContext('2d')!`.
- Improvement path: Add `{ willReadFrequently: true }` to `getContext('2d', ...)` calls on any canvas where `getImageData` is subsequently called.

**`patternAnalyzer.ts` and `seamAnalyzer.ts` are Very Large Single-File Modules:**
- Problem: `patternAnalyzer.ts` is 1,645 lines and `seamAnalyzer.ts` is 1,115 lines. Both contain inline helper functions, analysis algorithms, and rendering logic that could be modularized.
- Files: `src/lib/analysis/patternAnalyzer.ts`, `src/lib/analysis/seamAnalyzer.ts`
- Cause: Incremental feature additions without refactoring.
- Improvement path: Extract internal helpers (color analysis, composition analysis, edge comparison) into separate focused modules; this also enables tree-shaking.

**`RepeatExportModal.tsx` is 1,596 Lines:**
- Problem: The export modal component is 1,596 lines and combines UI state, export calculations, social media presets, ZIP generation, and canvas rendering logic.
- Files: `src/components/export/RepeatExportModal.tsx`
- Cause: Feature growth without decomposition.
- Improvement path: Extract export logic into custom hooks (`useRepeatExport`, `useSocialExport`) and split the ZIP generation pipeline into a separate utility.

**Multiple Canvas Elements Created per Mockup Render (No Cleanup):**
- Problem: `MockupPipeline.ts` creates 5-7 `document.createElement('canvas')` instances per zone per render call with no explicit cleanup. In multi-zone mockups, this can mean 15+ canvases allocated per render.
- Files: `src/lib/mockups/mockupEngineV2/MockupPipeline.ts`
- Cause: Functional rendering approach without resource pooling.
- Improvement path: Reuse a small pool of offscreen canvases, or explicitly set canvas `width = 0` after use to free GPU memory.

---

## Fragile Areas

**Multi-Zone Mask Alignment:**
- Files: `src/lib/mockups/mockupEngineV2/MockupPipeline.ts` lines 100-128, `src/lib/mockups/mockupEngineV2/templates/templateRegistry.ts`
- Why fragile: Mask images are expected to be the same pixel dimensions as `canvasSize`. If a mask image is a different size, the `patternArea` crop coordinates produce wrong results silently — no validation or error is thrown.
- Safe modification: Always verify mask image dimensions match `canvasSize` before adding a new template. Add a runtime assertion in `processZone` for development builds.
- Test coverage: No tests; alignment issues are only visible by visual inspection.

**Repeat Type String Mismatch Between Modules:**
- Files: `src/lib/tiling/PatternTiler.ts`, `src/lib/analysis/seamAnalyzer.ts`, `app/page.tsx`, `src/lib/utils/repeatFillExport.ts`
- Why fragile: Three different string formats are used for repeat types across modules: `'full-drop' | 'half-drop' | 'half-brick'` (UI/export layer), `'fulldrop' | 'halfdrop' | 'halfbrick'` (seam analyzer), and `RepeatType` from `PatternTiler`. Conversion functions exist (`mapRepeatType`) but are duplicated or implicit in multiple places.
- Safe modification: Any new feature handling repeat types must use the correct format for each layer. Use `repeatFillExport.ts`'s `mapRepeatType` as the canonical conversion.
- Test coverage: None.

**`invoice.customer` and `subscription.customer` Assumed Non-Null in Webhook:**
- Files: `app/api/stripe/webhook/route.ts` lines 33, 76, 116, 172
- Why fragile: All four webhook event handlers cast `.customer` directly to `string` without null-checking. Stripe allows `customer` to be `null` for some event types.
- Safe modification: Add null guard before every `stripe.customers.retrieve(...)` call.
- Test coverage: No webhook tests; Stripe CLI must be used manually to verify behavior.

**Orphaned `app/pattern-tester/page.tsx` Route:**
- Files: `app/pattern-tester/page.tsx`, `src/components/PatternCanvas.tsx`
- Why fragile: This page imports `@/components/PatternCanvas` (the root version with debug logging), not the refined `PatternPreviewCanvas`. Its relationship to the main app is unclear — it may be a development testing harness that was accidentally left in the production routes.
- Safe modification: Verify whether this route is intentionally public-facing or should be removed/protected. Do not modify `src/components/PatternCanvas.tsx` without confirming it is not the backing component for this route.

**`app/test-scaling/page.tsx` is a Public Development Test Page:**
- Files: `app/test-scaling/page.tsx`
- Why fragile: This page appears to be an internal testing harness for the DPI/scaling feature. It is not protected by auth and is accessible to any user who knows the URL.
- Safe modification: Either add Clerk auth guard, move behind a dev-only route, or delete if no longer needed.

---

## Test Coverage Gaps

**Zero Automated Tests:**
- What's not tested: The entire codebase has no test files (`.test.ts`, `.spec.ts`) anywhere in `src/`, `app/`, or the project root.
- Files: All source files
- Risk: Any refactor or bug fix has no regression safety net. Canvas rendering logic, DPI calculations, stripe webhook event handling, and seam analysis algorithms are all untested.
- Priority: High

**Stripe Webhook Handler:**
- What's not tested: Webhook event parsing, pro status grant/revoke logic, edge cases (missing customer, deleted subscription, invoice with null customer).
- Files: `app/api/stripe/webhook/route.ts`
- Risk: A broken webhook silently prevents users from gaining or losing Pro access.
- Priority: High

**Pro Status Gating:**
- What's not tested: `checkProStatus`, `requireProUser`, and the server-side API route enforcement in `/api/pro/verify`.
- Files: `src/lib/auth.ts`, `app/api/pro/verify/route.ts`
- Risk: Changes to Clerk metadata structure or auth lib behavior would silently break the paywall.
- Priority: High

**DPI Calculation and Export Pipeline:**
- What's not tested: `detectOriginalDPI` (which is a stub), `scaleImage`, `calculateOriginalSize`, `checkUpscaling`, and `generateRepeatFillExport`.
- Files: `src/lib/utils/imageScaler.ts`, `src/lib/utils/repeatFillExport.ts`, `src/lib/utils/exportScaled.ts`
- Risk: Users receive incorrectly-sized exports without any indication of error.
- Priority: Medium

**Seam Analysis Scoring:**
- What's not tested: `compareEdgesStraight`, `compareEdgesOffset`, `calculateSeamScore`, or the overall `analyzeSeams` pipeline.
- Files: `src/lib/analysis/seamAnalyzer.ts`
- Risk: Algorithm regressions go undetected; debug logging in this file was clearly added reactively to diagnose issues in production.
- Priority: Medium

---

## Leftover Development Artifacts

**30 `#region agent log` / `#endregion` Comments:**
- What they are: Empty code region markers left from a previous AI-assisted development session.
- Files: Distributed across `src/` (30 occurrences, primarily `src/lib/utils/imageUtils.ts`)
- Risk: Visual noise; no functional impact.
- Fix approach: Global find-and-remove all `// #region agent log` and `// #endregion` occurrences.

**106 `console.log`/`console.error`/`console.warn` Statements in `src/`:**
- What they are: Debug logging throughout the codebase, including inside canvas rendering loops, DPI parsing, seam analysis, and pixel processing.
- Files: Distributed across `src/` (106 total)
- Risk: Performance overhead in hot paths; information leakage in production; noisy browser console for end users.
- Fix approach: Audit and remove all non-error `console.log` from production paths; keep `console.error` only for genuinely unexpected failures.

---

*Concerns audit: 2026-03-22*
