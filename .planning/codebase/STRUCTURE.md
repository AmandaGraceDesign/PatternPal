# Codebase Structure

**Analysis Date:** 2026-03-22

## Directory Layout

```
patternpal-pro/
├── app/                        # Next.js App Router (primary)
│   ├── page.tsx                # Main app entry point — all pattern state lives here
│   ├── layout.tsx              # Root layout: ClerkProvider + fonts + affiliate script
│   ├── globals.css             # Global styles
│   ├── _components/            # Private app-level components (ResumeSignupFromQuery)
│   ├── api/                    # API route handlers
│   │   ├── checkout/           # Stripe checkout session creation
│   │   ├── create-portal-link/ # Stripe billing portal link
│   │   ├── stripe/
│   │   │   ├── create-subscription/
│   │   │   ├── portal/
│   │   │   └── webhook/        # Stripe webhook → Clerk Pro metadata update
│   │   ├── pro/verify/         # Server-side Pro status check
│   │   └── debug/              # Dev-only: grant-pro, user-status
│   ├── pattern-tester/         # Legacy/parallel pattern tester route
│   ├── seam-inspector/         # Seam inspector standalone page
│   └── test-scaling/           # Scale testing page
├── pages/                      # Pages Router (legacy remnant — do not add to)
│   └── api/stripe/             # Old Stripe routes — superseded by app/api/stripe/
├── src/                        # Application source code
│   ├── app/                    # Unused src/app shell (dashboard dir only, no files)
│   ├── components/             # React components
│   │   ├── canvas/             # Canvas display components
│   │   ├── layout/             # App chrome (TopBar, PatternControlsTopBar)
│   │   ├── mockups/            # Mockup gallery, renderer (V1 + V2)
│   │   ├── sidebar/            # ActionsSidebar — Pro feature launcher
│   │   ├── export/             # Export modals + UpgradeModal
│   │   ├── analysis/           # PatternAnalysisModal, SeamAnalyzer components
│   │   ├── controls/           # AdvancedToolsBar
│   │   ├── billing/            # ManageSubscriptionButton
│   │   ├── onboarding/         # WelcomeModal
│   │   ├── affiliate/          # AffiliateSlideOut
│   │   └── ui/                 # Generic UI primitives
│   ├── lib/                    # Business logic, pure utilities, engines
│   │   ├── tiling/             # PatternTiler — core repeat tiling engine
│   │   ├── analysis/           # Pattern analysis (contrast, composition, seams)
│   │   ├── mockups/            # Mockup system
│   │   │   ├── mockupTemplates.ts          # V1 template definitions
│   │   │   └── mockupEngineV2/             # V2 pipeline engine
│   │   │       ├── index.ts               # Public exports
│   │   │       ├── MockupPipeline.ts       # Stage orchestrator
│   │   │       ├── stages/                # Pipeline stages
│   │   │       └── templates/             # V2 template registry + types
│   │   ├── seam-inspector/     # Seam inspector launcher utility
│   │   ├── supabase/           # Supabase client (present but not actively used in main app)
│   │   ├── utils/              # General utilities (imageUtils, exportScaled, checkProStatus, etc.)
│   │   └── auth.ts             # Server-side auth wrappers (Clerk)
│   └── types/                  # TypeScript type declarations (eyedropper.d.ts, rewardful.d.ts)
├── public/                     # Static assets
│   └── mockups/
│       └── v2/                 # V2 mockup product images and zone masks (PNG)
├── mockup-system-package/      # Standalone mockup system export (not part of main app build)
│   └── public/mockups/
├── docs/                       # Internal planning and handoff documents
├── .planning/                  # GSD planning artifacts
│   └── codebase/
├── .superpowers/               # Brainstorm/AI session artifacts
├── next.config.ts              # Next.js config with CSP headers
├── tsconfig.json               # TypeScript config — path alias @/* → ./src/*
├── package.json
└── eslint.config.mjs
```

