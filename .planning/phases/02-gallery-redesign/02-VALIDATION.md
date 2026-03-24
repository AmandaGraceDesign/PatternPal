---
phase: 02
slug: gallery-redesign
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | GALL-01 | unit | `npm test` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | GALL-02 | manual-only | N/A — canvas rendering | N/A | ⬜ pending |
| 02-01-03 | 01 | 1 | GALL-03 | unit (existing) | `npm test` | ✅ | ⬜ pending |
| 02-01-04 | 01 | 1 | GALL-04 | manual-only | N/A — device/browser | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/galleryModal.test.ts` — covers GALL-01: category filtering logic
  - Test: given a category key, filtered templates return expected IDs
  - Test: "All" tab returns all 18 templates

*Existing `templateRegistry.test.ts` already covers GALL-03 (sizeLabel presence).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live pattern preview on each card | GALL-02 | Canvas rendering requires browser | Open gallery modal with uploaded pattern, verify each card shows tiled pattern |
| Touch targets 44px+, responsive layout | GALL-04 | Requires device/browser viewport | Test on iPhone Safari and iPad, verify all buttons are tappable, no horizontal scroll |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
