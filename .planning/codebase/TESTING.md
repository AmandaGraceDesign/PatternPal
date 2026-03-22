# Testing Patterns

**Analysis Date:** 2026-03-22

## Test Framework

**Runner:** None detected

No test framework is installed or configured. There is no `jest.config.*`, `vitest.config.*`, or any testing library in `package.json` (neither in `dependencies` nor `devDependencies`). No `*.test.*` or `*.spec.*` files exist in the repository.

**Test commands:** None defined in `package.json` scripts.

```json
"scripts": {
  "dev": "next dev --webpack",
  "build": "next build --webpack",
  "start": "next start",
  "lint": "eslint"
}
```

## Test File Organization

**Location:** No test files exist.

**Naming:** No established convention.

## Test Structure

Not applicable — no tests exist.

## Mocking

Not applicable — no test infrastructure.

## Fixtures and Factories

Not applicable — no test infrastructure.

## Coverage

**Requirements:** None enforced.

**Coverage tooling:** Not configured.

## Test Types

**Unit Tests:** Not present.

**Integration Tests:** Not present.

**E2E Tests:** Not present.

## Manual Testing Infrastructure

While automated testing is absent, there is evidence of manual/exploratory testing infrastructure:

**Debug pages:**
- `app/pattern-tester/page.tsx` — standalone pattern tester page
- `app/test-scaling/page.tsx` — dedicated scaling test page
- `app/seam-inspector/page.tsx` — standalone seam inspector

**Debug logging:**
- Heavy `console.log` usage in canvas and DPI analysis code (`src/components/canvas/PatternCanvas.tsx`, `src/lib/utils/imageUtils.ts`, `src/lib/analysis/seamAnalyzer.ts`) with emoji markers (`✓`, `❌`, `📄`, `🔍`) suggests runtime debugging is the primary validation approach.

**Test files directory:**
- A `test files/` directory exists at project root (note the space in name) — likely contains test image assets for manual verification.

## Recommendations for Adding Tests

Given the absence of any testing infrastructure, the following would need to be added before writing tests:

1. Install a test runner (Vitest is recommended for Next.js/TypeScript projects):
   ```bash
   npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
   ```

2. Create `vitest.config.ts` at project root.

3. Co-locate test files with source: `src/lib/utils/sanitizeFilename.test.ts` alongside `src/lib/utils/sanitizeFilename.ts`.

**Highest-value targets for first tests (pure functions with no browser dependencies):**
- `src/lib/utils/sanitizeFilename.ts` — pure function, security-relevant, easy to unit test
- `src/lib/utils/checkProStatus.ts` — pure function, gates Pro features
- `src/lib/auth.ts` — `checkProStatus` and `requireProUser` (would need Clerk mocking)
- `src/lib/analysis/patternAnalyzer.ts` — analysis scoring functions (would need canvas mock)

---

*Testing analysis: 2026-03-22*