## Directory Purposes

**`app/`:**
- Purpose: Next.js App Router pages and API routes
- Contains: Page components, layout, API route handlers, app-level private components
- Key files: `app/page.tsx` (main app), `app/layout.tsx` (root layout), `app/api/stripe/webhook/route.ts`

**`app/api/`:**
- Purpose: All backend logic — Stripe billing, Pro verification, debug utilities
- Contains: Route handlers as `route.ts` files in path-named directories
- Key files: `app/api/stripe/webhook/route.ts`, `app/api/checkout/route.ts`, `app/api/pro/verify/route.ts`

**`src/components/`:**
- Purpose: All React UI components, organized by feature domain
- Contains: Client components (`'use client'`) and a few server components
- Key files: `src/components/layout/TopBar.tsx`, `src/components/canvas/PatternPreviewCanvas.tsx`, `src/components/sidebar/ActionsSidebar.tsx`, `src/components/mockups/MockupGalleryModal.tsx`

**`src/lib/`:**
- Purpose: Framework-agnostic business logic, rendering engines, and pure utilities
- Contains: Class-based engines, pure functions, type interfaces
- Key files: `src/lib/tiling/PatternTiler.ts`, `src/lib/mockups/mockupEngineV2/MockupPipeline.ts`, `src/lib/auth.ts`, `src/lib/utils/imageUtils.ts`

**`src/lib/mockups/mockupEngineV2/`:**
- Purpose: The V2 mockup rendering pipeline — multi-stage canvas compositing
- Contains: Pipeline orchestrator, three rendering stages, template registry, template types
- Key files: `MockupPipeline.ts`, `stages/perspectiveWarp.ts`, `stages/displacementMap.ts`, `stages/blendComposite.ts`, `templates/templateRegistry.ts`

**`src/lib/analysis/`:**
- Purpose: Client-side pattern quality analysis using pixel data
- Contains: Contrast analyzer, composition analyzer, seam analyzer
- Key files: `src/lib/analysis/patternAnalyzer.ts`, `src/lib/analysis/seamAnalyzer.ts`

**`src/types/`:**
- Purpose: TypeScript ambient type declarations for third-party APIs without types
- Contains: `eyedropper.d.ts` (EyeDropper browser API), `rewardful.d.ts` (Rewardful affiliate)

**`public/mockups/v2/`:**
- Purpose: Static product photography and per-zone mask images used by MockupEngineV2
- Contains: PNG files — product base images and alpha-mask images for each zone
- Key files: `tshirt-dress.png`, `tshirt-dress_bodice.png`, `tshirt-dress_skirt.png`

**`pages/`:**
- Purpose: Legacy Pages Router — only exists as a historical remnant
- Contains: `pages/api/stripe/` (old webhook route — do NOT use or add to)
- Note: All new API routes go in `app/api/`

## Key File Locations

**Entry Points:**
- `app/page.tsx`: Main application — owns all pattern state
- `app/layout.tsx`: Root layout with ClerkProvider and global scripts
- `app/pattern-tester/page.tsx`: Legacy pattern tester route

**Configuration:**
- `next.config.ts`: CSP headers, Next.js settings
- `tsconfig.json`: TypeScript config, path aliases (`@/*` → `./src/*`)
- `eslint.config.mjs`: ESLint configuration

**Core Logic:**
- `src/lib/tiling/PatternTiler.ts`: Tiling engine
- `src/lib/mockups/mockupEngineV2/MockupPipeline.ts`: Mockup rendering pipeline
- `src/lib/mockups/mockupEngineV2/templates/templateRegistry.ts`: All V2 mockup definitions
- `src/lib/auth.ts`: Server-side auth and Pro status utilities
- `src/lib/utils/imageUtils.ts`: DPI extraction, SVG validation

