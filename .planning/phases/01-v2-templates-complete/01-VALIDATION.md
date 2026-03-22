---
phase: 1
slug: v2-templates-complete
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (to be installed in Wave 0) |
| **Config file** | vitest.config.ts (Wave 0 creates) |
| **Quick run command** | `npx vitest run src/__tests__/templateRegistry.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/__tests__/templateRegistry.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 0 | MOCK-02 | unit | `npx vitest run src/__tests__/templateRegistry.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | MOCK-02 | unit | `npx vitest run src/__tests__/templateRegistry.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 1 | MOCK-02 | unit | `npx vitest run src/__tests__/MockupPipeline.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | MOCK-01 | unit | `npx vitest run src/__tests__/templateRegistry.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 1 | MOCK-03 | unit | `npx vitest run src/__tests__/templateRegistry.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest` + `jsdom` installed — `npm install --save-dev vitest jsdom`
- [ ] `vitest.config.ts` — root config with jsdom environment for pipeline tests
- [ ] `package.json` — add `"test": "vitest run"` script
- [ ] `src/__tests__/templateRegistry.test.ts` — stubs for MOCK-01, MOCK-02 (zone fields), MOCK-03
- [ ] `src/__tests__/MockupPipeline.test.ts` — stubs for MOCK-02 (pipeline physicalWidth threading); requires jsdom

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Bodice vs skirt tiles are *visually* distinct sizes | MOCK-02 | Visual comparison of rendered canvas output | Render kids dress with a known pattern; bodice tiles should appear smaller than skirt tiles |
| Multiply blend looks correct on photo-based mockups | MOCK-01 | Subjective visual quality judgment | Compare V2 render against V1 render for each migrated template; lighting and color should match |
| sizeLabel reads naturally in gallery card | MOCK-03 | UX readability judgment | View gallery, confirm labels like "16x16" (40x40cm) Throw Pillow" are legible |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
