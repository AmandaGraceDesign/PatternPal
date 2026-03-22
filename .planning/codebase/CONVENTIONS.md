# Coding Conventions

**Analysis Date:** 2026-03-22

## Naming Patterns

**Files:**
- React components: PascalCase matching component name — `PatternPreviewCanvas.tsx`, `MockupGalleryModal.tsx`, `ActionsSidebar.tsx`
- Utility/lib modules: camelCase — `repeatFillExport.ts`, `sanitizeFilename.ts`, `checkProStatus.ts`
- Class files: PascalCase matching class name — `PatternTiler.ts`, `MockupPipeline.ts`
- Type definition files: lowercase `types.ts` within a module folder
- API routes: Next.js App Router convention — `route.ts` inside `app/api/[route]/`

**Functions:**
- camelCase for all functions: `analyzeSeams`, `extractDpiFromFile`, `sanitizeFilename`, `checkClientProStatus`
- Boolean-returning functions prefixed with `check`, `can`, `is`, `has` — `checkClientProStatus`, `canRunFreeTest`, `isValidOrigin`
- Event handlers prefixed with `handle` — `handlePointerDown`, `handleManageSubscription`, `handleEscape`
- Guard/require functions prefixed with `require` — `requireProUser`

**Variables:**
- camelCase throughout: `tileWidth`, `panX`, `scaleFactor`, `repeatType`
- Constants: SCREAMING_SNAKE_CASE for module-level constants — `MAX_FREE_TESTS`, `SOCIAL_DPI`, `PROMO_CODES`, `SIZE_PRESETS`
- Boolean state: `is` prefix — `isOpen`, `isPanning`, `isAnalyzing`, `isSignedIn`

**Types / Interfaces:**
- Interfaces: PascalCase with descriptive names — `RepeatFillExportConfig`, `MockupV2Template`, `PatternAnalysisModalProps`
- Props interfaces: `{ComponentName}Props` pattern — `RepeatExportModalProps`, `PatternPreviewCanvasProps`
- Union type aliases: PascalCase — `RepeatType`, `ModalMode`, `BlendMode`, `MockupV2Category`
- String literal unions preferred over enums: `type RepeatType = 'full-drop' | 'half-drop' | 'half-brick'`

## Code Style

**Formatting:**
- No Prettier config detected — formatting is not enforced via tooling
- Single quotes for string literals in TSX/TS source: `'use client'`, `'full-drop'`
- Double quotes in JSON and some API route files (mixed)
- Trailing commas used in multi-line object/array literals