**Billing API:**
- `app/api/stripe/webhook/route.ts`: Stripe webhook handler (grants Pro)
- `app/api/checkout/route.ts`: Checkout session creation
- `app/api/stripe/portal/route.ts`: Billing portal

**Key Components:**
- `src/components/layout/TopBar.tsx`: App header with auth and upgrade entry
- `src/components/layout/PatternControlsTopBar.tsx`: Pattern settings controls bar
- `src/components/canvas/PatternPreviewCanvas.tsx`: Interactive canvas preview
- `src/components/sidebar/ActionsSidebar.tsx`: Pro feature launcher panel
- `src/components/mockups/MockupGalleryModal.tsx`: Mockup selection gallery
- `src/components/export/UpgradeModal.tsx`: Subscription upgrade UI

## Naming Conventions

**Files:**
- React components: PascalCase `.tsx` — `PatternPreviewCanvas.tsx`, `MockupGalleryModal.tsx`
- Library utilities: camelCase `.ts` — `patternAnalyzer.ts`, `imageUtils.ts`, `checkProStatus.ts`
- Next.js routes: lowercase `route.ts` — per Next.js convention
- Type declaration files: camelCase `.d.ts` — `eyedropper.d.ts`

**Directories:**
- Component feature domains: lowercase kebab-case — `seam-inspector/`, `mockup-system-package/`
- Component sub-domains within `src/components/`: lowercase — `canvas/`, `layout/`, `mockups/`
- Library sub-domains within `src/lib/`: lowercase — `tiling/`, `analysis/`, `mockups/`

**Components:**
- Always exported as default exports
- Props interfaces named `[ComponentName]Props` — `PatternPreviewCanvasProps`, `ActionsSidebarProps`

**Templates/Registry:**
- V2 mockup templates registered in `templateRegistry.ts` keyed by lowercase kebab-case IDs — `'tshirt-dress'`, `'womens-skirt'`

## Where to Add New Code

**New page/route:**
- Page component: `app/[route-name]/page.tsx`
- Do NOT add to `pages/` — that directory is a legacy remnant

**New API endpoint:**
- Handler: `app/api/[endpoint-name]/route.ts`
- Auth check pattern: call `auth()` from `@clerk/nextjs/server`, use `checkProStatus()` for Pro gates

**New React component:**
- Feature-specific: `src/components/[domain]/ComponentName.tsx`
- Generic UI primitive: `src/components/ui/ComponentName.tsx`
- Use `'use client'` directive at the top for any component using hooks or browser APIs

**New V2 mockup template:**
- Add template object to `src/lib/mockups/mockupEngineV2/templates/templateRegistry.ts`
- Add product base image and zone mask PNGs to `public/mockups/v2/`
- Template type definition: `src/lib/mockups/mockupEngineV2/templates/types.ts` (inferred — check for `MockupV2Template` interface)

**New library utility:**
- Pure function or class: `src/lib/utils/[utilityName].ts`
- Domain-specific engine: `src/lib/[domain]/[EngineName].ts`

**New type declarations:**
- Ambient types for browser APIs or third-party libs without types: `src/types/[name].d.ts`

## Special Directories

**`.planning/`:**
- Purpose: GSD planning artifacts and codebase analysis documents
- Generated: No
- Committed: Yes

**`.next/`:**
- Purpose: Next.js build output and cache
- Generated: Yes
- Committed: No

**`.npm-cache/`:**
- Purpose: Local npm cache
- Generated: Yes
- Committed: No (should be in `.gitignore`)

**`mockup-system-package/`:**
- Purpose: Standalone export of the mockup system for distribution
- Generated: Partial (manual packaging)
- Committed: Yes (excluded from TypeScript compilation via `tsconfig.json`)

**`public/mockups/v2/`:**
- Purpose: Product photography assets for MockupEngineV2 — referenced by template `imagePath` and `maskPath` fields
- Generated: No (manually created/curated)
- Committed: Yes

---

*Structure analysis: 2026-03-22*