**Linting:**
- ESLint with `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
- Config: `eslint.config.mjs`
- `mockup-system-package/` excluded from linting via `globalIgnores`

**TypeScript:**
- `strict: true` in `tsconfig.json`
- Non-null assertion `!` used when context is guaranteed: `tileCanvas.getContext('2d')!`
- Type casting via `as`: `error as Error`, `user.publicMetadata as any` (pattern for external SDK metadata)
- `any` used sparingly, mostly for Clerk `publicMetadata` where types are not statically known
- `interface` preferred over `type` for object shapes; `type` used for unions and aliases

## Import Organization

**Order (observed pattern):**
1. React/Next.js framework imports: `'use client'` directive first, then React hooks
2. Third-party packages: `@clerk/nextjs`, `jszip`, etc.
3. Internal `@/lib/...` imports (utilities, lib functions)
4. Internal `@/components/...` imports

**Path Aliases:**
- `@/*` maps to `./src/*` (defined in `tsconfig.json`)
- Used consistently throughout components and lib: `@/lib/utils/sanitizeFilename`, `@/components/mockups/MockupRenderer`

**Example:**
```typescript
'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { analyzeContrast, analyzeComposition } from '@/lib/analysis/patternAnalyzer';
import MockupRenderer from '@/components/mockups/MockupRenderer';
import { sanitizeFilename } from '@/lib/utils/sanitizeFilename';
```

## Error Handling

**In lib/utility functions:**
- Throw `new Error(message)` for unrecoverable states (missing canvas context, invalid input)
- Pattern: `if (!ctx) throw new Error('Could not get canvas context');`
- Async functions use try/catch internally and return `null` or resolved fallback on failure

**In API routes:**
- All route handlers wrapped in try/catch
- Errors cast to `Error` type: `const err = error as Error`
- Return `NextResponse.json({ error: "...", code: "snake_case_code" }, { status: NNN })`
- Error codes are snake_case strings: `"unauthorized"`, `"invalid_plan"`, `"server_error"`
- Explicit env var validation at route entry: `if (!process.env.STRIPE_SECRET_KEY) throw new Error("Missing env var: ...")`

**In React components:**
- fetch calls wrapped in try/catch with `console.error` on failure
- No error boundaries detected — errors in canvas/analysis ops are logged, not surfaced to UI
- Pro gating handled via `proAccess` state (`'unknown' | 'allowed' | 'denied'`) pattern

**Example (API route):**
```typescript
export async function POST(req: Request) {
  try {
    // ... logic
    return NextResponse.json({ url: session.url });
  } catch (error) {
    const err = error as Error;
    console.error("[checkout]", err?.message, err?.stack);
    return NextResponse.json({ error: "Server error", code: "server_error" }, { status: 500 });
  }
}
```

## Logging

**Framework:** `console` (no logging library)

**Patterns:**
- `console.error` for caught exceptions and unexpected states — used in API routes and components
- `console.warn` for security-relevant fallbacks: `console.warn('Filename contains directory traversal sequence...')`
- `console.log` used heavily in canvas/DPI analysis code for debugging — including emoji markers (`✓`, `❌`, `📄`) — this is debug-level logging not cleaned up for production
- `console.error("[route-name]", message, stack)` pattern in API routes for structured identification

## Comments

**When to Comment:**
- JSDoc-style block comments (`/** ... */`) on exported functions and interfaces: `sanitizeFilename`, `checkProStatus`, `requireProUser`, `analyzeSeams`
- Inline comments explain non-obvious logic: algorithm steps, canvas coordinate math, pixel format parsing
- Stage labels in pipeline code: `// --- Stage 1: Tile Pattern ---`, `// --- Stage 2: Perspective Warp ---`
- TODO comments mark deferred work with phase references: `// TODO: EXIF detection (Phase 1b)`

**JSDoc style (observed):**
```typescript
/**
 * Sanitize filename to prevent path traversal and injection attacks
 * @param input - Raw filename from user input
 * @param fallback - Safe fallback name if input is invalid
 * @returns Safe filename suitable for filesystem operations
 */
export function sanitizeFilename(input: string, fallback = 'file'): string {
```

## Function Design

**Size:** Functions range from tiny utilities to 100+ line canvas rendering functions. No enforced limit. Large functions exist in `patternAnalyzer.ts` (1645 lines) and `RepeatExportModal.tsx` (1596 lines).

**Parameters:** Destructuring used consistently for React component props. Functions prefer explicit typed parameters over option bags, except where config interfaces are used (`RepeatFillExportConfig`, `PipelineInput`).

**Return Values:**
- Async utility functions return `Promise<T | null>` where failure is possible
- Void canvas-mutation functions have no return value
- Boolean guard functions return `boolean` or `Promise<boolean>`

## Module Design

**Exports:**
- Named exports preferred for lib/utility modules: `export function`, `export interface`, `export const`
- Default exports used for React components: `export default function ComponentName`
- Barrel `index.ts` files used in `mockupEngineV2/` to re-export from sub-modules

**Barrel example (`src/lib/mockups/mockupEngineV2/index.ts`):**
```typescript
export { runPipeline } from './MockupPipeline';
export type { PipelineInput } from './MockupPipeline';
export type { MockupV2Template, MockupV2Category } from './templates/types';
export { mockupV2Templates, getV2Template, getAllV2Templates } from './templates/templateRegistry';
```

**'use client' directive:**
- All interactive React components declare `'use client'` as the first line
- Server components (layout, API routes) have no directive
- No `'use server'` actions detected — server logic lives in `app/api/` route handlers

---

*Convention analysis: 2026-03-22*
